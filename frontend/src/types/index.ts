export type UserRole = 'ADMIN' | 'LEAD' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  created_by_id?: string;
}

export interface EmployeeWithLeads extends User {
  leads: User[];
}

export interface FolderPermission {
  id: string;
  folder_id: string;
  user_id: string;
  user: User;
  access_level: 'READ' | 'WRITE';
  granted_by_id?: string;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string | null;
  owner_id: string;
  owner?: User;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  permissions: FolderPermission[];
  env_files_count: number;
  subfolders_count: number;
  current_user_access: 'OWNER' | 'WRITE' | 'READ';
}

export interface EnvCommit {
  id: string;
  env_file_id: string;
  author_id?: string;
  author?: User;
  commit_message: string;
  commit_hash: string;
  created_at: string;
}

export interface EnvFile {
  id: string;
  name: string;
  folder_id: string;
  owner_id: string;
  owner?: User;
  env_tag: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  latest_commit?: EnvCommit;
}

export interface EnvContent {
  env_file_id: string;
  name: string;
  env_tag: string;
  folder_id: string;
  content: string;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  author_name: string;
  author_email: string;
  can_edit: boolean;
}

export interface DiffLine {
  type: 'same' | 'add' | 'del';
  content: string;
  old_lineno?: number | null;
  new_lineno?: number | null;
}

export interface DiffOut {
  old_commit_hash?: string | null;
  new_commit_hash: string;
  lines: DiffLine[];
}

export interface AccessRequest {
  id: string;
  lead_id: string;
  lead: User;
  employee_id: string;
  employee: User;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  reviewed_by_id?: string | null;
  reviewed_by?: User | null;
  reviewed_at?: string | null;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  target_name?: string | null;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface WorkspaceTree {
  folders: Folder[];
  files: EnvFile[];
}

export interface TrashItem {
  folders: {
    id: string;
    name: string;
    parent_id?: string | null;
    owner_id: string;
    owner_name: string;
    deleted_at: string;
  }[];
  env_files: {
    id: string;
    name: string;
    folder_id: string;
    folder_name: string;
    owner_id: string;
    owner_name: string;
    env_tag: string;
    deleted_at: string;
  }[];
}
