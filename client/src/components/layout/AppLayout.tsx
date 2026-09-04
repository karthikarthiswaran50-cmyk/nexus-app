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
  Crown,
  Menu,
  X,
  Compass,
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  Gem,
  Bell,
  BellRing,
} from 'lucide-react';
import axios from 'axios';
import { getNotificationPermissionStatus, requestNotificationPermission } from '../../utils/notifications';
import { requestFcmToken } from '../../config/firebase';

export type NavTab = 'chats' | 'calls' | 'directory' | 'subscription' | 'profile' | 'settings';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const { isConnected, callBannerMessage, latestMessage } = useSocket();

  const [currentTab, setCurrentTab] = useState<NavTab>('chats');
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Notification states
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [dismissNotifBanner, setDismissNotifBanner] = useState(false);
  const [inAppMessageToast, setInAppMessageToast] = useState<{ senderName: string; preview: string; sender?: User } | null>(null);

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifPermission('granted');
      try {
        const fcmToken = await requestFcmToken();
        if (fcmToken) {
          await axios.post('/api/users/fcm-token', { token: fcmToken });
        }
      } catch (e) {}
    } else {
      setNotifPermission(getNotificationPermissionStatus());
    }
  };

  // Listen to incoming messages for in-app floating banner
  useEffect(() => {
    if (!latestMessage || latestMessage.sender_id === user?.id) return;
    if (currentTab === 'chats' && selectedUserForChat?.id === latestMessage.sender_id) return;

    const senderName = latestMessage.sender?.full_name || latestMessage.sender?.username || 'Nexus Contact';
    const preview = latestMessage.type === 'audio'
      ? '🎤 Voice Message'
      : latestMessage.type === 'image'
      ? '📷 Photo'
      : latestMessage.content || 'Sent an attachment';

    setInAppMessageToast({
      senderName,
      preview,
      sender: latestMessage.sender,
    });

    const timer = setTimeout(() => {
      setInAppMessageToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [latestMessage, currentTab, selectedUserForChat?.id, user?.id]);

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
    { id: 'subscription' as NavTab, label: 'Royal Treasury', icon: Sparkles, badge: user?.plan_id === 'vip' ? 'VIP' : user?.plan_id === 'pro' ? 'PRO' : '₹99' },
    { id: 'profile' as NavTab, label: 'My Passport', icon: UserIcon },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-[100dvh] bg-dark-950 text-dark-100 flex flex-col selection:bg-gold-500 selection:text-dark-950 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Global Call Modals (always listening) */}
      <IncomingCallModal />
      <ActiveCallOverlay />

      {/* Global Toast / Banner Notification */}
      {callBannerMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-dark-900/95 border border-gold-500/40 text-amber-200 text-xs font-semibold shadow-2xl shadow-gold-500/20 backdrop-blur-xl flex items-center gap-2 animate-in fade-in">
          <Crown className="w-4 h-4 text-gold-400 animate-pulse" />
          <span>{callBannerMessage}</span>
        </div>
      )}

      {/* 💬 Floating In-App Chat Toast */}
      {inAppMessageToast && (
        <div
          onClick={() => {
            if (inAppMessageToast.sender) {
              handleStartChatWithUser(inAppMessageToast.sender);
            } else {
              setCurrentTab('chats');
            }
            setInAppMessageToast(null);
          }}
          className="fixed top-16 right-3 sm:right-6 z-50 max-w-sm w-[calc(100vw-1.5rem)] bg-dark-900/95 border border-gold-500/40 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-black/90 backdrop-blur-2xl flex items-center gap-3 cursor-pointer hover:border-gold-400 transition-all animate-in slide-in-from-top-3"
        >
          <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center shrink-0 text-gold-400 overflow-hidden">
            {inAppMessageToast.sender?.avatar_url ? (
              <img src={inAppMessageToast.sender.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <MessageSquare className="w-5 h-5 text-gold-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-bold text-white truncate">{inAppMessageToast.senderName}</p>
              <span className="text-[10px] text-gold-400 font-semibold shrink-0">Just now</span>
            </div>
            <p className="text-xs text-dark-300 truncate mt-0.5">{inAppMessageToast.preview}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInAppMessageToast(null);
            }}
            className="p-1 text-dark-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 👑 Royal Top Navbar */}
      <header className="h-14 sm:h-16 border-b border-gold-500/15 bg-dark-900/90 backdrop-blur-2xl sticky top-0 z-40 px-3.5 sm:px-6 flex items-center justify-between shrink-0 shadow-lg shadow-black/40">
        
        {/* Royal Brand Logo & Connection Status */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div
            onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 flex items-center justify-center text-dark-950 shadow-lg shadow-gold-500/30 group-hover:scale-105 group-hover:rotate-3 transition-all">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-dark-950" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-1.5 leading-none">
                <span className="gold-gradient-text tracking-wide font-black">NEXUS</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-600/25 text-amber-300 border border-amber-400/40 shadow-xs tracking-widest uppercase">
                  ROYAL
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full bg-dark-850/90 border border-gold-500/20 text-dark-300 shadow-inner">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-400 animate-pulse'}`} />
            <span className="hidden xs:inline font-medium text-dark-300">{isConnected ? 'Royal Gateway' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Royal Glass) */}
        <nav className="hidden md:flex items-center gap-1.5 bg-dark-950/80 p-1.5 rounded-2xl border border-gold-500/15 shadow-inner">
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
                className={`relative px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-dark-950 shadow-lg shadow-gold-500/25 scale-[1.02]'
                    : 'text-dark-300 hover:text-amber-200 hover:bg-dark-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'fill-dark-950 text-dark-950' : 'text-gold-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase ${
                      isActive
                        ? 'bg-dark-950/30 text-dark-950'
                        : item.badge === 'VIP'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : item.badge === 'PRO'
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 text-[11px] sm:text-xs font-black transition-all shadow-md shadow-gold-500/25 active:scale-95"
              title="Install Royal App / APK"
            >
              <Download className="w-3.5 h-3.5 text-dark-950 stroke-[2.5]" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
            className="flex items-center gap-2 p-1 sm:p-1.5 sm:pr-3 rounded-2xl bg-dark-850/80 hover:bg-dark-800 border border-gold-500/20 transition-all text-left group"
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
              <p className="text-xs font-extrabold text-white leading-tight truncate max-w-[120px] group-hover:text-amber-200 transition-colors">{user?.full_name}</p>
              <p className="text-[10px] text-gold-400/80 uppercase font-bold tracking-wider">{user?.plan_id === 'vip' ? '👑 Imperial VIP' : user?.plan_id === 'pro' ? '⚡ Pro Member' : 'Starter'}</p>
            </div>
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl bg-dark-850 text-gold-400 hover:text-white border border-gold-500/20"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 🔔 1-Click Permission Activation Ribbon */}
      {notifPermission === 'default' && !dismissNotifBanner && (
        <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border-b border-gold-500/25 px-3.5 sm:px-6 py-2 flex items-center justify-between gap-2.5 text-xs text-amber-200 z-30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-4 h-4 text-gold-400 animate-bounce shrink-0" />
            <span className="truncate text-xs font-medium">Enable notifications to get live incoming call alerts & message previews.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black rounded-lg text-[11px] shadow-sm transition-all active:scale-95"
            >
              Allow Alerts
            </button>
            <button
              type="button"
              onClick={() => setDismissNotifBanner(true)}
              className="p-1 text-dark-400 hover:text-white rounded-md transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu (Royal) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-dark-900 border-b border-gold-500/20 p-4 space-y-2 animate-in slide-in-from-top duration-200 z-30 shrink-0 shadow-2xl">
          {!isStandalone && (
            <button
              type="button"
              onClick={() => { handleInstallApp(); setMobileMenuOpen(false); }}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-dark-950 font-black text-xs flex items-center justify-center gap-2 mb-2 shadow-lg shadow-gold-500/30"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>👑 Install Nexus Royal App (APK) on Phone</span>
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
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  isActive ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md' : 'text-dark-300 hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-dark-950' : 'text-gold-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-dark-800 text-gold-300 border border-gold-500/20">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main App Content Body */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
        
        {/* Subtle Ambient Gold Light Orb */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />

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

      {/* 👑 Royal Mobile Bottom Navigation Bar (WhatsApp Style, 1-thumb touch) */}
      <nav className="md:hidden h-14 sm:h-16 bg-dark-900/95 backdrop-blur-2xl border-t border-gold-500/20 z-40 flex items-center justify-around px-2 shrink-0 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <button
          type="button"
          onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'chats' ? 'text-amber-300 font-extrabold scale-105' : 'text-dark-400'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('calls')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'calls' ? 'text-amber-300 font-extrabold scale-105' : 'text-dark-400'
          }`}
        >
          <Phone className="w-5 h-5" />
          <span className="text-[10px]">Calls</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('directory')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'directory' ? 'text-amber-300 font-extrabold scale-105' : 'text-dark-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Users</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('subscription')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'subscription' ? 'text-amber-300 font-extrabold scale-105' : 'text-dark-400'
          }`}
        >
          <Sparkles className="w-5 h-5 text-gold-400" />
          <span className="text-[10px] text-gold-400 font-bold">₹99 Pro</span>
        </button>

        <button
          type="button"
          onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'profile' ? 'text-amber-300 font-extrabold scale-105' : 'text-dark-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px]">Passport</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 📱 Royal Mobile App (APK / PWA) Installation Modal                        */}
      {/* ========================================================================= */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 royal-card">
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-dark-800 text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-xl shadow-gold-500/30">
                <Crown className="w-8 h-8 fill-dark-950" />
              </div>
              <h3 className="text-lg font-extrabold gold-gradient-text">Install Nexus Royal App</h3>
              <p className="text-xs text-dark-300 leading-relaxed max-w-xs mx-auto">
                Experience full-screen Royal video calls, instant push notifications, and ultra-fast messaging.
              </p>
            </div>

            {/* Options Tabs / Steps */}
            <div className="space-y-3">
              {/* Android Box */}
              <div className="p-4 rounded-2xl bg-dark-850/90 border border-gold-500/25 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>🤖 Android Phone (Chrome / Brave / Edge)</span>
                </div>
                <p className="text-xs text-dark-300">
                  Tap the button below to install directly to your app drawer, or tap <strong className="text-white">⋮ menu</strong> &gt; <strong className="text-white">"Install App"</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-gold-500/25 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Install Nexus Royal App</span>
                </button>
              </div>

              {/* iOS Box */}
              <div className="p-4 rounded-2xl bg-dark-850/90 border border-dark-700/80 space-y-1.5">
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
