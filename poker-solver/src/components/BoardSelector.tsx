'use client';

import React, { useRef, useCallback } from 'react';
import { CardIndex, RANKS, SUITS, Suit, cardToIndex, indexToCard } from '@/engine/types';

interface BoardSelectorProps {
  selectedCards: CardIndex[];
  onCardsChange: (cards: CardIndex[]) => void;
  maxCards?: number;
  deadCards?: CardIndex[];
  label?: string;
}

const SUIT_SYMBOL: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const SUIT_INLINE: Record<Suit, string> = { s: '#1e293b', h: '#dc2626', d: '#dc2626', c: '#1e293b' };

const DISPLAY_RANKS = [...RANKS].reverse(); // A K Q J T 9 8 7 6 5 4 3 2

export default function BoardSelector({
  selectedCards,
  onCardsChange,
  maxCards = 5,
  deadCards = [],
  label = 'Board',
}: BoardSelectorProps) {
  // Use refs to always have current values in callbacks without stale closures
  const selectedRef = useRef(selectedCards);
  selectedRef.current = selectedCards;
  const deadRef = useRef(deadCards);
  deadRef.current = deadCards;

  const handleCardClick = useCallback((idx: CardIndex) => {
    const current = selectedRef.current;
    const dead = new Set(deadRef.current);
    if (dead.has(idx)) return;

    if (current.includes(idx)) {
      onCardsChange(current.filter(c => c !== idx));
    } else if (current.length < maxCards) {
      onCardsChange([...current, idx]);
    }
  }, [onCardsChange, maxCards]);

  const deadSet = new Set(deadCards);
  const selectedSet = new Set(selectedCards);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#484f58' }}>
            {selectedCards.length}/{maxCards}
          </span>
          {selectedCards.length > 0 && (
            <button
              type="button"
              onClick={() => onCardsChange([])}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 8,
                background: 'rgba(239,68,68,0.15)', color: '#f87171',
                border: 'none', touchAction: 'manipulation', cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected cards display */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center', alignItems: 'center', minHeight: 72 }}>
        {selectedCards.map((idx) => {
          const card = indexToCard(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCardClick(idx)}
              style={{
                width: 52, height: 72,
                background: '#fbbf24', border: '2px solid #f59e0b',
                boxShadow: '0 2px 10px rgba(251,191,36,0.4)',
                borderRadius: 8, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: SUIT_INLINE[card.suit] }}>{card.rank}</span>
              <span style={{ fontSize: 16, color: SUIT_INLINE[card.suit] }}>{SUIT_SYMBOL[card.suit]}</span>
            </button>
          );
        })}
        {Array.from({ length: maxCards - selectedCards.length }).map((_, i) => (
          <div
            key={`e-${i}`}
            style={{
              width: 52, height: 72,
              border: '2px dashed #30363d', borderRadius: 8,
              background: 'rgba(33,38,45,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#484f58', fontSize: 24 }}>?</span>
          </div>
        ))}
      </div>

      {/* Card picker - grouped by suit, 7 columns for big touch targets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SUITS.map(suit => (
          <div key={suit}>
            {/* Suit label */}
            <div style={{ marginBottom: 4, paddingLeft: 2 }}>
              <span style={{ fontSize: 14, color: SUIT_INLINE[suit] }}>{SUIT_SYMBOL[suit]}</span>
            </div>
            {/* Cards in 7-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {DISPLAY_RANKS.map(rank => {
                const idx = cardToIndex({ rank, suit });
                const isSelected = selectedSet.has(idx);
                const isDead = deadSet.has(idx);

                return (
                  <button
                    key={`${rank}${suit}`}
                    type="button"
                    onClick={() => handleCardClick(idx)}
                    disabled={isDead}
                    style={{
                      height: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6,
                      border: isSelected ? '2px solid #f59e0b' : '2px solid transparent',
                      background: isDead ? '#1a1e24' : isSelected ? '#fbbf24' : '#f8f9fa',
                      opacity: isDead ? 0.2 : 1,
                      cursor: isDead ? 'not-allowed' : 'pointer',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: isSelected ? '0 0 8px rgba(251,191,36,0.4)' : '0 1px 2px rgba(0,0,0,0.1)',
                      padding: 0,
                    }}
                  >
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: isDead ? '#484f58' : SUIT_INLINE[suit],
                      pointerEvents: 'none',
                    }}>
                      {rank}
                    </span>
                    <span style={{
                      fontSize: 11, marginLeft: 1,
                      color: isDead ? '#484f58' : SUIT_INLINE[suit],
                      pointerEvents: 'none',
                    }}>
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
