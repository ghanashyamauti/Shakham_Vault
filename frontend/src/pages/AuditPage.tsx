import React, { useState, useEffect } from 'react';
import { auditApi } from '../services/api';
import { AuditLog } from '../types';
import { History, Search } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await auditApi.getLogs({
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('VIEW')) {
      return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    } else if (action.includes('COPY')) {
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else if (action.includes('COMMIT')) {
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (action.includes('DELETE')) {
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else if (action.includes('SHARE')) {
      return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    } else {
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.actor_name.toLowerCase().includes(search.toLowerCase()) ||
      l.actor_email.toLowerCase().includes(search.toLowerCase()) ||
      (l.target_name && l.target_name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f17] p-4 sm:p-6 lg:p-8 select-none">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Audit Trail & Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time immutable ledger of secret views, copies, commits, and permission changes
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
          <div className="flex items-center space-x-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 ml-1.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by actor, email, or target..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="VIEW_SECRET">Secret Views (VIEW_SECRET)</option>
              <option value="COPY_SECRET">Secret Copies (COPY_SECRET)</option>
              <option value="COMMIT_ENV">Commits (COMMIT_ENV)</option>
              <option value="CREATE_ENV_FILE">File Creation (CREATE_ENV_FILE)</option>
              <option value="DELETE_ENV_FILE">Deletions (DELETE_ENV_FILE)</option>
              <option value="SHARE_FOLDER">Folder Shares (SHARE_FOLDER)</option>
              <option value="USER_CREATED">User Creation (USER_CREATED)</option>
              <option value="LOGIN">User Logins (LOGIN)</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#121824] shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading audit trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">No audit events recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider font-bold font-sans">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Target</th>
                    <th className="px-5 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td className="px-5 py-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{log.actor_name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{log.actor_email}</p>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold border font-mono ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <div>
                          <p className="text-slate-900 dark:text-white font-medium text-xs">{log.target_name || log.target_type}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-mono">{log.target_type}</p>
                        </div>
                      </td>

                      <td className="px-5 py-3 max-w-xs truncate text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
