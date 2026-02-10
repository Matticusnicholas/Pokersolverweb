'use client';

import React, { useState, useEffect } from 'react';
import { CardIndex, RANKS, SUITS, Suit, cardToIndex, indexToCard } from '@/engine/types';

interface BoardSelectorProps {
  selectedCards: CardIndex[];
  onCardsChange: (cards: CardIndex[]) => void;
  maxCards?: number;
  deadCards?: CardIndex[];
  label?: string;
}

const SYM: Record<Suit, string> = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' };
const CLR: Record<Suit, string> = { s: '#1e293b', h: '#dc2626', d: '#dc2626', c: '#1e293b' };
const DISPLAY_RANKS = [...RANKS].reverse();

export default function BoardSelector({
  selectedCards,
  onCardsChange,
  maxCards = 5,
  deadCards = [],
  label = 'Board',
}: BoardSelectorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const deadSet = new Set(deadCards);
  const selectedSet = new Set(selectedCards);

  // Event delegation: single click handler on the grid container
  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-card-idx]') as HTMLElement | null;
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-card-idx'));
    if (isNaN(idx) || deadSet.has(idx)) return;

    if (selectedSet.has(idx)) {
      onCardsChange(selectedCards.filter(c => c !== idx));
    } else if (selectedCards.length < maxCards) {
      onCardsChange([...selectedCards, idx]);
    }
  }

  // Same for selected cards display (tap to deselect)
  function handleSelectedClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-card-idx]') as HTMLElement | null;
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-card-idx'));
    if (isNaN(idx)) return;
    onCardsChange(selectedCards.filter(c => c !== idx));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: mounted ? '#22c55e' : '#484f58' }}>
            {selectedCards.length}/{maxCards}
          </span>
          {selectedCards.length > 0 && (
            <div
              onClick={() => onCardsChange([])}
              role="button"
              tabIndex={0}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 8,
                background: 'rgba(239,68,68,0.15)', color: '#f87171',
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              Clear
            </div>
          )}
        </div>
      </div>

      {/* Selected cards display */}
      <div
        onClick={handleSelectedClick}
        style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center', alignItems: 'center', minHeight: 72 }}
      >
        {selectedCards.map((idx) => {
          const card = indexToCard(idx);
          return (
            <div
              key={idx}
              data-card-idx={idx}
              role="button"
              tabIndex={0}
              style={{
                width: 52, height: 72,
                background: '#fbbf24', border: '2px solid #f59e0b',
                boxShadow: '0 2px 10px rgba(251,191,36,0.4)',
                borderRadius: 8, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: CLR[card.suit], pointerEvents: 'none' }}>{card.rank}</span>
              <span style={{ fontSize: 16, color: CLR[card.suit], pointerEvents: 'none' }}>{SYM[card.suit]}</span>
            </div>
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
            <span style={{ color: '#484f58', fontSize: 24, pointerEvents: 'none' }}>?</span>
          </div>
        ))}
      </div>

      {/* Card picker grid - event delegation on parent div */}
      <div onClick={handleGridClick} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SUITS.map(suit => (
          <div key={suit}>
            <div style={{ marginBottom: 4, paddingLeft: 2 }}>
              <span style={{ fontSize: 14, color: CLR[suit], pointerEvents: 'none' }}>{SYM[suit]}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {DISPLAY_RANKS.map(rank => {
                const idx = cardToIndex({ rank, suit });
                const isSel = selectedSet.has(idx);
                const isDead = deadSet.has(idx);

                return (
                  <div
                    key={`${rank}${suit}`}
                    data-card-idx={isDead ? undefined : idx}
                    role="button"
                    tabIndex={isDead ? -1 : 0}
                    style={{
                      height: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6,
                      border: isSel ? '2px solid #f59e0b' : '2px solid transparent',
                      background: isDead ? '#1a1e24' : isSel ? '#fbbf24' : '#f8f9fa',
                      opacity: isDead ? 0.2 : 1,
                      cursor: isDead ? 'default' : 'pointer',
                      touchAction: 'manipulation',
                      boxShadow: isSel ? '0 0 8px rgba(251,191,36,0.4)' : '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: isDead ? '#484f58' : CLR[suit], pointerEvents: 'none' }}>
                      {rank}
                    </span>
                    <span style={{ fontSize: 11, marginLeft: 1, color: isDead ? '#484f58' : CLR[suit], pointerEvents: 'none' }}>
                      {SYM[suit]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
