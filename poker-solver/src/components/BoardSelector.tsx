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

const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663',
};

// Standard poker colors: spades=black, hearts=red, diamonds=red, clubs=black
const SUIT_TEXT: Record<Suit, string> = {
  s: 'text-gray-900',
  h: 'text-red-600',
  d: 'text-red-500',
  c: 'text-gray-900',
};

const DISPLAY_RANKS = [...RANKS].reverse(); // A, K, Q, J, T, 9...2

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
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{selectedCards.length}/{maxCards}</span>
          {selectedCards.length > 0 && (
            <button
              onClick={() => onCardsChange([])}
              className="text-xs text-red-400 active:text-red-300 px-2 py-0.5 rounded bg-red-950/50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected cards display */}
      <div className="flex gap-2 mb-3 justify-center min-h-[80px] items-center flex-wrap">
        {selectedCards.map((idx) => {
          const card = indexToCard(idx);
          return (
            <div
              key={idx}
              onClick={() => toggleCard(idx)}
              className="w-14 h-20 flex flex-col items-center justify-center cursor-pointer rounded-lg bg-yellow-400 shadow-lg shadow-yellow-500/30 border-2 border-yellow-300"
            >
              <span className={`text-xl font-bold ${SUIT_TEXT[card.suit]}`}>{card.rank}</span>
              <span className={`text-lg ${SUIT_TEXT[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
            </div>
          );
        })}
        {Array.from({ length: maxCards - selectedCards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-800/50"
          >
            <span className="text-gray-600 text-2xl">?</span>
          </div>
        ))}
      </div>

      {/* Card picker grid - 4 suits x 13 ranks */}
      <div className="w-full">
        <div
          className="grid gap-[3px] w-full"
          style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
        >
          {SUITS.map(suit =>
            DISPLAY_RANKS.map(rank => {
              const idx = cardToIndex({ rank, suit });
              const isSelected = selectedSet.has(idx);
              const isDead = deadSet.has(idx);

              return (
                <button
                  key={`${rank}${suit}`}
                  type="button"
                  onClick={() => toggleCard(idx)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    toggleCard(idx);
                  }}
                  disabled={isDead}
                  className={`
                    aspect-[3/4] rounded-md flex flex-col items-center justify-center font-bold
                    min-w-0 min-h-[32px] touch-manipulation
                    ${isDead
                      ? 'bg-gray-800 opacity-20 cursor-not-allowed'
                      : isSelected
                        ? 'bg-yellow-400 shadow-md shadow-yellow-500/30 border border-yellow-300'
                        : 'bg-[var(--card-white)] shadow-sm active:bg-gray-200 active:scale-95'
                    }
                  `}
                >
                  <span className={`text-[11px] sm:text-sm leading-none ${isDead ? 'text-gray-600' : isSelected ? SUIT_TEXT[suit] : SUIT_TEXT[suit]}`}>
                    {rank}
                  </span>
                  <span className={`text-[9px] sm:text-xs leading-none ${isDead ? 'text-gray-600' : SUIT_TEXT[suit]}`}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
