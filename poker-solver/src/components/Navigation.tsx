'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Hand', icon: '\u2660' },
  { href: '/preflop/', label: 'Preflop', icon: '\u2665' },
  { href: '/equity/', label: 'Equity', icon: '\u2666' },
];

export default function Navigation() {
  const pathname = usePathname();
  // Defer active-tab highlight to after hydration to avoid SSR/client mismatch
  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => { setCurrentPath(pathname); }, [pathname]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom md:relative md:bottom-auto"
      style={{
        background: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid #21262d',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around" style={{ height: 64 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href || currentPath === item.href.slice(0, -1);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors touch-manipulation"
              style={{
                minWidth: 72,
                color: isActive ? '#f0b429' : '#484f58',
              }}
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
