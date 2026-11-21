import React, { useState, useEffect, useRef } from 'react';
import {
  Folder as FolderIcon,
  FolderPlus,
  FilePlus,
  FileCode,
  ChevronRight,
  ChevronDown,
  Share2,
  Trash2,
  Edit2,
  Layers,
  X,
  Copy,
  FolderInput,
  Files,
  RefreshCw,
  ExternalLink,
  ClipboardCopy,
  Scissors,
  ClipboardPaste,
  Search
} from 'lucide-react';
import { Folder, EnvFile, EmployeeWithLeads, WorkspaceTree } from '../types';
import { foldersApi, envsApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CreateFolderModal } from './Modals/CreateFolderModal';
import { CreateEnvModal } from './Modals/CreateEnvModal';
import { ShareFolderModal } from './Modals/ShareFolderModal';
import { RenameItemModal } from './Modals/RenameItemModal';
import { MoveItemModal } from './Modals/MoveItemModal';
import { clearFileContentCache } from './Editor/NotepadEditor';

interface SidebarProps {
  selectedFolder: Folder | null;
  setSelectedFolder: (folder: Folder | null) => void;
  selectedEnvFile: EnvFile | null;
  setSelectedEnvFile: (file: EnvFile | null) => void;
  refreshTrigger: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: 'folder' | 'file' | 'root';
  targetFolder?: Folder | null;
  targetFile?: EnvFile | null;
}

interface ClipboardItem {
  action: 'cut' | 'copy';
  type: 'folder' | 'file';
  item: Folder | EnvFile;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedFolder,
  setSelectedFolder,
  selectedEnvFile,
  setSelectedEnvFile,
  refreshTrigger,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [allFiles, setAllFiles] = useState<EnvFile[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // Team filter for Leads / Admins
  const [teamMembers, setTeamMembers] = useState<EmployeeWithLeads[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const getOwnerName = (ownerId?: string | null): string => {
    if (!ownerId) return '';
    if (ownerId === user?.id) return user.full_name;
    const member = teamMembers.find((m) => m.id === ownerId);
    return member?.full_name || '';
  };

  const q = searchQuery.toLowerCase().trim();
  const filteredFolders = q
    ? allFolders.filter((f) => {
        const ownerName = getOwnerName(f.owner_id).toLowerCase();
        return f.name.toLowerCase().includes(q) || ownerName.includes(q);
      })
    : [];

  const filteredFiles = q
    ? allFiles.filter((file) => {
        const ownerName = getOwnerName(file.owner_id).toLowerCase();
        const parentFolder = allFolders.find((f) => f.id === file.folder_id);
        const folderName = parentFolder?.name.toLowerCase() || '';
        return (
          file.name.toLowerCase().includes(q) ||
          file.env_tag.toLowerCase().includes(q) ||
          ownerName.includes(q) ||
          folderName.includes(q)
        );
      })
    : [];

  // Modals state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [targetFolderForAction, setTargetFolderForAction] = useState<Folder | null>(null);
  const [targetParentForCreate, setTargetParentForCreate] = useState<Folder | null>(null);

  // Rename & Move Modals
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    type: 'folder' | 'file';
    targetFolder?: Folder | null;
    targetFile?: EnvFile | null;
  }>({ isOpen: false, type: 'folder' });

  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    type: 'folder' | 'file';
    targetFolder?: Folder | null;
    targetFile?: EnvFile | null;
  }>({ isOpen: false, type: 'folder' });

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'root',
  });

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'LEAD') {
      usersApi.getUsers().then(setTeamMembers).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    loadWorkspaceTree();
  }, [selectedOwnerId, refreshTrigger]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen]);

  // Fast single-query workspace loading
  const loadWorkspaceTree = async () => {
    try {
      setLoading(true);
      const data: WorkspaceTree = await foldersApi.getWorkspaceTree(selectedOwnerId || null);
      setAllFolders(data.folders);
      setAllFiles(data.files);

      // Auto-expand first root folder if none expanded yet
      if (data.folders.length > 0 && expandedFolderIds.size === 0) {
        const rootFolders = data.folders.filter((f) => !f.parent_id);
        if (rootFolders.length > 0) {
          setExpandedFolderIds(new Set([rootFolders[0].id]));
          setSelectedFolder(rootFolders[0]);
          const firstFolderFiles = data.files.filter((file) => file.folder_id === rootFolders[0].id);
          if (firstFolderFiles.length > 0 && !selectedEnvFile) {
            setSelectedEnvFile(firstFolderFiles[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspace tree:', err);
    } finally {
      setLoading(false);
    }
  };

  // Instant in-memory folder toggle (0ms latency)
  const toggleFolderExpand = (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newExpanded = new Set(expandedFolderIds);
    if (newExpanded.has(folder.id)) {
      newExpanded.delete(folder.id);
    } else {
      newExpanded.add(folder.id);
    }
    setExpandedFolderIds(newExpanded);
    setSelectedFolder(folder);
  };

  // Expands all ancestor folders up to the root so the selected item is revealed in the tree
  const revealInTree = (folderId?: string | null) => {
    if (!folderId) return;
    const newExpanded = new Set(expandedFolderIds);
    let currId: string | null = folderId;
    while (currId) {
      newExpanded.add(currId);
      const parent = allFolders.find((f) => f.id === currId);
      currId = parent?.parent_id || null;
    }
    setExpandedFolderIds(newExpanded);
  };

  // Open Context Menu with window boundary safety
  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'folder' | 'file' | 'root',
    folder?: Folder | null,
    file?: EnvFile | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 200;
    const menuHeight = 260;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      isOpen: true,
      x,
      y,
      type,
      targetFolder: folder || null,
      targetFile: file || null,
    });
  };

  // ----------------- File Operations -----------------

  const handleDuplicateFile = async (file: EnvFile) => {
    try {
      const duplicated = await envsApi.duplicateEnv(file.id);
      // Instant optimistic update in memory
      setAllFiles((prev) => [...prev, duplicated]);
      setSelectedEnvFile(duplicated);
      toast.success(`Duplicated "${file.name}"`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to duplicate file');
    }
  };

  const handleDeleteEnvFile = async (file: EnvFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Move file "${file.name}" to Recycle Bin?`)) return;

    clearFileContentCache(file.id);
    // Optimistic removal from UI immediately
    setAllFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (selectedEnvFile?.id === file.id) {
      setSelectedEnvFile(null);
    }

    try {
      await envsApi.deleteEnv(file.id);
      toast.info(`Moved "${file.name}" to Recycle Bin`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete file');
      loadWorkspaceTree(); // Rollback if error
    }
  };

  const handleRenameFileSubmit = async (newName: string) => {
    if (!renameModal.targetFile) return;
    const file = renameModal.targetFile;
    clearFileContentCache(file.id);

    // Optimistic rename
    setAllFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, name: newName } : f))
    );
    if (selectedEnvFile?.id === file.id) {
      setSelectedEnvFile({ ...selectedEnvFile, name: newName });
    }

    await envsApi.updateEnv(file.id, { name: newName });
    toast.success(`Renamed file to "${newName}"`);
  };

  const handleMoveFileSubmit = async (targetFolderId: string | null) => {
    if (!moveModal.targetFile || !targetFolderId) return;
    const file = moveModal.targetFile;
    clearFileContentCache(file.id);

    // Optimistic move
    setAllFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, folder_id: targetFolderId } : f))
    );

    // Expand destination folder
    setExpandedFolderIds((prev) => new Set(prev).add(targetFolderId));

    await envsApi.updateEnv(file.id, { folder_id: targetFolderId });
    toast.success(`Moved "${file.name}"`);
  };

  const handleCopyFileContent = async (file: EnvFile) => {
    try {
      const data = await envsApi.getEnvContent(file.id);
      await navigator.clipboard.writeText(data.content);
      await envsApi.logCopy(file.id);
      toast.success(`Copied "${file.name}" secrets to clipboard!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to copy file content');
    }
  };

  // ----------------- Folder Operations -----------------

  const handleDeleteFolder = async (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Move folder "${folder.name}" and all its contents to Recycle Bin?`)) return;

    // Optimistic removal immediately
    setAllFolders((prev) => prev.filter((f) => f.id !== folder.id && f.parent_id !== folder.id));
    setAllFiles((prev) => prev.filter((f) => f.folder_id !== folder.id));
    if (selectedFolder?.id === folder.id) {
      setSelectedFolder(null);
      setSelectedEnvFile(null);
    }

    try {
      await foldersApi.deleteFolder(folder.id);
      toast.info(`Moved folder "${folder.name}" to Recycle Bin`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete folder');
      loadWorkspaceTree(); // Rollback if error
    }
  };

  const handleRenameFolderSubmit = async (newName: string) => {
    if (!renameModal.targetFolder) return;
    const folder = renameModal.targetFolder;

    // Optimistic rename
    setAllFolders((prev) =>
      prev.map((f) => (f.id === folder.id ? { ...f, name: newName } : f))
    );
    if (selectedFolder?.id === folder.id) {
      setSelectedFolder({ ...selectedFolder, name: newName });
    }

    await foldersApi.renameFolder(folder.id, newName);
  };

  const handleMoveFolderSubmit = async (targetParentId: string | null) => {
    if (!moveModal.targetFolder) return;
    const folder = moveModal.targetFolder;

    // Optimistic move
    setAllFolders((prev) =>
      prev.map((f) => (f.id === folder.id ? { ...f, parent_id: targetParentId } : f))
    );

    if (targetParentId) {
      setExpandedFolderIds((prev) => new Set(prev).add(targetParentId));
    }

    await foldersApi.moveFolder(folder.id, targetParentId);
  };

  // ----------------- Cut, Copy & Paste Operations -----------------

  const handleCutFile = (file: EnvFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClipboard({ action: 'cut', type: 'file', item: file });
    toast.info(`Cut "${file.name}". Right-click destination folder to paste (Ctrl+V)`);
  };

  const handleCopyFile = (file: EnvFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClipboard({ action: 'copy', type: 'file', item: file });
    toast.info(`Copied "${file.name}". Right-click destination folder to paste (Ctrl+V)`);
  };

  const handleCutFolder = (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClipboard({ action: 'cut', type: 'folder', item: folder });
    toast.info(`Cut folder "${folder.name}". Right-click destination to paste (Ctrl+V)`);
  };

  const handleCopyFolder = (folder: Folder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClipboard({ action: 'copy', type: 'folder', item: folder });
    toast.info(`Copied folder "${folder.name}". Right-click destination to paste (Ctrl+V)`);
  };

  const handlePaste = async (destinationFolder: Folder | null) => {
    if (!clipboard) return;

    if (clipboard.type === 'file') {
      const file = clipboard.item as EnvFile;
      if (!destinationFolder) {
        toast.error('Files must be placed inside a folder. Please select a folder to paste.');
        return;
      }

      if (clipboard.action === 'cut') {
        // Move file into destination folder
        setAllFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, folder_id: destinationFolder.id } : f))
        );
        setExpandedFolderIds((prev) => new Set(prev).add(destinationFolder.id));
        setClipboard(null);
        try {
          await envsApi.updateEnv(file.id, { folder_id: destinationFolder.id });
          toast.success(`Moved "${file.name}" into "${destinationFolder.name}"`);
        } catch (err: any) {
          console.error(err);
          toast.error(err.response?.data?.detail || 'Failed to move file');
          loadWorkspaceTree();
        }
      } else {
        // Duplicate file into destination folder
        try {
          const dup = await envsApi.duplicateEnv(file.id, { target_folder_id: destinationFolder.id });
          setAllFiles((prev) => [...prev, dup]);
          setExpandedFolderIds((prev) => new Set(prev).add(destinationFolder.id));
          toast.success(`Pasted copy of "${file.name}" into "${destinationFolder.name}"`);
        } catch (err: any) {
          console.error(err);
          toast.error(err.response?.data?.detail || 'Failed to paste file copy');
        }
      }
    } else if (clipboard.type === 'folder') {
      const folder = clipboard.item as Folder;
      if (destinationFolder && folder.id === destinationFolder.id) {
        toast.error('Cannot paste a folder into itself.');
        return;
      }

      const targetParentId = destinationFolder ? destinationFolder.id : null;

      if (clipboard.action === 'cut') {
        // Move folder
        setAllFolders((prev) =>
          prev.map((f) => (f.id === folder.id ? { ...f, parent_id: targetParentId } : f))
        );
        if (targetParentId) {
          setExpandedFolderIds((prev) => new Set(prev).add(targetParentId));
        }
        setClipboard(null);
        try {
          await foldersApi.moveFolder(folder.id, targetParentId);
          toast.success(`Moved folder "${folder.name}" into ${destinationFolder ? `"${destinationFolder.name}"` : 'Root Workspace'}`);
        } catch (err: any) {
          console.error(err);
          toast.error(err.response?.data?.detail || 'Failed to move folder');
          loadWorkspaceTree();
        }
      } else {
        // Duplicate folder
        try {
          await foldersApi.duplicateFolder(folder.id, { target_parent_id: targetParentId });
          await loadWorkspaceTree();
          if (targetParentId) {
            setExpandedFolderIds((prev) => new Set(prev).add(targetParentId));
          }
          toast.success(`Pasted copy of folder "${folder.name}" into ${destinationFolder ? `"${destinationFolder.name}"` : 'Root Workspace'}`);
        } catch (err: any) {
          console.error(err);
          toast.error(err.response?.data?.detail || 'Failed to paste folder copy');
        }
      }
    }
  };

  // Keyboard shortcuts listener (Ctrl+C, Ctrl+X, Ctrl+V)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // If user has highlighted text on the page, allow native copy/cut
      const selectedText = window.getSelection()?.toString();
      if (selectedText && selectedText.length > 0) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedEnvFile) {
          e.preventDefault();
          handleCopyFile(selectedEnvFile);
        } else if (selectedFolder) {
          e.preventDefault();
          handleCopyFolder(selectedFolder);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (selectedEnvFile) {
          e.preventDefault();
          handleCutFile(selectedEnvFile);
        } else if (selectedFolder) {
          e.preventDefault();
          handleCutFolder(selectedFolder);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard) {
          e.preventDefault();
          handlePaste(selectedFolder);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [selectedEnvFile, selectedFolder, clipboard]);

  // ----------------- Tree Item Rendering -----------------

  const renderFolderItem = (folder: Folder, depth = 0) => {
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolder?.id === folder.id;
    const isFolderCut = clipboard?.action === 'cut' && clipboard.type === 'folder' && clipboard.item.id === folder.id;
    const files = allFiles.filter((f) => f.folder_id === folder.id);
    const subfolders = allFolders.filter((f) => f.parent_id === folder.id);
    const canWrite = folder.current_user_access === 'OWNER' || folder.current_user_access === 'WRITE';

    return (
      <div key={folder.id} className="select-none text-xs">
        {/* Folder Header Row */}
        <div
          onClick={(e) => toggleFolderExpand(folder, e)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 rounded-md cursor-pointer transition-colors ${
            isFolderCut
              ? 'opacity-40 border border-dashed border-indigo-500 bg-indigo-50/20'
              : isSelected
              ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate">
            <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
            <FolderIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-500 fill-amber-500/20' : 'text-amber-500/80'}`} />
            <span className="truncate">{folder.name}</span>
          </div>

          <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canWrite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFolder(folder);
                  setIsEnvModalOpen(true);
                }}
                title="New .env file"
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <FilePlus className="w-3 h-3" />
              </button>
            )}

            {canWrite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetParentForCreate(folder);
                  setIsFolderModalOpen(true);
                }}
                title="New Subfolder"
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            )}

            {(user?.role === 'ADMIN' || folder.owner_id === user?.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetFolderForAction(folder);
                  setIsShareModalOpen(true);
                }}
                title="Share folder"
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Share2 className="w-3 h-3" />
              </button>
            )}

            {canWrite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameModal({ isOpen: true, type: 'folder', targetFolder: folder });
                }}
                title="Rename folder"
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}

            {canWrite && (
              <button
                onClick={(e) => handleDeleteFolder(folder, e)}
                title="Move to trash"
                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Nested Subfolders & Env Files */}
        {isExpanded && (
          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-1 space-y-0.5">
            {subfolders.map((sub) => renderFolderItem(sub, depth + 1))}

            {files.map((file) => {
              const isFileSelected = selectedEnvFile?.id === file.id;
              const isFileCut = clipboard?.action === 'cut' && clipboard.type === 'file' && clipboard.item.id === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    setSelectedFolder(folder);
                    setSelectedEnvFile(file);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'file', folder, file)}
                  className={`group flex items-center justify-between pr-2 py-1 pl-2 rounded-md font-mono cursor-pointer transition-colors ${
                    isFileCut
                      ? 'opacity-40 border border-dashed border-indigo-500 bg-indigo-50/20'
                      : isFileSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/80'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isFileSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">{file.name}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-sans font-medium">
                      {file.env_tag.slice(0, 3)}
                    </span>
                    {canWrite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEnvFile(file, e);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition-opacity"
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {files.length === 0 && subfolders.length === 0 && (
              <div className="py-1 pl-3 text-[11px] text-slate-400 dark:text-slate-500 italic">
                (Empty)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = allFolders.filter((f) => !f.parent_id);

  const sidebarContent = (
    <div
      ref={sidebarRef}
      onContextMenu={(e) => handleContextMenu(e, 'root')}
      className="h-full flex flex-col bg-white dark:bg-[#0f1523] border-r border-slate-200 dark:border-slate-800/80 w-64 md:w-64 select-none relative"
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Files</span>
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setTargetParentForCreate(null);
                setIsFolderModalOpen(true);
              }}
              title="Create Root Folder"
              className="flex items-center space-x-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors"
            >
              <FolderPlus className="w-3 h-3" />
              <span>Folder</span>
            </button>

            <button
              onClick={loadWorkspaceTree}
              title="Refresh Workspace"
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lead/Admin Scope Switcher */}
        {(user?.role === 'ADMIN' || user?.role === 'LEAD') && (
          <div>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="">🏢 Company Folders</option>
              <option value={user.id}>👤 My Personal</option>
              {teamMembers
                .filter((m) => m.id !== user.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Real-time Search Input (Folders, Files, Employees) */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, folders, employees..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-medium transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree list or Search Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {searchQuery.trim() ? (
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span>{filteredFiles.length + filteredFolders.length} matches found</span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-sans font-medium"
              >
                Clear
              </button>
            </div>

            {/* Matching Folders */}
            {filteredFolders.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Folders ({filteredFolders.length})
                </span>
                {filteredFolders.map((f) => {
                  const isSelected = selectedFolder?.id === f.id;
                  const owner = getOwnerName(f.owner_id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedFolder(f);
                        revealInTree(f.id);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', f)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FolderIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {owner && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[90px] font-mono">
                            👤 {owner}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFolder(f);
                            revealInTree(f.id);
                            setSearchQuery('');
                          }}
                          title="Reveal in full tree"
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                        >
                          Tree
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Matching Files */}
            {filteredFiles.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Files ({filteredFiles.length})
                </span>
                {filteredFiles.map((file) => {
                  const parentFolder = allFolders.find((f) => f.id === file.folder_id);
                  const isFileSelected = selectedEnvFile?.id === file.id;
                  const owner = getOwnerName(file.owner_id);
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        if (parentFolder) {
                          setSelectedFolder(parentFolder);
                          revealInTree(parentFolder.id);
                        }
                        setSelectedEnvFile(file);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      onContextMenu={(e) => handleContextMenu(e, 'file', parentFolder, file)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                        isFileSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/80'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="truncate">
                          <p className="font-mono text-xs font-bold truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            📁 {parentFolder?.name || 'Folder'} {owner ? `• 👤 ${owner}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0 ml-1">
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                          {file.env_tag.slice(0, 3)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (parentFolder) {
                              setSelectedFolder(parentFolder);
                              revealInTree(parentFolder.id);
                            }
                            setSelectedEnvFile(file);
                            setSearchQuery('');
                          }}
                          title="Reveal in full tree"
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                        >
                          Tree
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredFiles.length === 0 && filteredFolders.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <p>No results found for "{searchQuery}"</p>
                <p className="text-[11px] text-slate-500">Search by folder, file, or employee name</p>
              </div>
            )}
          </div>
        ) : rootFolders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 px-3 space-y-2">
            <p>No folders in this scope.</p>
            <button
              onClick={() => {
                setTargetParentForCreate(null);
                setIsFolderModalOpen(true);
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              + Create a folder
            </button>
          </div>
        ) : (
          rootFolders.map((f) => renderFolderItem(f))
        )}
      </div>

      {/* Footer Quick Action */}
      {selectedFolder && (
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setIsEnvModalOpen(true)}
            className="w-full btn-primary py-2 text-xs flex items-center justify-center space-x-1.5 shadow-md"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>New .env</span>
          </button>
        </div>
      )}

      {/* ----------------- PC Right-Click Context Menu ----------------- */}
      {contextMenu.isOpen && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* FILE Context Options */}
          {contextMenu.type === 'file' && contextMenu.targetFile && (
            <>
              <button
                onClick={() => {
                  setSelectedFolder(contextMenu.targetFolder || null);
                  setSelectedEnvFile(contextMenu.targetFile || null);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Open in Editor</span>
              </button>

              <button
                onClick={() => {
                  handleCutFile(contextMenu.targetFile!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-2.5">
                  <Scissors className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cut File</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ctrl+X</span>
              </button>

              <button
                onClick={() => {
                  handleCopyFile(contextMenu.targetFile!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-2.5">
                  <Copy className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Copy File</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ctrl+C</span>
              </button>

              <button
                onClick={() => {
                  handleCopyFileContent(contextMenu.targetFile!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ClipboardCopy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Secrets to Clipboard</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  setRenameModal({
                    isOpen: true,
                    type: 'file',
                    targetFile: contextMenu.targetFile,
                  });
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Rename File</span>
              </button>

              <button
                onClick={() => {
                  handleDuplicateFile(contextMenu.targetFile!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Duplicate File</span>
              </button>

              <button
                onClick={() => {
                  setMoveModal({
                    isOpen: true,
                    type: 'file',
                    targetFile: contextMenu.targetFile,
                  });
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                <span>Move to Folder...</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  handleDeleteEnvFile(contextMenu.targetFile!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete File</span>
              </button>
            </>
          )}

          {/* FOLDER Context Options */}
          {contextMenu.type === 'folder' && contextMenu.targetFolder && (
            <>
              {/* Paste into Folder */}
              <button
                disabled={!clipboard}
                onClick={() => {
                  handlePaste(contextMenu.targetFolder || null);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left font-medium transition-colors ${
                  clipboard
                    ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 font-semibold'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {clipboard ? `Paste "${(clipboard.item as any).name}"` : 'Paste'}
                  </span>
                </div>
                <span className="text-[10px] font-mono opacity-60 ml-2 shrink-0">Ctrl+V</span>
              </button>

              <button
                onClick={() => {
                  handleCutFolder(contextMenu.targetFolder!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-2.5">
                  <Scissors className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cut Folder</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ctrl+X</span>
              </button>

              <button
                onClick={() => {
                  handleCopyFolder(contextMenu.targetFolder!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-2.5">
                  <Copy className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Copy Folder</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ctrl+C</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  setSelectedFolder(contextMenu.targetFolder || null);
                  setIsEnvModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                <FilePlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>New .env File...</span>
              </button>

              <button
                onClick={() => {
                  setTargetParentForCreate(contextMenu.targetFolder || null);
                  setIsFolderModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
                <span>New Subfolder...</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  setRenameModal({
                    isOpen: true,
                    type: 'folder',
                    targetFolder: contextMenu.targetFolder,
                  });
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Rename Folder</span>
              </button>

              <button
                onClick={() => {
                  setMoveModal({
                    isOpen: true,
                    type: 'folder',
                    targetFolder: contextMenu.targetFolder,
                  });
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                <span>Move Folder...</span>
              </button>

              {(user?.role === 'ADMIN' || contextMenu.targetFolder.owner_id === user?.id) && (
                <button
                  onClick={() => {
                    setTargetFolderForAction(contextMenu.targetFolder || null);
                    setIsShareModalOpen(true);
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Share Folder...</span>
                </button>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  handleDeleteFolder(contextMenu.targetFolder!);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Folder</span>
              </button>
            </>
          )}

          {/* ROOT Context Options */}
          {contextMenu.type === 'root' && (
            <>
              {clipboard && (
                <button
                  disabled={clipboard.type === 'file'}
                  onClick={() => {
                    handlePaste(null);
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left font-medium transition-colors ${
                    clipboard.type === 'folder'
                      ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 font-semibold'
                      : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {clipboard.type === 'folder' ? `Paste "${(clipboard.item as any).name}"` : 'Paste (needs folder)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 ml-2 shrink-0">Ctrl+V</span>
                </button>
              )}

              <button
                onClick={() => {
                  setTargetParentForCreate(null);
                  setIsFolderModalOpen(true);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>New Root Folder</span>
              </button>

              <button
                onClick={() => {
                  loadWorkspaceTree();
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Refresh Workspace</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        parentId={targetParentForCreate?.id || null}
        parentName={targetParentForCreate?.name || null}
        ownerId={selectedOwnerId || null}
        onFolderCreated={(newFolder) => {
          setAllFolders((prev) => [...prev, newFolder]);
          if (newFolder.parent_id) {
            setExpandedFolderIds((prev) => new Set(prev).add(newFolder.parent_id!));
          }
        }}
      />

      {selectedFolder && (
        <CreateEnvModal
          isOpen={isEnvModalOpen}
          onClose={() => setIsEnvModalOpen(false)}
          folderId={selectedFolder.id}
          folderName={selectedFolder.name}
          onFileCreated={(file) => {
            setAllFiles((prev) => [...prev, file]);
            setSelectedEnvFile(file);
            setExpandedFolderIds((prev) => new Set(prev).add(file.folder_id));
          }}
        />
      )}

      {targetFolderForAction && (
        <ShareFolderModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setTargetFolderForAction(null);
          }}
          folder={targetFolderForAction}
          onFolderUpdated={loadWorkspaceTree}
        />
      )}

      {/* Rename Modal */}
      <RenameItemModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false, type: 'folder' })}
        itemType={renameModal.type}
        currentName={
          renameModal.type === 'folder'
            ? renameModal.targetFolder?.name || ''
            : renameModal.targetFile?.name || ''
        }
        onRename={async (newName) => {
          if (renameModal.type === 'folder') {
            await handleRenameFolderSubmit(newName);
          } else {
            await handleRenameFileSubmit(newName);
          }
        }}
      />

      {/* Move Modal */}
      <MoveItemModal
        isOpen={moveModal.isOpen}
        onClose={() => setMoveModal({ isOpen: false, type: 'folder' })}
        itemType={moveModal.type}
        itemName={
          moveModal.type === 'folder'
            ? moveModal.targetFolder?.name || ''
            : moveModal.targetFile?.name || ''
        }
        currentParentId={
          moveModal.type === 'folder'
            ? moveModal.targetFolder?.parent_id
            : moveModal.targetFile?.folder_id
        }
        currentFolderId={moveModal.targetFolder?.id}
        allFolders={allFolders}
        onMove={async (targetFolderId) => {
          if (moveModal.type === 'folder') {
            await handleMoveFolderSubmit(targetFolderId);
          } else {
            await handleMoveFileSubmit(targetFolderId);
          }
        }}
      />
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile / Tablet Overlay Drawer */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
