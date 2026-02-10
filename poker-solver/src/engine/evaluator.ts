// Fast poker hand evaluator using lookup tables
// Evaluates 5-7 card hands and returns a numeric rank (higher = better)

import { CardIndex, HandRank, RANKS } from './types';

// Rank prime encoding for fast lookup
const RANK_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]; // 2-A

// Pre-computed flush and unique5 lookup tables
let flushTable: Int32Array;
let uniqueTable: Int32Array;
let initialized = false;

function rankOf(card: CardIndex): number {
  return Math.floor(card / 4); // 0=2, 1=3, ..., 12=A
}

function suitOf(card: CardIndex): number {
  return card % 4; // 0=s, 1=h, 2=d, 3=c
}

// Convert rank to bit position
function rankBit(r: number): number {
  return 1 << r;
}

// Initialize lookup tables for 5-card evaluation
function initTables() {
  if (initialized) return;

  // We'll use a simplified but fast approach:
  // Encode hand as bit pattern and use lookup
  flushTable = new Int32Array(8192); // 2^13 possible rank bit patterns
  uniqueTable = new Int32Array(8192);

  // Generate all possible 5-card rank bit patterns
  // For straights (including A-5 wheel)
  const straights = [
    0b1111100000000, // T-A
    0b0111110000000, // 9-K
    0b0011111000000, // 8-Q
    0b0001111100000, // 7-J
    0b0000111110000, // 6-T
    0b0000011111000, // 5-9
    0b0000001111100, // 4-8
    0b0000000111110, // 3-7
    0b0000000011111, // 2-6
    0b1000000001111, // A-5 (wheel)
  ];

  // Fill flush table (5 unique ranks, flush)
  for (let bits = 0; bits < 8192; bits++) {
    if (popcount(bits) !== 5) continue;

    const straightIdx = straights.indexOf(bits);
    if (straightIdx >= 0) {
      // Straight flush
      flushTable[bits] = HandRank.STRAIGHT_FLUSH * 10000 + (9 - straightIdx) * 100;
    } else {
      // Regular flush - rank by high cards
      flushTable[bits] = HandRank.FLUSH * 10000 + bitsToRank(bits);
    }
  }

  // Fill unique5 table (5 unique ranks, not flush)
  for (let bits = 0; bits < 8192; bits++) {
    if (popcount(bits) !== 5) continue;

    const straightIdx = straights.indexOf(bits);
    if (straightIdx >= 0) {
      uniqueTable[bits] = HandRank.STRAIGHT * 10000 + (9 - straightIdx) * 100;
    } else {
      uniqueTable[bits] = HandRank.HIGH_CARD * 10000 + bitsToRank(bits);
    }
  }

  initialized = true;
}

function popcount(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

function bitsToRank(bits: number): number {
  // Convert bit pattern to a ranking value (higher bits = better)
  let rank = 0;
  let mult = 1;
  for (let i = 0; i < 13; i++) {
    if (bits & (1 << i)) {
      rank += i * mult;
      mult *= 14;
    }
  }
  return rank;
}

// Evaluate exactly 5 cards
function evaluate5(cards: CardIndex[]): number {
  initTables();

  const ranks = cards.map(c => rankOf(c));
  const suits = cards.map(c => suitOf(c));

  // Check for flush
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2] &&
                  suits[2] === suits[3] && suits[3] === suits[4];

  // Create bit pattern of ranks
  let rankBits = 0;
  for (const r of ranks) {
    rankBits |= (1 << r);
  }

  const uniqueRanks = popcount(rankBits);

  if (uniqueRanks === 5) {
    // All unique ranks - straight, flush, straight flush, or high card
    if (isFlush) return flushTable[rankBits];
    return uniqueTable[rankBits];
  }

  // Count rank occurrences
  const counts = new Array(13).fill(0);
  for (const r of ranks) counts[r]++;

  // Classify by count pattern
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];

  for (let r = 12; r >= 0; r--) {
    switch (counts[r]) {
      case 4: quads.push(r); break;
      case 3: trips.push(r); break;
      case 2: pairs.push(r); break;
      case 1: singles.push(r); break;
    }
  }

  if (quads.length === 1) {
    return HandRank.FOUR_OF_A_KIND * 10000 + quads[0] * 100 + singles[0];
  }
  if (trips.length === 1 && pairs.length === 1) {
    return HandRank.FULL_HOUSE * 10000 + trips[0] * 100 + pairs[0];
  }
  if (trips.length === 1) {
    return HandRank.THREE_OF_A_KIND * 10000 + trips[0] * 100 + singles[0] * 14 + singles[1];
  }
  if (pairs.length === 2) {
    const highPair = Math.max(pairs[0], pairs[1]);
    const lowPair = Math.min(pairs[0], pairs[1]);
    return HandRank.TWO_PAIR * 10000 + highPair * 200 + lowPair * 14 + singles[0];
  }
  if (pairs.length === 1) {
    return HandRank.PAIR * 10000 + pairs[0] * 300 + singles[0] * 20 + singles[1] * 14 + singles[2];
  }

  // Should not reach here with 5 cards
  return 0;
}

// Evaluate 7 cards (Texas Hold'em - pick best 5 of 7)
export function evaluate7(cards: CardIndex[]): number {
  initTables();

  let best = 0;

  // C(7,5) = 21 combinations
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      // Skip cards i and j
      const hand5: CardIndex[] = [];
      for (let k = 0; k < 7; k++) {
        if (k !== i && k !== j) hand5.push(cards[k]);
      }
      const score = evaluate5(hand5);
      if (score > best) best = score;
    }
  }

  return best;
}

// Evaluate 5 or 6 cards
export function evaluateHand(cards: CardIndex[]): number {
  if (cards.length === 5) return evaluate5(cards);
  if (cards.length === 6) {
    let best = 0;
    for (let skip = 0; skip < 6; skip++) {
      const hand5 = cards.filter((_, i) => i !== skip);
      const score = evaluate5(hand5);
      if (score > best) best = score;
    }
    return best;
  }
  if (cards.length === 7) return evaluate7(cards);
  return 0;
}

// Get hand rank category from evaluation score
export function getHandRank(score: number): HandRank {
  return Math.floor(score / 10000) as HandRank;
}

// Get human-readable hand description
export function describeHand(score: number): string {
  const rank = getHandRank(score);
  const names = [
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  return names[rank] || 'Unknown';
}

// Compare two hands: >0 means hand1 wins, <0 means hand2 wins, 0 = tie
export function compareHands(hand1: CardIndex[], hand2: CardIndex[], board: CardIndex[]): number {
  const score1 = evaluateHand([...hand1, ...board]);
  const score2 = evaluateHand([...hand2, ...board]);
  return score1 - score2;
}

// Initialize on module load
initTables();
