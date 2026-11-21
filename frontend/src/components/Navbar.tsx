import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FolderGit2,
  Users,
  GitPullRequest,
  History,
  Trash2,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  PanelLeft,
  ChevronDown,
  UserCog
} from 'lucide-react';
import { requestsApi } from '../services/api';
import { AccountSettingsModal } from './Modals/AccountSettingsModal';

interface NavbarProps {
  activeTab: 'dashboard' | 'users' | 'requests' | 'audit' | 'trash';
  setActiveTab: (tab: 'dashboard' | 'users' | 'requests' | 'audit' | 'trash') => void;
  toggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  onOpenCommandPalette?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  toggleMobileSidebar,
  isMobileSidebarOpen,
  onOpenCommandPalette,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'LEAD')) {
      requestsApi.getRequests().then((reqs) => {
        const pending = reqs.filter((r) => r.status === 'PENDING').length;
        setPendingRequestsCount(pending);
      }).catch(() => { });
    }
  }, [user, activeTab]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
      case 'LEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
      case 'EMPLOYEE':
        return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Vault & Files',
      icon: FolderGit2,
      show: true,
      badge: 0,
    },
    {
      id: 'users',
      label: 'Team & Members',
      icon: Users,
      show: user?.role === 'ADMIN' || user?.role === 'LEAD',
      badge: 0,
    },
    {
      id: 'requests',
      label: 'Access Requests',
      icon: GitPullRequest,
      show: user?.role === 'ADMIN' || user?.role === 'LEAD',
      badge: pendingRequestsCount,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
      show: true,
      badge: 0,
    },
    {
      id: 'trash',
      label: 'Recycle Bin',
      icon: Trash2,
      show: true,
      badge: 0,
    },
  ];

  return (
    <>
      <header className="h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0f1523]/90 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between sticky top-0 z-40 select-none transition-colors">
      {/* Left: Mobile Sidebar Toggle + Brand */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Toggle Sidebar on mobile/tablet */}
        {activeTab === 'dashboard' && toggleMobileSidebar && (
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle File Tree"
          >
            <PanelLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </button>
        )}

        {/* Logo and Name */}
        <div
          onClick={() => {
            setActiveTab('dashboard');
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center space-x-2.5 cursor-pointer group select-none"
        >
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Shakham Inc."
              className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105 select-none"
            />
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center">
            <span className="vault-shimmer-text text-sm sm:text-base">
              VAULT
            </span>
          </div>
        </div>
      </div>

      {/* Center: Desktop Navigation Tabs */}
      <nav className="hidden lg:flex items-center space-x-1 bg-slate-100/80 dark:bg-slate-900/80 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all relative ${isActive
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Right Controls: Theme Toggle + User Info + Mobile Menu Trigger */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Light / Dark Mode Switcher Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-indigo-600" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {/* User profile (Desktop/Tablet) */}
        {user && (
          <div className="hidden sm:flex items-center space-x-2 pl-2.5 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsAccountModalOpen(true)}
              title="Account Settings & Password"
              className="flex flex-col items-end p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right group"
            >
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user.full_name}
                </span>
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border font-bold ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[130px]">
                {user.email}
              </span>
            </button>

            <button
              onClick={() => setIsAccountModalOpen(true)}
              title="Account Settings"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-all"
            >
              <UserCog className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-14 left-0 w-full bg-white dark:bg-[#0f1523] border-b border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

          {user && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAccountModalOpen(true);
                }}
                className="text-left"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1">
                  <span>{user.full_name}</span>
                  <UserCog className="w-3 h-3 text-indigo-600" />
                </p>
                <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
              </button>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAccountModalOpen(true);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg"
                >
                  Settings
                </button>
                <button
                  onClick={logout}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>

    {/* Self-service profile & password modal mounted outside header to avoid stacking context issues */}
    <AccountSettingsModal
      isOpen={isAccountModalOpen}
      onClose={() => setIsAccountModalOpen(false)}
    />
  </>
);
};
