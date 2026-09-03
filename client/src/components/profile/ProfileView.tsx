import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import {
  User as UserIcon,
  Globe,
  Calendar,
  Sparkles,
  Save,
  CheckCircle2,
  Edit3,
  Mail,
  AtSign,
  MessageSquare,
} from 'lucide-react';

interface ProfileViewProps {
  viewUser?: User | null;
  onNavigateToSubscription?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ viewUser, onNavigateToSubscription }) => {
  const { user: currentUser, updateProfile } = useAuth();
  const targetUser = viewUser || currentUser;
  const isOwnProfile = !viewUser || viewUser.id === currentUser?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [status, setStatus] = useState(currentUser?.status || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80',
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        bio,
        status,
        country,
        avatar_url: avatarUrl,
      });
      setSavedSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!targetUser) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Profile changes saved successfully!</span>
        </div>
      )}

      {/* Main Profile Card Header */}
      <div className="relative bg-dark-900 border border-dark-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Cover Graphic */}
        <div className="h-44 sm:h-52 bg-gradient-to-r from-brand-900 via-indigo-950 to-dark-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
        </div>

        {/* Profile Details Bar */}
        <div className="p-6 sm:p-8 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            <div className="relative">
              <Avatar
                src={isEditing ? avatarUrl : targetUser.avatar_url}
                name={targetUser.full_name}
                size="2xl"
                planId={targetUser.plan_id}
                className="ring-4 ring-dark-900 shadow-2xl"
              />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl font-extrabold text-white">{targetUser.full_name}</h1>
                <PlanBadge planId={targetUser.plan_id} size="sm" />
              </div>
              <p className="text-xs text-dark-400 flex items-center justify-center sm:justify-start gap-1">
                <AtSign className="w-3 h-3" />
                <span>{targetUser.username}</span>
              </p>
            </div>
          </div>

          {isOwnProfile && (
            <div className="flex items-center justify-center gap-3">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-dark-800 text-dark-300 hover:text-white border border-dark-700 text-xs font-semibold"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form or Information Grid */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-2">Edit Personal Information</h3>

          {/* Avatar Preset Picker */}
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-2">Choose Avatar Preset</label>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {avatarPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`p-1 rounded-full transition-all ${
                    avatarUrl === preset ? 'ring-2 ring-brand-500 scale-105' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt="preset" className="w-12 h-12 rounded-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Country / Location</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Sweden, United States"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Status Message</label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="e.g. Available for quick calls ☕"
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">About / Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others what you do and what you are building..."
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Bio & Details (Col 1 & 2) */}
          <div className="md:col-span-2 bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Status</h3>
              <p className="text-sm font-medium text-white p-3 rounded-xl bg-dark-800/60 border border-dark-700/60">
                {targetUser.status || 'Active on Nexus'}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">About</h3>
              <p className="text-xs sm:text-sm text-dark-200 leading-relaxed">
                {targetUser.bio || 'This user has not written a bio yet.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-800">
              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5" /> Location
                </p>
                <p className="text-xs font-semibold text-white">{targetUser.country || 'Global'}</p>
              </div>

              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Member Since
                </p>
                <p className="text-xs font-semibold text-white">
                  {new Date(targetUser.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Tier Info (Col 3) */}
          <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Subscription Tier</h3>
              <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-2">
                <PlanBadge planId={targetUser.plan_id} size="lg" />
                <p className="text-xs text-dark-300 pt-1">
                  {targetUser.plan_id === 'vip'
                    ? 'Ultra VIP Tier with 4K Calling & Concierge'
                    : targetUser.plan_id === 'pro'
                    ? 'Nexus Pro Tier with HD Video & Screen Sharing'
                    : 'Starter Free Tier'}
                </p>
              </div>
            </div>

            {isOwnProfile && onNavigateToSubscription && targetUser.plan_id !== 'vip' && (
              <button
                type="button"
                onClick={onNavigateToSubscription}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade Subscription</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
