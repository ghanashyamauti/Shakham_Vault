import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { RequestsPage } from './pages/RequestsPage';
import { AuditPage } from './pages/AuditPage';
import { TrashPage } from './pages/TrashPage';
import { Navbar } from './components/Navbar';
import { CommandPalette } from './components/CommandPalette';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'requests' | 'audit' | 'trash'>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f17] flex flex-col items-center justify-center space-y-4 select-none">
        <img
          src="/logo.png"
          alt="Shakham Inc."
          className="h-16 sm:h-20 w-auto object-contain animate-pulse select-none"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wide flex items-center justify-center space-x-1.5">
          <span>Unlocking Shakham</span>
          <span className="vault-shimmer-text text-xs">VAULT</span>
          <span>...</span>
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#0b0f17] overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        toggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardPage
            isMobileSidebarOpen={isMobileSidebarOpen}
            onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          />
        )}
        {activeTab === 'users' && <UsersPage />}
        {activeTab === 'requests' && <RequestsPage />}
        {activeTab === 'audit' && <AuditPage />}
        {activeTab === 'trash' && <TrashPage />}
      </main>

      {/* Raycast-style Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MainLayout />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
