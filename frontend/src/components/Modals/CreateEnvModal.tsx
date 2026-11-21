import React, { useState } from 'react';
import { FilePlus, X } from 'lucide-react';
import { envsApi } from '../../services/api';
import { EnvFile } from '../../types';
import { useToast } from '../../context/ToastContext';

interface CreateEnvModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  onFileCreated: (file: EnvFile) => void;
}

export const CreateEnvModal: React.FC<CreateEnvModalProps> = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onFileCreated,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState('.env');
  const [envTag, setEnvTag] = useState('development');
  const [content, setContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('Initial commit');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const file = await envsApi.createEnv({
        folder_id: folderId,
        name: name.trim(),
        env_tag: envTag,
        content: content,
        commit_message: commitMessage.trim() || 'Initial commit',
      });
      setName('.env');
      setContent('');
      onFileCreated(file);
      toast.success(`Created & encrypted "${file.name}"`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create .env file');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Environment File</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Folder: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{folderName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                File Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=".env, .env.local"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Tag
              </label>
              <select
                value={envTag}
                onChange={(e) => setEnvTag(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
                <option value="testing">Testing</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Initial Content
            </label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="PORT=8000&#10;DATABASE_URL=postgresql://...&#10;API_SECRET=your_secret_here"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Commit Message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Initial commit"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create & Encrypt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
