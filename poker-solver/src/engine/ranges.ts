// Hand range representation and manipulation
// A range is a set of hole card combinations with frequencies

import { CardIndex, HandCombo, RANKS, SUITS, RangeGrid, Position, cardToIndex, indexToCard } from './types';

// All 1326 possible hole card combinations
export const ALL_COMBOS: HandCombo[] = [];

// Map from combo string (e.g., "AKs") to list of specific combos
export const HAND_GROUP_MAP: Map<string, number[]> = new Map();

// 13x13 grid labels (rows = first card, cols = second card)
// Upper triangle = suited, lower triangle = offsuit, diagonal = pairs
export const GRID_LABELS: string[][] = [];

// Initialize all combos
function initCombos() {
  if (ALL_COMBOS.length > 0) return;

  let idx = 0;
  for (let c1 = 0; c1 < 52; c1++) {
    for (let c2 = c1 + 1; c2 < 52; c2++) {
      const card1 = indexToCard(c1);
      const card2 = indexToCard(c2);
      const r1 = RANKS.indexOf(card1.rank);
      const r2 = RANKS.indexOf(card2.rank);
      const isSuited = card1.suit === card2.suit;
      const isPair = card1.rank === card2.rank;

      let label: string;
      if (isPair) {
        label = `${card1.rank}${card2.rank}`;
      } else if (r1 > r2) {
        label = `${card1.rank}${card2.rank}${isSuited ? 's' : 'o'}`;
      } else {
        label = `${card2.rank}${card1.rank}${isSuited ? 's' : 'o'}`;
      }

      ALL_COMBOS.push({
        card1: c1,
        card2: c2,
        index: idx,
        label,
        isSuited,
        isPair,
      });

      // Add to group map
      const groupKey = label;
      if (!HAND_GROUP_MAP.has(groupKey)) {
        HAND_GROUP_MAP.set(groupKey, []);
      }
      HAND_GROUP_MAP.get(groupKey)!.push(idx);

      idx++;
    }
  }

  // Build grid labels
  for (let r = 12; r >= 0; r--) {
    const row: string[] = [];
    for (let c = 12; c >= 0; c--) {
      if (r === c) {
        row.push(`${RANKS[r]}${RANKS[c]}`);
      } else if (r > c) {
        row.push(`${RANKS[r]}${RANKS[c]}s`);
      } else {
        row.push(`${RANKS[c]}${RANKS[r]}o`);
      }
    }
    GRID_LABELS.push(row);
  }
}

initCombos();

// Convert a grid of frequencies to a flat array of 1326 combo weights
export function gridToRange(grid: RangeGrid): number[] {
  const weights = new Array(1326).fill(0);

  for (let i = 0; i < ALL_COMBOS.length; i++) {
    const combo = ALL_COMBOS[i];
    const card1 = indexToCard(combo.card1);
    const card2 = indexToCard(combo.card2);
    const r1 = RANKS.indexOf(card1.rank);
    const r2 = RANKS.indexOf(card2.rank);

    let gridRow: number, gridCol: number;
    if (combo.isPair) {
      gridRow = 12 - r1;
      gridCol = 12 - r1;
    } else if (combo.isSuited) {
      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);
      gridRow = 12 - highR;
      gridCol = 12 - lowR;
    } else {
      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);
      gridRow = 12 - lowR;
      gridCol = 12 - highR;
    }

    weights[i] = grid[gridRow]?.[gridCol] ?? 0;
  }

  return weights;
}

// Convert flat range weights to grid
export function rangeToGrid(weights: number[]): RangeGrid {
  const grid: RangeGrid = Array.from({ length: 13 }, () => new Array(13).fill(0));

  for (let i = 0; i < ALL_COMBOS.length; i++) {
    if (weights[i] === 0) continue;
    const combo = ALL_COMBOS[i];
    const card1 = indexToCard(combo.card1);
    const card2 = indexToCard(combo.card2);
    const r1 = RANKS.indexOf(card1.rank);
    const r2 = RANKS.indexOf(card2.rank);

    let gridRow: number, gridCol: number;
    if (combo.isPair) {
      gridRow = 12 - r1;
      gridCol = 12 - r1;
    } else if (combo.isSuited) {
      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);
      gridRow = 12 - highR;
      gridCol = 12 - lowR;
    } else {
      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);
      gridRow = 12 - lowR;
      gridCol = 12 - highR;
    }

    // Average the weights for this grid cell
    grid[gridRow][gridCol] = Math.max(grid[gridRow][gridCol], weights[i]);
  }

  return grid;
}

// Parse a range string like "AA,KK,QQ,AKs,AQs,AJo+" into weights
export function parseRange(rangeStr: string): number[] {
  const weights = new Array(1326).fill(0);
  if (!rangeStr.trim()) return weights;

  const parts = rangeStr.split(',').map(s => s.trim());

  for (const part of parts) {
    if (!part) continue;

    const hasPlus = part.endsWith('+');
    const base = hasPlus ? part.slice(0, -1) : part;

    if (base.length === 2 && base[0] === base[1]) {
      // Pair: "TT" or "TT+"
      const rankIdx = RANKS.indexOf(base[0] as typeof RANKS[number]);
      if (rankIdx < 0) continue;

      const startRank = rankIdx;
      const endRank = hasPlus ? 12 : rankIdx;

      for (let r = startRank; r <= endRank; r++) {
        const label = `${RANKS[r]}${RANKS[r]}`;
        const combos = HAND_GROUP_MAP.get(label);
        if (combos) {
          for (const ci of combos) weights[ci] = 1;
        }
      }
    } else if (base.length === 3) {
      // Suited or offsuit: "AKs" or "AKo" or "AKs+"
      const r1 = RANKS.indexOf(base[0] as typeof RANKS[number]);
      const r2 = RANKS.indexOf(base[1] as typeof RANKS[number]);
      const suited = base[2] === 's';

      if (r1 < 0 || r2 < 0) continue;

      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);

      if (hasPlus) {
        // ATs+ means ATs, AJs, AQs, AKs
        for (let r = lowR; r < highR; r++) {
          const label = `${RANKS[highR]}${RANKS[r]}${suited ? 's' : 'o'}`;
          const combos = HAND_GROUP_MAP.get(label);
          if (combos) {
            for (const ci of combos) weights[ci] = 1;
          }
        }
      } else {
        const label = `${RANKS[highR]}${RANKS[lowR]}${suited ? 's' : 'o'}`;
        const combos = HAND_GROUP_MAP.get(label);
        if (combos) {
          for (const ci of combos) weights[ci] = 1;
        }
      }
    } else if (base.length === 2) {
      // Both suited and offsuit: "AK"
      const r1 = RANKS.indexOf(base[0] as typeof RANKS[number]);
      const r2 = RANKS.indexOf(base[1] as typeof RANKS[number]);
      if (r1 < 0 || r2 < 0) continue;

      const highR = Math.max(r1, r2);
      const lowR = Math.min(r1, r2);

      for (const suffix of ['s', 'o']) {
        if (hasPlus) {
          for (let r = lowR; r < highR; r++) {
            const label = `${RANKS[highR]}${RANKS[r]}${suffix}`;
            const combos = HAND_GROUP_MAP.get(label);
            if (combos) {
              for (const ci of combos) weights[ci] = 1;
            }
          }
        } else {
          const label = `${RANKS[highR]}${RANKS[lowR]}${suffix}`;
          const combos = HAND_GROUP_MAP.get(label);
          if (combos) {
            for (const ci of combos) weights[ci] = 1;
          }
        }
      }
    }
  }

  return weights;
}

// Count number of combos in a range (accounting for weights)
export function countCombos(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w, 0);
}

// Get percentage of all hands
export function rangePercentage(weights: number[]): number {
  return (countCombos(weights) / 1326) * 100;
}

// Filter out combos that conflict with known cards (board, dead cards)
export function filterBlockedCombos(weights: number[], blockedCards: CardIndex[]): number[] {
  const blocked = new Set(blockedCards);
  const filtered = [...weights];

  for (let i = 0; i < ALL_COMBOS.length; i++) {
    if (blocked.has(ALL_COMBOS[i].card1) || blocked.has(ALL_COMBOS[i].card2)) {
      filtered[i] = 0;
    }
  }

  return filtered;
}

// Default ranges based on Janda's recommended chart (approximation)
export const DEFAULT_RANGES: Record<string, string> = {
  // UTG Raise First In (~15%)
  'UTG_RFI': '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KTo+,QTo+,JTo',

  // MP Raise First In (~18%)
  'MP_RFI': '22+,A2s+,K8s+,Q8s+,J8s+,T8s+,97s+,87s,76s,65s,54s,A9o+,K9o+,Q9o+,J9o+,T9o',

  // CO Raise First In (~25%)
  'CO_RFI': '22+,A2s+,K5s+,Q7s+,J7s+,T7s+,97s+,86s+,76s,65s,54s,A7o+,K9o+,Q9o+,J9o+,T9o,98o',

  // BTN Raise First In (~40%)
  'BTN_RFI': '22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,75s+,64s+,54s,43s,A2o+,K5o+,Q8o+,J8o+,T8o+,97o+,87o',

  // SB Raise First In (~35%)
  'SB_RFI': '22+,A2s+,K2s+,Q5s+,J7s+,T7s+,97s+,86s+,75s+,65s,54s,A2o+,K7o+,Q9o+,J9o+,T9o,98o',

  // 3-Bet ranges (value + bluffs)
  'SB_3BET_vs_BTN': 'QQ+,AKs,AQs,AJs,KQs,A5s,A4s,76s,65s,AKo',
  'BB_3BET_vs_BTN': 'QQ+,AKs,AQs,AJs,ATs,KQs,A5s,A4s,87s,76s,65s,AKo,AQo',
  'BB_3BET_vs_CO': 'KK+,AKs,AQs,A5s,A4s,AKo',
  'BB_3BET_vs_MP': 'KK+,AKs,A5s,AKo',
  'BB_3BET_vs_UTG': 'KK+,AKs',

  // 4-Bet ranges
  'UTG_4BET': 'KK+,AKs',
  'MP_4BET': 'QQ+,AKs,AKo',
  'CO_4BET': 'QQ+,AKs,AKo,A5s',
  'BTN_4BET': 'JJ+,AKs,AQs,AKo,A5s,A4s',

  // Calling ranges
  'BB_CALL_vs_BTN': 'A9o-A2o,K9o-K5o,Q9o-Q8o,J9o-J8o,T9o,98o,22-TT,A9s-A2s,K9s-K2s,Q9s-Q5s,J9s-J6s,T8s-T6s,97s-96s,86s-85s,75s-74s,64s,54s,43s',
};

// Get number of combos for common hand notations
export function getComboCount(hand: string): number {
  if (hand.length === 2 && hand[0] === hand[1]) return 6;  // Pair
  if (hand.endsWith('s')) return 4;  // Suited
  if (hand.endsWith('o')) return 12; // Offsuit
  return 16; // Both
}
