import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, FolderVideo, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/dashboard/projects', icon: FolderVideo, label: 'Projects' },
    { to: '/dashboard/assets', icon: Sparkles, label: 'Library' },
    { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-2)]/90 backdrop-blur-xl border-t border-[var(--border-3)] safe-bottom">
      <nav className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center w-full h-full space-y-1',
                isActive ? 'text-[var(--red-3)]' : 'text-[var(--text-4)] hover:text-[var(--text-2)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-[var(--red-3)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
