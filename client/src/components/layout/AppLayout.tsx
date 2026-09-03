import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChatLayout } from '../chat/ChatLayout';
import { CallsView } from '../calls/CallsView';
import { DirectoryView } from '../directory/DirectoryView';
import { SubscriptionView } from '../subscription/SubscriptionView';
import { ProfileView } from '../profile/ProfileView';
import { SettingsView } from '../settings/SettingsView';
import { IncomingCallModal } from '../call/IncomingCallModal';
import { ActiveCallOverlay } from '../call/ActiveCallOverlay';
import {
  MessageSquare,
  Phone,
  Sparkles,
  User as UserIcon,
  Settings,
  Video,
  Menu,
  X,
  Compass,
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  ExternalLink,
  ShieldCheck,
  Radio,
} from 'lucide-react';

export type NavTab = 'chats' | 'calls' | 'directory' | 'subscription' | 'profile' | 'settings';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const { isConnected, callBannerMessage } = useSocket();

  const [currentTab, setCurrentTab] = useState<NavTab>('chats');
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!checkStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
        setShowInstallModal(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleStartChatWithUser = (targetUser: User) => {
    setSelectedUserForChat(targetUser);
    setCurrentTab('chats');
  };

  const handleViewProfile = (targetUser: User) => {
    setViewProfileUser(targetUser);
    setCurrentTab('profile');
  };

  const navItems = [
    { id: 'chats' as NavTab, label: 'Messages', icon: MessageSquare },
    { id: 'calls' as NavTab, label: 'Calls', icon: Phone },
    { id: 'directory' as NavTab, label: 'Community', icon: Compass },
    { id: 'subscription' as NavTab, label: 'Subscription', icon: Sparkles, badge: user?.plan_id === 'vip' ? 'VIP' : user?.plan_id === 'pro' ? 'PRO' : '₹99' },
    { id: 'profile' as NavTab, label: 'My Profile', icon: UserIcon },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-[100dvh] bg-dark-950 text-dark-100 flex flex-col selection:bg-brand-500 selection:text-white overflow-hidden">
      
      {/* Global Call Modals (always listening) */}
      <IncomingCallModal />
      <ActiveCallOverlay />

      {/* Global Toast / Banner Notification */}
      {callBannerMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-dark-900/90 border border-brand-500/40 text-white text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span>{callBannerMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 sm:h-16 border-b border-dark-800/80 bg-dark-900/90 backdrop-blur-xl sticky top-0 z-40 px-3.5 sm:px-6 flex items-center justify-between shrink-0">
        
        {/* Brand Logo & Connection Status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                Nexus <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">APP</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full bg-dark-800/80 border border-dark-700/60 text-dark-300">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
            <span className="hidden xs:inline">{isConnected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-dark-950/60 p-1 rounded-2xl border border-dark-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentTab(item.id);
                  if (item.id === 'profile') setViewProfileUser(null);
                }}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badge === 'VIP'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : item.badge === 'PRO'
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Status Card & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Mobile/Desktop Install APK Button */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] sm:text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              title="Install Mobile App / APK"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
            className="flex items-center gap-2 p-1 sm:p-1.5 sm:pr-3 rounded-2xl bg-dark-800/80 hover:bg-dark-800 border border-dark-700/80 transition-all text-left"
          >
            <Avatar
              src={user?.avatar_url}
              name={user?.full_name || ''}
              size="sm"
              isOnline={isConnected}
              showOnlineStatus
              planId={user?.plan_id}
            />
            <div className="hidden lg:block">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">{user?.full_name}</p>
              <p className="text-[10px] text-dark-400 uppercase tracking-wider">{user?.plan_id || 'free'} Tier</p>
            </div>
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl bg-dark-800 text-dark-300 hover:text-white border border-dark-700"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-dark-900 border-b border-dark-800 p-4 space-y-2 animate-in slide-in-from-top duration-200 z-30 shrink-0 shadow-2xl">
          {!isStandalone && (
            <button
              type="button"
              onClick={() => { handleInstallApp(); setMobileMenuOpen(false); }}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 mb-2 shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>📱 Install Nexus App (APK) on Phone</span>
            </button>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentTab(item.id);
                  if (item.id === 'profile') setViewProfileUser(null);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-dark-300 hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-dark-800 text-dark-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main App Content Body */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {currentTab === 'chats' && (
          <div className="flex-1 flex overflow-hidden">
            <ChatLayout
              initialSelectedUser={selectedUserForChat}
              onNavigateToDirectory={() => setCurrentTab('directory')}
              onNavigateToSubscription={() => setCurrentTab('subscription')}
              onViewProfile={handleViewProfile}
            />
          </div>
        )}

        {currentTab === 'calls' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-20 md:pb-6">
            <CallsView
              onStartChat={handleStartChatWithUser}
              onViewProfile={handleViewProfile}
            />
          </div>
        )}

        {currentTab === 'directory' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-20 md:pb-6">
            <DirectoryView
              onStartChat={handleStartChatWithUser}
              onViewProfile={handleViewProfile}
            />
          </div>
        )}

        {currentTab === 'subscription' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-20 md:pb-6">
            <SubscriptionView />
          </div>
        )}

        {currentTab === 'profile' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-20 md:pb-6">
            <ProfileView
              viewUser={viewProfileUser}
              onNavigateToSubscription={() => setCurrentTab('subscription')}
            />
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-20 md:pb-6">
            <SettingsView />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (WhatsApp Style, 1-thumb touch) */}
      <nav className="md:hidden h-14 sm:h-16 bg-dark-900/95 backdrop-blur-xl border-t border-dark-800/80 z-40 flex items-center justify-around px-2 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'chats' ? 'text-brand-400 font-bold scale-105' : 'text-dark-400'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('calls')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'calls' ? 'text-brand-400 font-bold scale-105' : 'text-dark-400'
          }`}
        >
          <Phone className="w-5 h-5" />
          <span className="text-[10px]">Calls</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('directory')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'directory' ? 'text-brand-400 font-bold scale-105' : 'text-dark-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Users</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('subscription')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'subscription' ? 'text-emerald-400 font-bold scale-105' : 'text-dark-400'
          }`}
        >
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] text-emerald-400">₹99 Pro</span>
        </button>

        <button
          type="button"
          onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'profile' ? 'text-brand-400 font-bold scale-105' : 'text-dark-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 📱 Mobile App (APK / PWA) Installation Modal                             */}
      {/* ========================================================================= */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-dark-800 text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/25">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-white">Install Nexus Mobile App</h3>
              <p className="text-xs text-dark-300 leading-relaxed max-w-xs mx-auto">
                Get the full-screen native experience, instant push call ringers, and faster loading on your phone.
              </p>
            </div>

            {/* Options Tabs / Steps */}
            <div className="space-y-3">
              {/* Android Box */}
              <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <span>🤖 Android Phone (Chrome / Brave / Edge)</span>
                </div>
                <p className="text-xs text-dark-300">
                  Tap the button below to install directly to your app drawer, or tap the <strong className="text-white">⋮ menu</strong> at top right and choose <strong className="text-white">"Install App"</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Nexus App Now</span>
                </button>
              </div>

              {/* iOS Box */}
              <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <span>🍏 iPhone / iPad (Safari)</span>
                </div>
                <p className="text-xs text-dark-300">
                  1. Tap the <strong className="text-white">Share button (📤)</strong> at bottom of Safari.<br />
                  2. Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
                </p>
              </div>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="text-xs text-dark-400 hover:text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
