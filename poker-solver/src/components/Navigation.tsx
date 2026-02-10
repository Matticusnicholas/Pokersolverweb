'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Solver', icon: '\u2660' },
  { href: '/preflop/', label: 'Preflop', icon: '\u2665' },
  { href: '/equity/', label: 'Equity', icon: '\u2666' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a1218] border-t border-gray-800 safe-area-bottom md:relative md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 md:h-14 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname === item.href.slice(0, -1);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors min-w-[72px]
                ${isActive
                  ? 'text-[#d4a84b]'
                  : 'text-gray-500 active:text-gray-300'
                }`}
            >
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-semibold tracking-wide uppercase">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
