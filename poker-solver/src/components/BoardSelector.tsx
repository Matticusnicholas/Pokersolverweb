'use client';

import React, { useCallback } from 'react';
import { CardIndex, RANKS, SUITS, Suit, cardToIndex, indexToCard } from '@/engine/types';

interface BoardSelectorProps {
  selectedCards: CardIndex[];
  onCardsChange: (cards: CardIndex[]) => void;
  maxCards?: number;
  deadCards?: CardIndex[];
  label?: string;
}

const SUIT_SYMBOL: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const SUIT_COLOR: Record<Suit, string> = { s: 'suit-black', h: 'suit-red', d: 'suit-red', c: 'suit-black' };
const SUIT_BG: Record<Suit, string> = {
  s: 'rgba(30,41,59,0.08)',
  h: 'rgba(220,38,38,0.06)',
  d: 'rgba(220,38,38,0.06)',
  c: 'rgba(30,41,59,0.08)',
};

const DISPLAY_RANKS = [...RANKS].reverse(); // A K Q J T 9 8 7 6 5 4 3 2

export default function BoardSelector({
  selectedCards,
  onCardsChange,
  maxCards = 5,
  deadCards = [],
  label = 'Board',
}: BoardSelectorProps) {
  const deadSet = new Set(deadCards);
  const selectedSet = new Set(selectedCards);

  const toggleCard = useCallback((idx: CardIndex) => {
    if (deadSet.has(idx)) return;
    if (selectedSet.has(idx)) {
      onCardsChange(selectedCards.filter(c => c !== idx));
    } else if (selectedCards.length < maxCards) {
      onCardsChange([...selectedCards, idx]);
    }
  }, [selectedCards, onCardsChange, maxCards, deadCards]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: '#c9d1d9' }}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#484f58' }}>
            {selectedCards.length}/{maxCards}
          </span>
          {selectedCards.length > 0 && (
            <button
              type="button"
              onClick={() => onCardsChange([])}
              onTouchEnd={(e) => { e.preventDefault(); onCardsChange([]); }}
              className="text-xs px-2.5 py-1 rounded-lg touch-manipulation"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected cards display */}
      <div className="flex gap-2 mb-4 justify-center items-center" style={{ minHeight: 72 }}>
        {selectedCards.map((idx) => {
          const card = indexToCard(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleCard(idx)}
              onTouchEnd={(e) => { e.preventDefault(); toggleCard(idx); }}
              className="flex flex-col items-center justify-center rounded-lg touch-manipulation"
              style={{
                width: 52, height: 72,
                background: '#fbbf24',
                border: '2px solid #f59e0b',
                boxShadow: '0 2px 10px rgba(251,191,36,0.4)',
              }}
            >
              <span className={`text-lg font-bold ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
              <span className={`text-base ${SUIT_COLOR[card.suit]}`}>{SUIT_SYMBOL[card.suit]}</span>
            </button>
          );
        })}
        {Array.from({ length: maxCards - selectedCards.length }).map((_, i) => (
          <div
            key={`e-${i}`}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 52, height: 72,
              border: '2px dashed #30363d',
              background: 'rgba(33,38,45,0.5)',
            }}
          >
            <span style={{ color: '#484f58', fontSize: 24 }}>?</span>
          </div>
        ))}
      </div>

      {/* Card picker - grouped by suit, 7 columns for bigger targets */}
      <div className="space-y-1.5">
        {SUITS.map(suit => (
          <div key={suit}>
            {/* Suit row label */}
            <div className="flex items-center gap-1 mb-1">
              <span className={`text-sm ${SUIT_COLOR[suit]}`} style={{ width: 16, textAlign: 'center' }}>
                {SUIT_SYMBOL[suit]}
              </span>
            </div>
            {/* Cards grid - 7 columns */}
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
            >
              {DISPLAY_RANKS.map(rank => {
                const idx = cardToIndex({ rank, suit });
                const isSelected = selectedSet.has(idx);
                const isDead = deadSet.has(idx);

                return (
                  <button
                    key={`${rank}${suit}`}
                    type="button"
                    onClick={() => toggleCard(idx)}
                    onTouchEnd={(e) => { e.preventDefault(); toggleCard(idx); }}
                    disabled={isDead}
                    className={`card-btn touch-manipulation flex items-center justify-center ${isDead ? 'dead' : isSelected ? 'selected' : ''}`}
                    style={{
                      height: 42,
                      background: isDead ? '#21262d' : isSelected ? '#fbbf24' : SUIT_BG[suit],
                      borderColor: isSelected ? '#f59e0b' : 'transparent',
                    }}
                  >
                    <span
                      className={`text-sm font-bold ${isDead ? '' : SUIT_COLOR[suit]}`}
                      style={isDead ? { color: '#484f58' } : undefined}
                    >
                      {rank}
                    </span>
                    <span
                      className={`text-xs ml-0.5 ${isDead ? '' : SUIT_COLOR[suit]}`}
                      style={isDead ? { color: '#484f58' } : undefined}
                    >
                      {SUIT_SYMBOL[suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
