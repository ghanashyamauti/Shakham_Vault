import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Eye, EyeOff, X, RefreshCw, Check } from 'lucide-react';
import { EmployeeWithLeads } from '../../types';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../services/api';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EmployeeWithLeads | null;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  user: targetUser,
}) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !targetUser) return null;

  const generateStrongPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.resetPassword(targetUser.id, newPassword);
      toast.success(`Password reset successfully for ${targetUser.full_name}!`);
      setNewPassword('');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-md my-6 sm:my-8 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reset Member Password</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  For: <span className="font-semibold text-slate-800 dark:text-slate-200">{targetUser.full_name}</span> ({targetUser.email})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleReset} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                New Temporary or Permanent Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={generateStrongPassword}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                className="w-full px-3 py-2 pr-9 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              The member can log in with this new password immediately.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !newPassword}
              className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Resetting...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
);
};
