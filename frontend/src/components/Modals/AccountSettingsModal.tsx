import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Lock, Eye, EyeOff, X, Check, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../services/api';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState<string>(user?.full_name || '');
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [passwordSaving, setPasswordSaving] = useState<boolean>(false);

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateProfile(fullName.trim());
      await refreshUser();
      toast.success('Profile updated successfully!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 select-none">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-md my-6 sm:my-8 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account Settings</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 px-5 pt-3 shrink-0">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all mr-6 ${
                activeTab === 'profile'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile Details</span>
            </button>

            <button
              onClick={() => setActiveTab('password')}
              className={`flex items-center space-x-2 pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'password'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>
          </div>

          {/* Form Scroll Container */}
          <div className="overflow-y-auto flex-1">
            {/* Tab 1: Profile */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">To change your email, contact your administrator.</p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Assigned Role</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Password */}
            {activeTab === 'password' && (
              <form onSubmit={handleChangePassword} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-9 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 pr-9 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#0b0f17]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="btn-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 shadow-md"
                  >
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
