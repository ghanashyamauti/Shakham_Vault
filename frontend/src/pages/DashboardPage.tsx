import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { NotepadEditor } from '../components/Editor/NotepadEditor';
import { Folder, EnvFile } from '../types';
import { FileCode, Layers, ShieldCheck } from 'lucide-react';

interface DashboardPageProps {
  isMobileSidebarOpen?: boolean;
  onCloseMobileSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  isMobileSidebarOpen = false,
  onCloseMobileSidebar,
  onToggleMobileSidebar,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedEnvFile, setSelectedEnvFile] = useState<EnvFile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-[#0b0f17]">
      {/* Workspace Sidebar (Desktop persistent + Mobile overlay) */}
      <Sidebar
        selectedFolder={selectedFolder}
        setSelectedFolder={setSelectedFolder}
        selectedEnvFile={selectedEnvFile}
        setSelectedEnvFile={setSelectedEnvFile}
        refreshTrigger={refreshTrigger}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={onCloseMobileSidebar}
      />

      {/* Main Content Area */}
      {selectedEnvFile ? (
        <NotepadEditor
          key={selectedEnvFile.id}
          envFile={selectedEnvFile}
          folderName={selectedFolder?.name}
          onRefreshFile={triggerRefresh}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-slate-50 dark:bg-[#0b0f17]">
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Shakham Inc."
              className="h-16 sm:h-20 w-auto object-contain select-none drop-shadow-sm transition-transform hover:scale-105"
            />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {selectedFolder ? (
              `Folder: ${selectedFolder.name}`
            ) : (
              <span className="inline-flex items-center space-x-1.5">
                <span>Shakham</span>
                <span className="vault-shimmer-text text-sm">VAULT</span>
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
            {selectedFolder
              ? 'Select an existing .env file from the sidebar, or create a new file to start writing and committing variables.'
              : 'Select a project folder in the workspace to view and manage encrypted environment variables.'}
          </p>

          {/* Quick open sidebar button on mobile */}
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary text-white shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Open Files Drawer</span>
          </button>
        </div>
      )}
    </div>
  );
};
