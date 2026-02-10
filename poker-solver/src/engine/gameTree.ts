// Game tree construction for the poker solver
// Builds the decision tree based on allowed actions and bet sizes

import { ActionType, Action, Street, GameTreeNode, SolverConfig } from './types';

let nextNodeId = 0;

function createNode(
  street: Street,
  pot: number,
  player: number,
  isTerminal: boolean = false,
  isChance: boolean = false,
): GameTreeNode {
  return {
    id: nextNodeId++,
    street,
    pot,
    player,
    actions: [],
    children: new Map(),
    isTerminal,
    isChance,
  };
}

// Build the full game tree for a given configuration
export function buildGameTree(config: SolverConfig): {
  root: GameTreeNode;
  nodeCount: number;
  terminalCount: number;
} {
  nextNodeId = 0;
  let terminalCount = 0;

  const root = buildStreetTree(
    config.street,
    config.potSize,
    0, // first player to act
    config.stackDepth - config.potSize / 2, // effective stack remaining
    config.stackDepth - config.potSize / 2,
    config.betSizes,
    config.raiseSizes,
    0,   // current bet to call
    false, // has bet this street
    config,
  );

  return { root, nodeCount: nextNodeId, terminalCount };
}

function buildStreetTree(
  street: Street,
  pot: number,
  actingPlayer: number,
  stack0: number,   // player 0 remaining stack
  stack1: number,   // player 1 remaining stack
  betSizes: number[][],
  raiseSizes: number[][],
  betToCall: number,
  hasBet: boolean,
  config: SolverConfig,
  depth: number = 0,
  lastAction?: ActionType,
  consecutiveChecks: number = 0,
): GameTreeNode {
  const maxDepth = 20;
  if (depth > maxDepth) {
    return createNode(street, pot, actingPlayer, true);
  }

  const activeStack = actingPlayer === 0 ? stack0 : stack1;
  const node = createNode(street, pot, actingPlayer);

  // Terminal conditions
  if (lastAction === ActionType.FOLD) {
    node.isTerminal = true;
    return node;
  }

  // Both players checked or call after bet => go to next street or showdown
  if (lastAction === ActionType.CALL && hasBet) {
    if (street === Street.RIVER) {
      node.isTerminal = true;
      return node;
    }
    // Advance to next street
    return buildNextStreet(street, pot, stack0, stack1, betSizes, raiseSizes, config, depth);
  }

  if (consecutiveChecks >= 2) {
    if (street === Street.RIVER) {
      node.isTerminal = true;
      return node;
    }
    return buildNextStreet(street, pot, stack0, stack1, betSizes, raiseSizes, config, depth);
  }

  // Generate available actions
  const actions: Action[] = [];

  if (betToCall > 0) {
    // Facing a bet: fold, call, raise
    actions.push({ type: ActionType.FOLD, amount: 0 });
    actions.push({ type: ActionType.CALL, amount: Math.min(betToCall, activeStack) });

    // Raise options
    if (activeStack > betToCall) {
      const streetIdx = Math.min(street, 3);
      const sizes = raiseSizes[streetIdx] || [1];

      for (const size of sizes) {
        const raiseAmount = Math.min(
          betToCall + pot * size,
          activeStack
        );
        if (raiseAmount > betToCall) {
          actions.push({
            type: raiseAmount >= activeStack ? ActionType.ALL_IN : ActionType.RAISE,
            amount: raiseAmount,
          });
        }
      }

      // All-in option if not already covered
      if (!actions.some(a => a.type === ActionType.ALL_IN)) {
        actions.push({ type: ActionType.ALL_IN, amount: activeStack });
      }
    }
  } else {
    // No bet to call: check or bet
    actions.push({ type: ActionType.CHECK, amount: 0 });

    if (activeStack > 0) {
      const streetIdx = Math.min(street, 3);
      const sizes = betSizes[streetIdx] || [0.5, 0.75, 1];

      for (const size of sizes) {
        const betAmount = Math.min(pot * size, activeStack);
        if (betAmount > 0) {
          actions.push({
            type: betAmount >= activeStack ? ActionType.ALL_IN : ActionType.BET,
            amount: betAmount,
          });
        }
      }

      // All-in option
      if (!actions.some(a => a.type === ActionType.ALL_IN) && activeStack > 0) {
        actions.push({ type: ActionType.ALL_IN, amount: activeStack });
      }
    }
  }

  // Deduplicate actions by type+amount
  const seen = new Set<string>();
  const uniqueActions: Action[] = [];
  for (const action of actions) {
    const key = `${action.type}_${Math.round(action.amount * 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueActions.push(action);
    }
  }

  node.actions = uniqueActions;

  // Build children
  for (const action of uniqueActions) {
    const nextPlayer = 1 - actingPlayer;
    let newStack0 = stack0;
    let newStack1 = stack1;
    let newPot = pot;
    let newBetToCall = 0;
    let newHasBet = hasBet;
    let newConsChecks = consecutiveChecks;

    switch (action.type) {
      case ActionType.FOLD:
        node.children.set(actionKey(action), createNode(street, pot, nextPlayer, true));
        continue;

      case ActionType.CHECK:
        newConsChecks++;
        break;

      case ActionType.CALL:
        if (actingPlayer === 0) newStack0 -= action.amount;
        else newStack1 -= action.amount;
        newPot += action.amount;
        newBetToCall = 0;
        newConsChecks = 0;
        break;

      case ActionType.BET:
      case ActionType.RAISE:
      case ActionType.ALL_IN:
        if (actingPlayer === 0) newStack0 -= action.amount;
        else newStack1 -= action.amount;
        newPot += action.amount;
        newBetToCall = action.amount - betToCall;
        newHasBet = true;
        newConsChecks = 0;
        break;
    }

    const child = buildStreetTree(
      street,
      newPot,
      nextPlayer,
      newStack0,
      newStack1,
      betSizes,
      raiseSizes,
      newBetToCall,
      newHasBet,
      config,
      depth + 1,
      action.type,
      newConsChecks,
    );

    node.children.set(actionKey(action), child);
  }

  return node;
}

function buildNextStreet(
  currentStreet: Street,
  pot: number,
  stack0: number,
  stack1: number,
  betSizes: number[][],
  raiseSizes: number[][],
  config: SolverConfig,
  depth: number,
): GameTreeNode {
  const nextStreet = (currentStreet + 1) as Street;

  if (nextStreet > Street.RIVER) {
    return createNode(currentStreet, pot, 0, true);
  }

  // Chance node for dealing next card
  const chanceNode = createNode(nextStreet, pot, 0, false, true);

  // Continue with action tree on new street (OOP acts first)
  const actionNode = buildStreetTree(
    nextStreet,
    pot,
    0, // OOP acts first
    stack0,
    stack1,
    betSizes,
    raiseSizes,
    0,
    false,
    config,
    depth + 1,
  );

  // For the solver, we'll treat the chance node as directly leading to actions
  // The actual card dealing is handled by the solver
  chanceNode.actions = actionNode.actions;
  chanceNode.children = actionNode.children;
  chanceNode.player = actionNode.player;
  chanceNode.isChance = false;

  return actionNode;
}

export function actionKey(action: Action): string {
  if (action.type === ActionType.CHECK || action.type === ActionType.FOLD) {
    return action.type;
  }
  return `${action.type}_${Math.round(action.amount * 10) / 10}`;
}

// Count total nodes in tree
export function countNodes(node: GameTreeNode): number {
  let count = 1;
  for (const child of node.children.values()) {
    count += countNodes(child);
  }
  return count;
}

// Get tree depth
export function getTreeDepth(node: GameTreeNode): number {
  if (node.children.size === 0) return 0;
  let maxChildDepth = 0;
  for (const child of node.children.values()) {
    maxChildDepth = Math.max(maxChildDepth, getTreeDepth(child));
  }
  return 1 + maxChildDepth;
}
