import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { foldersApi } from '../../services/api';
import { Folder } from '../../types';
import { useToast } from '../../context/ToastContext';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  parentName?: string | null;
  ownerId?: string | null;
  onFolderCreated: (folder: Folder) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  parentId,
  parentName,
  ownerId,
  onFolderCreated,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const folder = await foldersApi.createFolder({
        name: name.trim(),
        parent_id: parentId || null,
        owner_id: ownerId || null,
      });
      setName('');
      onFolderCreated(folder);
      toast.success(`Created folder "${folder.name}"`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Folder</h3>
              {parentName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Inside: <span className="font-semibold text-slate-800 dark:text-slate-200">{parentName}</span></p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Folder Name <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. backend, microservices"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17]"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
