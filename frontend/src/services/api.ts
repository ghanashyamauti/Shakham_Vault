import axios from 'axios';
import {
  User,
  EmployeeWithLeads,
  Folder,
  FolderPermission,
  EnvFile,
  EnvCommit,
  EnvContent,
  DiffOut,
  AccessRequest,
  AuditLog,
  TrashItem,
  WorkspaceTree
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// ----------------- Auth API -----------------
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    return res.data;
  },
  me: async (): Promise<EmployeeWithLeads> => {
    const res = await api.get('/api/auth/me');
    return res.data;
  },
  updateProfile: async (fullName: string): Promise<User> => {
    const res = await api.put('/api/auth/me/profile', { full_name: fullName });
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.put('/api/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};

// ----------------- Users API -----------------
export const usersApi = {
  getUsers: async (): Promise<EmployeeWithLeads[]> => {
    const res = await api.get('/api/users');
    return res.data;
  },
  getLeads: async (): Promise<User[]> => {
    const res = await api.get('/api/users/leads');
    return res.data;
  },
  createUser: async (data: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    lead_ids?: string[];
  }): Promise<EmployeeWithLeads> => {
    const res = await api.post('/api/users', data);
    return res.data;
  },
  updateUser: async (
    userId: string,
    data: { full_name?: string; email?: string; is_active?: boolean; role?: string; password?: string }
  ): Promise<User> => {
    const res = await api.put(`/api/users/${userId}`, data);
    return res.data;
  },
  resetPassword: async (userId: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post(`/api/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
    return res.data;
  },
  deleteUser: async (userId: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/users/${userId}`);
    return res.data;
  },
  assignLeads: async (userId: string, lead_ids: string[]): Promise<EmployeeWithLeads> => {
    const res = await api.post(`/api/users/${userId}/assign-leads`, {
      employee_id: userId,
      lead_ids,
    });
    return res.data;
  },
};

// ----------------- Requests API -----------------
export const requestsApi = {
  getRequests: async (): Promise<AccessRequest[]> => {
    const res = await api.get('/api/requests');
    return res.data;
  },
  createRequest: async (employee_id: string, reason?: string): Promise<AccessRequest> => {
    const res = await api.post('/api/requests', { employee_id, reason });
    return res.data;
  },
  reviewRequest: async (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    rejection_reason?: string
  ): Promise<AccessRequest> => {
    const res = await api.post(`/api/requests/${requestId}/review`, {
      status,
      rejection_reason,
    });
    return res.data;
  },
};

// ----------------- Folders API -----------------
export const foldersApi = {
  getWorkspaceTree: async (ownerId?: string | null): Promise<WorkspaceTree> => {
    const params: any = {};
    if (ownerId) params.owner_id = ownerId;
    const res = await api.get('/api/folders/tree', { params });
    return res.data;
  },
  getFolders: async (parentId?: string | null, ownerId?: string | null): Promise<Folder[]> => {
    const params: any = {};
    if (parentId) params.parent_id = parentId;
    if (ownerId) params.owner_id = ownerId;
    const res = await api.get('/api/folders', { params });
    return res.data;
  },
  createFolder: async (data: { name: string; parent_id?: string | null; owner_id?: string | null }): Promise<Folder> => {
    const res = await api.post('/api/folders', data);
    return res.data;
  },
  renameFolder: async (folderId: string, name: string): Promise<Folder> => {
    const res = await api.put(`/api/folders/${folderId}`, { name });
    return res.data;
  },
  moveFolder: async (folderId: string, parentId: string | null): Promise<Folder> => {
    const res = await api.put(`/api/folders/${folderId}`, { parent_id: parentId || "root" });
    return res.data;
  },
  duplicateFolder: async (folderId: string, data?: { target_parent_id?: string | null; new_name?: string }): Promise<Folder> => {
    const res = await api.post(`/api/folders/${folderId}/duplicate`, data || {});
    return res.data;
  },
  deleteFolder: async (folderId: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/folders/${folderId}`);
    return res.data;
  },
  restoreFolder: async (folderId: string): Promise<{ message: string }> => {
    const res = await api.post(`/api/folders/${folderId}/restore`);
    return res.data;
  },
  permanentDeleteFolder: async (folderId: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/folders/${folderId}/permanent`);
    return res.data;
  },
  shareFolder: async (folderId: string, user_id: string, access_level: 'READ' | 'WRITE'): Promise<FolderPermission> => {
    const res = await api.post(`/api/folders/${folderId}/share`, { user_id, access_level });
    return res.data;
  },
  revokeShare: async (folderId: string, user_id: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/folders/${folderId}/share/${user_id}`);
    return res.data;
  },
};

// ----------------- Env Files API -----------------
export const envsApi = {
  getFolderEnvs: async (folderId: string): Promise<EnvFile[]> => {
    const res = await api.get(`/api/envs/folder/${folderId}`);
    return res.data;
  },
  createEnv: async (data: {
    name: string;
    folder_id: string;
    env_tag: string;
    content: string;
    commit_message?: string;
  }): Promise<EnvFile> => {
    const res = await api.post('/api/envs', data);
    return res.data;
  },
  updateEnv: async (envFileId: string, data: { name?: string; env_tag?: string; folder_id?: string }): Promise<EnvFile> => {
    const res = await api.put(`/api/envs/${envFileId}`, data);
    return res.data;
  },
  duplicateEnv: async (envFileId: string, data?: { target_folder_id?: string; new_name?: string }): Promise<EnvFile> => {
    const res = await api.post(`/api/envs/${envFileId}/duplicate`, data || {});
    return res.data;
  },
  getEnvContent: async (envFileId: string): Promise<EnvContent> => {
    const res = await api.get(`/api/envs/${envFileId}`);
    return res.data;
  },
  logCopy: async (envFileId: string): Promise<{ message: string }> => {
    const res = await api.post(`/api/envs/${envFileId}/copy-log`);
    return res.data;
  },
  commitEnv: async (envFileId: string, data: { content: string; commit_message: string }): Promise<EnvCommit> => {
    const res = await api.post(`/api/envs/${envFileId}/commit`, data);
    return res.data;
  },
  getCommits: async (envFileId: string): Promise<EnvCommit[]> => {
    const res = await api.get(`/api/envs/${envFileId}/commits`);
    return res.data;
  },
  getHistoricalContent: async (envFileId: string, commitHash: string): Promise<EnvContent> => {
    const res = await api.get(`/api/envs/${envFileId}/commits/${commitHash}`);
    return res.data;
  },
  revertCommit: async (envFileId: string, commitHash: string): Promise<EnvCommit> => {
    const res = await api.post(`/api/envs/${envFileId}/revert/${commitHash}`);
    return res.data;
  },
  getDiff: async (envFileId: string, fromHash?: string, toHash?: string): Promise<DiffOut> => {
    const params: any = {};
    if (fromHash) params.from_hash = fromHash;
    if (toHash) params.to_hash = toHash;
    const res = await api.get(`/api/envs/${envFileId}/diff`, { params });
    return res.data;
  },
  deleteEnv: async (envFileId: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/envs/${envFileId}`);
    return res.data;
  },
  restoreEnv: async (envFileId: string): Promise<{ message: string }> => {
    const res = await api.post(`/api/envs/${envFileId}/restore`);
    return res.data;
  },
  permanentDeleteEnv: async (envFileId: string): Promise<{ message: string }> => {
    const res = await api.delete(`/api/envs/${envFileId}/permanent`);
    return res.data;
  },
};

// ----------------- Audit Logs API -----------------
export const auditApi = {
  getLogs: async (params?: { action?: string; target_type?: string; actor_id?: string; limit?: number; offset?: number }): Promise<AuditLog[]> => {
    const res = await api.get('/api/audit', { params });
    return res.data;
  },
};

// ----------------- Trash API -----------------
export const trashApi = {
  getTrash: async (): Promise<TrashItem> => {
    const res = await api.get('/api/trash');
    return res.data;
  },
};
