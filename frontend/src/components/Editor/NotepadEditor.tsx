import React, { useState, useEffect, useRef } from 'react';
import { EnvFile, EnvContent, EnvCommit } from '../../types';
import { envsApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { CommitModal } from './CommitModal';
import { CommitHistory } from './CommitHistory';
import { DiffViewer } from './DiffViewer';
import {
  FileCode,
  Save,
  GitCommit,
  GitCompare,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Lock,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Client-side cache for instantaneous (0ms) file switching like PC
export const fileContentCache = new Map<string, EnvContent>();
export const clearFileContentCache = (id?: string) => {
  if (id) {
    fileContentCache.delete(id);
  } else {
    fileContentCache.clear();
  }
};

interface NotepadEditorProps {
  envFile: EnvFile;
  folderName?: string;
  onRefreshFile: () => void;
}

export const NotepadEditor: React.FC<NotepadEditorProps> = ({ envFile, folderName, onRefreshFile }) => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'commits' | 'diff'>('editor');
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [currentCommitHash, setCurrentCommitHash] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [canEdit, setCanEdit] = useState<boolean>(true);
  const [commits, setCommits] = useState<EnvCommit[]>([]);
  const [isMasked, setIsMasked] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!fileContentCache.has(envFile.id));
  const [viewingHistorical, setViewingHistorical] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadEnvContent();
    loadCommits();
  }, [envFile.id]);

  const loadEnvContent = async () => {
    // 0ms instant render from cache if previously opened
    if (fileContentCache.has(envFile.id)) {
      const cached = fileContentCache.get(envFile.id)!;
      setContent(cached.content);
      setSavedContent(cached.content);
      setCurrentCommitHash(cached.commit_hash);
      setCommitMessage(cached.commit_message);
      setAuthorName(cached.author_name);
      setUpdatedAt(cached.created_at);
      setCanEdit(cached.can_edit);
      setViewingHistorical(false);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data: EnvContent = await envsApi.getEnvContent(envFile.id);
      fileContentCache.set(envFile.id, data);
      setContent(data.content);
      setSavedContent(data.content);
      setCurrentCommitHash(data.commit_hash);
      setCommitMessage(data.commit_message);
      setAuthorName(data.author_name);
      setUpdatedAt(data.created_at);
      setCanEdit(data.can_edit);
      setViewingHistorical(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCommits = async () => {
    try {
      const list = await envsApi.getCommits(envFile.id);
      setCommits(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await envsApi.logCopy(envFile.id);
      toast.success(`Copied ${envFile.name} secrets to clipboard`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveCommit = async (msg: string) => {
    try {
      fileContentCache.delete(envFile.id);
      await envsApi.commitEnv(envFile.id, {
        content: content,
        commit_message: msg,
      });
      await loadEnvContent();
      await loadCommits();
      onRefreshFile();
      toast.success('Successfully committed new version!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to commit changes');
    }
  };

  const handleViewHistoricalCommit = async (hash: string) => {
    setLoading(true);
    try {
      const data = await envsApi.getHistoricalContent(envFile.id, hash);
      setContent(data.content);
      setCurrentCommitHash(data.commit_hash);
      setCommitMessage(data.commit_message);
      setAuthorName(data.author_name);
      setUpdatedAt(data.created_at);
      setViewingHistorical(true);
      setActiveSubTab('editor');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertCommit = async (hash: string) => {
    if (!window.confirm(`Are you sure you want to rollback to commit ${hash}?`)) return;
    try {
      fileContentCache.delete(envFile.id);
      await envsApi.revertCommit(envFile.id, hash);
      await loadEnvContent();
      await loadCommits();
      onRefreshFile();
      toast.success(`Rolled back to commit ${hash.slice(0, 7)}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to revert commit');
    }
  };

  const hasUnsavedChanges = content !== savedContent && !viewingHistorical;
  const lineCount = content ? content.split('\n').length : 1;

  const getTagBadge = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'production':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      case 'staging':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'development':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0b0f17] overflow-hidden select-none">
      {/* Clean Compact Header Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-5 py-2.5 bg-white dark:bg-[#0f1523] flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Breadcrumbs + Title + Metadata */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="flex items-center space-x-1.5 text-xs truncate">
            {folderName && (
              <>
                <span className="text-slate-400 dark:text-slate-500 font-medium truncate max-w-[120px]">{folderName}</span>
                <span className="text-slate-300 dark:text-slate-700">/</span>
              </>
            )}
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {envFile.name}
            </span>
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border font-bold ${getTagBadge(envFile.env_tag)}`}>
              {envFile.env_tag}
            </span>
            {hasUnsavedChanges && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
            )}
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden md:flex items-center space-x-1.5 truncate">
            <span>Commit:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{currentCommitHash}</span>
            <span>by {authorName}</span>
          </div>
        </div>

        {/* Center/Right: View Switcher Tabs + Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 ml-auto">
          {/* Segmented View Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('editor')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
                activeSubTab === 'editor'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Editor</span>
            </button>

            <button
              onClick={() => setActiveSubTab('commits')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
                activeSubTab === 'commits'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitCommit className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Commits ({commits.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('diff')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all ${
                activeSubTab === 'diff'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitCompare className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1.5">
            {/* Mask/Reveal Toggle */}
            <button
              onClick={() => setIsMasked(!isMasked)}
              className={`btn-secondary flex items-center space-x-1 px-2.5 py-1 text-xs font-medium ${
                isMasked
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : ''
              }`}
              title={isMasked ? 'Reveal secret values' : 'Mask secret values'}
            >
              {isMasked ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{isMasked ? 'Masked' : 'Reveal'}</span>
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="btn-secondary flex items-center space-x-1 px-2.5 py-1 text-xs font-medium"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Commit Button */}
            {canEdit && (
              <button
                onClick={() => setIsCommitModalOpen(true)}
                disabled={!hasUnsavedChanges}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  hasUnsavedChanges
                    ? 'btn-primary shadow-indigo-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Commit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Historical view warning banner */}
      {viewingHistorical && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 font-medium">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Inspecting historical commit: <strong className="font-mono text-amber-900 dark:text-amber-100">{currentCommitHash}</strong>
            </span>
          </div>
          <button
            onClick={loadEnvContent}
            className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-amber-100 text-amber-900 dark:text-amber-200 text-xs font-bold transition-colors border border-amber-300 dark:border-amber-700 shadow-xs"
          >
            Return to HEAD
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[#0b0f17]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-400 font-medium">
            Decrypting environment secrets...
          </div>
        ) : activeSubTab === 'editor' ? (
          <div className="flex min-h-full">
            {/* Line Numbers Column */}
            <div className="w-10 sm:w-12 bg-slate-50/70 dark:bg-[#090d14] text-slate-400 dark:text-slate-600 font-mono text-xs select-none text-right py-4 pr-2 sm:pr-3 border-r border-slate-200/80 dark:border-slate-800/80 leading-6 shrink-0">
              {Array.from({ length: lineCount }).map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Freeform Notepad Textarea */}
            <div className="flex-1 relative bg-white dark:bg-[#0b0f17]">
              <textarea
                ref={textareaRef}
                value={content}
                readOnly={!canEdit || viewingHistorical}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Paste or type your environment variables here&#10;PORT=8000&#10;DATABASE_URL=postgresql://...&#10;API_SECRET=your_secret_here"
                className={`w-full h-full min-h-[500px] p-4 bg-transparent font-mono text-xs leading-6 text-slate-900 dark:text-slate-100 focus:outline-none resize-none selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:text-indigo-200 ${
                  isMasked ? 'secret-masked' : ''
                }`}
                spellCheck={false}
              />
            </div>
          </div>
        ) : activeSubTab === 'commits' ? (
          <CommitHistory
            commits={commits}
            currentCommitHash={currentCommitHash}
            onViewCommit={handleViewHistoricalCommit}
            onRevertCommit={handleRevertCommit}
            canEdit={canEdit}
          />
        ) : (
          <DiffViewer envFileId={envFile.id} commits={commits} />
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="h-8 border-t border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0f1523]/80 select-none">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 font-medium">
            <Lock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>AES-256-GCM</span>
          </span>
          <span>•</span>
          <span className="font-mono">{lineCount} lines</span>
        </div>
        <div>
          {canEdit ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Write Access</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Read Only</span>
          )}
        </div>
      </div>

      {/* Commit Modal */}
      <CommitModal
        isOpen={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        onConfirm={handleSaveCommit}
        fileName={envFile.name}
      />
    </div>
  );
};
