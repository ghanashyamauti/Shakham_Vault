import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Floating Frosted Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center justify-between p-3.5 rounded-xl bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-3 fade-in duration-200 select-none"
          >
            <div className="flex items-center space-x-2.5">
              {t.type === 'success' && (
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              {t.type === 'error' && (
                <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </div>
              )}
              {t.type === 'info' && (
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center shrink-0">
                  <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {t.message}
              </span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 ml-3 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
