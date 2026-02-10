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
  strategy: ActionFrequency[][][];
  actions: string[];
  title?: string;
  onCellClick?: (row: number, col: number) => void;
}

const ACTION_COLORS: Record<string, string> = {
  fold: '#ef4444',
  check: '#6b7280',
  call: '#22c55e',
  bet: '#3b82f6',
  raise: '#f59e0b',
  all_in: '#a855f7',
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
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
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
      <div
        className="grid gap-[1px] w-full"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
      >
        {Array.from({ length: 13 }).map((_, row) =>
          Array.from({ length: 13 }).map((_, col) => {
            const cellStrategy = strategy[row]?.[col] || [];
            const label = getHandLabel(row, col);

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
                  aspect-square flex items-center justify-center text-[8px] sm:text-[10px] font-mono
                  cursor-pointer rounded-[2px] transition-opacity
                  ${hasStrategy ? 'text-white' : 'bg-gray-800 text-gray-600'}
                  active:opacity-80
                `}
                style={backgroundStyle}
                onClick={() => onCellClick?.(row, col)}
              >
                <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{label}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function solverResultsToStrategy(
  handStrategies: Map<number, Float32Array>,
  actions: string[],
): ActionFrequency[][][] {
  const grid: ActionFrequency[][][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => [])
  );

  const gridCounts: number[][] = Array.from({ length: 13 }, () => new Array(13).fill(0));
  const gridSums: number[][][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => new Array(actions.length).fill(0))
  );

  for (const [comboIdx, strategy] of handStrategies) {
    const { row, col } = comboIndexToGrid(comboIdx);
    if (row < 0 || row >= 13 || col < 0 || col >= 13) continue;

    gridCounts[row][col]++;
    for (let a = 0; a < Math.min(strategy.length, actions.length); a++) {
      gridSums[row][col][a] += strategy[a];
    }
  }

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
  let idx = 0;
  for (let c1 = 0; c1 < 52; c1++) {
    for (let c2 = c1 + 1; c2 < 52; c2++) {
      if (idx === comboIdx) {
        const r1 = Math.floor(c1 / 4);
        const r2 = Math.floor(c2 / 4);
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
