'use client';

import React, { useState, useCallback, useRef } from 'react';
import RangeEditor from '@/components/RangeEditor';
import BoardSelector from '@/components/BoardSelector';
import { SolverProgress, ActionBreakdown, PotOddsDisplay } from '@/components/EVDisplay';
import StrategyDisplay, { solverResultsToStrategy } from '@/components/StrategyDisplay';
import { CardIndex, Street, STREET_NAMES, SolverConfig } from '@/engine/types';
import { CFRSolver } from '@/engine/cfr';
import { gridToRange, rangeToGrid, parseRange, DEFAULT_RANGES } from '@/engine/ranges';

interface SolverState {
  running: boolean;
  iteration: number;
  exploitability: number;
  timeMs: number;
  nodeCount: number;
  results: {
    actions: string[];
    handStrategies: Map<number, Float32Array>;
    overallFrequencies: Float32Array;
  } | null;
}

export default function SolverPage() {
  // Step tracking
  const [step, setStep] = useState(1);

  // Game config
  const [street, setStreet] = useState<Street>(Street.FLOP);
  const [board, setBoard] = useState<CardIndex[]>([]);
  const [stackDepth, setStackDepth] = useState(100);
  const [potSize, setPotSize] = useState(6);
  const [maxIterations, setMaxIterations] = useState(10000);
  const [targetExploitability, setTargetExploitability] = useState(0.5);

  // Bet sizes
  const [flopBets, setFlopBets] = useState('0.33,0.67,1.0');
  const [turnBets, setTurnBets] = useState('0.5,0.75,1.0');
  const [riverBets, setRiverBets] = useState('0.5,0.75,1.0,1.5');
  const [flopRaises, setFlopRaises] = useState('0.5,1.0');
  const [turnRaises, setTurnRaises] = useState('0.5,1.0');
  const [riverRaises, setRiverRaises] = useState('0.5,1.0');

  // Ranges
  const [oopGrid, setOopGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BB_3BET_vs_BTN']))
  );
  const [ipGrid, setIpGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BTN_RFI']))
  );
  const [oopPreset, setOopPreset] = useState('BB_3BET_vs_BTN');
  const [ipPreset, setIpPreset] = useState('BTN_RFI');

  // Range section toggles
  const [showRanges, setShowRanges] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Solver state
  const [solver, setSolverState] = useState<SolverState>({
    running: false, iteration: 0, exploitability: Infinity,
    timeMs: 0, nodeCount: 0, results: null,
  });

  const solverRef = useRef<CFRSolver | null>(null);

  // Quick pot odds calc
  const [betAmount, setBetAmount] = useState(4);

  const handleRangePreset = (player: 'oop' | 'ip', preset: string) => {
    const range = parseRange(DEFAULT_RANGES[preset] || '');
    const grid = rangeToGrid(range);
    if (player === 'oop') { setOopGrid(grid); setOopPreset(preset); }
    else { setIpGrid(grid); setIpPreset(preset); }
  };

  const parseBetSizes = (str: string): number[] =>
    str.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);

  const requiredCards = street === Street.FLOP ? 3 : street === Street.TURN ? 4 : 5;
  const canSolve = board.length >= requiredCards;

  const startSolver = useCallback(async () => {
    const config: SolverConfig = {
      numPlayers: 2, stackDepth, potSize, street, board,
      playerRanges: [gridToRange(oopGrid), gridToRange(ipGrid)],
      betSizes: [[], parseBetSizes(flopBets), parseBetSizes(turnBets), parseBetSizes(riverBets)],
      raiseSizes: [[], parseBetSizes(flopRaises), parseBetSizes(turnRaises), parseBetSizes(riverRaises)],
      maxIterations, targetExploitability, useGPU: true,
    };

    const cfr = new CFRSolver(config);
    solverRef.current = cfr;
    const startTime = performance.now();

    setSolverState(prev => ({ ...prev, running: true, iteration: 0, exploitability: Infinity, timeMs: 0, nodeCount: 0, results: null }));

    cfr.onProgress = (iteration, exploitability) => {
      setSolverState(prev => ({
        ...prev, iteration, exploitability,
        timeMs: performance.now() - startTime,
        nodeCount: cfr.getAggregatedStrategy(0).handStrategies.size,
      }));
    };

    try {
      await cfr.solve();
      const oopStrategy = cfr.getAggregatedStrategy(0);
      setSolverState(prev => ({ ...prev, running: false, timeMs: performance.now() - startTime, results: oopStrategy }));
      setStep(3);
    } catch (err) {
      console.error('Solver error:', err);
      setSolverState(prev => ({ ...prev, running: false }));
    }
  }, [stackDepth, potSize, street, board, oopGrid, ipGrid, flopBets, turnBets, riverBets, flopRaises, turnRaises, riverRaises, maxIterations, targetExploitability]);

  const stopSolver = () => {
    solverRef.current?.cancel();
    setSolverState(prev => ({ ...prev, running: false }));
  };

  const rangePresets = Object.keys(DEFAULT_RANGES);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold">
          <span className="text-[var(--gold)]">GTO</span> Solver
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Pick cards, set ranges, find the optimal play</p>
      </div>

      {/* Step 1: Street + Board */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-[var(--gold)] text-black text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="text-sm font-semibold">Choose the Board</h2>
        </div>

        {/* Street selector */}
        <div className="flex gap-2 mb-4">
          {[Street.FLOP, Street.TURN, Street.RIVER].map(s => (
            <button
              key={s}
              onClick={() => { setStreet(s); setBoard(board.slice(0, s === Street.FLOP ? 3 : s === Street.TURN ? 4 : 5)); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${street === s
                  ? 'bg-[var(--gold)] text-black'
                  : 'bg-gray-800 text-gray-400 active:bg-gray-700'
                }`}
            >
              {STREET_NAMES[s]}
            </button>
          ))}
        </div>

        {/* Board cards */}
        <div className="felt-bg rounded-xl p-4">
          <BoardSelector
            selectedCards={board}
            onCardsChange={setBoard}
            maxCards={requiredCards}
            label={`Pick ${requiredCards} board cards`}
          />
        </div>

        {canSolve && !solver.running && step < 2 && (
          <button
            onClick={() => setStep(2)}
            className="w-full mt-3 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-[var(--gold)] active:bg-gray-700"
          >
            Next: Configure &amp; Solve
          </button>
        )}
      </div>

      {/* Step 2: Config + Solve */}
      {(step >= 2 || canSolve) && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-[var(--gold)] text-black text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-semibold">Configure &amp; Solve</h2>
          </div>

          {/* Quick config */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stack (bb)</label>
              <input type="number" value={stackDepth} onChange={(e) => setStackDepth(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={1} max={500} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pot (bb)</label>
              <input type="number" value={potSize} onChange={(e) => setPotSize(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={1} />
            </div>
          </div>

          {/* Ranges - collapsible */}
          <button
            onClick={() => setShowRanges(!showRanges)}
            className="w-full flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg mb-2 text-sm"
          >
            <span className="text-gray-300">Player Ranges</span>
            <span className="text-gray-500 text-xs">{showRanges ? 'Hide' : 'Show'}</span>
          </button>

          {showRanges && (
            <div className="space-y-4 mb-4">
              {/* OOP Range */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400">OOP Range</span>
                  <select value={oopPreset} onChange={(e) => handleRangePreset('oop', e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                    {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <RangeEditor grid={oopGrid} onChange={setOopGrid} />
              </div>

              {/* IP Range */}
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400">IP Range</span>
                  <select value={ipPreset} onChange={(e) => handleRangePreset('ip', e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                    {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <RangeEditor grid={ipGrid} onChange={setIpGrid} />
              </div>
            </div>
          )}

          {/* Advanced settings - collapsible */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg mb-4 text-sm"
          >
            <span className="text-gray-300">Advanced Settings</span>
            <span className="text-gray-500 text-xs">{showSettings ? 'Hide' : 'Show'}</span>
          </button>

          {showSettings && (
            <div className="space-y-3 mb-4 bg-gray-800/30 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Max Iterations</label>
                  <input type="number" value={maxIterations} onChange={(e) => setMaxIterations(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" min={100} max={10000000} step={1000} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Target Exploit. (bb)</label>
                  <input type="number" value={targetExploitability} onChange={(e) => setTargetExploitability(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" min={0.001} max={10} step={0.1} />
                </div>
              </div>
              {[
                ['Flop Bets', flopBets, setFlopBets],
                ['Turn Bets', turnBets, setTurnBets],
                ['River Bets', riverBets, setRiverBets],
                ['Flop Raises', flopRaises, setFlopRaises],
                ['Turn Raises', turnRaises, setTurnRaises],
                ['River Raises', riverRaises, setRiverRaises],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{label as string} (x pot)</label>
                  <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono" />
                </div>
              ))}
            </div>
          )}

          {/* Solve button */}
          <button
            onClick={solver.running ? stopSolver : startSolver}
            disabled={!canSolve && !solver.running}
            className={`w-full py-3.5 rounded-xl text-base font-bold transition-all
              ${solver.running
                ? 'bg-red-600 active:bg-red-500 text-white'
                : canSolve
                  ? 'btn-gold text-lg'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
          >
            {solver.running ? 'Stop Solver' : canSolve ? 'SOLVE' : `Select ${requiredCards} board cards first`}
          </button>

          {/* Progress */}
          {(solver.running || solver.iteration > 0) && (
            <div className="mt-3">
              <SolverProgress
                iteration={solver.iteration}
                maxIterations={maxIterations}
                exploitability={solver.exploitability}
                targetExploitability={targetExploitability}
                timeMs={solver.timeMs}
                nodeCount={solver.nodeCount}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {solver.results && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="text-sm font-semibold">GTO Strategy</h2>
          </div>

          <div className="mb-4">
            <h3 className="text-xs text-gray-500 mb-2 uppercase">Action Frequencies</h3>
            <ActionBreakdown actions={solver.results.actions.map((action, i) => ({
              action, frequency: solver.results!.overallFrequencies[i] || 0, ev: 0,
            }))} />
          </div>

          <StrategyDisplay
            strategy={solverResultsToStrategy(solver.results.handStrategies, solver.results.actions)}
            actions={solver.results.actions}
            title="Per-Hand Strategy"
          />
        </div>
      )}

      {/* GTO Quick Calculator */}
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <h2 className="text-sm font-semibold mb-3">
          <span className="text-[var(--gold)]">GTO</span> Quick Math
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pot (bb)</label>
            <input type="number" value={potSize} onChange={(e) => setPotSize(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={0} step={0.5} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bet (bb)</label>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" min={0} step={0.5} />
          </div>
        </div>
        <PotOddsDisplay potSize={potSize} betSize={betAmount} callAmount={betAmount} />
      </div>
    </div>
  );
}
