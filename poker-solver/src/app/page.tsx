'use client';

import React, { useState, useCallback, useMemo } from 'react';
import BoardSelector from '@/components/BoardSelector';
import { CardIndex, Suit, indexToCard } from '@/engine/types';
import { calculateEquityVsRange, potOdds } from '@/engine/equity';
import { parseRange, DEFAULT_RANGES } from '@/engine/ranges';

// --- Constants ---
const SUIT_SYM: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const OPEN_SIZES = [2, 2.5, 3, 4];

function getVillainRange(pos: string): number[] {
  const key = `${pos}_RFI`;
  return parseRange(DEFAULT_RANGES[key] || DEFAULT_RANGES['BTN_RFI'] || '');
}

interface EqResult { equity: number; wins: number; ties: number; losses: number; samples: number; }
interface Advice { action: string; color: string; bg: string; border: string; reason: string; }

function getAdvice(equity: number, pot: number, bet: number): Advice {
  if (bet <= 0) {
    if (equity >= 0.65) return { action: 'BET', color: '#60a5fa', bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.3)', reason: `Strong hand (${(equity * 100).toFixed(0)}% equity) \u2014 bet for value` };
    if (equity >= 0.45) return { action: 'CHECK', color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', reason: `Medium strength (${(equity * 100).toFixed(0)}%) \u2014 pot control` };
    return { action: 'CHECK', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', reason: `Weak (${(equity * 100).toFixed(0)}%) \u2014 check and reassess` };
  }
  const need = potOdds(pot, bet);
  if (equity >= need + 0.15) return { action: 'RAISE', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', reason: `${(equity * 100).toFixed(0)}% equity >> ${(need * 100).toFixed(0)}% needed` };
  if (equity >= need) return { action: 'CALL', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', reason: `${(equity * 100).toFixed(0)}% equity \u2265 ${(need * 100).toFixed(0)}% needed` };
  if (equity >= need - 0.05) return { action: 'CLOSE', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', reason: `${(equity * 100).toFixed(0)}% \u2248 ${(need * 100).toFixed(0)}% needed \u2014 borderline` };
  return { action: 'FOLD', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', reason: `${(equity * 100).toFixed(0)}% equity < ${(need * 100).toFixed(0)}% needed` };
}

function suitColor(s: Suit): string {
  return s === 'h' || s === 'd' ? '#dc2626' : '#e6edf3';
}

// --- Sub-components ---
function HeroMini({ cards }: { cards: CardIndex[] }) {
  if (cards.length < 2) return null;
  return (
    <div className="flex items-center gap-1">
      {cards.map(idx => {
        const c = indexToCard(idx);
        return (
          <span key={idx} className="text-base font-bold" style={{ color: suitColor(c.suit) }}>
            {c.rank}{SUIT_SYM[c.suit]}
          </span>
        );
      })}
    </div>
  );
}

function BoardMini({ cards }: { cards: CardIndex[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {cards.map(idx => {
        const c = indexToCard(idx);
        return (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded"
            style={{ width: 32, height: 44, background: '#f8f9fa', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            <span className="text-[10px] font-bold" style={{ color: suitColor(c.suit) === '#dc2626' ? '#dc2626' : '#1e293b' }}>{c.rank}</span>
            <span className="text-[9px]" style={{ color: suitColor(c.suit) === '#dc2626' ? '#dc2626' : '#1e293b' }}>{SUIT_SYM[c.suit]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AdviceBanner({ advice, label }: { advice: Advice; label: string }) {
  return (
    <div
      className="advice-banner p-4 rounded-2xl text-center"
      style={{ background: advice.bg, border: `1px solid ${advice.border}` }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>{label}</div>
      <div className="text-4xl font-black mb-1" style={{ color: advice.color }}>{advice.action}</div>
      <div className="text-xs" style={{ color: '#8b949e' }}>{advice.reason}</div>
    </div>
  );
}

function EquityBarInline({ equity }: { equity: number }) {
  const pct = equity * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="eq-bar flex-1">
        <div className="eq-fill" style={{ width: `${pct}%`, background: equity >= 0.5 ? '#22c55e' : '#ef4444' }} />
      </div>
      <span className="text-sm font-mono font-bold" style={{ color: '#e6edf3', width: 52, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function BetButtons({ pot, value, onChange }: { pot: number; value: number; onChange: (v: number) => void }) {
  const presets = [
    { label: 'Check', bb: 0 },
    { label: '\u2153 Pot', bb: Math.round(pot / 3 * 10) / 10 },
    { label: '\u00bd Pot', bb: Math.round(pot / 2 * 10) / 10 },
    { label: '\u2154 Pot', bb: Math.round(pot * 2 / 3 * 10) / 10 },
    { label: 'Pot', bb: Math.round(pot * 10) / 10 },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold" style={{ color: '#c9d1d9' }}>Villain&apos;s action:</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {presets.map(p => {
          const active = Math.abs(value - p.bb) < 0.01;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.bb)}
              onTouchEnd={(e) => { e.preventDefault(); onChange(p.bb); }}
              className={`pill touch-manipulation py-2.5 text-center ${active ? 'active' : ''}`}
            >
              <div className="text-xs font-semibold">{p.label}</div>
              {p.bb > 0 && <div className="text-[10px] opacity-60">{p.bb}bb</div>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#484f58' }}>Custom:</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2.5 text-sm rounded-xl"
          style={{ background: '#21262d', border: '1px solid #30363d', color: '#e6edf3' }}
          placeholder="0"
          min={0}
          step={0.5}
        />
        <span className="text-xs" style={{ color: '#484f58' }}>bb</span>
      </div>
    </div>
  );
}

// --- Main Component ---
export default function HandAdvisor() {
  const [step, setStep] = useState(1);

  // Step 1: Hero cards
  const [heroCards, setHeroCards] = useState<CardIndex[]>([]);

  // Step 2: Table
  const [numPlayers, setNumPlayers] = useState(6);
  const [heroPos, setHeroPos] = useState('BTN');
  const [villainPos, setVillainPos] = useState('CO');
  const [openSize, setOpenSize] = useState(2.5);

  // Board cards
  const [flopCards, setFlopCards] = useState<CardIndex[]>([]);
  const [turnCard, setTurnCard] = useState<CardIndex[]>([]);
  const [riverCard, setRiverCard] = useState<CardIndex[]>([]);

  // Pot tracking
  const preflopPot = openSize * 2 + 1.5;
  const [flopPot, setFlopPot] = useState(6.5);
  const [turnPot, setTurnPot] = useState(6.5);
  const [riverPot, setRiverPot] = useState(6.5);

  // Villain bets
  const [flopBet, setFlopBet] = useState(0);
  const [turnBet, setTurnBet] = useState(0);
  const [riverBet, setRiverBet] = useState(0);

  // Equity results
  const [preflopEq, setPreflopEq] = useState<EqResult | null>(null);
  const [flopEq, setFlopEq] = useState<EqResult | null>(null);
  const [turnEq, setTurnEq] = useState<EqResult | null>(null);
  const [riverEq, setRiverEq] = useState<EqResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const villainRange = useMemo(() => getVillainRange(villainPos), [villainPos]);

  const calcEquity = useCallback(async (board: CardIndex[]): Promise<EqResult | null> => {
    if (heroCards.length < 2) return null;
    setCalculating(true);
    await new Promise(r => setTimeout(r, 10));
    try {
      return calculateEquityVsRange(
        [heroCards[0], heroCards[1]] as [CardIndex, CardIndex],
        villainRange, board, 25000,
      );
    } catch { return null; }
    finally { setCalculating(false); }
  }, [heroCards, villainRange]);

  // --- Step Transitions ---
  const toStep2 = () => { if (heroCards.length >= 2) setStep(2); };
  const toFlop = async () => {
    const eq = await calcEquity([]);
    setPreflopEq(eq);
    setFlopPot(Math.round(preflopPot * 10) / 10);
    setFlopBet(0);
    setStep(3);
  };
  const toTurn = async () => {
    if (flopCards.length < 3) return;
    const eq = await calcEquity(flopCards);
    setFlopEq(eq);
    setTurnPot(Math.round((flopBet > 0 ? flopPot + flopBet * 2 : flopPot) * 10) / 10);
    setTurnBet(0);
    setStep(4);
  };
  const toRiver = async () => {
    if (turnCard.length < 1) return;
    const eq = await calcEquity([...flopCards, ...turnCard]);
    setTurnEq(eq);
    setRiverPot(Math.round((turnBet > 0 ? turnPot + turnBet * 2 : turnPot) * 10) / 10);
    setRiverBet(0);
    setStep(5);
  };
  const toResults = async () => {
    if (riverCard.length < 1) return;
    const eq = await calcEquity([...flopCards, ...turnCard, ...riverCard]);
    setRiverEq(eq);
    setStep(6);
  };

  const newHand = () => {
    setStep(1);
    setHeroCards([]);
    setFlopCards([]); setTurnCard([]); setRiverCard([]);
    setPreflopEq(null); setFlopEq(null); setTurnEq(null); setRiverEq(null);
    setFlopBet(0); setTurnBet(0); setRiverBet(0);
    setCalculating(false);
  };

  const goBack = (target: number) => {
    if (target >= step) return;
    setStep(target);
    if (target <= 2) { setPreflopEq(null); setFlopEq(null); setTurnEq(null); setRiverEq(null); }
    else if (target <= 3) { setFlopEq(null); setTurnEq(null); setRiverEq(null); }
    else if (target <= 4) { setTurnEq(null); setRiverEq(null); }
    else { setRiverEq(null); }
  };

  const steps = ['Cards', 'Table', 'Flop', 'Turn', 'River'];

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between px-1">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = step === n || (step === 6 && n === 5);
          const done = step > n;
          return (
            <React.Fragment key={label}>
              <button
                type="button"
                onClick={() => done && goBack(n)}
                onTouchEnd={(e) => { if (done) { e.preventDefault(); goBack(n); } }}
                className={`flex flex-col items-center gap-1 touch-manipulation ${done ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`step-dot ${active ? 'current' : done ? 'done' : 'pending'}`}>
                  {done ? '\u2713' : n}
                </div>
                <span className="text-[10px] font-medium" style={{ color: active ? '#f0b429' : done ? '#34d399' : '#484f58' }}>
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-1.5 rounded" style={{ height: 2, background: done ? '#22c55e' : '#21262d' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Hero hand + board mini always visible after step 1 */}
      {heroCards.length === 2 && step > 1 && (
        <div className="flex items-center justify-center gap-3 py-1">
          <HeroMini cards={heroCards} />
          {flopCards.length > 0 && (
            <>
              <span style={{ color: '#30363d' }}>|</span>
              <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
            </>
          )}
        </div>
      )}

      {/* ==================== STEP 1: YOUR CARDS ==================== */}
      {step === 1 && (
        <div className="glass p-5">
          <h2 className="text-xl font-bold text-center mb-1" style={{ color: '#e6edf3' }}>
            What are your cards?
          </h2>
          <p className="text-sm text-center mb-5" style={{ color: '#8b949e' }}>
            Tap your 2 hole cards
          </p>

          <div className="felt-bg rounded-2xl p-4">
            <BoardSelector
              selectedCards={heroCards}
              onCardsChange={(c) => setHeroCards(c.slice(0, 2))}
              maxCards={2}
              label="Your hole cards"
            />
          </div>

          <button
            type="button"
            onClick={toStep2}
            onTouchEnd={(e) => { e.preventDefault(); toStep2(); }}
            disabled={heroCards.length < 2}
            className="w-full mt-5 py-4 rounded-2xl text-lg font-bold touch-manipulation btn-gold"
            style={heroCards.length < 2 ? { background: '#21262d', color: '#484f58', boxShadow: 'none' } : {}}
          >
            {heroCards.length >= 2 ? 'NEXT \u2192' : `Pick ${2 - heroCards.length} more card${heroCards.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* ==================== STEP 2: TABLE SETUP ==================== */}
      {step === 2 && (
        <div className="glass p-5 space-y-5">
          <h2 className="text-xl font-bold text-center" style={{ color: '#e6edf3' }}>Table Setup</h2>

          {/* Player count */}
          <div>
            <div className="text-sm font-semibold mb-2" style={{ color: '#c9d1d9' }}>Players at the table</div>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} type="button"
                  onClick={() => setNumPlayers(n)}
                  onTouchEnd={(e) => { e.preventDefault(); setNumPlayers(n); }}
                  className={`pill touch-manipulation ${numPlayers === n ? 'active' : ''}`}
                  style={{ width: 48, height: 48, fontSize: 18 }}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Hero position */}
          <div>
            <div className="text-sm font-semibold mb-2" style={{ color: '#c9d1d9' }}>Your position</div>
            <div className="grid grid-cols-6 gap-2">
              {POSITIONS.map(pos => (
                <button key={pos} type="button"
                  onClick={() => setHeroPos(pos)}
                  onTouchEnd={(e) => { e.preventDefault(); setHeroPos(pos); }}
                  className={`pill touch-manipulation py-3 text-sm ${heroPos === pos ? 'active' : ''}`}
                >{pos}</button>
              ))}
            </div>
          </div>

          {/* Villain position */}
          <div>
            <div className="text-sm font-semibold mb-2" style={{ color: '#c9d1d9' }}>Who raised pre-flop?</div>
            <div className="grid grid-cols-5 gap-2">
              {POSITIONS.filter(p => p !== heroPos).map(pos => (
                <button key={pos} type="button"
                  onClick={() => setVillainPos(pos)}
                  onTouchEnd={(e) => { e.preventDefault(); setVillainPos(pos); }}
                  className={`pill touch-manipulation py-3 text-sm ${villainPos === pos ? 'active-red' : ''}`}
                >{pos}</button>
              ))}
            </div>
          </div>

          {/* Open size */}
          <div>
            <div className="text-sm font-semibold mb-2" style={{ color: '#c9d1d9' }}>Raise size</div>
            <div className="flex gap-2">
              {OPEN_SIZES.map(s => (
                <button key={s} type="button"
                  onClick={() => setOpenSize(s)}
                  onTouchEnd={(e) => { e.preventDefault(); setOpenSize(s); }}
                  className={`pill touch-manipulation flex-1 py-3 text-base ${openSize === s ? 'active' : ''}`}
                >{s}x</button>
              ))}
            </div>
          </div>

          <button type="button"
            onClick={toFlop}
            onTouchEnd={(e) => { e.preventDefault(); toFlop(); }}
            disabled={calculating}
            className="w-full py-4 rounded-2xl text-lg font-bold btn-gold touch-manipulation"
          >
            {calculating ? 'Calculating...' : 'DEAL THE FLOP \u2192'}
          </button>
        </div>
      )}

      {/* ===== Preflop equity (visible step 3+) ===== */}
      {step >= 3 && preflopEq && (
        <div className="glass p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: '#8b949e' }}>Pre-flop vs {villainPos}</span>
            <span className="text-sm font-mono font-bold" style={{ color: '#f0b429' }}>Pot: {flopPot}bb</span>
          </div>
          <EquityBarInline equity={preflopEq.equity} />
        </div>
      )}

      {/* ==================== STEP 3: FLOP ==================== */}
      {step === 3 && (
        <div className="glass p-5 space-y-4">
          <h2 className="text-xl font-bold text-center" style={{ color: '#e6edf3' }}>The Flop</h2>

          <div className="felt-bg rounded-2xl p-4">
            <BoardSelector
              selectedCards={flopCards}
              onCardsChange={(c) => setFlopCards(c.slice(0, 3))}
              maxCards={3}
              deadCards={heroCards}
              label="Pick 3 flop cards"
            />
          </div>

          {flopCards.length === 3 && (
            <>
              <BetButtons pot={flopPot} value={flopBet} onChange={setFlopBet} />
              <button type="button"
                onClick={toTurn}
                onTouchEnd={(e) => { e.preventDefault(); toTurn(); }}
                disabled={calculating}
                className="w-full py-4 rounded-2xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 TURN'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== Flop advice (visible step 4+) ===== */}
      {step >= 4 && flopEq && (
        <div className="space-y-3">
          <AdviceBanner advice={getAdvice(flopEq.equity, flopPot, flopBet)} label="Flop Advice" />
          <div className="glass p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#8b949e' }}>Flop:</span>
                <BoardMini cards={flopCards} />
              </div>
              <span className="text-sm font-mono" style={{ color: '#8b949e' }}>{(flopEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={flopEq.equity} />
          </div>
        </div>
      )}

      {/* ==================== STEP 4: TURN ==================== */}
      {step === 4 && (
        <div className="glass p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: '#e6edf3' }}>The Turn</h2>
            <span className="text-sm font-mono font-bold" style={{ color: '#f0b429' }}>Pot: {turnPot}bb</span>
          </div>

          <div className="felt-bg rounded-2xl p-4">
            <BoardSelector
              selectedCards={turnCard}
              onCardsChange={(c) => setTurnCard(c.slice(0, 1))}
              maxCards={1}
              deadCards={[...heroCards, ...flopCards]}
              label="Pick the turn card"
            />
          </div>

          {turnCard.length === 1 && (
            <>
              <BetButtons pot={turnPot} value={turnBet} onChange={setTurnBet} />
              <button type="button"
                onClick={toRiver}
                onTouchEnd={(e) => { e.preventDefault(); toRiver(); }}
                disabled={calculating}
                className="w-full py-4 rounded-2xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 RIVER'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== Turn advice (visible step 5+) ===== */}
      {step >= 5 && turnEq && (
        <div className="space-y-3">
          <AdviceBanner advice={getAdvice(turnEq.equity, turnPot, turnBet)} label="Turn Advice" />
          <div className="glass p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#8b949e' }}>Turn:</span>
                <BoardMini cards={[...flopCards, ...turnCard]} />
              </div>
              <span className="text-sm font-mono" style={{ color: '#8b949e' }}>{(turnEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={turnEq.equity} />
          </div>
        </div>
      )}

      {/* ==================== STEP 5: RIVER ==================== */}
      {step === 5 && (
        <div className="glass p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: '#e6edf3' }}>The River</h2>
            <span className="text-sm font-mono font-bold" style={{ color: '#f0b429' }}>Pot: {riverPot}bb</span>
          </div>

          <div className="felt-bg rounded-2xl p-4">
            <BoardSelector
              selectedCards={riverCard}
              onCardsChange={(c) => setRiverCard(c.slice(0, 1))}
              maxCards={1}
              deadCards={[...heroCards, ...flopCards, ...turnCard]}
              label="Pick the river card"
            />
          </div>

          {riverCard.length === 1 && (
            <>
              <BetButtons pot={riverPot} value={riverBet} onChange={setRiverBet} />
              <button type="button"
                onClick={toResults}
                onTouchEnd={(e) => { e.preventDefault(); toResults(); }}
                disabled={calculating}
                className="w-full py-4 rounded-2xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET FINAL ADVICE'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== River advice (step 6) ===== */}
      {step === 6 && riverEq && (
        <div className="space-y-3">
          <AdviceBanner advice={getAdvice(riverEq.equity, riverPot, riverBet)} label="River Advice" />
          <div className="glass p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#8b949e' }}>Board:</span>
                <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
              </div>
              <span className="text-sm font-mono" style={{ color: '#8b949e' }}>{(riverEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={riverEq.equity} />
          </div>
        </div>
      )}

      {/* New hand button */}
      {step >= 3 && (
        <button type="button"
          onClick={newHand}
          onTouchEnd={(e) => { e.preventDefault(); newHand(); }}
          className="w-full py-3.5 rounded-2xl text-base font-semibold touch-manipulation"
          style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d' }}
        >
          NEW HAND
        </button>
      )}
    </div>
  );
}
