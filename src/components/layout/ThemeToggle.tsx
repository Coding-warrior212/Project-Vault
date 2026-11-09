import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative p-2 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B3F] ${
        isDark
          ? 'bg-[#14133B] hover:bg-[#25245F] text-[#FFF4E3] border border-[#2D2C68]'
          : 'bg-neutral-100 hover:bg-neutral-200 text-[#25245F] border border-neutral-200'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Sun Icon (Visible in dark mode to switch to light) */}
        <Sun
          className={`w-4 h-4 text-[#E5B25D] absolute transition-all duration-300 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
          }`}
        />
        {/* Moon Icon (Visible in light mode to switch to dark) */}
        <Moon
          className={`w-4 h-4 text-[#25245F] absolute transition-all duration-300 transform ${
            isDark
              ? 'opacity-0 rotate-90 scale-50 pointer-events-none'
              : 'opacity-100 rotate-0 scale-100'
          }`}
        />
      </div>
    </button>
  );
};
