import React, { useState } from 'react';
import { GitCommit, X, Check } from 'lucide-react';

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
  fileName: string;
}

export const CommitModal: React.FC<CommitModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
}) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(message.trim());
      setMessage('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shadow-xs">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Commit Changes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Target: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{fileName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Commit Message <span className="text-rose-500">*</span>
            </label>
            <textarea
              autoFocus
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Added Stripe webhook signing secret and increased pool size"
              className="w-full px-3 py-2 text-xs bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17] focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none font-sans"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Creates an immutable snapshot with your author attribution and timestamp.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="btn-primary flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? 'Committing...' : 'Save & Commit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
