'use client';

import React, { useState, useCallback, useRef } from 'react';
import RangeEditor from '@/components/RangeEditor';
import BoardSelector from '@/components/BoardSelector';
import { SolverProgress, PotOddsDisplay, ActionBreakdown } from '@/components/EVDisplay';
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
  const [stackDepth, setStackDepth] = useState(100);
  const [potSize, setPotSize] = useState(6);
  const [street, setStreet] = useState<Street>(Street.FLOP);
  const [board, setBoard] = useState<CardIndex[]>([]);
  const [maxIterations, setMaxIterations] = useState(10000);
  const [targetExploitability, setTargetExploitability] = useState(0.5);

  const [flopBets, setFlopBets] = useState('0.33,0.67,1.0');
  const [turnBets, setTurnBets] = useState('0.5,0.75,1.0');
  const [riverBets, setRiverBets] = useState('0.5,0.75,1.0,1.5');
  const [flopRaises, setFlopRaises] = useState('0.5,1.0');
  const [turnRaises, setTurnRaises] = useState('0.5,1.0');
  const [riverRaises, setRiverRaises] = useState('0.5,1.0');

  const [oopGrid, setOopGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BB_3BET_vs_BTN']))
  );
  const [ipGrid, setIpGrid] = useState<number[][]>(() =>
    rangeToGrid(parseRange(DEFAULT_RANGES['BTN_RFI']))
  );
  const [oopPreset, setOopPreset] = useState('BB_3BET_vs_BTN');
  const [ipPreset, setIpPreset] = useState('BTN_RFI');

  const [solver, setSolverState] = useState<SolverState>({
    running: false, iteration: 0, exploitability: Infinity,
    timeMs: 0, nodeCount: 0, results: null,
  });

  const solverRef = useRef<CFRSolver | null>(null);
  const [betAmount, setBetAmount] = useState(4);

  const handleRangePreset = (player: 'oop' | 'ip', preset: string) => {
    const range = parseRange(DEFAULT_RANGES[preset] || '');
    const grid = rangeToGrid(range);
    if (player === 'oop') { setOopGrid(grid); setOopPreset(preset); }
    else { setIpGrid(grid); setIpPreset(preset); }
  };

  const parseBetSizes = (str: string): number[] =>
    str.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GTO Poker Solver</h1>
        <p className="text-sm text-gray-500 mt-1">
          CFR solver with WebGPU acceleration. Based on GTO principles from Janda&apos;s &quot;Applications of No-Limit Hold&apos;em&quot;.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Configuration */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Game Setup</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stack Depth (bb)</label>
                  <input type="number" value={stackDepth} onChange={(e) => setStackDepth(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" min={1} max={500} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pot Size (bb)</label>
                  <input type="number" value={potSize} onChange={(e) => setPotSize(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" min={1} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Starting Street</label>
                <div className="flex gap-1">
                  {[Street.FLOP, Street.TURN, Street.RIVER].map(s => (
                    <button key={s} onClick={() => setStreet(s)}
                      className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors
                        ${street === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {STREET_NAMES[s]}
                    </button>
                  ))}
                </div>
              </div>

              <BoardSelector selectedCards={board} onCardsChange={setBoard}
                maxCards={street === Street.FLOP ? 3 : street === Street.TURN ? 4 : 5}
                label={`Board (${street === Street.FLOP ? '3' : street === Street.TURN ? '4' : '5'} cards)`} />
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Bet Sizes (x pot)</h2>
            <div className="space-y-2">
              {[
                ['Flop Bets', flopBets, setFlopBets],
                ['Turn Bets', turnBets, setTurnBets],
                ['River Bets', riverBets, setRiverBets],
                ['Flop Raises', flopRaises, setFlopRaises],
                ['Turn Raises', turnRaises, setTurnRaises],
                ['River Raises', riverRaises, setRiverRaises],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{label as string}</label>
                  <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Solver Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Iterations</label>
                <input type="number" value={maxIterations} onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" min={100} max={10000000} step={1000} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Exploitability (bb)</label>
                <input type="number" value={targetExploitability} onChange={(e) => setTargetExploitability(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" min={0.001} max={10} step={0.1} />
              </div>
              <button onClick={solver.running ? stopSolver : startSolver}
                disabled={board.length < (street === Street.FLOP ? 3 : street === Street.TURN ? 4 : 5)}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  solver.running
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}>
                {solver.running ? 'Stop Solver' : 'Run Solver'}
              </button>
              {board.length < (street === Street.FLOP ? 3 : street === Street.TURN ? 4 : 5) && (
                <p className="text-xs text-amber-400">Select board cards to start solving</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">GTO Quick Calculator</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bet Size (bb)</label>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" min={0} step={0.5} />
            </div>
            <div className="mt-3">
              <PotOddsDisplay potSize={potSize} betSize={betAmount} callAmount={betAmount} />
            </div>
          </div>
        </div>

        {/* Middle - Ranges */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-300">OOP Range (Player 1)</h2>
              <select value={oopPreset} onChange={(e) => handleRangePreset('oop', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <RangeEditor grid={oopGrid} onChange={setOopGrid} />
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-300">IP Range (Player 2)</h2>
              <select value={ipPreset} onChange={(e) => handleRangePreset('ip', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                {rangePresets.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <RangeEditor grid={ipGrid} onChange={setIpGrid} />
          </div>
        </div>

        {/* Right - Results */}
        <div className="space-y-4">
          {(solver.running || solver.iteration > 0) && (
            <SolverProgress iteration={solver.iteration} maxIterations={maxIterations}
              exploitability={solver.exploitability} targetExploitability={targetExploitability}
              timeMs={solver.timeMs} nodeCount={solver.nodeCount} />
          )}

          {solver.results && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">OOP Strategy</h2>
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 mb-2">Overall Action Frequencies</h3>
                <ActionBreakdown actions={solver.results.actions.map((action, i) => ({
                  action, frequency: solver.results!.overallFrequencies[i] || 0, ev: 0,
                }))} />
              </div>
              <StrategyDisplay
                strategy={solverResultsToStrategy(solver.results.handStrategies, solver.results.actions)}
                actions={solver.results.actions}
                title="Per-Hand Strategy" />
            </div>
          )}

          {!solver.results && !solver.running && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-center">
              <div className="text-4xl mb-3 opacity-30">&#9824;</div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Ready to Solve</h3>
              <ol className="text-xs text-gray-500 text-left space-y-2 max-w-xs mx-auto">
                <li>1. Select the starting street and board cards</li>
                <li>2. Configure OOP and IP ranges using the 13x13 grid</li>
                <li>3. Set bet sizes (as fractions of the pot)</li>
                <li>4. Click &quot;Run Solver&quot; to compute GTO strategy</li>
              </ol>
              <div className="mt-4 p-3 bg-gray-800 rounded text-xs text-gray-500">
                The solver uses <strong className="text-gray-400">Counterfactual Regret Minimization</strong> (CFR),
                the same algorithm behind PioSolver, to converge on Nash Equilibrium strategies.
                WebGPU acceleration leverages your RTX 4070 Ti Super for parallel equity calculations.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
