import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, X, Check } from 'lucide-react';
import { usersApi } from '../../services/api';
import { User, EmployeeWithLeads } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: EmployeeWithLeads) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'LEAD' | 'EMPLOYEE'>('EMPLOYEE');
  const [availableLeads, setAvailableLeads] = useState<User[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser?.role === 'ADMIN') {
      usersApi.getLeads().then((leads) => {
        setAvailableLeads(leads);
        if (leads.length > 0) {
          setSelectedLeadIds([leads[0].id]);
        }
      }).catch(console.error);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const toggleLeadSelection = (leadId: string) => {
    if (selectedLeadIds.includes(leadId)) {
      setSelectedLeadIds(selectedLeadIds.filter((id) => id !== leadId));
    } else {
      setSelectedLeadIds([...selectedLeadIds, leadId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role === 'ADMIN' && role === 'EMPLOYEE' && selectedLeadIds.length === 0) {
      toast.error('Assigning at least one Lead is mandatory when creating an Employee.');
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await usersApi.createUser({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        role: currentUser?.role === 'LEAD' ? 'EMPLOYEE' : role,
        lead_ids: role === 'EMPLOYEE' ? selectedLeadIds : [],
      });

      setFullName('');
      setEmail('');
      setPassword('');
      onUserCreated(newUser);
      toast.success(`Provisioned user "${newUser.full_name}"`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-md my-6 sm:my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Provision New User</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser?.role === 'LEAD' ? 'Add Employee to your team' : 'Provision Team Member'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Work Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@shakham.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Temporary Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          {/* Role selector (Only Admin can select LEAD or EMPLOYEE) */}
          {currentUser?.role === 'ADMIN' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Role <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('LEAD')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    role === 'LEAD'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Lead
                </button>
                <button
                  type="button"
                  onClick={() => setRole('EMPLOYEE')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    role === 'EMPLOYEE'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Employee
                </button>
              </div>
            </div>
          )}

          {/* Mandatory Lead Assignment when Admin creates Employee */}
          {currentUser?.role === 'ADMIN' && role === 'EMPLOYEE' && (
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assign Reporting Leads <span className="text-rose-500">* (Mandatory)</span>
                </label>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  {selectedLeadIds.length} selected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All selected leads inherit management visibility over this employee.
              </p>

              {availableLeads.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-medium">
                  No Leads exist yet. Please create at least one Lead before provisioning Employees.
                </div>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-800/50">
                  {availableLeads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    return (
                      <div
                        key={lead.id}
                        onClick={() => toggleLeadSelection(lead.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-transparent'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{lead.full_name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{lead.email}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
              disabled={submitting || (currentUser?.role === 'ADMIN' && role === 'EMPLOYEE' && selectedLeadIds.length === 0)}
              className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
);
};
