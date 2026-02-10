'use client';

import React, { useState, useMemo } from 'react';
import RangeEditor from '@/components/RangeEditor';
import { RANKS, POSITION_NAMES, Position } from '@/engine/types';
import {
  RFI_CHARTS, RFI_FREQUENCIES, OPEN_SIZES, HAND_GRID,
  MAX_3BET_BY_POSITION, PREFLOP_FREQUENCIES,
  calculate3BetDefenseFrequency, calculate3BetComposition,
  calculateOpenEV, getRecommendedBetSizing,
} from '@/engine/preflop';
import { parseRange, rangeToGrid, DEFAULT_RANGES, rangePercentage, gridToRange } from '@/engine/ranges';

const RANK_LABELS = [...RANKS].reverse();

export default function PreflopPage() {
  const [selectedPosition, setSelectedPosition] = useState<string>('BTN');
  const [viewMode, setViewMode] = useState<'rfi' | '3bet' | '4bet' | 'defend'>('rfi');
  const [customGrid, setCustomGrid] = useState<number[][]>(() =>
    RFI_CHARTS['BTN'] || Array.from({ length: 13 }, () => new Array(13).fill(0))
  );

  // Preflop math calculator state
  const [openSize, setOpenSize] = useState(2.5);
  const [threeBetSize, setThreeBetSize] = useState(8);
  const [fourBetSize, setFourBetSize] = useState(20);
  const [fiveBeAllIn, setFiveBeAllIn] = useState(100);
  const [blinds, setBlinds] = useState(1.5);

  // Calculate derived values
  const defense3Bet = useMemo(() =>
    calculate3BetDefenseFrequency(openSize, threeBetSize, blinds),
    [openSize, threeBetSize, blinds]
  );

  const composition3Bet = useMemo(() => {
    const totalFreq = defense3Bet.maxCombined3BetFrequency * 0.5; // per position estimate
    return calculate3BetComposition(totalFreq, 0.43); // ~43% value hands in 3bet range
  }, [defense3Bet]);

  const openEV = useMemo(() =>
    calculateOpenEV(0.52, 0.20, 0.28, openSize, blinds, -0.3),
    [openSize, blinds]
  );

  // Update chart when position changes
  const handlePositionChange = (pos: string) => {
    setSelectedPosition(pos);
    const chart = getChartForView(pos, viewMode);
    setCustomGrid(chart);
  };

  const handleViewChange = (view: 'rfi' | '3bet' | '4bet' | 'defend') => {
    setViewMode(view);
    const chart = getChartForView(selectedPosition, view);
    setCustomGrid(chart);
  };

  function getChartForView(position: string, view: string): number[][] {
    switch (view) {
      case 'rfi':
        return RFI_CHARTS[position] || Array.from({ length: 13 }, () => new Array(13).fill(0));
      case '3bet': {
        const key = `BB_3BET_vs_${position}`;
        const altKey = `SB_3BET_vs_${position}`;
        const rangeStr = DEFAULT_RANGES[key] || DEFAULT_RANGES[altKey] || '';
        return rangeToGrid(parseRange(rangeStr));
      }
      case '4bet': {
        const key = `${position}_4BET`;
        const rangeStr = DEFAULT_RANGES[key] || '';
        return rangeToGrid(parseRange(rangeStr));
      }
      case 'defend': {
        const key = `BB_CALL_vs_${position}`;
        const rangeStr = DEFAULT_RANGES[key] || '';
        return rangeToGrid(parseRange(rangeStr));
      }
      default:
        return Array.from({ length: 13 }, () => new Array(13).fill(0));
    }
  }

  const gridRange = gridToRange(customGrid);
  const percentage = rangePercentage(gridRange);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Preflop GTO Charts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raise First In (RFI), 3-bet, 4-bet, and defense ranges derived from Janda&apos;s mathematical framework.
          All frequencies are based on 6-max, 100bb deep play.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Controls */}
        <div className="space-y-4">
          {/* Position selector */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Position</h2>
            <div className="grid grid-cols-3 gap-1">
              {['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'].map(pos => (
                <button
                  key={pos}
                  onClick={() => handlePositionChange(pos)}
                  className={`px-3 py-2 rounded text-xs font-semibold transition-colors
                    ${selectedPosition === pos
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {pos}
                  {RFI_FREQUENCIES[pos] && (
                    <span className="block text-[10px] opacity-60">{RFI_FREQUENCIES[pos]}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* View mode */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Chart Type</h2>
            <div className="space-y-1">
              {[
                { key: 'rfi', label: 'Raise First In (RFI)', desc: 'Hands to open from this position' },
                { key: '3bet', label: '3-Bet Range', desc: `Hands to 3-bet vs ${selectedPosition} open` },
                { key: '4bet', label: '4-Bet Range', desc: `Hands ${selectedPosition} 4-bets with` },
                { key: 'defend', label: 'BB Defense', desc: `Hands BB calls vs ${selectedPosition} open` },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => handleViewChange(key as typeof viewMode)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors
                    ${viewMode === key
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'}`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-[10px] opacity-60">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Janda's key frequencies */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">GTO Frequencies (Janda)</h2>
            <div className="space-y-2">
              {Object.entries(PREFLOP_FREQUENCIES).map(([key, data]) => (
                <div key={key} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-blue-400">
                      {(data.min * 100).toFixed(0)}-{(data.max * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{data.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3-bet vs position data */}
          {MAX_3BET_BY_POSITION[selectedPosition] && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">
                Max 3-Bet vs {selectedPosition}
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Max 3-Bet %</span>
                  <span className="font-mono text-yellow-400">
                    {MAX_3BET_BY_POSITION[selectedPosition].max3BetPercent}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Value 3-Bet %</span>
                  <span className="font-mono text-green-400">
                    {MAX_3BET_BY_POSITION[selectedPosition].value3BetPercent}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Value Hands</span>
                  <span className="font-mono text-gray-300 text-[10px]">
                    {MAX_3BET_BY_POSITION[selectedPosition].valueHands}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle - Range Grid */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300">
              {selectedPosition} {viewMode === 'rfi' ? 'RFI' : viewMode === '3bet' ? '3-Bet' : viewMode === '4bet' ? '4-Bet' : 'Defense'} Range
            </h2>
            <span className="text-xs text-gray-500 font-mono">{percentage.toFixed(1)}%</span>
          </div>
          <RangeEditor grid={customGrid} onChange={setCustomGrid} />
        </div>

        {/* Right - Calculator & Analysis */}
        <div className="space-y-4">
          {/* Preflop Math Calculator */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Preflop Math Lab</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Open Size (bb)</label>
                  <input type="number" value={openSize} onChange={e => setOpenSize(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    step={0.5} min={2} max={5} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">3-Bet Size (bb)</label>
                  <input type="number" value={threeBetSize} onChange={e => setThreeBetSize(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    step={1} min={6} max={15} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">4-Bet Size (bb)</label>
                  <input type="number" value={fourBetSize} onChange={e => setFourBetSize(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    step={1} min={15} max={30} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Blinds Total</label>
                  <input type="number" value={blinds} onChange={e => setBlinds(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                    step={0.5} min={1} max={3} />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-gray-800 rounded">
                <h3 className="text-[10px] text-gray-500 uppercase mb-2">3-Bet Defense Requirements</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">3-Bet needs folds:</span>
                    <span className="ml-1 font-mono text-red-400">{(defense3Bet.immediateProfit * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Min defense:</span>
                    <span className="ml-1 font-mono text-green-400">{(defense3Bet.minDefenseFrequency * 100).toFixed(1)}%</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Max combined 3-bet:</span>
                    <span className="ml-1 font-mono text-yellow-400">{(defense3Bet.maxCombined3BetFrequency * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-800 rounded">
                <h3 className="text-[10px] text-gray-500 uppercase mb-2">3-Bet Range Composition</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Value %:</span>
                    <span className="ml-1 font-mono text-green-400">{(composition3Bet.valuePercentage * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bluff %:</span>
                    <span className="ml-1 font-mono text-red-400">{(composition3Bet.bluffPercentage * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-3 overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${composition3Bet.valuePercentage * 100}%` }}
                  />
                  <div
                    className="bg-red-500/70 h-full flex-1"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Value</span>
                  <span>Bluffs</span>
                </div>
              </div>

              <div className="p-3 bg-gray-800 rounded">
                <h3 className="text-[10px] text-gray-500 uppercase mb-2">Opening EV (weakest hand)</h3>
                <div className="text-xs">
                  <span className="text-gray-500">EV of opening:</span>
                  <span className={`ml-1 font-mono ${openEV >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {openEV >= 0 ? '+' : ''}{openEV.toFixed(3)} bb
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  From Janda: EV = (fold%)(blinds) + (call%)(EV|called) - (3bet%)(open_size)
                </div>
              </div>
            </div>
          </div>

          {/* Bet Sizing Advisor */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Position Guide</h2>
            <div className="space-y-2 text-xs">
              {['UTG', 'MP', 'CO', 'BTN', 'SB'].map(pos => {
                const freq = RFI_FREQUENCIES[pos];
                const size = OPEN_SIZES[pos];
                return (
                  <div key={pos} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                    <span className={`w-8 text-center font-bold ${pos === selectedPosition ? 'text-blue-400' : 'text-gray-500'}`}>
                      {pos}
                    </span>
                    <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-500/60 h-full transition-all"
                        style={{ width: `${freq}%` }}
                      />
                    </div>
                    <span className="font-mono text-gray-400 w-12 text-right">{freq}%</span>
                    <span className="text-gray-600">|</span>
                    <span className="font-mono text-gray-400 w-10 text-right">{size}x</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Concepts */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Key GTO Concepts</h2>
            <div className="space-y-3 text-xs text-gray-500">
              <div>
                <span className="text-gray-400 font-semibold">Nash Equilibrium:</span> A strategy where neither player has incentive to deviate.
                An optimal player always takes the most +EV line.
              </div>
              <div>
                <span className="text-gray-400 font-semibold">Polarized Range:</span> Strong hands + bluffs, few medium hands.
                Betting/raising ranges are typically polarized.
              </div>
              <div>
                <span className="text-gray-400 font-semibold">Condensed Range:</span> Mostly medium-strength hands.
                Calling ranges are typically condensed.
              </div>
              <div>
                <span className="text-gray-400 font-semibold">Indifference:</span> Making opponent break even with bluff catchers
                so they can&apos;t exploit your bet sizing.
              </div>
              <div>
                <span className="text-gray-400 font-semibold">MDF:</span> Minimum Defense Frequency = P / (P + B).
                How often you must defend to prevent profitable bluffs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
