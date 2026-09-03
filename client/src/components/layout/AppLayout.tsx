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
} from 'lucide-react';

export type NavTab = 'chats' | 'calls' | 'directory' | 'subscription' | 'profile' | 'settings';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const { isConnected, callBannerMessage } = useSocket();

  const [currentTab, setCurrentTab] = useState<NavTab>('chats');
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
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
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on Mobile:\n• Android Chrome: Tap ⋮ menu > "Install App" or "Add to Home Screen"\n• iPhone Safari: Tap Share button > "Add to Home Screen"');
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
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col selection:bg-brand-500 selection:text-white pb-16 md:pb-0">
      
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
      <header className="h-16 border-b border-dark-800/80 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        
        {/* Brand Logo & Connection Status */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                Nexus <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">CALL</span>
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-dark-800/80 border border-dark-700/60 text-dark-300 ml-3">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
            <span>{isConnected ? 'Gateway Active' : 'Connecting...'}</span>
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
        <div className="flex items-center gap-2.5">
          
          {/* Mobile Install App Button */}
          <button
            type="button"
            onClick={handleInstallApp}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-500/20 hover:from-emerald-600/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Install App</span>
          </button>

          <button
            type="button"
            onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-dark-800/80 hover:bg-dark-800 border border-dark-700/80 transition-all text-left"
          >
            <Avatar
              src={user?.avatar_url}
              name={user?.full_name || ''}
              size="sm"
              isOnline={isConnected}
              showOnlineStatus
              planId={user?.plan_id}
            />
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">{user?.full_name}</p>
              <p className="text-[10px] text-dark-400 uppercase tracking-wider">{user?.plan_id || 'free'} Tier</p>
            </div>
          </button>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-dark-800 text-dark-300 hover:text-white border border-dark-700"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-dark-900 border-b border-dark-800 p-4 space-y-2 animate-in slide-in-from-top duration-200">
          <button
            type="button"
            onClick={() => { handleInstallApp(); setMobileMenuOpen(false); }}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 mb-2"
          >
            <Download className="w-4 h-4" />
            <span>📱 Install Nexus on Mobile Home Screen</span>
          </button>

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
      <main className="flex-1 flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <CallsView
              onStartChat={handleStartChatWithUser}
              onViewProfile={handleViewProfile}
            />
          </div>
        )}

        {currentTab === 'directory' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <DirectoryView
              onStartChat={handleStartChatWithUser}
              onViewProfile={handleViewProfile}
            />
          </div>
        )}

        {currentTab === 'subscription' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <SubscriptionView />
          </div>
        )}

        {currentTab === 'profile' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ProfileView
              viewUser={viewProfileUser}
              onNavigateToSubscription={() => setCurrentTab('subscription')}
            />
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <SettingsView />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (1-thumb easy tapping) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-dark-900/95 backdrop-blur-xl border-t border-dark-800/80 z-40 flex items-center justify-around px-2">
        <button
          type="button"
          onClick={() => { setCurrentTab('chats'); setSelectedUserForChat(null); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'chats' ? 'text-brand-400 font-bold' : 'text-dark-400'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('calls')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'calls' ? 'text-brand-400 font-bold' : 'text-dark-400'
          }`}
        >
          <Phone className="w-5 h-5" />
          <span className="text-[10px]">Calls</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('directory')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'directory' ? 'text-brand-400 font-bold' : 'text-dark-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Users</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('subscription')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'subscription' ? 'text-emerald-400 font-bold' : 'text-dark-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">₹99 Pro</span>
        </button>

        <button
          type="button"
          onClick={() => { setCurrentTab('profile'); setViewProfileUser(null); }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            currentTab === 'profile' ? 'text-brand-400 font-bold' : 'text-dark-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>
    </div>
  );
};
