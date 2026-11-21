import React, { useState, useEffect } from 'react';
import { EnvCommit, DiffOut } from '../../types';
import { envsApi } from '../../services/api';
import { GitCompare, ArrowRight, Plus, Minus } from 'lucide-react';

interface DiffViewerProps {
  envFileId: string;
  commits: EnvCommit[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ envFileId, commits }) => {
  const [fromHash, setFromHash] = useState<string>('');
  const [toHash, setToHash] = useState<string>('');
  const [diffData, setDiffData] = useState<DiffOut | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (commits.length >= 2) {
      setToHash(commits[0].commit_hash);
      setFromHash(commits[1].commit_hash);
    } else if (commits.length === 1) {
      setToHash(commits[0].commit_hash);
      setFromHash('');
    }
  }, [commits]);

  useEffect(() => {
    if (toHash) {
      fetchDiff();
    }
  }, [fromHash, toHash, envFileId]);

  const fetchDiff = async () => {
    setLoading(true);
    try {
      const data = await envsApi.getDiff(envFileId, fromHash || undefined, toHash || undefined);
      setDiffData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const additions = diffData?.lines.filter((l) => l.type === 'add').length || 0;
  const deletions = diffData?.lines.filter((l) => l.type === 'del').length || 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 select-none">
      {/* Comparison Selector Card */}
      <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-300">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Compare Commits</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Cryptographic line difference</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Base commit */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-slate-500">Base:</span>
            <select
              value={fromHash}
              onChange={(e) => setFromHash(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="">(None - Initial Creation)</option>
              {commits.map((c) => (
                <option key={c.commit_hash} value={c.commit_hash}>
                  {c.commit_hash} — {c.commit_message.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

          {/* Target commit */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-slate-500">Compare:</span>
            <select
              value={toHash}
              onChange={(e) => setToHash(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-indigo-500"
            >
              {commits.map((c) => (
                <option key={c.commit_hash} value={c.commit_hash}>
                  {c.commit_hash} — {c.commit_message.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>

          {/* Stats badges */}
          <div className="flex items-center space-x-1.5 text-xs font-mono ml-auto">
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
              <Plus className="w-3 h-3" />
              <span>{additions}</span>
            </span>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
              <Minus className="w-3 h-3" />
              <span>{deletions}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Diff Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Computing commit diff...</div>
      ) : !diffData || diffData.lines.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-xl">
          No differences detected between these commits.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#121824] font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {diffData.lines.map((line, idx) => {
                  let rowBg = 'bg-white dark:bg-[#121824]';
                  let symbol = ' ';
                  let textColor = 'text-slate-800 dark:text-slate-200';
                  let symbolColor = 'text-transparent';

                  if (line.type === 'add') {
                    rowBg = 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-2 border-emerald-500';
                    symbol = '+';
                    textColor = 'text-emerald-950 dark:text-emerald-300 font-semibold';
                    symbolColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
                  } else if (line.type === 'del') {
                    rowBg = 'bg-rose-50/70 dark:bg-rose-950/30 border-l-2 border-rose-500';
                    symbol = '-';
                    textColor = 'text-rose-950 dark:text-rose-300 font-medium line-through opacity-75';
                    symbolColor = 'text-rose-600 dark:text-rose-400 font-bold';
                  }

                  return (
                    <tr key={idx} className={`${rowBg} hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors`}>
                      <td className="w-10 px-2 py-0.5 text-right text-[10px] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                        {line.old_lineno || ''}
                      </td>
                      <td className="w-10 px-2 py-0.5 text-right text-[10px] text-slate-400 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                        {line.new_lineno || ''}
                      </td>
                      <td className={`w-6 px-1.5 py-0.5 text-center font-bold select-none ${symbolColor}`}>
                        {symbol}
                      </td>
                      <td className={`px-2.5 py-0.5 whitespace-pre ${textColor}`}>
                        {line.content || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
