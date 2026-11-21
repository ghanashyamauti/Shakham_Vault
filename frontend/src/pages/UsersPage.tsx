import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usersApi } from '../services/api';
import { EmployeeWithLeads, User } from '../types';
import {
  Users,
  UserPlus,
  GitPullRequest,
  Check,
  Search,
  Edit2,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { CreateUserModal } from '../components/Modals/CreateUserModal';
import { RequestAccessModal } from '../components/Modals/RequestAccessModal';
import { EditUserModal } from '../components/Modals/EditUserModal';
import { ResetPasswordModal } from '../components/Modals/ResetPasswordModal';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<EmployeeWithLeads[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [userToEdit, setUserToEdit] = useState<EmployeeWithLeads | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<EmployeeWithLeads | null>(null);

  // Lead re-assignment state for Admin
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithLeads | null>(null);
  const [availableLeads, setAvailableLeads] = useState<User[]>([]);
  const [reassignLeadIds, setReassignLeadIds] = useState<string[]>([]);
  const [savingLeads, setSavingLeads] = useState<boolean>(false);

  const canManageUser = (targetUser: EmployeeWithLeads): boolean => {
    if (currentUser?.role === 'ADMIN') return true;
    if (currentUser?.role === 'LEAD') {
      return targetUser.role === 'EMPLOYEE' && !!targetUser.leads?.some((l) => l.id === currentUser.id);
    }
    return false;
  };

  const handleDeleteUser = async (u: EmployeeWithLeads) => {
    if (u.id === currentUser?.id) {
      toast.error('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${u.full_name}" (${u.email})? This action cannot be undone.`)) {
      return;
    }
    try {
      await usersApi.deleteUser(u.id);
      toast.success(`Deleted user "${u.full_name}"`);
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  useEffect(() => {
    loadUsers();
    if (currentUser?.role === 'ADMIN') {
      usersApi.getLeads().then(setAvailableLeads).catch(console.error);
    }
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = (emp: EmployeeWithLeads) => {
    setEditingEmployee(emp);
    setReassignLeadIds(emp.leads.map((l) => l.id));
  };

  const handleSaveAssignedLeads = async () => {
    if (!editingEmployee) return;
    if (reassignLeadIds.length === 0) {
      toast.error('An Employee must have at least one assigned Lead.');
      return;
    }
    setSavingLeads(true);
    try {
      await usersApi.assignLeads(editingEmployee.id, reassignLeadIds);
      setEditingEmployee(null);
      await loadUsers();
      toast.success('Assigned leads updated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to assign leads');
    } finally {
      setSavingLeads(false);
    }
  };

  const toggleLeadInReassign = (leadId: string) => {
    if (reassignLeadIds.includes(leadId)) {
      setReassignLeadIds(reassignLeadIds.filter((id) => id !== leadId));
    } else {
      setReassignLeadIds([...reassignLeadIds, leadId]);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const unassignedEmployeesForLead = users.filter(
    (u) =>
      u.role === 'EMPLOYEE' &&
      !u.leads?.some((lead) => lead.id === currentUser?.id)
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f17] p-4 sm:p-6 lg:p-8 select-none">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Team & Members</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provision members, manage lead assignments, and review role access
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser?.role === 'LEAD' && (
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>Request Employee</span>
              </button>
            )}

            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'LEAD') && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-md"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {currentUser?.role === 'LEAD' ? 'Create Employee' : 'Add User'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
          <div className="flex items-center space-x-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 ml-1.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or email..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="LEAD">Lead</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#121824] shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading team members...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">No members match search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Leads</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{u.full_name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                              : u.role === 'LEAD'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                              : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        {u.role === 'EMPLOYEE' ? (
                          <div className="flex flex-wrap gap-1">
                            {u.leads && u.leads.length > 0 ? (
                              u.leads.map((lead) => (
                                <span
                                  key={lead.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  {lead.full_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No Leads</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      </td>

                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {canManageUser(u) && (
                            <>
                              <button
                                onClick={() => setUserToEdit(u)}
                                title="Edit Member Details"
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setUserToResetPassword(u)}
                                title="Reset Member Password"
                                className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {currentUser?.role === 'ADMIN' && u.role === 'EMPLOYEE' && (
                            <button
                              onClick={() => handleOpenAssignModal(u)}
                              title="Manage Reporting Leads"
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                            >
                              Leads
                            </button>
                          )}

                          {canManageUser(u) && u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Delete Member"
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Re-assign Leads Modal for Admin */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
          <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Manage Reporting Leads</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Employee: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{editingEmployee.full_name}</span>
              </p>
            </div>

            <div className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Select the leads who have management visibility and edit access over this employee:
              </p>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                {availableLeads.map((lead) => {
                  const isChecked = reassignLeadIds.includes(lead.id);
                  return (
                    <div
                      key={lead.id}
                      onClick={() => toggleLeadInReassign(lead.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{lead.full_name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{lead.email}</p>
                      </div>
                      {isChecked && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingLeads || reassignLeadIds.length === 0}
                  onClick={handleSaveAssignedLeads}
                  className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
                >
                  {savingLeads ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={() => loadUsers()}
      />

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        availableEmployees={unassignedEmployeesForLead}
        onRequestSubmitted={() => loadUsers()}
      />

      <EditUserModal
        isOpen={!!userToEdit}
        onClose={() => setUserToEdit(null)}
        user={userToEdit}
        onUserUpdated={() => loadUsers()}
      />

      <ResetPasswordModal
        isOpen={!!userToResetPassword}
        onClose={() => setUserToResetPassword(null)}
        user={userToResetPassword}
      />
    </div>
  );
};
