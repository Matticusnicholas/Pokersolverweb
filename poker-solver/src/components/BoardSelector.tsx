'use client';

import React from 'react';
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

const SUIT_TEXT: Record<Suit, string> = {
  s: 'text-gray-900',
  h: 'text-red-600',
  d: 'text-blue-600',
  c: 'text-green-700',
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

  const toggleCard = (idx: CardIndex) => {
    if (deadSet.has(idx)) return;
    if (selectedSet.has(idx)) {
      onCardsChange(selectedCards.filter(c => c !== idx));
    } else if (selectedCards.length < maxCards) {
      onCardsChange([...selectedCards, idx]);
    }
  };

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
      <div className="flex gap-2 mb-3 justify-center min-h-[80px] items-center">
        {selectedCards.map((idx) => {
          const card = indexToCard(idx);
          return (
            <div
              key={idx}
              onClick={() => toggleCard(idx)}
              className="poker-card selected w-14 h-20 flex flex-col items-center justify-center cursor-pointer"
            >
              <span className={`text-xl font-bold ${SUIT_TEXT[card.suit]}`}>{card.rank}</span>
              <span className={`text-lg ${SUIT_TEXT[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
            </div>
          );
        })}
        {Array.from({ length: maxCards - selectedCards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-14 h-20 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center"
          >
            <span className="text-gray-700 text-2xl">?</span>
          </div>
        ))}
      </div>

      {/* Card picker grid - 4 suits x 13 ranks */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: 'repeat(13, 1fr)', minWidth: '320px' }}
        >
          {SUITS.map(suit =>
            DISPLAY_RANKS.map(rank => {
              const idx = cardToIndex({ rank, suit });
              const isSelected = selectedSet.has(idx);
              const isDead = deadSet.has(idx);

              return (
                <button
                  key={`${rank}${suit}`}
                  onClick={() => toggleCard(idx)}
                  disabled={isDead}
                  className={`
                    aspect-[3/4] rounded-md flex flex-col items-center justify-center font-bold
                    transition-all duration-100 min-w-0
                    ${isDead
                      ? 'poker-card dead'
                      : isSelected
                        ? 'poker-card selected !transform-none'
                        : 'poker-card'
                    }
                  `}
                >
                  <span className={`text-xs sm:text-sm leading-none ${isDead ? 'text-gray-500' : SUIT_TEXT[suit]}`}>
                    {rank}
                  </span>
                  <span className={`text-[10px] sm:text-xs leading-none ${isDead ? 'text-gray-500' : SUIT_TEXT[suit]}`}>
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
