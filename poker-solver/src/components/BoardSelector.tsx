'use client';

import React, { useState } from 'react';
import { CardIndex, RANKS, SUITS, Rank, Suit, cardToIndex, indexToCard, cardToString } from '@/engine/types';

interface BoardSelectorProps {
  selectedCards: CardIndex[];
  onCardsChange: (cards: CardIndex[]) => void;
  maxCards?: number;
  deadCards?: CardIndex[];
  label?: string;
}

const SUIT_COLORS: Record<Suit, string> = {
  s: 'text-gray-300',     // spades
  h: 'text-red-400',      // hearts
  d: 'text-blue-400',     // diamonds
  c: 'text-green-400',    // clubs
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '\u2660',  // ♠
  h: '\u2665',  // ♥
  d: '\u2666',  // ♦
  c: '\u2663',  // ♣
};

export default function BoardSelector({
  selectedCards,
  onCardsChange,
  maxCards = 5,
  deadCards = [],
  label = 'Board',
}: BoardSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const deadSet = new Set([...deadCards]);
  const selectedSet = new Set(selectedCards);

  const toggleCard = (idx: CardIndex) => {
    if (deadSet.has(idx)) return;

    if (selectedSet.has(idx)) {
      onCardsChange(selectedCards.filter(c => c !== idx));
    } else if (selectedCards.length < maxCards) {
      onCardsChange([...selectedCards, idx]);
    }
  };

  const clearAll = () => onCardsChange([]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>

      {/* Selected cards display */}
      <div
        className="flex items-center gap-1 p-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 min-h-[48px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCards.length === 0 ? (
          <span className="text-gray-500 text-sm">Click to select cards...</span>
        ) : (
          selectedCards.map((idx) => {
            const card = indexToCard(idx);
            return (
              <span
                key={idx}
                className={`inline-flex items-center justify-center w-10 h-12 bg-white rounded-md shadow-md text-lg font-bold ${SUIT_COLORS[card.suit]}`}
              >
                <span className="text-gray-900">{card.rank}</span>
                <span>{SUIT_SYMBOLS[card.suit]}</span>
              </span>
            );
          })
        )}

        {selectedCards.length > 0 && selectedCards.length < maxCards && (
          <span className="text-gray-500 text-xs ml-2">
            +{maxCards - selectedCards.length} more
          </span>
        )}
      </div>

      {/* Card picker dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Select up to {maxCards} cards</span>
            <div className="flex gap-2">
              <button
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Done
              </button>
            </div>
          </div>

          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-[2px] mb-[2px]">
              {[...RANKS].reverse().map((rank) => {
                const idx = cardToIndex({ rank, suit });
                const isSelected = selectedSet.has(idx);
                const isDead = deadSet.has(idx);

                return (
                  <button
                    key={`${rank}${suit}`}
                    onClick={() => toggleCard(idx)}
                    disabled={isDead}
                    className={`
                      w-8 h-10 flex flex-col items-center justify-center text-xs font-mono rounded
                      transition-all
                      ${isDead
                        ? 'bg-gray-800 text-gray-700 cursor-not-allowed'
                        : isSelected
                          ? 'bg-white shadow-md ring-2 ring-yellow-400'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }
                    `}
                    title={`${rank}${SUIT_SYMBOLS[suit]}`}
                  >
                    <span className={isSelected ? 'text-gray-900 font-bold' : 'text-gray-300'}>{rank}</span>
                    <span className={`text-[10px] ${SUIT_COLORS[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
