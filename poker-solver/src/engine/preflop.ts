// Preflop GTO charts and analysis
// Based on the mathematical framework from Janda's "Applications of No-Limit Hold'em"
// Implements defend frequencies, 3-bet/4-bet/5-bet ranges, and position-based strategy

import { Position, POSITION_NAMES } from './types';

// Opening Raise First In (RFI) frequencies by position (6-max, 100bb deep)
export const RFI_FREQUENCIES: Record<string, number> = {
  UTG: 15,  // ~15% of hands
  MP: 18,   // ~18%
  CO: 25,   // ~25%
  BTN: 40,  // ~40%
  SB: 35,   // ~35%
};

// Standard open sizes by position (in big blinds)
export const OPEN_SIZES: Record<string, number> = {
  UTG: 3.0,
  MP: 3.0,
  CO: 2.5,
  BTN: 2.5,
  SB: 3.0,
};

// 3-bet sizes (in big blinds)
export const THREE_BET_SIZES = {
  IP: 3.0,   // multiplier of open size when in position
  OOP: 3.5,  // multiplier when out of position
};

// Preflop chart: hand -> action for each position
// Format: hand string -> 'R' (raise), 'C' (call), '3' (3-bet), 'F' (fold)
export interface PreflopAction {
  action: 'raise' | 'call' | '3bet' | '4bet' | '5bet' | 'fold';
  frequency: number; // 0-1 (mixed strategies)
}

// Complete 13x13 preflop grid of hands
// Row index 0 = AA row (A-high), 12 = 22 row (2-high)
// Above diagonal = suited, below = offsuit, diagonal = pairs
export const HAND_GRID: string[][] = [];
for (let r = 12; r >= 0; r--) {
  const row: string[] = [];
  for (let c = 12; c >= 0; c--) {
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    if (r === c) {
      row.push(`${RANKS[r]}${RANKS[c]}`);
    } else if (r > c) {
      row.push(`${RANKS[r]}${RANKS[c]}s`);
    } else {
      row.push(`${RANKS[c]}${RANKS[r]}o`);
    }
  }
  HAND_GRID.push(row);
}

// GTO Raise First In charts by position
// Derived from Janda's recommended ranges and mathematical framework
// Each cell is a frequency (0-1) of how often to raise
export const RFI_CHARTS: Record<string, number[][]> = {
  UTG: generateRFIChart(Position.UTG),
  MP: generateRFIChart(Position.MP),
  CO: generateRFIChart(Position.CO),
  BTN: generateRFIChart(Position.BTN),
  SB: generateRFIChart(Position.SB),
};

function generateRFIChart(position: Position): number[][] {
  const chart: number[][] = Array.from({ length: 13 }, () => new Array(13).fill(0));

  // Position-based hand strength thresholds
  // These are approximations derived from the GTO frequencies in the book
  const thresholds = getPositionThresholds(position);

  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const isAboveDiag = r < c; // offsuit
      const isDiag = r === c;    // pair
      const isBelowDiag = r > c; // suited

      const highRank = 12 - Math.min(r, c);  // rank of higher card (12=A)
      const lowRank = 12 - Math.max(r, c);   // rank of lower card

      if (isDiag) {
        // Pairs: always raise 22+ in most positions
        const pairRank = 12 - r;
        if (pairRank >= thresholds.minPairRaise) {
          chart[r][c] = 1.0;
        } else if (pairRank >= thresholds.minPairRaise - 2) {
          chart[r][c] = 0.5; // mixed
        }
      } else if (isBelowDiag) {
        // Suited hands
        const gap = highRank - lowRank;
        const suitedScore = highRank * 2 + lowRank - gap * 0.5;

        if (suitedScore >= thresholds.suitedThreshold) {
          chart[r][c] = 1.0;
        } else if (suitedScore >= thresholds.suitedThreshold - 3) {
          chart[r][c] = Math.max(0, (suitedScore - thresholds.suitedThreshold + 3) / 3);
        }
        // Suited connectors get a bonus
        if (gap <= 2 && highRank >= 3 && gap > 0) {
          chart[r][c] = Math.max(chart[r][c], thresholds.suitedConnectorFreq);
        }
        // Suited aces always raise
        if (highRank === 12) {
          chart[r][c] = 1.0;
        }
      } else {
        // Offsuit hands
        const gap = highRank - lowRank;
        const offsuitScore = highRank * 1.5 + lowRank - gap * 1.5;

        if (offsuitScore >= thresholds.offsuitThreshold) {
          chart[r][c] = 1.0;
        } else if (offsuitScore >= thresholds.offsuitThreshold - 3) {
          chart[r][c] = Math.max(0, (offsuitScore - thresholds.offsuitThreshold + 3) / 3);
        }
        // Offsuit aces with decent kicker
        if (highRank === 12 && lowRank >= thresholds.minAceKicker) {
          chart[r][c] = 1.0;
        }
      }
    }
  }

  return chart;
}

function getPositionThresholds(position: Position) {
  switch (position) {
    case Position.UTG:
      return {
        minPairRaise: 0,    // 22+
        suitedThreshold: 16,
        offsuitThreshold: 18,
        suitedConnectorFreq: 0.8,
        minAceKicker: 8, // AT+
      };
    case Position.MP:
      return {
        minPairRaise: 0,
        suitedThreshold: 14,
        offsuitThreshold: 16,
        suitedConnectorFreq: 0.9,
        minAceKicker: 7, // A9+
      };
    case Position.CO:
      return {
        minPairRaise: 0,
        suitedThreshold: 11,
        offsuitThreshold: 14,
        suitedConnectorFreq: 1.0,
        minAceKicker: 5, // A7+
      };
    case Position.BTN:
      return {
        minPairRaise: 0,
        suitedThreshold: 7,
        offsuitThreshold: 10,
        suitedConnectorFreq: 1.0,
        minAceKicker: 0, // A2+
      };
    case Position.SB:
      return {
        minPairRaise: 0,
        suitedThreshold: 8,
        offsuitThreshold: 12,
        suitedConnectorFreq: 1.0,
        minAceKicker: 0, // A2+
      };
    default:
      return {
        minPairRaise: 0,
        suitedThreshold: 16,
        offsuitThreshold: 18,
        suitedConnectorFreq: 0.8,
        minAceKicker: 8,
      };
  }
}

// 3-bet defense calculations based on Janda's math
// "A player risks X big blinds to win Y big blinds, so it must succeed Z% of the time"
export function calculate3BetDefenseFrequency(
  openSize: number,
  threeBetSize: number,
  blinds: number = 1.5
): {
  immediateProfit: number;         // % folds needed for immediate profit
  minDefenseFrequency: number;     // % opener must defend
  maxCombined3BetFrequency: number;
} {
  // 3-bettor risks threeBetSize to win openSize + blinds
  const risk = threeBetSize;
  const reward = openSize + blinds;
  const immediateProfit = risk / (risk + reward);

  // Opener must defend at least 1 - immediateProfit
  const minDefenseFrequency = 1 - immediateProfit;

  // Max combined 3-bet percentage before opener can't profitably open weak hands
  const maxCombined3BetFrequency = 1 - (openSize / (openSize + blinds));

  return { immediateProfit, minDefenseFrequency, maxCombined3BetFrequency };
}

// 4-bet calculations
export function calculate4BetDefenseFrequency(
  threeBetSize: number,
  fourBetSize: number,
  potBeforeFourBet: number
): {
  immediateProfit: number;
  minDefenseFrequency: number;
} {
  const risk = fourBetSize - threeBetSize; // additional chips risked
  const reward = potBeforeFourBet;
  const immediateProfit = risk / (risk + reward);
  const minDefenseFrequency = 1 - immediateProfit;

  return { immediateProfit, minDefenseFrequency };
}

// Calculate value-to-bluff ratio for 3-betting
// Based on Janda: value percentage of 3-bet range = defense frequency against 4-bet
export function calculate3BetComposition(
  totalThreeBetFrequency: number,
  defenseAgainst4Bet: number
): {
  valuePercentage: number;
  bluffPercentage: number;
  valueFrequency: number;
  bluffFrequency: number;
} {
  const valuePercentage = defenseAgainst4Bet;
  const bluffPercentage = 1 - defenseAgainst4Bet;
  const valueFrequency = totalThreeBetFrequency * valuePercentage;
  const bluffFrequency = totalThreeBetFrequency * bluffPercentage;

  return { valuePercentage, bluffPercentage, valueFrequency, bluffFrequency };
}

// Calculate preflop EV of opening with the worst hand in range
// From Janda: EV = (fold%)(blinds) + (call%)(EVwhenCalled) - (3bet%)(openSize)
export function calculateOpenEV(
  foldFrequency: number,
  callFrequency: number,
  threeBetFrequency: number,
  openSize: number,
  blinds: number,
  evWhenCalled: number
): number {
  return foldFrequency * blinds + callFrequency * evWhenCalled - threeBetFrequency * openSize;
}

// Maximum 3-bet frequency per position (from Janda's table)
// Based on combined 3-bet not exceeding ~30% so weak opens remain profitable
export const MAX_3BET_BY_POSITION: Record<string, {
  max3BetPercent: number;
  value3BetPercent: number;
  valueHands: string;
}> = {
  UTG: { max3BetPercent: 6.9, value3BetPercent: 2.76, valueHands: 'AA-QQ, AKs' },
  MP: { max3BetPercent: 8.5, value3BetPercent: 3.4, valueHands: 'AA-JJ, AKs, AQs' },
  CO: { max3BetPercent: 11.2, value3BetPercent: 4.6, valueHands: 'JJ+, AJs+, AQo+' },
  BTN: { max3BetPercent: 16.3, value3BetPercent: 6.52, valueHands: 'TT+, ATs+, KQs, AJo+' },
};

// Post-flop bet sizing recommendations based on Janda's framework
export interface BetSizingRecommendation {
  streetName: string;
  potFraction: number;
  reason: string;
  valueToBluffRatio: number;
  mdf: number; // minimum defense frequency
}

export function getRecommendedBetSizing(
  potSize: number,
  street: number,
  boardTexture: string, // 'dry', 'wet', 'monotone'
  rangePolarization: number, // 0-1, how polarized the betting range is
): BetSizingRecommendation {
  // From Janda's bet sizing framework:
  // - Smaller bets on dry boards where ranges are less polarized
  // - Larger bets on wet boards to charge draws
  // - River bets based on polarization and desired value:bluff ratio

  let potFraction: number;
  let reason: string;

  if (street === 3) {
    // River: size based on polarization
    if (rangePolarization > 0.7) {
      potFraction = 1.5; // Overbet when very polarized
      reason = 'Highly polarized range benefits from overbets (Janda Ch.11)';
    } else if (rangePolarization > 0.4) {
      potFraction = 0.75;
      reason = 'Standard river sizing for moderately polarized range';
    } else {
      potFraction = 0.33;
      reason = 'Small sizing with condensed/merged range';
    }
  } else if (street === 2) {
    // Turn
    if (boardTexture === 'wet') {
      potFraction = 0.75;
      reason = 'Larger turn sizing on wet board to charge draws';
    } else {
      potFraction = 0.5;
      reason = 'Standard turn sizing on dry/medium board';
    }
  } else {
    // Flop
    if (boardTexture === 'dry') {
      potFraction = 0.33;
      reason = 'Small c-bet on dry flop (Janda: range advantage)';
    } else if (boardTexture === 'monotone') {
      potFraction = 0.5;
      reason = 'Medium bet on monotone flop';
    } else {
      potFraction = 0.66;
      reason = 'Larger bet on wet/connected flop to protect equity';
    }
  }

  // Calculate derived values
  const betSize = potSize * potFraction;
  const mdf = potSize / (potSize + betSize);
  const valueToBluffRatio = (potSize + betSize) / betSize;

  return {
    streetName: ['Preflop', 'Flop', 'Turn', 'River'][street],
    potFraction,
    reason,
    valueToBluffRatio,
    mdf,
  };
}

// 3-bet/4-bet/5-bet frequency summary from Janda
export const PREFLOP_FREQUENCIES = {
  '3bet_bluff_needs_folds': { min: 0.67, max: 0.70, description: '3-bet bluffs need folds 67-70% of the time for immediate profit' },
  '4bet_bluff_needs_folds': { min: 0.54, max: 0.60, description: '4-bet bluffs need folds 54-60% of the time' },
  '5bet_bluff_needs_folds': { min: 0.40, max: 0.50, description: '5-bet bluffs need folds 40-50% of the time' },
  'defend_vs_3bet': { min: 0.27, max: 0.31, description: 'Opens should defend 27-31% against 3-bets' },
  '3bet_defend_vs_4bet': { min: 0.40, max: 0.46, description: '3-bet range should defend 40-46% against 4-bets' },
  '4bet_defend_vs_5bet': { min: 0.50, max: 0.60, description: '4-bet range should call 50-60% of 5-bet jams' },
};
