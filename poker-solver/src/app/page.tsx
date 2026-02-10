'use client';

import React, { useState, useCallback, useMemo } from 'react';
import BoardSelector from '@/components/BoardSelector';
import { EquityBar } from '@/components/EVDisplay';
import { CardIndex, Suit, indexToCard } from '@/engine/types';
import { calculateEquityVsRange, potOdds } from '@/engine/equity';
import { parseRange, DEFAULT_RANGES } from '@/engine/ranges';

// --- Constants ---
const SUIT_SYM: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const SUIT_CLR: Record<Suit, string> = { s: 'text-gray-200', h: 'text-red-400', d: 'text-red-400', c: 'text-gray-200' };
const CARD_CLR: Record<Suit, string> = { s: 'text-gray-900', h: 'text-red-600', d: 'text-red-500', c: 'text-gray-900' };

const POSITIONS = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const OPEN_SIZES = [2, 2.5, 3, 4];

function getVillainRange(pos: string): number[] {
  const key = `${pos}_RFI`;
  return parseRange(DEFAULT_RANGES[key] || DEFAULT_RANGES['BTN_RFI'] || '');
}

interface EqResult { equity: number; wins: number; ties: number; losses: number; samples: number; }
interface Advice { action: string; color: string; bg: string; reason: string; }

function getAdvice(equity: number, pot: number, bet: number): Advice {
  if (bet <= 0) {
    if (equity >= 0.65) return { action: 'BET', color: 'text-blue-400', bg: 'bg-blue-950/50 border-blue-800/50', reason: `Strong (${(equity * 100).toFixed(0)}% equity) \u2014 bet for value` };
    if (equity >= 0.45) return { action: 'CHECK', color: 'text-gray-300', bg: 'bg-gray-800/50 border-gray-700/50', reason: `Medium strength (${(equity * 100).toFixed(0)}%) \u2014 control the pot` };
    return { action: 'CHECK', color: 'text-gray-400', bg: 'bg-gray-800/50 border-gray-700/50', reason: `Weak (${(equity * 100).toFixed(0)}%) \u2014 check and reassess` };
  }
  const need = potOdds(pot, bet);
  if (equity >= need + 0.15) return { action: 'RAISE', color: 'text-yellow-300', bg: 'bg-yellow-950/50 border-yellow-700/50', reason: `${(equity * 100).toFixed(0)}% equity >> ${(need * 100).toFixed(0)}% needed \u2014 raise for value!` };
  if (equity >= need) return { action: 'CALL', color: 'text-green-400', bg: 'bg-green-950/50 border-green-800/50', reason: `${(equity * 100).toFixed(0)}% equity \u2265 ${(need * 100).toFixed(0)}% needed` };
  if (equity >= need - 0.05) return { action: 'CLOSE DECISION', color: 'text-orange-400', bg: 'bg-orange-950/50 border-orange-800/50', reason: `${(equity * 100).toFixed(0)}% equity \u2248 ${(need * 100).toFixed(0)}% needed \u2014 borderline` };
  return { action: 'FOLD', color: 'text-red-400', bg: 'bg-red-950/50 border-red-800/50', reason: `${(equity * 100).toFixed(0)}% equity < ${(need * 100).toFixed(0)}% needed` };
}

// --- Sub-components ---
function HeroMini({ cards }: { cards: CardIndex[] }) {
  if (cards.length < 2) return null;
  return (
    <div className="flex items-center gap-1.5">
      {cards.map(idx => {
        const c = indexToCard(idx);
        return (
          <span key={idx} className={`text-lg font-bold ${SUIT_CLR[c.suit]}`}>
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
          <div key={idx} className="w-8 h-11 rounded bg-[var(--card-white)] flex flex-col items-center justify-center shadow-sm">
            <span className={`text-[10px] font-bold ${CARD_CLR[c.suit]}`}>{c.rank}</span>
            <span className={`text-[9px] ${CARD_CLR[c.suit]}`}>{SUIT_SYM[c.suit]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AdviceBanner({ advice, label }: { advice: Advice; label: string }) {
  return (
    <div className={`p-4 rounded-xl border text-center ${advice.bg}`}>
      <div className="text-[10px] text-gray-500 uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black mb-1 ${advice.color}`}>{advice.action}</div>
      <div className="text-xs text-gray-400">{advice.reason}</div>
    </div>
  );
}

function BetButtons({ pot, value, onChange }: { pot: number; value: number; onChange: (v: number) => void }) {
  const presets = [
    { label: 'Checks', bb: 0 },
    { label: '\u2153 Pot', bb: Math.round(pot / 3 * 10) / 10 },
    { label: '\u00bd Pot', bb: Math.round(pot / 2 * 10) / 10 },
    { label: '\u2154 Pot', bb: Math.round(pot * 2 / 3 * 10) / 10 },
    { label: 'Pot', bb: Math.round(pot * 10) / 10 },
  ];

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-300">Villain&apos;s action:</div>
      <div className="flex gap-1.5">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.bb)}
            onTouchEnd={(e) => { e.preventDefault(); onChange(p.bb); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all touch-manipulation
              ${Math.abs(value - p.bb) < 0.01
                ? 'bg-[var(--gold)] text-black'
                : 'bg-gray-800 text-gray-400 active:bg-gray-700'
              }`}
          >
            <div>{p.label}</div>
            {p.bb > 0 && <div className="text-[10px] opacity-70">{p.bb}bb</div>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Custom:</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm"
          placeholder="0"
          min={0}
          step={0.5}
        />
        <span className="text-xs text-gray-500">bb</span>
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

  // Pot tracking per street
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
    const newPot = flopBet > 0 ? flopPot + flopBet * 2 : flopPot;
    setTurnPot(Math.round(newPot * 10) / 10);
    setTurnBet(0);
    setStep(4);
  };

  const toRiver = async () => {
    if (turnCard.length < 1) return;
    const eq = await calcEquity([...flopCards, ...turnCard]);
    setTurnEq(eq);
    const newPot = turnBet > 0 ? turnPot + turnBet * 2 : turnPot;
    setRiverPot(Math.round(newPot * 10) / 10);
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

  // --- Progress Bar ---
  const steps = ['Cards', 'Table', 'Flop', 'Turn', 'River'];

  return (
    <div className="space-y-3">
      {/* Progress dots */}
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
                className={`flex flex-col items-center gap-0.5 touch-manipulation ${done ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${active ? 'bg-[var(--gold)] text-black scale-110' : done ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                  {done ? '\u2713' : n}
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-[var(--gold)]' : done ? 'text-green-400' : 'text-gray-600'}`}>{label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${step > n ? 'bg-green-600' : 'bg-gray-800'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Hero hand + board always visible when past step 1 */}
      {heroCards.length === 2 && step > 1 && (
        <div className="flex items-center justify-center gap-3 py-1">
          <HeroMini cards={heroCards} />
          {flopCards.length > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
            </>
          )}
        </div>
      )}

      {/* ==================== STEP 1: YOUR CARDS ==================== */}
      {step === 1 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
          <h2 className="text-xl font-bold text-center mb-1">What are your cards?</h2>
          <p className="text-sm text-gray-500 text-center mb-4">Tap your 2 hole cards</p>

          <div className="felt-bg rounded-xl p-3">
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
            className={`w-full mt-4 py-4 rounded-xl text-lg font-bold transition-all touch-manipulation
              ${heroCards.length >= 2 ? 'btn-gold' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
          >
            {heroCards.length >= 2 ? 'NEXT' : 'Pick 2 cards'}
          </button>
        </div>
      )}

      {/* ==================== STEP 2: TABLE SETUP ==================== */}
      {step === 2 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 space-y-5">
          <h2 className="text-xl font-bold text-center">Table Setup</h2>

          {/* Player count */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">How many players at the table?</div>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} type="button"
                  onClick={() => setNumPlayers(n)}
                  onTouchEnd={(e) => { e.preventDefault(); setNumPlayers(n); }}
                  className={`w-12 h-12 rounded-xl text-lg font-bold transition-all touch-manipulation
                    ${numPlayers === n ? 'bg-[var(--gold)] text-black' : 'bg-gray-800 text-gray-400 active:bg-gray-700'}`}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Your position */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Your position?</div>
            <div className="grid grid-cols-6 gap-2">
              {POSITIONS.map(pos => (
                <button key={pos} type="button"
                  onClick={() => setHeroPos(pos)}
                  onTouchEnd={(e) => { e.preventDefault(); setHeroPos(pos); }}
                  className={`py-3 rounded-xl text-sm font-bold transition-all touch-manipulation
                    ${heroPos === pos ? 'bg-[var(--gold)] text-black' : 'bg-gray-800 text-gray-400 active:bg-gray-700'}`}
                >{pos}</button>
              ))}
            </div>
          </div>

          {/* Who raised */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Who raised pre-flop?</div>
            <div className="grid grid-cols-5 gap-2">
              {POSITIONS.filter(p => p !== heroPos).map(pos => (
                <button key={pos} type="button"
                  onClick={() => setVillainPos(pos)}
                  onTouchEnd={(e) => { e.preventDefault(); setVillainPos(pos); }}
                  className={`py-3 rounded-xl text-sm font-bold transition-all touch-manipulation
                    ${villainPos === pos ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 active:bg-gray-700'}`}
                >{pos}</button>
              ))}
            </div>
          </div>

          {/* Raise size */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Raise size?</div>
            <div className="flex gap-2">
              {OPEN_SIZES.map(s => (
                <button key={s} type="button"
                  onClick={() => setOpenSize(s)}
                  onTouchEnd={(e) => { e.preventDefault(); setOpenSize(s); }}
                  className={`flex-1 py-3 rounded-xl text-base font-bold transition-all touch-manipulation
                    ${openSize === s ? 'bg-[var(--gold)] text-black' : 'bg-gray-800 text-gray-400 active:bg-gray-700'}`}
                >{s}x</button>
              ))}
            </div>
          </div>

          <button type="button"
            onClick={toFlop}
            onTouchEnd={(e) => { e.preventDefault(); toFlop(); }}
            disabled={calculating}
            className="w-full py-4 rounded-xl text-lg font-bold btn-gold touch-manipulation"
          >
            {calculating ? 'Calculating...' : 'DEAL THE FLOP'}
          </button>
        </div>
      )}

      {/* ===== Preflop Equity (visible step 3+) ===== */}
      {step >= 3 && preflopEq && (
        <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Pre-flop vs {villainPos} ({(preflopEq.equity * 100).toFixed(0)}% equity)</span>
            <span className="text-sm font-mono font-bold text-[var(--gold)]">Pot: {flopPot}bb</span>
          </div>
          <EquityBar equity={preflopEq.equity} height={16} />
        </div>
      )}

      {/* ==================== STEP 3: FLOP ==================== */}
      {step === 3 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 space-y-4">
          <h2 className="text-xl font-bold text-center">The Flop</h2>

          <div className="felt-bg rounded-xl p-3">
            <BoardSelector
              selectedCards={flopCards}
              onCardsChange={(c) => setFlopCards(c.slice(0, 3))}
              maxCards={3}
              deadCards={heroCards}
              label="Pick the 3 flop cards"
            />
          </div>

          {flopCards.length === 3 && (
            <>
              <BetButtons pot={flopPot} value={flopBet} onChange={setFlopBet} />

              <button type="button"
                onClick={toTurn}
                onTouchEnd={(e) => { e.preventDefault(); toTurn(); }}
                disabled={calculating}
                className="w-full py-4 rounded-xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 TURN'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== Flop Advice (visible step 4+) ===== */}
      {step >= 4 && flopEq && (
        <div className="space-y-2">
          <AdviceBanner advice={getAdvice(flopEq.equity, flopPot, flopBet)} label="Flop Advice" />
          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Flop:</span>
                <BoardMini cards={flopCards} />
              </div>
              <span className="text-sm font-mono text-gray-400">{(flopEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBar equity={flopEq.equity} height={16} />
          </div>
        </div>
      )}

      {/* ==================== STEP 4: TURN ==================== */}
      {step === 4 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">The Turn</h2>
            <span className="text-sm font-mono text-[var(--gold)]">Pot: {turnPot}bb</span>
          </div>

          <div className="felt-bg rounded-xl p-3">
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
                className="w-full py-4 rounded-xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET ADVICE \u2192 RIVER'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== Turn Advice (visible step 5+) ===== */}
      {step >= 5 && turnEq && (
        <div className="space-y-2">
          <AdviceBanner advice={getAdvice(turnEq.equity, turnPot, turnBet)} label="Turn Advice" />
          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Turn:</span>
                <BoardMini cards={[...flopCards, ...turnCard]} />
              </div>
              <span className="text-sm font-mono text-gray-400">{(turnEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBar equity={turnEq.equity} height={16} />
          </div>
        </div>
      )}

      {/* ==================== STEP 5: RIVER ==================== */}
      {step === 5 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">The River</h2>
            <span className="text-sm font-mono text-[var(--gold)]">Pot: {riverPot}bb</span>
          </div>

          <div className="felt-bg rounded-xl p-3">
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
                className="w-full py-4 rounded-xl text-lg font-bold btn-gold touch-manipulation"
              >
                {calculating ? 'Calculating...' : 'GET FINAL ADVICE'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== River Advice (step 6) ===== */}
      {step === 6 && riverEq && (
        <div className="space-y-2">
          <AdviceBanner advice={getAdvice(riverEq.equity, riverPot, riverBet)} label="River Advice" />
          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Board:</span>
                <BoardMini cards={[...flopCards, ...turnCard, ...riverCard]} />
              </div>
              <span className="text-sm font-mono text-gray-400">{(riverEq.equity * 100).toFixed(1)}%</span>
            </div>
            <EquityBar equity={riverEq.equity} height={16} />
          </div>
        </div>
      )}

      {/* ===== New Hand button ===== */}
      {step >= 3 && (
        <button type="button"
          onClick={newHand}
          onTouchEnd={(e) => { e.preventDefault(); newHand(); }}
          className="w-full py-3.5 rounded-xl text-base font-semibold bg-gray-800 text-gray-300 active:bg-gray-700 border border-gray-700 touch-manipulation"
        >
          NEW HAND
        </button>
      )}
    </div>
  );
}
