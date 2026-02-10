'use client';

import React, { useState, useCallback } from 'react';
import BoardSelector from '@/components/BoardSelector';
import RangeEditor from '@/components/RangeEditor';
import { EquityBar, EVChip, PotOddsDisplay } from '@/components/EVDisplay';
import { CardIndex, RANKS, SUITS, indexToCard, cardToIndex, Suit } from '@/engine/types';
import { calculateEquityVsRange } from '@/engine/equity';
import { parseRange, rangeToGrid, gridToRange, DEFAULT_RANGES, ALL_COMBOS, rangePercentage } from '@/engine/ranges';

const SUIT_SYMBOLS: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const SUIT_COLORS: Record<Suit, string> = { s: 'text-gray-200', h: 'text-red-400', d: 'text-blue-400', c: 'text-green-400' };

interface EquityResult {
  equity: number;
  wins: number;
  ties: number;
  losses: number;
  samples: number;
}

export default function EquityPage() {
  const [heroCard1, setHeroCard1] = useState<CardIndex[]>([]);
  const [heroCard2, setHeroCard2] = useState<CardIndex[]>([]);
  const [board, setBoard] = useState<CardIndex[]>([]);
  const [villainGrid, setVillainGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BTN_RFI']))
  );
  const [villainPreset, setVillainPreset] = useState('BTN_RFI');
  const [numSims, setNumSims] = useState(50000);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [calcTime, setCalcTime] = useState(0);

  // Pot calculation
  const [potSize, setPotSize] = useState(6);
  const [betSize, setBetSize] = useState(4);

  const heroCards = [...heroCard1, ...heroCard2].slice(0, 2);
  const allDeadCards = [...heroCards, ...board];

  const handleVillainPreset = (preset: string) => {
    setVillainPreset(preset);
    const range = parseRange(DEFAULT_RANGES[preset] || '');
    setVillainGrid(rangeToGrid(range));
  };

  const calculate = useCallback(async () => {
    if (heroCards.length < 2) return;

    setCalculating(true);
    const startTime = performance.now();

    // Run in next tick to allow UI update
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      const villainRange = gridToRange(villainGrid);
      const result = calculateEquityVsRange(
        [heroCards[0], heroCards[1]] as [CardIndex, CardIndex],
        villainRange,
        board,
        numSims,
      );

      setResult(result);
      setCalcTime(performance.now() - startTime);
    } catch (err) {
      console.error('Equity calculation error:', err);
    } finally {
      setCalculating(false);
    }
  }, [heroCards, board, villainGrid, numSims]);

  const rangePresets = Object.keys(DEFAULT_RANGES);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equity Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monte Carlo equity simulation - calculate your hand equity against any range.
          Supports GPU acceleration for parallel computation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Hero Hand & Board */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Hero Hand</h2>
            <BoardSelector
              selectedCards={heroCards}
              onCardsChange={(cards) => {
                setHeroCard1(cards.slice(0, 1));
                setHeroCard2(cards.slice(1, 2));
              }}
              maxCards={2}
              deadCards={board}
              label="Select 2 hole cards"
            />

            {heroCards.length === 2 && (
              <div className="mt-3 flex items-center gap-2">
                {heroCards.map(idx => {
                  const card = indexToCard(idx);
                  return (
                    <span key={idx} className={`text-2xl font-bold ${SUIT_COLORS[card.suit]}`}>
                      {card.rank}{SUIT_SYMBOLS[card.suit]}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <BoardSelector
              selectedCards={board}
              onCardsChange={setBoard}
              maxCards={5}
              deadCards={heroCards}
              label="Board (0-5 cards)"
            />
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Simulation Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Number of Simulations</label>
                <input
                  type="number"
                  value={numSims}
                  onChange={e => setNumSims(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                  min={1000}
                  max={1000000}
                  step={10000}
                />
              </div>
              <button
                onClick={calculate}
                disabled={heroCards.length < 2 || calculating}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all
                  ${calculating
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                {calculating ? 'Calculating...' : 'Calculate Equity'}
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300">Results</h2>

              <EquityBar equity={result.equity} label="Hero Equity" height={32} />

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 uppercase">Wins</div>
                  <div className="text-lg font-mono text-green-400">{((result.wins / result.samples) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-600">{result.wins.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 uppercase">Ties</div>
                  <div className="text-lg font-mono text-yellow-400">{((result.ties / result.samples) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-600">{result.ties.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500 uppercase">Losses</div>
                  <div className="text-lg font-mono text-red-400">{((result.losses / result.samples) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-600">{result.losses.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{result.samples.toLocaleString()} samples</span>
                <span>{(calcTime / 1000).toFixed(2)}s</span>
              </div>
            </div>
          )}

          {/* Pot Odds Calculator */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Pot Analysis</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Pot (bb)</label>
                <input type="number" value={potSize} onChange={e => setPotSize(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" min={0} step={0.5} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Bet (bb)</label>
                <input type="number" value={betSize} onChange={e => setBetSize(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" min={0} step={0.5} />
              </div>
            </div>
            <PotOddsDisplay potSize={potSize} betSize={betSize} callAmount={betSize} />

            {result && (
              <div className="mt-3 p-3 bg-gray-800 rounded">
                <div className="text-xs">
                  {result.equity >= betSize / (potSize + betSize) ? (
                    <div className="text-green-400 font-semibold">
                      CALL - You have {(result.equity * 100).toFixed(1)}% equity, need {(betSize / (potSize + betSize) * 100).toFixed(1)}%
                    </div>
                  ) : (
                    <div className="text-red-400 font-semibold">
                      FOLD - You have {(result.equity * 100).toFixed(1)}% equity, need {(betSize / (potSize + betSize) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle - Villain Range */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300">Villain Range</h2>
            <select
              value={villainPreset}
              onChange={e => handleVillainPreset(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
            >
              {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <RangeEditor grid={villainGrid} onChange={setVillainGrid} />
        </div>

        {/* Right - Analysis */}
        <div className="space-y-4">
          {/* Quick Reference */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Equity Reference</h2>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-gray-800 rounded">
                <div className="font-semibold text-gray-400 mb-1">Common Preflop All-In Equities</div>
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between"><span className="text-gray-500">AA vs KK</span><span className="text-green-400">~82%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">AA vs AKs</span><span className="text-green-400">~87%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">KK vs AKo</span><span className="text-green-400">~70%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">QQ vs AKo</span><span className="text-green-400">~57%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">AKs vs JJ</span><span className="text-red-400">~46%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">77 vs AKo</span><span className="text-green-400">~55%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">AKs vs AQs</span><span className="text-green-400">~70%</span></div>
                </div>
              </div>

              <div className="p-2 bg-gray-800 rounded">
                <div className="font-semibold text-gray-400 mb-1">Post-flop Draw Equities</div>
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between"><span className="text-gray-500">Flush Draw (9 outs)</span><span className="text-blue-400">~35%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">OESD (8 outs)</span><span className="text-blue-400">~31%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Gutshot (4 outs)</span><span className="text-blue-400">~17%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Two Overcards (6 outs)</span><span className="text-blue-400">~24%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Combo Draw (15 outs)</span><span className="text-green-400">~54%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Set vs Overpair</span><span className="text-green-400">~91%</span></div>
                </div>
              </div>

              <div className="p-2 bg-gray-800 rounded">
                <div className="font-semibold text-gray-400 mb-1">Rule of 2 and 4</div>
                <div className="text-gray-500">
                  <p><span className="text-gray-300">Flop to River:</span> Outs x 4 = approximate %</p>
                  <p><span className="text-gray-300">Turn to River:</span> Outs x 2 = approximate %</p>
                </div>
              </div>
            </div>
          </div>

          {/* Janda's Key Insight */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">From the Book</h2>
            <div className="text-xs text-gray-500 space-y-2">
              <blockquote className="border-l-2 border-blue-600 pl-3 italic text-gray-400">
                &quot;A hand which has 100% equity one-third of the time and 0% equity two-thirds of the time
                is better than a hand which always has 33.3% equity.&quot;
              </blockquote>
              <p>
                - Matthew Janda on equity distribution. Hands that make strong hands or nothing
                are more valuable than hands that always make medium-strength holdings because
                it&apos;s easier to realize equity with strong hands.
              </p>
              <blockquote className="border-l-2 border-green-600 pl-3 italic text-gray-400">
                &quot;We want to emphasize playing hands which have a high amount of equity against
                our opponent&apos;s betting and calling range, not against their folding range.&quot;
              </blockquote>
              <p>
                - This is why suited connectors (9&#9824;8&#9824;) are often better calls than A&#9824;7&#9829;
                despite having less total equity. The suited connector retains equity against
                strong ranges through draws, while A7o&apos;s equity comes mostly from beating hands
                that fold.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
