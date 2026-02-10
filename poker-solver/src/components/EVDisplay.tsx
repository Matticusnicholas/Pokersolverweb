'use client';

import React from 'react';

interface EVDisplayProps {
  ev: number;
  label?: string;
  unit?: string;
  precision?: number;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function EVChip({ ev, label, unit = 'bb', precision = 2, showSign = true, size = 'md' }: EVDisplayProps) {
  const isPositive = ev > 0;
  const isZero = Math.abs(ev) < 0.001;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-lg px-4 py-2',
  };

  const colorClass = isZero
    ? 'bg-gray-700 text-gray-300'
    : isPositive
      ? 'bg-green-900/50 text-green-400 border-green-700'
      : 'bg-red-900/50 text-red-400 border-red-700';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${colorClass} ${sizeClasses[size]} font-mono`}>
      {label && <span className="text-gray-400 font-sans">{label}</span>}
      <span className="font-semibold">
        {showSign && !isZero && (isPositive ? '+' : '')}{ev.toFixed(precision)} {unit}
      </span>
    </span>
  );
}

interface EquityBarProps {
  equity: number; // 0-1
  label?: string;
  height?: number;
}

export function EquityBar({ equity, label, height = 24 }: EquityBarProps) {
  const percentage = equity * 100;
  const color = equity >= 0.5 ? 'bg-green-500' : 'bg-red-500';
  const oppColor = equity >= 0.5 ? 'bg-red-500/50' : 'bg-green-500/50';

  return (
    <div>
      {label && <div className="text-xs text-gray-400 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-700 rounded-full overflow-hidden" style={{ height }}>
          <div className="flex h-full">
            <div
              className={`${color} transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
            <div
              className={`${oppColor} flex-1`}
            />
          </div>
        </div>
        <span className="text-sm font-mono text-gray-300 w-16 text-right">
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

interface ActionBreakdownProps {
  actions: { action: string; frequency: number; ev: number }[];
  potSize?: number;
}

const ACTION_COLORS: Record<string, string> = {
  fold: 'bg-red-500',
  check: 'bg-gray-500',
  call: 'bg-green-500',
  bet: 'bg-blue-500',
  raise: 'bg-amber-500',
  all_in: 'bg-purple-500',
};

export function ActionBreakdown({ actions, potSize }: ActionBreakdownProps) {
  return (
    <div className="space-y-2">
      {actions.map(({ action, frequency, ev }) => (
        <div key={action} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${ACTION_COLORS[action.split(' ')[0]] || 'bg-gray-500'}`} />
          <span className="text-sm text-gray-300 w-24 capitalize">{action}</span>
          <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full ${ACTION_COLORS[action.split(' ')[0]] || 'bg-gray-500'} transition-all duration-300`}
              style={{ width: `${frequency * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400 w-12 text-right">
            {(frequency * 100).toFixed(1)}%
          </span>
          <EVChip ev={ev} size="sm" />
        </div>
      ))}
    </div>
  );
}

interface SolverProgressProps {
  iteration: number;
  maxIterations: number;
  exploitability: number;
  targetExploitability: number;
  timeMs: number;
  nodeCount: number;
}

export function SolverProgress({
  iteration,
  maxIterations,
  exploitability,
  targetExploitability,
  timeMs,
  nodeCount,
}: SolverProgressProps) {
  const progress = (iteration / maxIterations) * 100;
  const iterPerSec = timeMs > 0 ? (iteration / (timeMs / 1000)).toFixed(0) : '...';

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-300">Solver Progress</h4>
        <span className="text-xs text-gray-500">
          {iteration.toLocaleString()} / {maxIterations.toLocaleString()} iterations
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-200 rounded-full"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Exploitability</div>
          <div className={`text-sm font-mono ${exploitability <= targetExploitability ? 'text-green-400' : 'text-yellow-400'}`}>
            {exploitability < 0.001 ? '< 0.001' : exploitability.toFixed(4)} bb
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Target</div>
          <div className="text-sm font-mono text-gray-400">{targetExploitability} bb</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Speed</div>
          <div className="text-sm font-mono text-gray-400">{iterPerSec} iter/s</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Info Sets</div>
          <div className="text-sm font-mono text-gray-400">{nodeCount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

interface PotOddsDisplayProps {
  potSize: number;
  betSize: number;
  callAmount: number;
}

export function PotOddsDisplay({ potSize, betSize, callAmount }: PotOddsDisplayProps) {
  const potOdds = callAmount / (potSize + callAmount);
  const mdf = potSize / (potSize + betSize);
  const bluffFreq = betSize / (potSize + betSize);
  const valueToBluff = (potSize + betSize) / betSize;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
      <h4 className="text-sm font-semibold text-gray-300">GTO Calculations</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Pot Odds</div>
          <div className="text-sm font-mono text-blue-400">
            {(potOdds * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Need {(potOdds * 100).toFixed(1)}% equity to call</div>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase">Min Defense Freq (MDF)</div>
          <div className="text-sm font-mono text-green-400">
            {(mdf * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Must defend at least this much</div>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase">Bluff Breakeven</div>
          <div className="text-sm font-mono text-red-400">
            {(bluffFreq * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Bluff needs folds this often</div>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase">Value:Bluff Ratio</div>
          <div className="text-sm font-mono text-amber-400">
            {valueToBluff.toFixed(2)} : 1
          </div>
          <div className="text-[10px] text-gray-600">For balanced river betting</div>
        </div>
      </div>
    </div>
  );
}
