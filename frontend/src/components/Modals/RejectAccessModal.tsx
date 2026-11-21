import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, ShieldAlert, UserCheck } from 'lucide-react';
import { AccessRequest } from '../../types';

interface RejectAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: AccessRequest | null;
  onConfirm: (reason: string) => Promise<void>;
}

export const RejectAccessModal: React.FC<RejectAccessModalProps> = ({
  isOpen,
  onClose,
  request,
  onConfirm,
}) => {
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setValidationError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError('Please provide a specific rejection reason for the lead.');
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-md my-6 sm:my-8 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reject Access Request</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Provide a mandatory explanation for the lead
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Request Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Requesting Lead:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{request.lead?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Requested Employee:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{request.employee?.full_name}</span>
              </div>
              {request.reason && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">Lead's Justification:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800">
                    "{request.reason}"
                  </p>
                </div>
              )}
            </div>

            {/* Rejection Reason Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError && e.target.value.trim()) {
                    setValidationError(null);
                  }
                }}
                placeholder="e.g. This employee is allocated to another critical milestone and cannot be assigned right now."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 resize-none font-medium"
              />
              {validationError && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{validationError}</span>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 active:scale-98 transition-all disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{submitting ? 'Rejecting...' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
