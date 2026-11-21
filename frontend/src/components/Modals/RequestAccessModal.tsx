import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GitPullRequest, X, Send, AlertCircle } from 'lucide-react';
import { requestsApi } from '../../services/api';
import { EmployeeWithLeads } from '../../types';
import { useToast } from '../../context/ToastContext';

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableEmployees: EmployeeWithLeads[];
  onRequestSubmitted: () => void;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  isOpen,
  onClose,
  availableEmployees,
  onRequestSubmitted,
}) => {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Automatically synchronize employeeId when modal opens or availableEmployees updates
  useEffect(() => {
    if (isOpen) {
      if (availableEmployees && availableEmployees.length > 0) {
        if (!employeeId || !availableEmployees.some((e) => e.id === employeeId)) {
          setEmployeeId(availableEmployees[0].id);
        }
      } else {
        setEmployeeId('');
      }
    }
  }, [isOpen, availableEmployees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = employeeId || availableEmployees[0]?.id;
    if (!targetId) {
      toast.error('Please select an employee to request access');
      return;
    }

    setSubmitting(true);
    try {
      await requestsApi.createRequest(targetId, reason.trim() || undefined);
      setReason('');
      onRequestSubmitted();
      toast.success('Access request submitted to Admin for approval!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-md my-6 sm:my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Request Employee Access</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Submit request to Admin to assign an employee to your team</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {availableEmployees.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>All registered employees are already assigned to your team, or no unassigned employees currently exist.</span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={employeeId || (availableEmployees[0]?.id ?? '')}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
                >
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {emp.full_name} ({emp.email}) — Current Leads: {emp.leads?.map((l) => l.full_name).join(', ') || 'None'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Project Justification / Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Needs access to collaborate on backend microservices architecture and API secrets"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || availableEmployees.length === 0}
                className="btn-primary flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Send Request to Admin'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
