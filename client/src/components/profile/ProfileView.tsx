import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import { uploadToFirebaseStorage, trackUserActivity } from '../../config/firebase';
import axios from 'axios';
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
  Camera,
  Image as ImageIcon,
  Trash2,
  Shuffle,
  Smile,
  X,
  ShieldCheck,
  Phone,
  Zap,
  Check,
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
  const [status, setStatus] = useState(currentUser?.status || 'Hey there! I am using Nexus.');
  const [country, setCountry] = useState(currentUser?.country || 'Global');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  
  // Photo modal & upload states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // WhatsApp-style status presets
  const statusPresets = [
    { text: 'Available', emoji: '🟢' },
    { text: 'Busy', emoji: '🔴' },
    { text: 'At work', emoji: '💼' },
    { text: 'In a call', emoji: '📞' },
    { text: 'Battery about to die', emoji: '🔋' },
    { text: 'Traveling', emoji: '✈️' },
    { text: 'Coffee break', emoji: '☕' },
    { text: 'Urgent calls only', emoji: '💬' },
    { text: 'Hey there! I am using Nexus.', emoji: '⚡' },
  ];

  // 3D / HD Avatar presets
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300&auto=format&fit=crop&q=80',
    'https://api.dicebear.com/7.x/bottts/svg?seed=NexusUltra',
    'https://api.dicebear.com/7.x/bottts/svg?seed=ProGamer',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=CyberSamurai',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=StarLord',
  ];

  // Handle direct file upload from Device / Camera
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB.');
      return;
    }

    setUploadingPhoto(true);
    setUploadProgress('Uploading photo to cloud...');

    try {
      let finalUrl = '';

      // 1. Try Firebase Storage first
      try {
        finalUrl = await uploadToFirebaseStorage(file, 'profile_photos');
      } catch (fbErr) {
        console.warn('Firebase Storage upload fallback to server:', fbErr);
        // 2. Fallback to Server Upload endpoint
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('/api/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalUrl = res.data.url;
      }

      if (finalUrl) {
        setAvatarUrl(finalUrl);
        await updateProfile({ avatar_url: finalUrl });
        setShowPhotoModal(false);
        showToast('Profile photo updated successfully!');

        trackUserActivity({
          userId: currentUser?.id,
          username: currentUser?.username,
          action: 'profile_updated',
          details: { type: 'avatar_upload', fileName: file.name },
        });
      }
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Generate random avatar
  const handleGenerateRandomAvatar = async () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const styles = ['bottts', 'adventurer', 'avataaars', 'fun-emoji'];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const generatedUrl = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
    
    setAvatarUrl(generatedUrl);
    await updateProfile({ avatar_url: generatedUrl });
    setShowPhotoModal(false);
    showToast('Random 3D Avatar applied!');
  };

  // Select preset avatar
  const handleSelectPreset = async (presetUrl: string) => {
    setAvatarUrl(presetUrl);
    await updateProfile({ avatar_url: presetUrl });
    setShowPhotoModal(false);
    showToast('Profile avatar changed!');
  };

  // Remove photo
  const handleRemovePhoto = async () => {
    const defaultUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username || 'user'}`;
    setAvatarUrl(defaultUrl);
    await updateProfile({ avatar_url: defaultUrl });
    setShowPhotoModal(false);
    showToast('Profile photo removed.');
  };

  // Save text profile changes
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
      setIsEditing(false);
      showToast('Profile updated successfully!');

      trackUserActivity({
        userId: currentUser?.id,
        username: currentUser?.username,
        action: 'profile_updated',
        details: { full_name: fullName, status },
      });
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!targetUser) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
      
      {/* Hidden File Inputs for Device Gallery & Live Camera */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="user"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="p-3.5 px-5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shadow-xl backdrop-blur-md animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="relative bg-dark-900 border border-dark-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Cover Gradient Graphic */}
        <div className="h-44 sm:h-52 bg-gradient-to-r from-brand-900 via-indigo-950 to-dark-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-dark-950/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-dark-700/50 text-[11px] text-dark-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nexus End-to-End Encrypted</span>
          </div>
        </div>

        {/* Profile Details Bar */}
        <div className="p-6 sm:p-8 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-16 sm:-mt-20">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            
            {/* WhatsApp-Style Avatar with Camera Edit Icon */}
            <div className="relative group">
              <Avatar
                src={avatarUrl || targetUser.avatar_url}
                name={targetUser.full_name}
                size="2xl"
                planId={targetUser.plan_id}
                className="ring-4 ring-dark-900 shadow-2xl bg-dark-950"
              />

              {/* WhatsApp Camera Overlay on Avatar */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-dark-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-200 text-white cursor-pointer backdrop-blur-xs ring-4 ring-brand-500/50"
                  title="Change Profile Photo (WhatsApp Style)"
                >
                  <Camera className="w-6 h-6 text-brand-300" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                </button>
              )}

              {/* Mobile Quick Camera Badge */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="sm:hidden absolute bottom-1 right-1 p-2 rounded-full bg-brand-500 hover:bg-brand-400 text-white shadow-lg border-2 border-dark-900"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{targetUser.full_name}</h1>
                <PlanBadge planId={targetUser.plan_id} size="sm" />
              </div>
              <p className="text-xs text-dark-400 flex items-center justify-center sm:justify-start gap-1 font-mono">
                <AtSign className="w-3.5 h-3.5 text-brand-400" />
                <span>{targetUser.username}</span>
              </p>
              <p className="text-xs text-emerald-400 font-medium flex items-center justify-center sm:justify-start gap-1 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{targetUser.status || 'Hey there! I am using Nexus.'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {isOwnProfile && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white border border-dark-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-brand-400" />
                <span>Edit Photo</span>
              </button>

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
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form or View Layout */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-dark-800">
            <div>
              <h3 className="text-base font-bold text-white">Edit Profile Details</h3>
              <p className="text-xs text-dark-400">Update your name, WhatsApp-style status, and bio</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 text-xs font-semibold flex items-center gap-1.5 border border-brand-500/30 transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Change Photo</span>
            </button>
          </div>

          {/* Full Name & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-300 mb-1.5">Country / Location</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India, United States, Global"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>
          </div>

          {/* WhatsApp-Style Status & Quick Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-dark-300">
              About / Status (WhatsApp Style)
            </label>
            <div className="relative">
              <Smile className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={100}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="e.g. Available for video calls ☕"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>

            {/* Quick Status Pill Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {statusPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setStatus(`${preset.emoji} ${preset.text}`)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 border ${
                    status.includes(preset.text)
                      ? 'bg-brand-600 text-white border-brand-500 shadow-sm'
                      : 'bg-dark-800 text-dark-300 hover:text-white border-dark-700 hover:bg-dark-700'
                  }`}
                >
                  <span>{preset.emoji}</span>
                  <span>{preset.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bio Textarea */}
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Detailed Bio</label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others what you do and what you are building..."
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all"
            />
            <span className="text-[10px] text-dark-500 float-right mt-1">{bio.length}/300</span>
          </div>

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-xs font-semibold"
            >
              Cancel
            </button>
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
        /* View Profile Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Bio & Details (Col 1 & 2) */}
          <div className="md:col-span-2 bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            
            {/* Status Card (WhatsApp Style) */}
            <div>
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">About / Status</h3>
              <div className="p-3.5 rounded-2xl bg-dark-800/80 border border-dark-700/80 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  {targetUser.status || 'Hey there! I am using Nexus.'}
                </p>
                <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  Live
                </span>
              </div>
            </div>

            {/* Bio Card */}
            <div>
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Bio</h3>
              <p className="text-xs sm:text-sm text-dark-200 leading-relaxed bg-dark-800/40 p-4 rounded-2xl border border-dark-800">
                {targetUser.bio || 'This user has not written a bio yet.'}
              </p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-800">
              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5 text-brand-400" /> Location
                </p>
                <p className="text-xs font-semibold text-white">{targetUser.country || 'Global'}</p>
              </div>

              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-400" /> Member Since
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
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade Subscription</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WhatsApp-Style Profile Photo Selector Modal                                */}
      {/* ========================================================================= */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-dark-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Profile Photo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="p-1.5 rounded-full hover:bg-dark-800 text-dark-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Preview */}
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <Avatar
                src={avatarUrl || currentUser?.avatar_url}
                name={currentUser?.full_name || 'User'}
                size="2xl"
                planId={currentUser?.plan_id}
                className="ring-4 ring-brand-500/40 shadow-2xl"
              />
              {uploadingPhoto && (
                <p className="text-xs text-brand-400 animate-pulse font-medium">{uploadProgress}</p>
              )}
            </div>

            {/* WhatsApp-Style Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* 1. Camera Snap */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 rounded-2xl bg-dark-800 hover:bg-dark-700/80 border border-dark-700 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95"
              >
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-all">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-dark-200 group-hover:text-white">Camera</span>
              </button>

              {/* 2. Gallery / Device Files */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl bg-dark-800 hover:bg-dark-700/80 border border-dark-700 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95"
              >
                <div className="p-3 rounded-full bg-brand-500/10 text-brand-400 group-hover:scale-110 transition-all">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-dark-200 group-hover:text-white">Gallery</span>
              </button>

              {/* 3. Random 3D Avatar */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={handleGenerateRandomAvatar}
                className="p-4 rounded-2xl bg-dark-800 hover:bg-dark-700/80 border border-dark-700 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95"
              >
                <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-all">
                  <Shuffle className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-dark-200 group-hover:text-white">Random 3D</span>
              </button>

              {/* 4. Remove Photo */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={handleRemovePhoto}
                className="p-4 rounded-2xl bg-dark-800 hover:bg-rose-500/10 border border-dark-700 hover:border-rose-500/30 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95"
              >
                <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-all">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-dark-200 group-hover:text-rose-300">Remove</span>
              </button>
            </div>

            {/* 3D / HD Avatar Preset Carousel */}
            <div>
              <label className="block text-xs font-medium text-dark-400 mb-2">Or Choose from Curated Avatars</label>
              <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-1 rounded-full transition-all hover:scale-110 ${
                      avatarUrl === preset ? 'ring-2 ring-brand-500 scale-105 bg-brand-500/20' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={preset} alt="preset" className="w-10 h-10 rounded-full object-cover shadow-md" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
