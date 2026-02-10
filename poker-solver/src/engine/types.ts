// Core poker types for the GTO solver engine

export const SUITS = ['s', 'h', 'd', 'c'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Compact card representation: 0-51
// rank * 4 + suit where rank 0=2..12=A, suit 0=s,1=h,2=d,3=c
export type CardIndex = number;

export function cardToIndex(card: Card): CardIndex {
  const rankIdx = RANKS.indexOf(card.rank);
  const suitIdx = SUITS.indexOf(card.suit);
  return rankIdx * 4 + suitIdx;
}

export function indexToCard(idx: CardIndex): Card {
  return {
    rank: RANKS[Math.floor(idx / 4)],
    suit: SUITS[idx % 4],
  };
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function indexToString(idx: CardIndex): string {
  return cardToString(indexToCard(idx));
}

export function parseCard(s: string): Card {
  return { rank: s[0] as Rank, suit: s[1] as Suit };
}

export function parseCardIndex(s: string): CardIndex {
  return cardToIndex(parseCard(s));
}

// Hand categories for evaluation
export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
}

export const HAND_RANK_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
];

// Position in a 6-max game
export enum Position {
  UTG = 0,    // Under the Gun
  MP = 1,     // Middle Position (HJ)
  CO = 2,     // Cutoff
  BTN = 3,    // Button
  SB = 4,     // Small Blind
  BB = 5,     // Big Blind
}

export const POSITION_NAMES = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

// Game tree action types
export enum ActionType {
  FOLD = 'fold',
  CHECK = 'check',
  CALL = 'call',
  BET = 'bet',
  RAISE = 'raise',
  ALL_IN = 'all_in',
}

export interface Action {
  type: ActionType;
  amount: number; // in big blinds
}

// Street
export enum Street {
  PREFLOP = 0,
  FLOP = 1,
  TURN = 2,
  RIVER = 3,
}

export const STREET_NAMES = ['Preflop', 'Flop', 'Turn', 'River'];

// Solver configuration
export interface SolverConfig {
  numPlayers: number;
  stackDepth: number;        // in big blinds
  potSize: number;           // current pot in big blinds
  street: Street;
  board: CardIndex[];        // community cards
  playerRanges: number[][];  // range weights for each player (1326 combos)
  betSizes: number[][];      // allowed bet sizes per street as fraction of pot [flop, turn, river]
  raiseSizes: number[][];    // allowed raise sizes per street
  maxIterations: number;
  targetExploitability: number; // stop when exploitability < this
  useGPU: boolean;
}

// Game tree node
export interface GameTreeNode {
  id: number;
  street: Street;
  pot: number;
  player: number;            // which player acts (0 or 1 for heads-up)
  actions: Action[];
  children: Map<string, GameTreeNode>;
  isTerminal: boolean;
  isChance: boolean;         // deal card node
}

// Solver results
export interface SolverResults {
  strategy: Float32Array[];      // strategy for each info set
  evs: Float32Array[];           // EV for each hand in range
  exploitability: number;
  iterations: number;
  timeMs: number;
  nodeCount: number;
}

// Range combo - one of 1326 possible hole card combinations
export interface HandCombo {
  card1: CardIndex;
  card2: CardIndex;
  index: number;    // 0-1325
  label: string;    // e.g., "AKs", "TT"
  isSuited: boolean;
  isPair: boolean;
}

// Preflop range as 13x13 grid
export type RangeGrid = number[][]; // [row][col], value 0-1 (frequency)

// Board texture analysis
export interface BoardTexture {
  isPaired: boolean;
  isMonotone: boolean;
  isTwoTone: boolean;
  isRainbow: boolean;
  hasFlushDraw: boolean;
  hasStraightDraw: boolean;
  connectivity: number;     // 0-1 how connected the board is
  highCard: Rank;
  texture: string;          // description
}

// EV breakdown for results display
export interface EVBreakdown {
  hand: string;
  ev: number;
  frequency: number;
  actions: { action: string; frequency: number; ev: number }[];
}
