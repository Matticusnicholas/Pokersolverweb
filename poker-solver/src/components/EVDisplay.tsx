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
  equity: number;
  label?: string;
  height?: number;
}

export function EquityBar({ equity, label, height = 28 }: EquityBarProps) {
  const percentage = equity * 100;
  const color = equity >= 0.5 ? 'bg-green-500' : 'bg-red-500';
  const oppColor = equity >= 0.5 ? 'bg-red-500/50' : 'bg-green-500/50';

  return (
    <div>
      {label && <div className="text-xs text-gray-400 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-700 rounded-full overflow-hidden" style={{ height }}>
          <div className="flex h-full">
            <div className={`${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
            <div className={`${oppColor} flex-1`} />
          </div>
        </div>
        <span className="text-sm font-mono font-bold text-gray-200 w-16 text-right">
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

interface ActionBreakdownProps {
  actions: { action: string; frequency: number; ev: number }[];
}

const ACTION_COLORS: Record<string, string> = {
  fold: 'bg-red-500',
  check: 'bg-gray-500',
  call: 'bg-green-500',
  bet: 'bg-blue-500',
  raise: 'bg-amber-500',
  all_in: 'bg-purple-500',
};

export function ActionBreakdown({ actions }: ActionBreakdownProps) {
  return (
    <div className="space-y-2">
      {actions.map(({ action, frequency, ev }) => (
        <div key={action} className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ACTION_COLORS[action.split(' ')[0]] || 'bg-gray-500'}`} />
          <span className="text-sm text-gray-300 w-16 sm:w-24 capitalize truncate">{action}</span>
          <div className="flex-1 bg-gray-700 rounded-full h-5 overflow-hidden">
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
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-300">Solver Progress</h4>
        <span className="text-xs text-gray-500">
          {iteration.toLocaleString()} / {maxIterations.toLocaleString()}
        </span>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-[var(--gold)] transition-all duration-200 rounded-full"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Exploitability</div>
          <div className={`text-sm font-mono ${exploitability <= targetExploitability ? 'text-green-400' : 'text-yellow-400'}`}>
            {exploitability < 0.001 ? '< 0.001' : exploitability.toFixed(4)} bb
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 uppercase">Speed</div>
          <div className="text-sm font-mono text-gray-400">{iterPerSec} iter/s</div>
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase mb-1">Pot Odds</div>
          <div className="text-lg font-mono font-bold text-blue-400">
            {(potOdds * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Need this equity to call</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase mb-1">MDF</div>
          <div className="text-lg font-mono font-bold text-green-400">
            {(mdf * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Minimum defense</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase mb-1">Bluff Breakeven</div>
          <div className="text-lg font-mono font-bold text-red-400">
            {(bluffFreq * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-600">Folds needed to bluff</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase mb-1">Value:Bluff</div>
          <div className="text-lg font-mono font-bold text-amber-400">
            {valueToBluff.toFixed(1)}:1
          </div>
          <div className="text-[10px] text-gray-600">Balanced bet ratio</div>
        </div>
      </div>
    </div>
  );
}
