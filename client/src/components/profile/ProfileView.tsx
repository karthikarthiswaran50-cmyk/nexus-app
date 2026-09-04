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
  Crown,
  Zap,
  Check,
  Gem,
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
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [status, setStatus] = useState(currentUser?.status || '👑 Imperial VIP on Nexus');
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

  // WhatsApp-style status presets with gemstones & emojis
  const statusPresets = [
    { text: 'Available', emoji: '🟢', color: 'emerald' },
    { text: 'Busy', emoji: '🔴', color: 'ruby' },
    { text: 'Royal VIP', emoji: '👑', color: 'gold' },
    { text: 'In a 4K Call', emoji: '📞', color: 'sapphire' },
    { text: 'At work', emoji: '💼', color: 'indigo' },
    { text: 'Battery low', emoji: '🔋', color: 'amber' },
    { text: 'Traveling', emoji: '✈️', color: 'cyan' },
    { text: 'Coffee break', emoji: '☕', color: 'amber' },
    { text: 'Urgent only', emoji: '💬', color: 'rose' },
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
    'https://api.dicebear.com/7.x/bottts/svg?seed=NexusRoyal',
    'https://api.dicebear.com/7.x/bottts/svg?seed=KingNexus',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=ImperialKnight',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=RoyalEmpress',
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
    showToast('Royal 3D Avatar applied!');
  };

  // Select preset avatar
  const handleSelectPreset = async (presetUrl: string) => {
    setAvatarUrl(presetUrl);
    await updateProfile({ avatar_url: presetUrl });
    setShowPhotoModal(false);
    showToast('Royal avatar selected!');
  };

  // Remove photo
  const handleRemovePhoto = async () => {
    const defaultUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username || 'user'}`;
    setAvatarUrl(defaultUrl);
    await updateProfile({ avatar_url: defaultUrl });
    setShowPhotoModal(false);
    showToast('Profile photo reset.');
  };

  // Save text profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        username,
        bio,
        status,
        country,
        avatar_url: avatarUrl,
      });
      setIsEditing(false);
      showToast('Profile passport updated!');


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
    <div className="max-w-4xl mx-auto p-3.5 sm:p-6 space-y-6 animate-in fade-in duration-200">
      
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
        <div className="p-3.5 px-5 rounded-2xl bg-dark-900/95 border border-gold-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 shadow-2xl shadow-gold-500/20 backdrop-blur-xl animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 👑 Main Royal Profile Passport Card */}
      <div className="relative bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl royal-card">
        
        {/* Cover Gradient Graphic */}
        <div className="h-44 sm:h-56 bg-gradient-to-r from-amber-950 via-indigo-950 to-dark-950 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
          
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-dark-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-gold-500/30 text-[11px] text-amber-200 shadow-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">256-Bit Royal Quantum Vault</span>
          </div>

          <div className="absolute bottom-4 left-6 hidden sm:flex items-center gap-2 text-gold-400/60 text-xs font-mono">
            <Crown className="w-3.5 h-3.5 text-gold-400" />
            <span>PASSPORT ID: #{targetUser.id.substring(0, 12)}</span>
          </div>
        </div>

        {/* Profile Details Bar */}
        <div className="p-6 sm:p-8 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-16 sm:-mt-22">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            
            {/* WhatsApp-Style Avatar with 24K Gold Ring */}
            <div className="relative group">
              <Avatar
                src={avatarUrl || targetUser.avatar_url}
                name={targetUser.full_name}
                size="2xl"
                planId={targetUser.plan_id}
                className="ring-4 ring-dark-950 shadow-2xl bg-dark-950"
              />

              {/* WhatsApp Camera Overlay on Avatar */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-dark-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-200 text-white cursor-pointer backdrop-blur-xs ring-4 ring-gold-400/60"
                  title="Change Profile Photo"
                >
                  <Camera className="w-6 h-6 text-gold-300" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">Change</span>
                </button>
              )}

              {/* Mobile Quick Camera Badge */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="sm:hidden absolute bottom-1 right-1 p-2 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-dark-950 shadow-lg border-2 border-dark-900"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{targetUser.full_name}</h1>
                <PlanBadge planId={targetUser.plan_id} size="sm" />
              </div>
              <p className="text-xs text-dark-400 flex items-center justify-center sm:justify-start gap-1 font-mono">
                <AtSign className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-dark-300">{targetUser.username}</span>
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dark-850/80 border border-gold-500/20 text-xs font-semibold text-amber-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span>{targetUser.status || '👑 Imperial VIP on Nexus'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isOwnProfile && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-amber-200 hover:text-white border border-gold-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-gold-400" />
                <span>Photo</span>
              </button>

              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl bg-dark-850 text-dark-300 hover:text-white border border-dark-700 text-xs font-bold"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 shadow-lg shadow-gold-500/25 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5 text-dark-950 stroke-[2.5]" />
                  <span>Edit Passport</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form or View Layout */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="bg-dark-900 border border-gold-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl royal-card">
          <div className="flex items-center justify-between pb-4 border-b border-gold-500/15">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-400" />
                <span>Edit Royal Passport</span>
              </h3>
              <p className="text-xs text-dark-400">Update your public credentials and status</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-amber-200 text-xs font-bold flex items-center gap-1.5 border border-gold-500/30 transition-all"
            >
              <Camera className="w-3.5 h-3.5 text-gold-400" />
              <span>Change DP</span>
            </button>
          </div>

          {/* Name & Country Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                maxLength={50}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1.5">Unique Royal ID *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-400 font-bold text-xs">@</span>
                <input
                  type="text"
                  required
                  maxLength={25}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="your_handle"
                  className="w-full pl-7 pr-3 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-dark-300 mb-1.5">Country / Realm</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India, Global"
                className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all"
              />
            </div>
          </div>

          {/* WhatsApp-Style Status & Quick Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-dark-300">
              Royal Status / About
            </label>
            <div className="relative">
              <Smile className="w-4 h-4 text-gold-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={100}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="e.g. 👑 Imperial VIP on Nexus"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all"
              />
            </div>

            {/* Gemstone Status Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {statusPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setStatus(`${preset.emoji} ${preset.text}`)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                    status.includes(preset.text)
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 border-gold-400 shadow-md'
                      : 'bg-dark-850 text-dark-300 hover:text-white border-gold-500/15 hover:bg-dark-800'
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
            <label className="block text-xs font-bold text-dark-300 mb-1.5">Imperial Bio</label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your role, projects, and specialties..."
              className="w-full px-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/50 transition-all"
            />
            <span className="text-[10px] text-dark-500 float-right mt-1">{bio.length}/300</span>
          </div>

          {/* Form Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gold-500/15">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-300 hover:text-white border border-dark-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/25 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5 stroke-[2.5]" />
              {saving ? 'Saving...' : 'Save Passport Changes'}
            </button>
          </div>
        </form>
      ) : (
        /* View Profile Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Bio & Details (Col 1 & 2) */}
          <div className="md:col-span-2 bg-dark-900 border border-gold-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl royal-card">
            
            {/* Status Card (Royal WhatsApp Style) */}
            <div>
              <h3 className="text-xs font-extrabold text-gold-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-gold-400" />
                <span>Live Status</span>
              </h3>
              <div className="p-4 rounded-2xl bg-dark-850/90 border border-gold-500/20 flex items-center justify-between shadow-inner">
                <p className="text-sm font-bold text-amber-100">
                  {targetUser.status || '👑 Imperial VIP on Nexus'}
                </p>
                <span className="text-[10px] text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  ONLINE
                </span>
              </div>
            </div>

            {/* Bio Card */}
            <div>
              <h3 className="text-xs font-extrabold text-dark-400 uppercase tracking-wider mb-2">Imperial Bio</h3>
              <p className="text-xs sm:text-sm text-dark-200 leading-relaxed bg-dark-850/50 p-4 rounded-2xl border border-dark-800">
                {targetUser.bio || 'This member has not written an Imperial bio yet.'}
              </p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gold-500/15">
              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Globe className="w-3.5 h-3.5 text-gold-400" /> Location
                </p>
                <p className="text-xs font-bold text-white">{targetUser.country || 'Global Realm'}</p>
              </div>

              <div>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-gold-400" /> Member Since
                </p>
                <p className="text-xs font-bold text-white">
                  {new Date(targetUser.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Tier Info (Col 3) */}
          <div className="bg-dark-900 border border-gold-500/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl flex flex-col justify-between royal-card-gold">
            <div>
              <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Gem className="w-4 h-4 text-gold-400" />
                <span>Tier Standing</span>
              </h3>
              <div className="p-4 rounded-2xl bg-dark-850/90 border border-gold-500/30 space-y-2 shadow-inner">
                <PlanBadge planId={targetUser.plan_id} size="lg" />
                <p className="text-xs text-amber-200/80 pt-1 font-medium leading-relaxed">
                  {targetUser.plan_id === 'vip'
                    ? 'Imperial VIP Standing with Unlimited 4K Calling & Concierge Access.'
                    : targetUser.plan_id === 'pro'
                    ? 'Nexus Pro Standing with HD Video & Screen Sharing.'
                    : 'Standard Starter Tier.'}
                </p>
              </div>
            </div>

            {isOwnProfile && onNavigateToSubscription && targetUser.plan_id !== 'vip' && (
              <button
                type="button"
                onClick={onNavigateToSubscription}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-xl shadow-gold-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Crown className="w-4 h-4 stroke-[2.5]" />
                <span>Upgrade to Imperial VIP</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👑 Royal WhatsApp-Style Profile Photo Selector Modal                      */}
      {/* ========================================================================= */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-dark-900 border border-gold-500/30 rounded-3xl p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 royal-card">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gold-500/20">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-gold-400" />
                <h3 className="text-base font-extrabold gold-gradient-text">Royal Profile Photo</h3>
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
                className="ring-4 ring-gold-400/50 shadow-2xl"
              />
              {uploadingPhoto && (
                <p className="text-xs text-amber-300 animate-pulse font-bold">{uploadProgress}</p>
              )}
            </div>

            {/* WhatsApp-Style Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* 1. Camera Snap */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-gold-500/20 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95 shadow-md"
              >
                <div className="p-3 rounded-full bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition-all">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-dark-200 group-hover:text-amber-200">Camera</span>
              </button>

              {/* 2. Gallery / Device Files */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-gold-500/20 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95 shadow-md"
              >
                <div className="p-3 rounded-full bg-gold-500/15 text-gold-400 group-hover:scale-110 transition-all">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-dark-200 group-hover:text-amber-200">Gallery</span>
              </button>

              {/* 3. Random 3D Avatar */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={handleGenerateRandomAvatar}
                className="p-4 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-gold-500/20 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95 shadow-md"
              >
                <div className="p-3 rounded-full bg-amber-500/15 text-amber-300 group-hover:scale-110 transition-all">
                  <Shuffle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-dark-200 group-hover:text-amber-200">Random 3D</span>
              </button>

              {/* 4. Remove Photo */}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={handleRemovePhoto}
                className="p-4 rounded-2xl bg-dark-850 hover:bg-rose-500/15 border border-dark-700 hover:border-rose-500/30 flex flex-col items-center justify-center gap-2 text-center transition-all group active:scale-95 shadow-md"
              >
                <div className="p-3 rounded-full bg-rose-500/15 text-rose-400 group-hover:scale-110 transition-all">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-dark-200 group-hover:text-rose-300">Remove</span>
              </button>
            </div>

            {/* 3D / HD Avatar Preset Carousel */}
            <div>
              <label className="block text-xs font-bold text-gold-300 mb-2">Curated Imperial Avatars</label>
              <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-1 rounded-full transition-all hover:scale-110 ${
                      avatarUrl === preset ? 'ring-2 ring-gold-400 scale-105 bg-gold-500/20' : 'opacity-70 hover:opacity-100'
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
