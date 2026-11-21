import React, { useState, useEffect } from 'react';
import { trashApi, foldersApi, envsApi } from '../services/api';
import { TrashItem } from '../types';
import { useToast } from '../context/ToastContext';
import { Trash2, RotateCcw, Folder, FileCode } from 'lucide-react';

export const TrashPage: React.FC = () => {
  const { toast } = useToast();
  const [trashData, setTrashData] = useState<TrashItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const data = await trashApi.getTrash();
      setTrashData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFolder = async (id: string) => {
    try {
      await foldersApi.restoreFolder(id);
      loadTrash();
      toast.success('Folder restored successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore folder');
    }
  };

  const handlePermanentDeleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete folder "${name}"? This cannot be undone.`)) return;
    try {
      await foldersApi.permanentDeleteFolder(id);
      loadTrash();
      toast.info(`Permanently deleted folder "${name}"`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to permanently delete folder');
    }
  };

  const handleRestoreEnv = async (id: string) => {
    try {
      await envsApi.restoreEnv(id);
      loadTrash();
      toast.success('File restored successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore file');
    }
  };

  const handlePermanentDeleteEnv = async (id: string, name: string) => {
    if (!window.confirm(`Permanently destroy file "${name}"? This cannot be undone.`)) return;
    try {
      await envsApi.permanentDeleteEnv(id);
      loadTrash();
      toast.info(`Permanently destroyed file "${name}"`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to permanently delete file');
    }
  };

  const totalItems = (trashData?.folders.length || 0) + (trashData?.env_files.length || 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b0f17] p-4 sm:p-6 lg:p-8 select-none">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span>Recycle Bin & Trash</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Soft-deleted folders and environment files can be restored or purged permanently
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Scanning recycle bin...</div>
        ) : totalItems === 0 ? (
          <div className="py-20 text-center space-y-2 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <Trash2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Recycle Bin is empty</p>
            <p className="text-xs text-slate-400">Deleted folders and .env files will safely appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Deleted Folders */}
            {trashData && trashData.folders.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>Deleted Folders ({trashData.folders.length})</span>
                </h3>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#121824] shadow-xs">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {trashData.folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{folder.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Owner: {folder.owner_name} • {new Date(folder.deleted_at).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleRestoreFolder(folder.id)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteFolder(folder.id, folder.name)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Purge</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Deleted Files */}
            {trashData && trashData.env_files.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Deleted .env Files ({trashData.env_files.length})</span>
                </h3>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#121824] shadow-xs">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {trashData.env_files.map((file) => (
                      <div
                        key={file.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 font-mono shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{file.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Folder: {file.folder_name} • Owner: {file.owner_name} • {new Date(file.deleted_at).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleRestoreEnv(file.id)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteEnv(file.id, file.name)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Purge</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
