import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, ArrowRight, Sun, Moon, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080c14] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Ambient Radial Mesh Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top right Theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl bg-white/80 dark:bg-[#121824]/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-indigo-600" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>
      </div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Shakham" 
              className="h-16 sm:h-20 w-auto object-contain select-none drop-shadow-sm"
            />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center">
              <span className="vault-shimmer-text text-2xl sm:text-3xl">
                VAULT
              </span>
            </h1>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/90 dark:bg-[#0f1523]/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 border-t-white/80 dark:border-t-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#090d15] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#090d15] focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50/80 dark:bg-[#090d15] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#090d15] focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white btn-primary flex items-center justify-center space-x-1.5 shadow-md disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
