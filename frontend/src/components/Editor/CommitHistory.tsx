import React from 'react';
import { EnvCommit } from '../../types';
import { GitCommit, RotateCcw, Clock, Eye } from 'lucide-react';

interface CommitHistoryProps {
  commits: EnvCommit[];
  currentCommitHash: string;
  onViewCommit: (hash: string) => void;
  onRevertCommit: (hash: string) => void;
  canEdit: boolean;
}

export const CommitHistory: React.FC<CommitHistoryProps> = ({
  commits,
  currentCommitHash,
  onViewCommit,
  onRevertCommit,
  canEdit,
}) => {
  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 select-none">
        <GitCommit className="w-10 h-10 mb-2.5 text-slate-300 dark:text-slate-700" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No commits recorded</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Commit snapshots appear here when saved.</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Commit History</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {commits.length} {commits.length === 1 ? 'version' : 'versions'} recorded in immutable ledger
          </p>
        </div>
      </div>

      <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4">
        {commits.map((commit, index) => {
          const isCurrent = commit.commit_hash === currentCommitHash;
          const isLatest = index === 0;

          return (
            <div key={commit.id} className="relative pl-5 group">
              {/* Timeline marker */}
              <div
                className={`absolute -left-[11px] top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                    : 'bg-white dark:bg-[#0f1523] border-slate-300 dark:border-slate-700 text-slate-400 group-hover:border-indigo-500'
                }`}
              >
                <GitCommit className="w-2.5 h-2.5" />
              </div>

              {/* Commit Card */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-white dark:bg-[#121824] border-indigo-500/80 shadow-xs'
                    : 'bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {commit.commit_message}
                      </span>
                      {isLatest && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          HEAD
                        </span>
                      )}
                      {isCurrent && !isLatest && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Viewing
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-indigo-700 dark:text-indigo-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-bold text-[10px] border border-slate-200 dark:border-slate-700">
                        {commit.commit_hash}
                      </span>
                      <span>by <strong className="text-slate-700 dark:text-slate-200 font-semibold">{commit.author?.full_name || 'System'}</strong></span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(commit.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => onViewCommit(commit.commit_hash)}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        isCurrent
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>{isCurrent ? 'Viewing' : 'Inspect'}</span>
                    </button>

                    {canEdit && !isLatest && (
                      <button
                        onClick={() => onRevertCommit(commit.commit_hash)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                        title="Rollback to this version"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
