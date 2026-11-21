import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FolderGit2,
  Users,
  Key,
  History,
  Trash2,
  Sun,
  Moon,
  LogOut,
  X,
  Command
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: 'dashboard' | 'users' | 'requests' | 'audit' | 'trash') => void;
  onOpenCreateFolder?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions';
  icon: React.FC<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onOpenCreateFolder,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const commands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Go to Vault & Files',
      category: 'Navigation',
      icon: FolderGit2,
      shortcut: 'G D',
      action: () => {
        setActiveTab('dashboard');
        onClose();
      },
    },
    ...(user?.role === 'ADMIN' || user?.role === 'LEAD'
      ? [
          {
            id: 'nav-users',
            title: 'Go to Team & Members',
            category: 'Navigation' as const,
            icon: Users,
            shortcut: 'G T',
            action: () => {
              setActiveTab('users');
              onClose();
            },
          },
        ]
      : []),
    ...(user?.role === 'ADMIN' || user?.role === 'LEAD'
      ? [
          {
            id: 'nav-requests',
            title: 'Go to Access Requests',
            category: 'Navigation' as const,
            icon: Key,
            shortcut: 'G R',
            action: () => {
              setActiveTab('requests');
              onClose();
            },
          },
        ]
      : []),
    ...(user?.role === 'ADMIN'
      ? [
          {
            id: 'nav-audit',
            title: 'Go to Audit Trail & Ledger',
            category: 'Navigation' as const,
            icon: History,
            shortcut: 'G A',
            action: () => {
              setActiveTab('audit');
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'nav-trash',
      title: 'Go to Recycle Bin',
      category: 'Navigation',
      icon: Trash2,
      shortcut: 'G B',
      action: () => {
        setActiveTab('trash');
        onClose();
      },
    },
    {
      id: 'action-theme',
      title: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
      category: 'Actions',
      icon: theme === 'light' ? Moon : Sun,
      shortcut: 'T',
      action: () => {
        toggleTheme();
        onClose();
      },
    },
    {
      id: 'action-logout',
      title: 'Lock Vault / Sign Out',
      category: 'Actions',
      icon: LogOut,
      shortcut: 'Q',
      action: () => {
        logout();
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium"
          />
          <div className="flex items-center space-x-1.5 pl-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">ESC</kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span>{cmd.title}</span>
                  </div>
                  {cmd.shortcut && (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Shakham Vault Command</span>
        </div>
      </div>
    </div>
  );
};
