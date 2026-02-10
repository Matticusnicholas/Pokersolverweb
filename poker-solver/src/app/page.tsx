'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CardIndex, Suit, indexToCard } from '@/engine/types';

// Lazy-load heavy engine modules to avoid blocking hydration
const BoardSelector = dynamic(() => import('@/components/BoardSelector'), { ssr: true });

let _eqModule: typeof import('@/engine/equity') | null = null;
let _rangeModule: typeof import('@/engine/ranges') | null = null;

async function loadEngineModules() {
  if (!_eqModule) _eqModule = await import('@/engine/equity');
  if (!_rangeModule) _rangeModule = await import('@/engine/ranges');
  return { eq: _eqModule, ranges: _rangeModule };
}

// --- Constants ---
const SUIT_SYM: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const OPEN_SIZES = [2, 2.5, 3, 4];

async function getVillainRange(pos: string): Promise<number[]> {
  const { ranges } = await loadEngineModules();
  const key = `${pos}_RFI`;
  return ranges.parseRange(ranges.DEFAULT_RANGES[key] || ranges.DEFAULT_RANGES['BTN_RFI'] || '');
}

interface EqResult { equity: number; wins: number; ties: number; losses: number; samples: number; }
interface Advice { action: string; color: string; bg: string; border: string; reason: string; }

function getAdvice(equity: number, pot: number, bet: number): Advice {
  if (bet <= 0) {
    if (equity >= 0.65) return { action: 'BET', color: '#60a5fa', bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.3)', reason: `Strong hand (${(equity * 100).toFixed(0)}% equity) \u2014 bet for value` };
    if (equity >= 0.45) return { action: 'CHECK', color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', reason: `Medium strength (${(equity * 100).toFixed(0)}%) \u2014 pot control` };
    return { action: 'CHECK', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', reason: `Weak (${(equity * 100).toFixed(0)}%) \u2014 check and reassess` };
  }
  const need = bet / (pot + bet); // pot odds inline to avoid import
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {cards.map(idx => {
        const c = indexToCard(idx);
        return (
          <span key={idx} style={{ fontSize: 16, fontWeight: 700, color: suitColor(c.suit) }}>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {cards.map(idx => {
        const c = indexToCard(idx);
        const col = suitColor(c.suit) === '#dc2626' ? '#dc2626' : '#1e293b';
        return (
          <div
            key={idx}
            style={{
              width: 32, height: 44, background: '#f8f9fa', borderRadius: 4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{c.rank}</span>
            <span style={{ fontSize: 9, color: col }}>{SUIT_SYM[c.suit]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AdviceBanner({ advice, label }: { advice: Advice; label: string }) {
  return (
    <div
      className="advice-banner"
      style={{
        padding: 16, borderRadius: 16, textAlign: 'center',
        background: advice.bg, border: `1px solid ${advice.border}`,
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8b949e', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: advice.color, marginBottom: 4 }}>{advice.action}</div>
      <div style={{ fontSize: 12, color: '#8b949e' }}>{advice.reason}</div>
    </div>
  );
}

function EquityBarInline({ equity }: { equity: number }) {
  const pct = equity * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="eq-bar" style={{ flex: 1 }}>
        <div className="eq-fill" style={{ width: `${pct}%`, background: equity >= 0.5 ? '#22c55e' : '#ef4444' }} />
      </div>
      <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#e6edf3', width: 52, textAlign: 'right' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>Villain&apos;s action:</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {presets.map(p => {
          const active = Math.abs(value - p.bb) < 0.01;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.bb)}
              style={{
                padding: '10px 0', textAlign: 'center', borderRadius: 12,
                background: active ? 'rgba(240,180,41,0.15)' : '#21262d',
                border: active ? '2px solid #f0b429' : '2px solid #30363d',
                color: active ? '#f0b429' : '#8b949e',
                fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              <div style={{ fontSize: 12 }}>{p.label}</div>
              {p.bb > 0 && <div style={{ fontSize: 10, opacity: 0.6 }}>{p.bb}bb</div>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#484f58' }}>Custom:</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{
            flex: 1, padding: '10px 12px', fontSize: 14, borderRadius: 12,
            background: '#21262d', border: '1px solid #30363d', color: '#e6edf3',
          }}
          placeholder="0"
          min={0}
          step={0.5}
        />
        <span style={{ fontSize: 12, color: '#484f58' }}>bb</span>
      </div>
    </div>
  );
}

// Shared button style for all action buttons
const goldBtnStyle: React.CSSProperties = {
  width: '100%', padding: '16px 0', borderRadius: 14, fontSize: 18,
  fontWeight: 700, border: 'none', cursor: 'pointer', touchAction: 'manipulation',
  background: 'linear-gradient(135deg, #f0b429 0%, #d99a1e 100%)', color: '#000',
  boxShadow: '0 4px 14px rgba(240,180,41,0.35)',
};
const disabledBtnStyle: React.CSSProperties = {
  ...goldBtnStyle,
  background: '#21262d', color: '#484f58', boxShadow: 'none', cursor: 'not-allowed',
};
const pillStyle = (active: boolean, red?: boolean): React.CSSProperties => ({
  padding: '12px 0', textAlign: 'center', borderRadius: 12, fontWeight: 600, fontSize: 14,
  cursor: 'pointer', touchAction: 'manipulation',
  background: active ? (red ? 'rgba(239,68,68,0.15)' : 'rgba(240,180,41,0.15)') : '#21262d',
  border: active ? `2px solid ${red ? '#ef4444' : '#f0b429'}` : '2px solid #30363d',
  color: active ? (red ? '#ef4444' : '#f0b429') : '#8b949e',
});
const glassStyle: React.CSSProperties = {
  background: 'rgba(22,27,34,0.8)', backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(48,54,61,0.6)',
  borderRadius: 16, padding: 20,
};

// --- Main Component ---
export default function HandAdvisor() {
  const [step, setStep] = useState(1);

  const [heroCards, setHeroCards] = useState<CardIndex[]>([]);
  const [numPlayers, setNumPlayers] = useState(6);
  const [heroPos, setHeroPos] = useState('BTN');
  const [villainPos, setVillainPos] = useState('CO');
  const [openSize, setOpenSize] = useState(2.5);

  const [flopCards, setFlopCards] = useState<CardIndex[]>([]);
  const [turnCard, setTurnCard] = useState<CardIndex[]>([]);
  const [riverCard, setRiverCard] = useState<CardIndex[]>([]);

  const preflopPot = openSize * 2 + 1.5;
  const [flopPot, setFlopPot] = useState(6.5);
  const [turnPot, setTurnPot] = useState(6.5);
  const [riverPot, setRiverPot] = useState(6.5);

  const [flopBet, setFlopBet] = useState(0);
  const [turnBet, setTurnBet] = useState(0);
  const [riverBet, setRiverBet] = useState(0);

  const [preflopEq, setPreflopEq] = useState<EqResult | null>(null);
  const [flopEq, setFlopEq] = useState<EqResult | null>(null);
  const [turnEq, setTurnEq] = useState<EqResult | null>(null);
  const [riverEq, setRiverEq] = useState<EqResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const calcEquity = useCallback(async (board: CardIndex[]): Promise<EqResult | null> => {
    if (heroCards.length < 2) return null;
    setCalculating(true);
    await new Promise(r => setTimeout(r, 10));
    try {
      const { eq } = await loadEngineModules();
      const range = await getVillainRange(villainPos);
      return eq.calculateEquityVsRange(
        [heroCards[0], heroCards[1]] as [CardIndex, CardIndex],
        range, board, 25000,
      );
    } catch { return null; }
    finally { setCalculating(false); }
  }, [heroCards, villainPos]);

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

  const stepLabels = ['Cards', 'Table', 'Flop', 'Turn', 'River'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hydration indicator - green dot = JS active, gray = static HTML */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px' }}>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 8,
          background: hydrated ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
          color: hydrated ? '#22c55e' : '#6b7280',
        }}>
          {hydrated ? '\u25cf JS Active' : '\u25cb Loading...'}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const active = step === n || (step === 6 && n === 5);
          const done = step > n;
          return (
            <React.Fragment key={label}>
              <button
                type="button"
                onClick={() => done && goBack(n)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: done ? 'pointer' : 'default', background: 'none', border: 'none',
                  touchAction: 'manipulation', padding: 0,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  background: active ? '#f0b429' : done ? '#22c55e' : '#21262d',
                  color: active ? '#000' : done ? '#fff' : '#484f58',
                  border: active || done ? 'none' : '2px solid #30363d',
                  boxShadow: active ? '0 0 0 4px rgba(240,180,41,0.2)' : 'none',
                }}>
                  {done ? '\u2713' : n}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? '#f0b429' : done ? '#34d399' : '#484f58' }}>
                  {label}
                </span>
              </button>
              {i < stepLabels.length - 1 && (
                <div style={{ flex: 1, height: 2, margin: '0 6px', borderRadius: 1, background: done ? '#22c55e' : '#21262d' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Hero hand + board mini */}
      {heroCards.length === 2 && step > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '4px 0' }}>
          <HeroMini cards={heroCards} />
          {flopCards.length > 0 && (
            <>
              <span style={{ color: '#30363d' }}>|</span>
              <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
            </>
          )}
        </div>
      )}

      {/* ==================== STEP 1 ==================== */}
      {step === 1 && (
        <div style={glassStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#e6edf3', margin: '0 0 4px' }}>
            What are your cards?
          </h2>
          <p style={{ fontSize: 14, textAlign: 'center', color: '#8b949e', margin: '0 0 20px' }}>
            Tap your 2 hole cards
          </p>

          <div className="felt-bg" style={{ borderRadius: 16, padding: 16 }}>
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
            disabled={heroCards.length < 2}
            style={heroCards.length >= 2 ? { ...goldBtnStyle, marginTop: 20 } : { ...disabledBtnStyle, marginTop: 20 }}
          >
            {heroCards.length >= 2 ? 'NEXT \u2192' : `Pick ${2 - heroCards.length} more card${heroCards.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* ==================== STEP 2 ==================== */}
      {step === 2 && (
        <div style={{ ...glassStyle, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#e6edf3', margin: 0 }}>Table Setup</h2>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9', marginBottom: 8 }}>Players at the table</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} type="button" onClick={() => setNumPlayers(n)}
                  style={{ ...pillStyle(numPlayers === n), width: 48, height: 48, fontSize: 18 }}
                >{n}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9', marginBottom: 8 }}>Your position</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {POSITIONS.map(pos => (
                <button key={pos} type="button" onClick={() => setHeroPos(pos)}
                  style={pillStyle(heroPos === pos)}
                >{pos}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9', marginBottom: 8 }}>Who raised pre-flop?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {POSITIONS.filter(p => p !== heroPos).map(pos => (
                <button key={pos} type="button" onClick={() => setVillainPos(pos)}
                  style={pillStyle(villainPos === pos, true)}
                >{pos}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9', marginBottom: 8 }}>Raise size</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {OPEN_SIZES.map(s => (
                <button key={s} type="button" onClick={() => setOpenSize(s)}
                  style={{ ...pillStyle(openSize === s), flex: 1 }}
                >{s}x</button>
              ))}
            </div>
          </div>

          <button type="button" onClick={toFlop} disabled={calculating} style={goldBtnStyle}>
            {calculating ? 'Calculating...' : 'DEAL THE FLOP \u2192'}
          </button>
        </div>
      )}

      {/* Preflop equity */}
      {step >= 3 && preflopEq && (
        <div style={{ ...glassStyle, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>Pre-flop vs {villainPos}</span>
            <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#f0b429' }}>Pot: {flopPot}bb</span>
          </div>
          <EquityBarInline equity={preflopEq.equity} />
        </div>
      )}

      {/* ==================== STEP 3: FLOP ==================== */}
      {step === 3 && (
        <div style={{ ...glassStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#e6edf3', margin: 0 }}>The Flop</h2>
          <div className="felt-bg" style={{ borderRadius: 16, padding: 16 }}>
            <BoardSelector selectedCards={flopCards} onCardsChange={(c) => setFlopCards(c.slice(0, 3))}
              maxCards={3} deadCards={heroCards} label="Pick 3 flop cards" />
          </div>
          {flopCards.length === 3 && (
            <>
              <BetButtons pot={flopPot} value={flopBet} onChange={setFlopBet} />
              <button type="button" onClick={toTurn} disabled={calculating} style={goldBtnStyle}>
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 TURN'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Flop advice */}
      {step >= 4 && flopEq && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AdviceBanner advice={getAdvice(flopEq.equity, flopPot, flopBet)} label="Flop Advice" />
          <div style={{ ...glassStyle, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>Flop:</span>
                <BoardMini cards={flopCards} />
              </div>
              <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#8b949e' }}>{(flopEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={flopEq.equity} />
          </div>
        </div>
      )}

      {/* ==================== STEP 4: TURN ==================== */}
      {step === 4 && (
        <div style={{ ...glassStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3', margin: 0 }}>The Turn</h2>
            <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#f0b429' }}>Pot: {turnPot}bb</span>
          </div>
          <div className="felt-bg" style={{ borderRadius: 16, padding: 16 }}>
            <BoardSelector selectedCards={turnCard} onCardsChange={(c) => setTurnCard(c.slice(0, 1))}
              maxCards={1} deadCards={[...heroCards, ...flopCards]} label="Pick the turn card" />
          </div>
          {turnCard.length === 1 && (
            <>
              <BetButtons pot={turnPot} value={turnBet} onChange={setTurnBet} />
              <button type="button" onClick={toRiver} disabled={calculating} style={goldBtnStyle}>
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 RIVER'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Turn advice */}
      {step >= 5 && turnEq && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AdviceBanner advice={getAdvice(turnEq.equity, turnPot, turnBet)} label="Turn Advice" />
          <div style={{ ...glassStyle, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>Turn:</span>
                <BoardMini cards={[...flopCards, ...turnCard]} />
              </div>
              <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#8b949e' }}>{(turnEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={turnEq.equity} />
          </div>
        </div>
      )}

      {/* ==================== STEP 5: RIVER ==================== */}
      {step === 5 && (
        <div style={{ ...glassStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3', margin: 0 }}>The River</h2>
            <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#f0b429' }}>Pot: {riverPot}bb</span>
          </div>
          <div className="felt-bg" style={{ borderRadius: 16, padding: 16 }}>
            <BoardSelector selectedCards={riverCard} onCardsChange={(c) => setRiverCard(c.slice(0, 1))}
              maxCards={1} deadCards={[...heroCards, ...flopCards, ...turnCard]} label="Pick the river card" />
          </div>
          {riverCard.length === 1 && (
            <>
              <BetButtons pot={riverPot} value={riverBet} onChange={setRiverBet} />
              <button type="button" onClick={toResults} disabled={calculating} style={goldBtnStyle}>
                {calculating ? 'Calculating...' : 'GET FINAL ADVICE'}
              </button>
            </>
          )}
        </div>
      )}

      {/* River advice */}
      {step === 6 && riverEq && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AdviceBanner advice={getAdvice(riverEq.equity, riverPot, riverBet)} label="River Advice" />
          <div style={{ ...glassStyle, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>Board:</span>
                <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
              </div>
              <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#8b949e' }}>{(riverEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBarInline equity={riverEq.equity} />
          </div>
        </div>
      )}

      {/* New hand */}
      {step >= 3 && (
        <button type="button" onClick={newHand}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 16,
            fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation',
            background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
          }}
        >
          NEW HAND
        </button>
      )}
    </div>
  );
}
