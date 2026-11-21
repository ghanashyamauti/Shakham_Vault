import React, { useState, useEffect } from 'react';
import { Edit2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface RenameItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'folder' | 'file';
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  isOpen,
  onClose,
  itemType,
  currentName,
  onRename,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onRename(name.trim());
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || `Failed to rename ${itemType}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Rename {itemType === 'folder' ? 'Folder' : 'File'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              New Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={itemType === 'folder' ? 'Folder name' : '.env.production'}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
