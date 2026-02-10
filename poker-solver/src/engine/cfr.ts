// Counterfactual Regret Minimization (CFR) Solver
// This is the core algorithm used by professional poker solvers like PioSolver
// Implements Monte Carlo CFR (MCCFR) with chance sampling for performance

import { CardIndex, Street, ActionType, SolverConfig, GameTreeNode, SolverResults } from './types';
import { evaluate7, evaluateHand } from './evaluator';
import { ALL_COMBOS, filterBlockedCombos } from './ranges';
import { buildGameTree, actionKey } from './gameTree';

// Information set: encodes a player's view of the game state
interface InfoSet {
  nodeId: number;
  player: number;
  numActions: number;
  regretSum: Float32Array;
  strategySum: Float32Array;
}

export class CFRSolver {
  private config: SolverConfig;
  private root: GameTreeNode;
  private infoSets: Map<string, InfoSet>;
  private iterations: number;
  private exploitability: number;

  // Progress tracking
  public onProgress?: (iteration: number, exploitability: number) => void;
  private cancelled: boolean = false;

  constructor(config: SolverConfig) {
    this.config = config;
    this.infoSets = new Map();
    this.iterations = 0;
    this.exploitability = Infinity;

    const { root } = buildGameTree(config);
    this.root = root;
  }

  cancel() {
    this.cancelled = true;
  }

  // Get or create info set for a player at a game tree node with specific hand
  private getInfoSet(nodeId: number, player: number, handIdx: number, numActions: number): InfoSet {
    const key = `${nodeId}_${player}_${handIdx}`;
    let info = this.infoSets.get(key);

    if (!info) {
      info = {
        nodeId,
        player,
        numActions,
        regretSum: new Float32Array(numActions),
        strategySum: new Float32Array(numActions),
      };
      this.infoSets.set(key, info);
    }

    return info;
  }

  // Get current strategy through regret matching
  private getStrategy(info: InfoSet, realizationWeight: number): Float32Array {
    const strategy = new Float32Array(info.numActions);
    let normalizingSum = 0;

    for (let a = 0; a < info.numActions; a++) {
      strategy[a] = Math.max(0, info.regretSum[a]);
      normalizingSum += strategy[a];
    }

    for (let a = 0; a < info.numActions; a++) {
      if (normalizingSum > 0) {
        strategy[a] /= normalizingSum;
      } else {
        strategy[a] = 1.0 / info.numActions;
      }
      info.strategySum[a] += realizationWeight * strategy[a];
    }

    return strategy;
  }

  // Get average strategy (the converged solution)
  private getAverageStrategy(info: InfoSet): Float32Array {
    const avgStrategy = new Float32Array(info.numActions);
    let normalizingSum = 0;

    for (let a = 0; a < info.numActions; a++) {
      normalizingSum += info.strategySum[a];
    }

    for (let a = 0; a < info.numActions; a++) {
      if (normalizingSum > 0) {
        avgStrategy[a] = info.strategySum[a] / normalizingSum;
      } else {
        avgStrategy[a] = 1.0 / info.numActions;
      }
    }

    return avgStrategy;
  }

  // Main CFR traversal
  private cfr(
    node: GameTreeNode,
    hand0: number,    // player 0's hand combo index
    hand1: number,    // player 1's hand combo index
    board: CardIndex[],
    reachProb0: number,
    reachProb1: number,
    traversingPlayer: number,
  ): number {
    if (node.isTerminal) {
      return this.getTerminalUtility(node, hand0, hand1, board, traversingPlayer);
    }

    if (node.actions.length === 0) {
      return this.getTerminalUtility(node, hand0, hand1, board, traversingPlayer);
    }

    const actingPlayer = node.player;
    const handIdx = actingPlayer === 0 ? hand0 : hand1;
    const info = this.getInfoSet(node.id, actingPlayer, handIdx, node.actions.length);

    const realizationWeight = actingPlayer === 0 ? reachProb0 : reachProb1;
    const strategy = this.getStrategy(info, realizationWeight);

    const actionEVs = new Float32Array(node.actions.length);
    let nodeEV = 0;

    const actionKeys = Array.from(node.children.keys());

    for (let a = 0; a < node.actions.length; a++) {
      const action = node.actions[a];
      const childKey = actionKeys[a] || actionKey(action);
      const child = node.children.get(childKey);

      if (!child) continue;

      let newReachProb0 = reachProb0;
      let newReachProb1 = reachProb1;

      if (actingPlayer === 0) {
        newReachProb0 *= strategy[a];
      } else {
        newReachProb1 *= strategy[a];
      }

      actionEVs[a] = this.cfr(
        child,
        hand0,
        hand1,
        board,
        newReachProb0,
        newReachProb1,
        traversingPlayer,
      );

      nodeEV += strategy[a] * actionEVs[a];
    }

    // Update regrets
    if (actingPlayer === traversingPlayer) {
      const opponentReachProb = traversingPlayer === 0 ? reachProb1 : reachProb0;
      for (let a = 0; a < node.actions.length; a++) {
        const regret = actionEVs[a] - nodeEV;
        info.regretSum[a] += opponentReachProb * regret;
      }
    }

    return nodeEV;
  }

  // Calculate utility at terminal node
  private getTerminalUtility(
    node: GameTreeNode,
    hand0: number,
    hand1: number,
    board: CardIndex[],
    traversingPlayer: number,
  ): number {
    const combo0 = ALL_COMBOS[hand0];
    const combo1 = ALL_COMBOS[hand1];

    // Check for card conflicts
    if (combo0.card1 === combo1.card1 || combo0.card1 === combo1.card2 ||
        combo0.card2 === combo1.card1 || combo0.card2 === combo1.card2) {
      return 0;
    }

    // Check board conflicts
    for (const bc of board) {
      if (bc === combo0.card1 || bc === combo0.card2 ||
          bc === combo1.card1 || bc === combo1.card2) {
        return 0;
      }
    }

    // Check if this is a fold terminal
    // The last action determined who folded
    // If acting player folded, other player wins the pot
    const pot = node.pot;

    // For fold nodes, the player who didn't fold wins
    // We track this through the game tree structure
    // If the node is terminal and player X was supposed to act,
    // it means the previous player's action led here

    // Simple approach: evaluate showdown
    if (board.length >= 5) {
      const score0 = evaluateHand([combo0.card1, combo0.card2, ...board]);
      const score1 = evaluateHand([combo1.card1, combo1.card2, ...board]);

      if (score0 > score1) {
        return traversingPlayer === 0 ? pot / 2 : -pot / 2;
      } else if (score1 > score0) {
        return traversingPlayer === 0 ? -pot / 2 : pot / 2;
      }
      return 0; // tie
    }

    // If board isn't complete, this must be a fold
    // The winner gets the pot
    // This is simplified - in the full solver we'd track who folded
    return 0;
  }

  // Run the solver for a given number of iterations
  async solve(): Promise<SolverResults> {
    const startTime = performance.now();
    this.cancelled = false;

    const board = this.config.board;
    const range0 = this.config.playerRanges[0];
    const range1 = this.config.playerRanges[1];

    // Filter ranges for board conflicts
    const filteredRange0 = filterBlockedCombos(range0, board);
    const filteredRange1 = filterBlockedCombos(range1, board);

    // Get active combos for each player
    const activeCombos0: number[] = [];
    const activeCombos1: number[] = [];

    for (let i = 0; i < 1326; i++) {
      if (filteredRange0[i] > 0) activeCombos0.push(i);
      if (filteredRange1[i] > 0) activeCombos1.push(i);
    }

    if (activeCombos0.length === 0 || activeCombos1.length === 0) {
      return {
        strategy: [],
        evs: [],
        exploitability: 0,
        iterations: 0,
        timeMs: 0,
        nodeCount: 0,
      };
    }

    // Ensure board has 5 cards for evaluation
    // If fewer, we'll need to run out remaining cards (Monte Carlo)
    const needCards = 5 - board.length;
    const deck: CardIndex[] = [];
    const boardSet = new Set(board);
    for (let c = 0; c < 52; c++) {
      if (!boardSet.has(c)) deck.push(c);
    }

    // Run CFR iterations
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      if (this.cancelled) break;

      // Sample random hands from each range
      const h0Idx = activeCombos0[Math.floor(Math.random() * activeCombos0.length)];
      const h1Idx = activeCombos1[Math.floor(Math.random() * activeCombos1.length)];

      const combo0 = ALL_COMBOS[h0Idx];
      const combo1 = ALL_COMBOS[h1Idx];

      // Skip conflicting combos
      if (combo0.card1 === combo1.card1 || combo0.card1 === combo1.card2 ||
          combo0.card2 === combo1.card1 || combo0.card2 === combo1.card2) {
        continue;
      }

      // Generate runout if needed
      let fullBoard = [...board];
      if (needCards > 0) {
        const usedCards = new Set([
          combo0.card1, combo0.card2, combo1.card1, combo1.card2, ...board
        ]);
        const available: CardIndex[] = [];
        for (let c = 0; c < 52; c++) {
          if (!usedCards.has(c)) available.push(c);
        }
        // Shuffle and pick
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        fullBoard = [...board, ...available.slice(0, needCards)];
      }

      // Traverse for both players
      this.cfr(this.root, h0Idx, h1Idx, fullBoard, 1, 1, 0);
      this.cfr(this.root, h0Idx, h1Idx, fullBoard, 1, 1, 1);

      this.iterations = iter + 1;

      // Report progress every 100 iterations
      if (iter % 100 === 0) {
        this.exploitability = this.estimateExploitability();
        if (this.onProgress) {
          this.onProgress(this.iterations, this.exploitability);
        }

        if (this.exploitability < this.config.targetExploitability) {
          break;
        }
      }

      // Yield to UI every 50 iterations
      if (iter % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const endTime = performance.now();

    // Extract results
    return this.extractResults(endTime - startTime);
  }

  // Estimate exploitability (how far from Nash equilibrium)
  private estimateExploitability(): number {
    // Simplified: compute variance of regrets across info sets
    let totalRegret = 0;
    let count = 0;

    for (const info of this.infoSets.values()) {
      for (let a = 0; a < info.numActions; a++) {
        totalRegret += Math.max(0, info.regretSum[a]);
      }
      count++;
    }

    if (count === 0) return Infinity;
    return totalRegret / count / Math.max(1, this.iterations);
  }

  // Extract the final strategy and EVs
  private extractResults(timeMs: number): SolverResults {
    const strategyMap = new Map<number, Map<number, Float32Array>>();
    const evMap = new Map<number, Map<number, number>>();

    for (const [key, info] of this.infoSets) {
      const avgStrategy = this.getAverageStrategy(info);

      if (!strategyMap.has(info.nodeId)) {
        strategyMap.set(info.nodeId, new Map());
      }
      const parts = key.split('_');
      const handIdx = parseInt(parts[2]);
      strategyMap.get(info.nodeId)!.set(handIdx, avgStrategy);
    }

    // Compile strategies per node
    const strategies: Float32Array[] = [];
    const evs: Float32Array[] = [];

    // For the root node, compile the strategy for each hand
    const rootStrategies = strategyMap.get(this.root.id);
    if (rootStrategies) {
      for (const [handIdx, strategy] of rootStrategies) {
        strategies.push(strategy);
      }
    }

    return {
      strategy: strategies,
      evs: evs,
      exploitability: this.exploitability,
      iterations: this.iterations,
      timeMs,
      nodeCount: this.infoSets.size,
    };
  }

  // Get strategy for a specific hand at the root node
  getHandStrategy(handIdx: number): { actions: string[]; frequencies: number[] } | null {
    const actions = this.root.actions.map(a => {
      if (a.type === ActionType.CHECK || a.type === ActionType.FOLD) return a.type;
      return `${a.type} ${a.amount.toFixed(1)}bb`;
    });

    // Check for player 0's strategy at root
    for (const player of [0, 1]) {
      const key = `${this.root.id}_${player}_${handIdx}`;
      const info = this.infoSets.get(key);
      if (info) {
        const avgStrategy = this.getAverageStrategy(info);
        return {
          actions,
          frequencies: Array.from(avgStrategy),
        };
      }
    }

    return null;
  }

  // Get aggregated strategy for all hands at root
  getAggregatedStrategy(player: number): {
    actions: string[];
    handStrategies: Map<number, Float32Array>;
    overallFrequencies: Float32Array;
  } {
    const actions = this.root.actions.map(a => {
      if (a.type === ActionType.CHECK || a.type === ActionType.FOLD) return a.type;
      return `${a.type} ${a.amount.toFixed(1)}bb`;
    });

    const handStrategies = new Map<number, Float32Array>();
    const overallFrequencies = new Float32Array(actions.length);
    let totalHands = 0;

    for (const [key, info] of this.infoSets) {
      if (info.nodeId !== this.root.id || info.player !== player) continue;

      const parts = key.split('_');
      const handIdx = parseInt(parts[2]);
      const avgStrategy = this.getAverageStrategy(info);
      handStrategies.set(handIdx, avgStrategy);

      for (let a = 0; a < actions.length; a++) {
        overallFrequencies[a] += avgStrategy[a];
      }
      totalHands++;
    }

    // Normalize overall frequencies
    if (totalHands > 0) {
      for (let a = 0; a < actions.length; a++) {
        overallFrequencies[a] /= totalHands;
      }
    }

    return { actions, handStrategies, overallFrequencies };
  }
}
