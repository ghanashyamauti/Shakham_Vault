import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, X, Check, Shield } from 'lucide-react';
import { EmployeeWithLeads } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../services/api';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EmployeeWithLeads | null;
  onUserUpdated: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user: targetUser,
  onUserUpdated,
}) => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('EMPLOYEE');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (targetUser) {
      setFullName(targetUser.full_name);
      setEmail(targetUser.email);
      setRole(targetUser.role);
      setIsActive(targetUser.is_active);
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (!email.trim()) {
      toast.error('Email cannot be empty');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        is_active: isActive,
      };
      // Only Admin can change role
      if (currentUser?.role === 'ADMIN') {
        payload.role = role;
      }

      await usersApi.updateUser(targetUser.id, payload);
      toast.success(`Updated ${fullName.trim()}'s profile successfully!`);
      onUserUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update member');
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
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Team Member</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{targetUser.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Doe"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@shakham.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {currentUser?.role === 'ADMIN' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role (Admin Only)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="LEAD">LEAD</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Role</span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{targetUser.role}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Account Active</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Inactive accounts cannot log in to the vault</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
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
              disabled={submitting}
              className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
);
};
