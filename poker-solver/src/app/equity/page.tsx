'use client';

import React, { useState, useCallback } from 'react';
import BoardSelector from '@/components/BoardSelector';
import RangeEditor from '@/components/RangeEditor';
import { EquityBar, PotOddsDisplay } from '@/components/EVDisplay';
import { CardIndex, Suit, indexToCard } from '@/engine/types';
import { calculateEquityVsRange } from '@/engine/equity';
import { parseRange, rangeToGrid, gridToRange, DEFAULT_RANGES } from '@/engine/ranges';

const SUIT_SYMBOLS: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const SUIT_COLORS: Record<Suit, string> = { s: 'text-gray-200', h: 'text-red-400', d: 'text-red-400', c: 'text-gray-200' };

interface EquityResult {
  equity: number;
  wins: number;
  ties: number;
  losses: number;
  samples: number;
}

export default function EquityPage() {
  const [heroCards, setHeroCards] = useState<CardIndex[]>([]);
  const [board, setBoard] = useState<CardIndex[]>([]);
  const [showBoard, setShowBoard] = useState(false);
  const [villainGrid, setVillainGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BTN_RFI']))
  );
  const [villainPreset, setVillainPreset] = useState('BTN_RFI');
  const [showRange, setShowRange] = useState(false);
  const [numSims, setNumSims] = useState(50000);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [calcTime, setCalcTime] = useState(0);

  const [potSize, setPotSize] = useState(6);
  const [betSize, setBetSize] = useState(4);

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
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      const villainRange = gridToRange(villainGrid);
      const res = calculateEquityVsRange(
        [heroCards[0], heroCards[1]] as [CardIndex, CardIndex],
        villainRange,
        board,
        numSims,
      );
      setResult(res);
      setCalcTime(performance.now() - startTime);
    } catch (err) {
      console.error('Equity calculation error:', err);
    } finally {
      setCalculating(false);
    }
  }, [heroCards, board, villainGrid, numSims]);

  const rangePresets = Object.keys(DEFAULT_RANGES);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold">
          <span className="text-[var(--gold)]">Equity</span> Calculator
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Your hand vs. villain&apos;s range</p>
      </div>

      {/* Hero Hand */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-2">Your Hand</h2>
        <div className="felt-bg rounded-xl p-4">
          <BoardSelector
            selectedCards={heroCards}
            onCardsChange={(cards) => setHeroCards(cards.slice(0, 2))}
            maxCards={2}
            deadCards={board}
            label="Pick your 2 hole cards"
          />
        </div>

        {/* Hero hand display */}
        {heroCards.length === 2 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            {heroCards.map(idx => {
              const card = indexToCard(idx);
              return (
                <span key={idx} className={`text-3xl font-bold ${SUIT_COLORS[card.suit]}`}>
                  {card.rank}{SUIT_SYMBOLS[card.suit]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Board - collapsible */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <button
          onClick={() => setShowBoard(!showBoard)}
          className="w-full flex items-center justify-between text-sm"
        >
          <h2 className="font-semibold">
            Board Cards
            {board.length > 0 && <span className="text-gray-500 font-normal ml-2">({board.length} selected)</span>}
          </h2>
          <span className="text-gray-500 text-xs">{showBoard ? 'Hide' : 'Show'}</span>
        </button>

        {showBoard && (
          <div className="mt-3 felt-bg rounded-xl p-4">
            <BoardSelector
              selectedCards={board}
              onCardsChange={setBoard}
              maxCards={5}
              deadCards={heroCards}
              label="Board (0-5 cards)"
            />
          </div>
        )}
      </div>

      {/* Villain Range - collapsible */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <button
          onClick={() => setShowRange(!showRange)}
          className="w-full flex items-center justify-between text-sm"
        >
          <h2 className="font-semibold">Villain Range</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{villainPreset.replace(/_/g, ' ')}</span>
            <span className="text-gray-500 text-xs">{showRange ? 'Hide' : 'Show'}</span>
          </div>
        </button>

        <div className="mt-2">
          <select
            value={villainPreset}
            onChange={e => handleVillainPreset(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {showRange && (
          <div className="mt-3">
            <RangeEditor grid={villainGrid} onChange={setVillainGrid} />
          </div>
        )}
      </div>

      {/* Calculate */}
      <button
        onClick={calculate}
        disabled={heroCards.length < 2 || calculating}
        className={`w-full py-3.5 rounded-xl text-base font-bold transition-all
          ${calculating
            ? 'bg-gray-700 text-gray-400 cursor-wait'
            : heroCards.length >= 2
              ? 'btn-gold text-lg'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
      >
        {calculating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full inline-block" />
            Calculating...
          </span>
        ) : heroCards.length >= 2 ? 'CALCULATE EQUITY' : 'Pick 2 hole cards first'}
      </button>

      {/* Results */}
      {result && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 space-y-4">
          <h2 className="text-sm font-semibold">Results</h2>

          <EquityBar equity={result.equity} label="Your Equity" height={36} />

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-950/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase">Win</div>
              <div className="text-xl font-mono font-bold text-green-400">
                {((result.wins / result.samples) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-yellow-950/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase">Tie</div>
              <div className="text-xl font-mono font-bold text-yellow-400">
                {((result.ties / result.samples) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-red-950/30 rounded-lg p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase">Lose</div>
              <div className="text-xl font-mono font-bold text-red-400">
                {((result.losses / result.samples) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{result.samples.toLocaleString()} simulations</span>
            <span>{(calcTime / 1000).toFixed(2)}s</span>
          </div>

          {/* Call/Fold recommendation */}
          <div className={`p-3 rounded-lg text-center font-semibold text-sm ${
            result.equity >= betSize / (potSize + betSize)
              ? 'bg-green-950/40 text-green-400 border border-green-800/50'
              : 'bg-red-950/40 text-red-400 border border-red-800/50'
          }`}>
            {result.equity >= betSize / (potSize + betSize)
              ? `CALL - ${(result.equity * 100).toFixed(1)}% equity vs ${(betSize / (potSize + betSize) * 100).toFixed(1)}% needed`
              : `FOLD - ${(result.equity * 100).toFixed(1)}% equity vs ${(betSize / (potSize + betSize) * 100).toFixed(1)}% needed`
            }
          </div>
        </div>
      )}

      {/* Pot Odds */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3">
          <span className="text-[var(--gold)]">GTO</span> Quick Math
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pot (bb)</label>
            <input type="number" value={potSize} onChange={e => setPotSize(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={0} step={0.5} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bet (bb)</label>
            <input type="number" value={betSize} onChange={e => setBetSize(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={0} step={0.5} />
          </div>
        </div>
        <PotOddsDisplay potSize={potSize} betSize={betSize} callAmount={betSize} />
      </div>

      {/* Quick Reference */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3">Quick Reference</h2>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-2 space-y-1 font-mono">
              <div className="text-gray-500 font-sans text-[10px] uppercase mb-1">Preflop All-In</div>
              <div className="flex justify-between"><span className="text-gray-400">AA vs KK</span><span className="text-green-400">82%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">QQ vs AKo</span><span className="text-green-400">57%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">77 vs AKo</span><span className="text-green-400">55%</span></div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 space-y-1 font-mono">
              <div className="text-gray-500 font-sans text-[10px] uppercase mb-1">Draw Equity</div>
              <div className="flex justify-between"><span className="text-gray-400">Flush Draw</span><span className="text-blue-400">35%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">OESD</span><span className="text-blue-400">31%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Gutshot</span><span className="text-blue-400">17%</span></div>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2 text-gray-500">
            <span className="text-gray-300 font-semibold">Rule of 2&amp;4:</span> Outs x 4 on flop, Outs x 2 on turn = approx equity %
          </div>
        </div>
      </div>
    </div>
  );
}
