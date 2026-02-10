'use client';

import React from 'react';
import { RANKS } from '@/engine/types';

const RANK_LABELS = [...RANKS].reverse();

function getHandLabel(row: number, col: number): string {
  if (row === col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}`;
  if (row < col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}s`;
  return `${RANK_LABELS[col]}${RANK_LABELS[row]}o`;
}

interface ActionFrequency {
  action: string;
  frequency: number;
  color: string;
}

interface StrategyDisplayProps {
  // 13x13 grid, each cell has array of action frequencies
  strategy: ActionFrequency[][][];
  actions: string[];
  title?: string;
  onCellClick?: (row: number, col: number) => void;
}

const ACTION_COLORS: Record<string, string> = {
  fold: '#ef4444',      // red
  check: '#6b7280',     // gray
  call: '#22c55e',      // green
  bet: '#3b82f6',       // blue
  raise: '#f59e0b',     // amber
  all_in: '#a855f7',    // purple
};

export default function StrategyDisplay({
  strategy,
  actions,
  title,
  onCellClick,
}: StrategyDisplayProps) {
  return (
    <div>
      {title && <h3 className="text-sm font-semibold mb-2 text-gray-300">{title}</h3>}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        {actions.map((action) => (
          <span key={action} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: ACTION_COLORS[action.split(' ')[0]] || '#6b7280' }}
            />
            <span className="text-gray-400 capitalize">{action}</span>
          </span>
        ))}
      </div>

      {/* Strategy grid */}
      <div className="inline-block">
        <div className="grid gap-[1px]" style={{
          gridTemplateColumns: `repeat(13, minmax(0, 1fr))`,
        }}>
          {Array.from({ length: 13 }).map((_, row) =>
            Array.from({ length: 13 }).map((_, col) => {
              const cellStrategy = strategy[row]?.[col] || [];
              const label = getHandLabel(row, col);

              // Generate stacked bar background
              let gradientStops: string[] = [];
              let cumPercent = 0;

              for (const af of cellStrategy) {
                if (af.frequency <= 0) continue;
                const startPercent = cumPercent;
                cumPercent += af.frequency * 100;
                const color = ACTION_COLORS[af.action.split(' ')[0]] || '#6b7280';
                gradientStops.push(`${color} ${startPercent}%`);
                gradientStops.push(`${color} ${cumPercent}%`);
              }

              const hasStrategy = cellStrategy.length > 0 && cellStrategy.some(a => a.frequency > 0);
              const backgroundStyle = hasStrategy && gradientStops.length > 0
                ? { background: `linear-gradient(to right, ${gradientStops.join(', ')})` }
                : {};

              return (
                <div
                  key={`${row}-${col}`}
                  className={`
                    w-[42px] h-[34px] flex items-center justify-center text-[10px] font-mono
                    cursor-pointer border border-gray-700/50 rounded-[2px] transition-opacity
                    ${hasStrategy ? 'text-white' : 'bg-gray-800 text-gray-600'}
                    hover:opacity-80
                  `}
                  style={backgroundStyle}
                  onClick={() => onCellClick?.(row, col)}
                  title={cellStrategy.map(a => `${a.action}: ${(a.frequency * 100).toFixed(1)}%`).join('\n')}
                >
                  <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to convert solver results to strategy display format
export function solverResultsToStrategy(
  handStrategies: Map<number, Float32Array>,
  actions: string[],
): ActionFrequency[][][] {
  const grid: ActionFrequency[][][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => [])
  );

  // We need to map combo indices to grid positions and average
  const gridCounts: number[][] = Array.from({ length: 13 }, () => new Array(13).fill(0));
  const gridSums: number[][][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => new Array(actions.length).fill(0))
  );

  for (const [comboIdx, strategy] of handStrategies) {
    // Map combo index to grid position
    // This is a simplified mapping - in production you'd use the actual combo data
    const { row, col } = comboIndexToGrid(comboIdx);
    if (row < 0 || row >= 13 || col < 0 || col >= 13) continue;

    gridCounts[row][col]++;
    for (let a = 0; a < Math.min(strategy.length, actions.length); a++) {
      gridSums[row][col][a] += strategy[a];
    }
  }

  // Average and build result
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (gridCounts[r][c] === 0) continue;
      const cellActions: ActionFrequency[] = [];
      for (let a = 0; a < actions.length; a++) {
        const avgFreq = gridSums[r][c][a] / gridCounts[r][c];
        if (avgFreq > 0.001) {
          cellActions.push({
            action: actions[a],
            frequency: avgFreq,
            color: ACTION_COLORS[actions[a].split(' ')[0]] || '#6b7280',
          });
        }
      }
      grid[r][c] = cellActions;
    }
  }

  return grid;
}

function comboIndexToGrid(comboIdx: number): { row: number; col: number } {
  // Simplified mapping from the 1326 combo index to the 13x13 grid
  // In a full implementation this would use the actual ALL_COMBOS data
  // For now, approximate based on the triangular number pattern
  let idx = 0;
  for (let c1 = 0; c1 < 52; c1++) {
    for (let c2 = c1 + 1; c2 < 52; c2++) {
      if (idx === comboIdx) {
        const r1 = Math.floor(c1 / 4); // rank of card 1
        const r2 = Math.floor(c2 / 4); // rank of card 2
        const s1 = c1 % 4;
        const s2 = c2 % 4;
        const isSuited = s1 === s2;
        const highR = Math.max(r1, r2);
        const lowR = Math.min(r1, r2);

        if (r1 === r2) {
          return { row: 12 - r1, col: 12 - r1 };
        } else if (isSuited) {
          return { row: 12 - highR, col: 12 - lowR };
        } else {
          return { row: 12 - lowR, col: 12 - highR };
        }
      }
      idx++;
    }
  }
  return { row: -1, col: -1 };
}
