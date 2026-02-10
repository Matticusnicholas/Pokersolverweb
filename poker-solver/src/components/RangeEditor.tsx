'use client';

import React, { useState, useCallback, useRef } from 'react';
import { RANKS } from '@/engine/types';

const GRID_SIZE = 13;
const RANK_LABELS = [...RANKS].reverse();

function getHandLabel(row: number, col: number): string {
  if (row === col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}`;
  if (row < col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}s`;
  return `${RANK_LABELS[col]}${RANK_LABELS[row]}o`;
}

function getComboCount(row: number, col: number): number {
  if (row === col) return 6;
  if (row < col) return 4;
  return 12;
}

interface RangeEditorProps {
  grid: number[][];
  onChange: (grid: number[][]) => void;
  readOnly?: boolean;
  title?: string;
}

export default function RangeEditor({
  grid,
  onChange,
  readOnly = false,
  title,
}: RangeEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchCell = useRef<string | null>(null);

  const handleCellDown = useCallback((row: number, col: number) => {
    if (readOnly) return;
    const currentVal = grid[row]?.[col] ?? 0;
    const newVal = currentVal > 0 ? 0 : 1;
    setDragValue(newVal);
    setIsDragging(true);

    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = newVal;
    onChange(newGrid);
  }, [grid, onChange, readOnly]);

  const handleCellEnter = useCallback((row: number, col: number) => {
    if (!isDragging || readOnly) return;
    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = dragValue;
    onChange(newGrid);
  }, [isDragging, dragValue, grid, onChange, readOnly]);

  // Touch drag support
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || readOnly) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const cellKey = el.getAttribute('data-cell');
    if (!cellKey || cellKey === lastTouchCell.current) return;
    lastTouchCell.current = cellKey;
    const [r, c] = cellKey.split('-').map(Number);
    if (r >= 0 && r < 13 && c >= 0 && c < 13) {
      const newGrid = grid.map(row => [...row]);
      newGrid[r][c] = dragValue;
      onChange(newGrid);
    }
  }, [isDragging, dragValue, grid, onChange, readOnly]);

  React.useEffect(() => {
    const up = () => {
      setIsDragging(false);
      lastTouchCell.current = null;
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, []);

  // Stats
  let totalCombos = 0;
  let selectedCombos = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const count = getComboCount(r, c);
      totalCombos += count;
      selectedCombos += count * (grid[r]?.[c] ?? 0);
    }
  }
  const percentage = (selectedCombos / totalCombos * 100).toFixed(1);

  const selectAll = () => { if (!readOnly) onChange(Array.from({ length: 13 }, () => new Array(13).fill(1))); };
  const clearAll = () => { if (!readOnly) onChange(Array.from({ length: 13 }, () => new Array(13).fill(0))); };
  const selectPairs = () => {
    if (readOnly) return;
    const g = grid.map(r => [...r]);
    for (let i = 0; i < 13; i++) g[i][i] = 1;
    onChange(g);
  };
  const selectBroadway = () => {
    if (readOnly) return;
    const g = grid.map(r => [...r]);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) g[r][c] = 1;
    onChange(g);
  };

  return (
    <div className="select-none" ref={containerRef}>
      {title && <h3 className="text-sm font-semibold mb-2 text-gray-300">{title}</h3>}

      {/* Stats + quick buttons */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">
          <span className="font-bold text-[var(--gold)]">{percentage}%</span>
          <span className="text-gray-500 text-xs ml-1">({Math.round(selectedCombos)} combos)</span>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <button onClick={selectAll} className="px-2 py-1 text-[10px] bg-gray-700 active:bg-gray-600 rounded text-gray-300">All</button>
            <button onClick={clearAll} className="px-2 py-1 text-[10px] bg-gray-700 active:bg-gray-600 rounded text-gray-300">Clear</button>
            <button onClick={selectPairs} className="px-2 py-1 text-[10px] bg-blue-900/70 active:bg-blue-800 rounded text-blue-300">Pairs</button>
            <button onClick={selectBroadway} className="px-2 py-1 text-[10px] bg-amber-900/50 active:bg-amber-800 rounded text-amber-300">Bway</button>
          </div>
        )}
      </div>

      {/* 13x13 Grid */}
      <div
        className="range-grid grid gap-[1px] w-full touch-none"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
        onTouchMove={handleTouchMove}
      >
        {Array.from({ length: GRID_SIZE }).map((_, row) =>
          Array.from({ length: GRID_SIZE }).map((_, col) => {
            const label = getHandLabel(row, col);
            const val = grid[row]?.[col] ?? 0;
            const isPair = row === col;
            const isSuited = row < col;

            return (
              <div
                key={`${row}-${col}`}
                data-cell={`${row}-${col}`}
                className={`
                  range-cell aspect-square flex items-center justify-center text-[8px] sm:text-[10px] font-mono
                  cursor-pointer rounded-[2px]
                  ${val > 0
                    ? isPair
                      ? 'bg-blue-600 text-white font-bold'
                      : isSuited
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600/80 text-white'
                    : 'bg-gray-800/80 text-gray-600 active:bg-gray-700'
                  }
                `}
                onMouseDown={(e) => { e.preventDefault(); handleCellDown(row, col); }}
                onMouseEnter={() => handleCellEnter(row, col)}
                onTouchStart={() => handleCellDown(row, col)}
              >
                {label}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-3 text-[10px] text-gray-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-blue-600 rounded-sm inline-block" /> Pairs
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm inline-block" /> Suited
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-red-600/80 rounded-sm inline-block" /> Offsuit
        </span>
      </div>
    </div>
  );
}
