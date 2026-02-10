// Monte Carlo equity calculator
// Computes hand equity against a range through random sampling

import { CardIndex, Street } from './types';
import { evaluate7, evaluateHand } from './evaluator';
import { ALL_COMBOS, filterBlockedCombos } from './ranges';

// Fisher-Yates shuffle for deck
function shuffleDeck(deck: CardIndex[], rng: () => number): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Simple PRNG (xorshift32) for reproducibility
function createRNG(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

// Calculate equity of a specific hand against a range
export function calculateEquityVsRange(
  hand: [CardIndex, CardIndex],
  villainRange: number[],
  board: CardIndex[],
  numSimulations: number = 10000,
  seed: number = 42
): { equity: number; wins: number; ties: number; losses: number; samples: number } {
  const rng = createRNG(seed);
  const usedCards = new Set([hand[0], hand[1], ...board]);

  // Filter villain combos that don't conflict with hero hand or board
  const validVillainCombos: { card1: CardIndex; card2: CardIndex; weight: number }[] = [];
  let totalWeight = 0;

  for (let i = 0; i < ALL_COMBOS.length; i++) {
    if (villainRange[i] <= 0) continue;
    const combo = ALL_COMBOS[i];
    if (usedCards.has(combo.card1) || usedCards.has(combo.card2)) continue;
    validVillainCombos.push({ card1: combo.card1, card2: combo.card2, weight: villainRange[i] });
    totalWeight += villainRange[i];
  }

  if (validVillainCombos.length === 0 || totalWeight === 0) {
    return { equity: 0.5, wins: 0, ties: 0, losses: 0, samples: 0 };
  }

  // Build cumulative weight array for weighted sampling
  const cumWeights: number[] = [];
  let cumSum = 0;
  for (const vc of validVillainCombos) {
    cumSum += vc.weight;
    cumWeights.push(cumSum);
  }

  const cardsNeeded = 5 - board.length;
  let wins = 0, ties = 0, losses = 0, samples = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    // Sample a villain hand weighted by range
    const r = rng() * totalWeight;
    let villainIdx = 0;
    for (let i = 0; i < cumWeights.length; i++) {
      if (cumWeights[i] >= r) { villainIdx = i; break; }
    }
    const villain = validVillainCombos[villainIdx];

    // Build remaining deck
    const blocked = new Set([hand[0], hand[1], villain.card1, villain.card2, ...board]);
    const remainingDeck: CardIndex[] = [];
    for (let c = 0; c < 52; c++) {
      if (!blocked.has(c)) remainingDeck.push(c);
    }

    // Deal remaining community cards
    shuffleDeck(remainingDeck, rng);
    const fullBoard = [...board, ...remainingDeck.slice(0, cardsNeeded)];

    // Evaluate both hands
    const heroScore = evaluateHand([hand[0], hand[1], ...fullBoard]);
    const villainScore = evaluateHand([villain.card1, villain.card2, ...fullBoard]);

    if (heroScore > villainScore) wins++;
    else if (heroScore === villainScore) ties++;
    else losses++;
    samples++;
  }

  const equity = (wins + ties * 0.5) / samples;
  return { equity, wins, ties, losses, samples };
}

// Calculate equity of entire range vs range (returns equity for each combo)
export function calculateRangeVsRange(
  range1: number[],
  range2: number[],
  board: CardIndex[],
  numSimulations: number = 5000,
  seed: number = 42
): Float32Array {
  const equities = new Float32Array(1326);
  const rng = createRNG(seed);

  for (let i = 0; i < ALL_COMBOS.length; i++) {
    if (range1[i] <= 0) {
      equities[i] = 0;
      continue;
    }

    const combo = ALL_COMBOS[i];
    // Check board conflict
    if (board.includes(combo.card1) || board.includes(combo.card2)) {
      equities[i] = 0;
      continue;
    }

    const result = calculateEquityVsRange(
      [combo.card1, combo.card2],
      range2,
      board,
      Math.min(numSimulations, 2000),
      seed + i
    );
    equities[i] = result.equity;
  }

  return equities;
}

// Calculate pot odds needed to call
export function potOdds(potSize: number, callAmount: number): number {
  return callAmount / (potSize + callAmount);
}

// Calculate minimum defense frequency (MDF) to prevent profitable bluffs
export function minDefenseFrequency(betSize: number, potSize: number): number {
  return potSize / (potSize + betSize);
}

// Calculate optimal bluff frequency for a given bet size
// Based on Janda: bluffs / (value + bluffs) = betSize / (potSize + betSize)
export function optimalBluffFrequency(betSize: number, potSize: number): number {
  return betSize / (potSize + betSize);
}

// Calculate value-to-bluff ratio for making opponent indifferent
export function valueToBluffRatio(betSize: number, potSize: number): number {
  // If we bet B into pot P, opponent risks B to win P+B
  // Needs to win B/(P+2B) of the time
  // So our range should be: value / (value + bluffs) = (P+B) / (P+2B)
  return (potSize + betSize) / betSize;
}

// Alpha: probability our bluff needs to work to be profitable
export function bluffBreakevenFrequency(betSize: number, potSize: number): number {
  return betSize / (potSize + betSize);
}

// Calculate EV of a bet
export function betEV(
  foldEquity: number,
  potSize: number,
  betSize: number,
  equityWhenCalled: number
): number {
  const evWhenFold = potSize;
  const evWhenCall = (potSize + 2 * betSize) * equityWhenCalled - betSize;
  return foldEquity * evWhenFold + (1 - foldEquity) * evWhenCall;
}

// Board texture analysis
export function analyzeBoardTexture(board: CardIndex[]): {
  isPaired: boolean;
  isMonotone: boolean;
  isTwoTone: boolean;
  isRainbow: boolean;
  connectivity: number;
  flushDrawPossible: boolean;
  straightDrawPossible: boolean;
} {
  if (board.length < 3) {
    return {
      isPaired: false, isMonotone: false, isTwoTone: false, isRainbow: false,
      connectivity: 0, flushDrawPossible: false, straightDrawPossible: false,
    };
  }

  const ranks = board.map(c => Math.floor(c / 4));
  const suits = board.map(c => c % 4);

  // Check paired
  const rankCounts = new Map<number, number>();
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  const isPaired = Array.from(rankCounts.values()).some(c => c >= 2);

  // Check suit distribution
  const suitCounts = new Map<number, number>();
  for (const s of suits) suitCounts.set(s, (suitCounts.get(s) || 0) + 1);
  const maxSuitCount = Math.max(...suitCounts.values());
  const isMonotone = maxSuitCount >= 3;
  const isTwoTone = maxSuitCount === 2 && !isMonotone;
  const isRainbow = maxSuitCount === 1 || (board.length === 3 && suitCounts.size === 3);
  const flushDrawPossible = maxSuitCount >= 2;

  // Check connectivity (how close ranks are)
  const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
  let maxGap = 0;
  let connections = 0;
  for (let i = 1; i < sortedRanks.length; i++) {
    const gap = sortedRanks[i] - sortedRanks[i - 1];
    maxGap = Math.max(maxGap, gap);
    if (gap <= 2) connections++;
  }
  const connectivity = sortedRanks.length > 1 ? connections / (sortedRanks.length - 1) : 0;

  // Check straight draw possibility
  const straightDrawPossible = sortedRanks.length >= 2 &&
    (sortedRanks[sortedRanks.length - 1] - sortedRanks[0] <= 4 || sortedRanks.includes(12)); // Ace can be low

  return {
    isPaired,
    isMonotone,
    isTwoTone,
    isRainbow,
    connectivity,
    flushDrawPossible,
    straightDrawPossible,
  };
}
