'use client';

import React, { useState, useCallback, useRef } from 'react';
import { RANKS } from '@/engine/types';

// 13x13 grid: rows from A (top) to 2 (bottom)
// Above diagonal = suited, below = offsuit, diagonal = pairs
const GRID_SIZE = 13;
const RANK_LABELS = [...RANKS].reverse(); // A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2

function getHandLabel(row: number, col: number): string {
  if (row === col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}`;
  if (row < col) return `${RANK_LABELS[row]}${RANK_LABELS[col]}s`;
  return `${RANK_LABELS[col]}${RANK_LABELS[row]}o`;
}

function getComboCount(row: number, col: number): number {
  if (row === col) return 6;   // Pair
  if (row < col) return 4;    // Suited
  return 12;                    // Offsuit
}

interface RangeEditorProps {
  grid: number[][];
  onChange: (grid: number[][]) => void;
  readOnly?: boolean;
  colorMode?: 'frequency' | 'action'; // frequency = green shading, action = multi-color
  actionColors?: Map<string, string>; // action -> color map for multi-action display
  title?: string;
}

export default function RangeEditor({
  grid,
  onChange,
  readOnly = false,
  colorMode = 'frequency',
  title,
}: RangeEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCellDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Calculate stats
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

  const getCellColor = (row: number, col: number): string => {
    const val = grid[row]?.[col] ?? 0;
    if (val <= 0) return 'bg-gray-800';
    if (val >= 1) {
      if (row === col) return 'bg-blue-600'; // Pairs
      if (row < col) return 'bg-green-600';  // Suited
      return 'bg-red-600/80';                 // Offsuit
    }
    // Partial frequency
    const opacity = Math.round(val * 100);
    if (row === col) return `bg-blue-600/${opacity}`;
    if (row < col) return `bg-green-600/${opacity}`;
    return `bg-red-600/${opacity}`;
  };

  const getCellStyle = (row: number, col: number): React.CSSProperties => {
    const val = grid[row]?.[col] ?? 0;
    if (val <= 0) return {};
    if (val >= 1) return {};
    // Partial frequency - use inline opacity
    let baseColor: string;
    if (row === col) baseColor = '59, 130, 246';      // blue
    else if (row < col) baseColor = '34, 197, 94';    // green
    else baseColor = '239, 68, 68';                     // red
    return { backgroundColor: `rgba(${baseColor}, ${val * 0.8 + 0.2})` };
  };

  // Quick select buttons
  const selectAll = () => {
    if (readOnly) return;
    onChange(Array.from({ length: 13 }, () => new Array(13).fill(1)));
  };

  const clearAll = () => {
    if (readOnly) return;
    onChange(Array.from({ length: 13 }, () => new Array(13).fill(0)));
  };

  const selectPairs = () => {
    if (readOnly) return;
    const newGrid = grid.map(r => [...r]);
    for (let i = 0; i < 13; i++) newGrid[i][i] = 1;
    onChange(newGrid);
  };

  const selectSuited = () => {
    if (readOnly) return;
    const newGrid = grid.map(r => [...r]);
    for (let r = 0; r < 13; r++) {
      for (let c = r + 1; c < 13; c++) {
        newGrid[r][c] = 1;
      }
    }
    onChange(newGrid);
  };

  const selectBroadway = () => {
    if (readOnly) return;
    const newGrid = grid.map(r => [...r]);
    // Broadway = T, J, Q, K, A (indices 0-4 in our reversed array)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        newGrid[r][c] = 1;
      }
    }
    onChange(newGrid);
  };

  return (
    <div className="select-none" ref={containerRef} onMouseUp={handleMouseUp}>
      {title && <h3 className="text-sm font-semibold mb-2 text-gray-300">{title}</h3>}

      <div className="inline-block">
        <div className="grid gap-[1px]" style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
        }}>
          {Array.from({ length: GRID_SIZE }).map((_, row) =>
            Array.from({ length: GRID_SIZE }).map((_, col) => {
              const label = getHandLabel(row, col);
              const val = grid[row]?.[col] ?? 0;
              const isPair = row === col;
              const isSuited = row < col;

              return (
                <div
                  key={`${row}-${col}`}
                  className={`
                    w-[42px] h-[34px] flex items-center justify-center text-[10px] font-mono
                    cursor-pointer border border-gray-700/50 rounded-[2px] transition-colors
                    ${val > 0
                      ? isPair ? 'bg-blue-600 text-white' : isSuited ? 'bg-green-600 text-white' : 'bg-red-600/80 text-white'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }
                  `}
                  style={val > 0 && val < 1 ? getCellStyle(row, col) : {}}
                  onMouseDown={(e) => handleCellDown(row, col, e)}
                  onMouseEnter={() => handleCellEnter(row, col)}
                  title={`${label} (${getComboCount(row, col)} combos) - ${Math.round(val * 100)}%`}
                >
                  {label}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <span className="font-semibold text-white">{percentage}%</span> of hands
          <span className="text-gray-500 ml-2">({Math.round(selectedCombos)} combos)</span>
        </div>

        {!readOnly && (
          <div className="flex gap-1">
            <button onClick={selectAll} className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300">All</button>
            <button onClick={clearAll} className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300">Clear</button>
            <button onClick={selectPairs} className="px-2 py-1 text-[10px] bg-blue-800 hover:bg-blue-700 rounded text-blue-200">Pairs</button>
            <button onClick={selectSuited} className="px-2 py-1 text-[10px] bg-green-800 hover:bg-green-700 rounded text-green-200">Suited</button>
            <button onClick={selectBroadway} className="px-2 py-1 text-[10px] bg-yellow-800 hover:bg-yellow-700 rounded text-yellow-200">Broadway</button>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-600 rounded-sm inline-block"></span> Pairs
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-600 rounded-sm inline-block"></span> Suited
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-600/80 rounded-sm inline-block"></span> Offsuit
        </span>
      </div>
    </div>
  );
}
