import React, { useState, useEffect, useMemo } from 'react';
import { FolderInput, X, Folder as FolderIcon } from 'lucide-react';
import { Folder } from '../../types';
import { useToast } from '../../context/ToastContext';

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'folder' | 'file';
  itemName: string;
  currentParentId?: string | null;
  currentFolderId?: string;
  allFolders: Folder[];
  onMove: (targetFolderId: string | null) => Promise<void>;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemName,
  currentParentId,
  currentFolderId,
  allFolders,
  onMove,
}) => {
  const { toast } = useToast();

  // If item is a folder, prevent moving into itself OR any of its descendants (avoids circular loops)
  const validFolders = useMemo(() => {
    if (itemType !== 'folder' || !currentFolderId) {
      return allFolders;
    }
    const descendantIds = new Set<string>([currentFolderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parent_id && descendantIds.has(f.parent_id) && !descendantIds.has(f.id)) {
          descendantIds.add(f.id);
          added = true;
        }
      }
    }
    return allFolders.filter((f) => !descendantIds.has(f.id));
  }, [allFolders, itemType, currentFolderId]);

  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize selected folder ONLY when modal opens, preventing dropdown reset on change
  useEffect(() => {
    if (isOpen) {
      if (itemType === 'file') {
        setSelectedFolderId(currentParentId || (validFolders.length > 0 ? validFolders[0].id : ''));
      } else {
        setSelectedFolderId(currentParentId || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemType === 'file' && !selectedFolderId) {
      toast.error('Please select a destination folder for the file.');
      return;
    }
    setSubmitting(true);
    try {
      await onMove(selectedFolderId ? selectedFolderId : null);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || `Failed to move ${itemType}`);
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
              <FolderInput className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Move {itemType === 'folder' ? 'Folder' : 'File'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                {itemName}
              </p>
            </div>
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
              Select Destination Folder
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
            >
              {itemType === 'folder' && (
                <option value="">📁 Root Workspace (Top Level)</option>
              )}
              {validFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name} {f.parent_id ? '(subfolder)' : ''}
                </option>
              ))}
            </select>
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
              disabled={submitting}
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
            >
              {submitting ? 'Moving...' : 'Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
