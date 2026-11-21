import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestsApi, usersApi } from '../services/api';
import { AccessRequest, EmployeeWithLeads } from '../types';
import { GitPullRequest, Check, X, Clock, ShieldAlert } from 'lucide-react';
import { RequestAccessModal } from '../components/Modals/RequestAccessModal';
import { RejectAccessModal } from '../components/Modals/RejectAccessModal';

export const RequestsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Lead request modal & available employees
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<EmployeeWithLeads[]>([]);

  // Admin rejection modal
  const [selectedRejectRequest, setSelectedRejectRequest] = useState<AccessRequest | null>(null);

  useEffect(() => {
    loadRequests();
    if (currentUser?.role === 'LEAD') {
      loadUsers();
    }
  }, [currentUser]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await requestsApi.getRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReview = async (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ) => {
    setActionLoading(requestId);
    try {
      await requestsApi.reviewRequest(requestId, status, rejectionReason);
      await loadRequests();
      toast.success(
        status === 'APPROVED'
          ? 'Access request approved! Employee is now assigned to the team.'
          : 'Access request rejected and reason communicated.'
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update request');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold';
      case 'REJECTED':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold';
      default:
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold';
    }
  };

  const unassignedEmployeesForLead = users.filter(
    (u) =>
      u.role === 'EMPLOYEE' &&
      !u.leads?.some((lead) => lead.id === currentUser?.id)
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f17] p-4 sm:p-6 lg:p-8 select-none">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <GitPullRequest className="w-5 h-5 text-amber-500" />
              <span>Lead Access Requests</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentUser?.role === 'ADMIN'
                ? 'Review and approve Lead requests to manage employees'
                : 'Track status of your employee access requests'}
            </p>
          </div>

          {currentUser?.role === 'LEAD' && (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="btn-primary flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-md"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Request Employee</span>
            </button>
          )}
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center space-y-2">
              <p>No access requests recorded.</p>
              {currentUser?.role === 'LEAD' && (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="btn-primary inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Request an Employee Now</span>
                </button>
              )}
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                      <GitPullRequest className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Lead <strong className="text-indigo-600 dark:text-indigo-400">{req.lead?.full_name}</strong> requested access to{' '}
                          <strong className="text-violet-600 dark:text-violet-400">{req.employee?.full_name}</strong>
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase px-2 py-0.2 rounded-full border ${getStatusBadge(
                            req.status
                          )}`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {req.lead?.email} ➔ {req.employee?.email} • {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {currentUser?.role === 'ADMIN' && req.status === 'PENDING' && (
                    <div className="flex items-center space-x-1.5 ml-auto">
                      <button
                        disabled={actionLoading === req.id}
                        onClick={() => handleReview(req.id, 'APPROVED')}
                        className="btn-primary flex items-center space-x-1 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        disabled={actionLoading === req.id}
                        onClick={() => setSelectedRejectRequest(req)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>

                {req.reason && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Project Justification: </span>
                    {req.reason}
                  </div>
                )}

                {req.status === 'REJECTED' && req.rejection_reason && (
                  <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 font-bold">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Rejection Reason from Admin:</span>
                    </div>
                    <p className="text-rose-900 dark:text-rose-200 pl-5 font-medium leading-relaxed">
                      {req.rejection_reason}
                    </p>
                  </div>
                )}

                {req.reviewed_by && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      Reviewed by {req.reviewed_by.full_name} ({req.reviewed_by.email}) on{' '}
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : ''}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal for Lead to request employee access */}
        <RequestAccessModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          availableEmployees={unassignedEmployeesForLead}
          onRequestSubmitted={() => {
            loadRequests();
            loadUsers();
          }}
        />

        {/* Modal for Admin to reject request with mandatory reason */}
        <RejectAccessModal
          isOpen={!!selectedRejectRequest}
          onClose={() => setSelectedRejectRequest(null)}
          request={selectedRejectRequest}
          onConfirm={async (reason) => {
            if (selectedRejectRequest) {
              await handleReview(selectedRejectRequest.id, 'REJECTED', reason);
            }
          }}
        />
      </div>
    </div>
  );
};

