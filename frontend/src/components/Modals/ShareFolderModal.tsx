import React, { useState, useEffect } from 'react';
import { Share2, X, Trash2 } from 'lucide-react';
import { Folder, EmployeeWithLeads } from '../../types';
import { foldersApi, usersApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder;
  onFolderUpdated: () => void;
}

export const ShareFolderModal: React.FC<ShareFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  onFolderUpdated,
}) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<EmployeeWithLeads[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<'READ' | 'WRITE'>('READ');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (isOpen) {
      usersApi.getUsers().then((u) => {
        setUsers(u.filter((user) => user.id !== folder.owner_id));
        if (u.length > 0) setSelectedUserId(u[0].id);
      }).catch(console.error).finally(() => setLoadingUsers(false));
    }
  }, [isOpen, folder.id]);

  if (!isOpen) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      await foldersApi.shareFolder(folder.id, selectedUserId, accessLevel);
      toast.success(`Granted ${accessLevel} access to user`);
      onFolderUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to share folder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!window.confirm('Revoke access for this user?')) return;
    try {
      await foldersApi.revokeShare(folder.id, userId);
      toast.info('Revoked access for user');
      onFolderUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to revoke access');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Share Folder Access</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Folder: <span className="font-mono text-indigo-800 dark:text-indigo-400 font-bold">{folder.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add Share Form */}
          <form onSubmit={handleShare} className="space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={loadingUsers}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role}) — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Access
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as 'READ' | 'WRITE')}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="READ">Read Only</option>
                  <option value="WRITE">Read & Write</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedUserId}
              className="btn-primary w-full py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Granting...' : 'Grant Access'}
            </button>
          </form>

          {/* Currently Shared List */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Active Permissions</h4>
            {folder.permissions.length === 0 ? (
              <p className="text-xs text-slate-400">This folder is not shared with anyone yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {folder.permissions.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{perm.user?.full_name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{perm.user?.email}</p>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono font-bold ${perm.access_level === 'WRITE'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                        {perm.access_level}
                      </span>
                      <button
                        onClick={() => handleRevoke(perm.user_id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
