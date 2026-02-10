'use client';

import React, { useState, useMemo } from 'react';
import RangeEditor from '@/components/RangeEditor';
import { RANKS } from '@/engine/types';
import {
  RFI_CHARTS, RFI_FREQUENCIES, OPEN_SIZES,
  MAX_3BET_BY_POSITION, PREFLOP_FREQUENCIES,
  calculate3BetDefenseFrequency, calculate3BetComposition,
  calculateOpenEV,
} from '@/engine/preflop';
import { parseRange, rangeToGrid, DEFAULT_RANGES, rangePercentage, gridToRange } from '@/engine/ranges';

export default function PreflopPage() {
  const [selectedPosition, setSelectedPosition] = useState<string>('BTN');
  const [viewMode, setViewMode] = useState<'rfi' | '3bet' | '4bet' | 'defend'>('rfi');
  const [customGrid, setCustomGrid] = useState<number[][]>(() =>
    RFI_CHARTS['BTN'] || Array.from({ length: 13 }, () => new Array(13).fill(0))
  );
  const [showMath, setShowMath] = useState(false);

  // Math calculator
  const [openSize, setOpenSize] = useState(2.5);
  const [threeBetSize, setThreeBetSize] = useState(8);
  const [blinds, setBlinds] = useState(1.5);

  const defense3Bet = useMemo(() =>
    calculate3BetDefenseFrequency(openSize, threeBetSize, blinds),
    [openSize, threeBetSize, blinds]
  );

  const composition3Bet = useMemo(() => {
    const totalFreq = defense3Bet.maxCombined3BetFrequency * 0.5;
    return calculate3BetComposition(totalFreq, 0.43);
  }, [defense3Bet]);

  const openEV = useMemo(() =>
    calculateOpenEV(0.52, 0.20, 0.28, openSize, blinds, -0.3),
    [openSize, blinds]
  );

  const handlePositionChange = (pos: string) => {
    setSelectedPosition(pos);
    setCustomGrid(getChartForView(pos, viewMode));
  };

  const handleViewChange = (view: 'rfi' | '3bet' | '4bet' | 'defend') => {
    setViewMode(view);
    setCustomGrid(getChartForView(selectedPosition, view));
  };

  function getChartForView(position: string, view: string): number[][] {
    switch (view) {
      case 'rfi':
        return RFI_CHARTS[position] || Array.from({ length: 13 }, () => new Array(13).fill(0));
      case '3bet': {
        const key = `BB_3BET_vs_${position}`;
        const altKey = `SB_3BET_vs_${position}`;
        return rangeToGrid(parseRange(DEFAULT_RANGES[key] || DEFAULT_RANGES[altKey] || ''));
      }
      case '4bet': {
        return rangeToGrid(parseRange(DEFAULT_RANGES[`${position}_4BET`] || ''));
      }
      case 'defend': {
        return rangeToGrid(parseRange(DEFAULT_RANGES[`BB_CALL_vs_${position}`] || ''));
      }
      default:
        return Array.from({ length: 13 }, () => new Array(13).fill(0));
    }
  }

  const gridRange = gridToRange(customGrid);
  const percentage = rangePercentage(gridRange);

  const positions = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
  const chartTypes = [
    { key: 'rfi' as const, label: 'RFI', desc: 'Open raise' },
    { key: '3bet' as const, label: '3-Bet', desc: 'vs open' },
    { key: '4bet' as const, label: '4-Bet', desc: 'vs 3-bet' },
    { key: 'defend' as const, label: 'Defend', desc: 'BB call' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold">
          <span className="text-[var(--gold)]">Preflop</span> Charts
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">GTO ranges based on Janda&apos;s framework, 6-max 100bb</p>
      </div>

      {/* Position Selector - Poker Table Visual */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3 text-center">Position</h2>

        {/* Poker table layout */}
        <div className="relative felt-bg rounded-full mx-auto max-w-[280px] aspect-[2/1] flex items-center justify-center mb-2">
          <span className="text-xs text-green-200/30 font-bold">TABLE</span>

          {/* Position buttons arranged around the table */}
          {positions.map((pos, i) => {
            const angles = [-30, 30, 75, 135, 195, 245]; // roughly around table
            const angle = (angles[i] * Math.PI) / 180;
            const rx = 52;
            const ry = 48;
            const left = 50 + rx * Math.cos(angle);
            const top = 50 + ry * Math.sin(angle);

            return (
              <button
                key={pos}
                onClick={() => handlePositionChange(pos)}
                className={`absolute w-10 h-10 rounded-full text-xs font-bold transition-all
                  ${selectedPosition === pos
                    ? 'bg-[var(--gold)] text-black scale-110 shadow-lg shadow-yellow-900/50'
                    : 'bg-gray-800 text-gray-400 active:bg-gray-700'
                  }`}
                style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
              >
                {pos}
              </button>
            );
          })}
        </div>

        {/* Position info bar */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <span>
            RFI: <span className="font-mono text-[var(--gold)]">{RFI_FREQUENCIES[selectedPosition] || 0}%</span>
          </span>
          <span>
            Open: <span className="font-mono text-[var(--gold)]">{OPEN_SIZES[selectedPosition] || 2.5}x</span>
          </span>
          {MAX_3BET_BY_POSITION[selectedPosition] && (
            <span>
              Max 3b: <span className="font-mono text-[var(--gold)]">{MAX_3BET_BY_POSITION[selectedPosition].max3BetPercent}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="flex gap-2">
        {chartTypes.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => handleViewChange(key)}
            className={`flex-1 py-2 rounded-lg text-center transition-all
              ${viewMode === key
                ? 'bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/40'
                : 'bg-gray-800/50 text-gray-400 border border-transparent active:bg-gray-700'
              }`}
          >
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-[10px] opacity-60">{desc}</div>
          </button>
        ))}
      </div>

      {/* Range Grid */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-300">
            {selectedPosition} {viewMode === 'rfi' ? 'RFI' : viewMode === '3bet' ? '3-Bet' : viewMode === '4bet' ? '4-Bet' : 'Defense'}
          </h2>
          <span className="text-sm font-mono text-[var(--gold)]">{percentage.toFixed(1)}%</span>
        </div>
        <RangeEditor grid={customGrid} onChange={setCustomGrid} />
      </div>

      {/* Position Guide */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3">Opening Frequency by Position</h2>
        <div className="space-y-2">
          {positions.filter(p => p !== 'BB').map(pos => {
            const freq = RFI_FREQUENCIES[pos] || 0;
            const size = OPEN_SIZES[pos] || 2.5;
            return (
              <div key={pos} className="flex items-center gap-2">
                <span className={`w-8 text-center text-xs font-bold ${pos === selectedPosition ? 'text-[var(--gold)]' : 'text-gray-500'}`}>
                  {pos}
                </span>
                <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pos === selectedPosition ? 'bg-[var(--gold)]/60' : 'bg-blue-500/40'}`}
                    style={{ width: `${freq}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-gray-400 w-10 text-right">{freq}%</span>
                <span className="text-gray-600 text-xs">|</span>
                <span className="font-mono text-xs text-gray-500 w-8 text-right">{size}x</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Math Lab - collapsible */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <button
          onClick={() => setShowMath(!showMath)}
          className="w-full flex items-center justify-between text-sm"
        >
          <h2 className="font-semibold">
            <span className="text-[var(--gold)]">GTO</span> Math Lab
          </h2>
          <span className="text-gray-500 text-xs">{showMath ? 'Hide' : 'Show'}</span>
        </button>

        {showMath && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Open (bb)</label>
                <input type="number" value={openSize} onChange={e => setOpenSize(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" step={0.5} min={2} max={5} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">3-Bet (bb)</label>
                <input type="number" value={threeBetSize} onChange={e => setThreeBetSize(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" step={1} min={6} max={15} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Blinds</label>
                <input type="number" value={blinds} onChange={e => setBlinds(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" step={0.5} min={1} max={3} />
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase mb-1">3-Bet Needs Folds</div>
                <div className="text-lg font-mono font-bold text-red-400">
                  {(defense3Bet.immediateProfit * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase mb-1">Min Defense</div>
                <div className="text-lg font-mono font-bold text-green-400">
                  {(defense3Bet.minDefenseFrequency * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase mb-1">Max 3-Bet Freq</div>
                <div className="text-lg font-mono font-bold text-yellow-400">
                  {(defense3Bet.maxCombined3BetFrequency * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase mb-1">Open EV</div>
                <div className={`text-lg font-mono font-bold ${openEV >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {openEV >= 0 ? '+' : ''}{openEV.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Value vs Bluff bar */}
            <div>
              <div className="text-xs text-gray-500 mb-1">3-Bet Composition</div>
              <div className="w-full bg-gray-700 rounded-full h-5 overflow-hidden flex">
                <div className="bg-green-500 h-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ width: `${composition3Bet.valuePercentage * 100}%` }}>
                  {(composition3Bet.valuePercentage * 100).toFixed(0)}% Value
                </div>
                <div className="bg-red-500/70 h-full flex-1 flex items-center justify-center text-[10px] font-bold text-white">
                  {(composition3Bet.bluffPercentage * 100).toFixed(0)}% Bluff
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Concepts */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3">Key Concepts</h2>
        <div className="space-y-2 text-xs text-gray-500">
          <div className="bg-gray-800/30 rounded-lg p-2">
            <span className="text-[var(--gold)] font-semibold">MDF</span> = Pot / (Pot + Bet) - How often you must defend to prevent profitable bluffs
          </div>
          <div className="bg-gray-800/30 rounded-lg p-2">
            <span className="text-[var(--gold)] font-semibold">Polarized</span> = Strong hands + bluffs. Betting/raising ranges are typically polarized.
          </div>
          <div className="bg-gray-800/30 rounded-lg p-2">
            <span className="text-[var(--gold)] font-semibold">Condensed</span> = Medium-strength hands. Calling ranges are typically condensed.
          </div>
        </div>
      </div>
    </div>
  );
}
