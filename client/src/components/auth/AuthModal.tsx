import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Video, MessageSquare, Shield, ArrowRight, UserCheck, Lock, Mail, User as UserIcon, Crown } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const AuthModal: React.FC = () => {
  const { login, register, loginDemoUser, loginWithGoogle } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loginInput, setLoginInput] = useState(() => localStorage.getItem('nexus_saved_username') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Registration form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed or was cancelled.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'demo_user', name: 'Alex Rivera', role: 'Creator & Nomad', tier: 'pro' as const, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
    { username: 'elena_ux', name: 'Elena Rostova', role: 'UI/UX Designer', tier: 'pro' as const, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
    { username: 'marcus_dev', name: 'Marcus Chen', role: 'Systems Engineer', tier: 'vip' as const, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
    { username: 'sophia_ai', name: 'Sophia Taylor', role: 'Product Manager', tier: 'free' as const, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80' },
  ];

  const avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80',
  ];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !password) {
      setError('Please enter your email/username and password');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(loginInput, password);
      if (rememberMe) {
        localStorage.setItem('nexus_saved_username', loginInput.trim());
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !email || !regPassword) {
      setError('Please fill in all required fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({
        full_name: fullName,
        username,
        email,
        password: regPassword,
        avatar_url: selectedAvatar,
        bio: bio || undefined,
      });
      localStorage.setItem('nexus_saved_username', username.trim());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Try a different username or email.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (usr: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginDemoUser(usr);
    } catch (err: any) {
      setError('Failed to login with demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-2xl animate-in fade-in duration-300 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 royal-card">
        
        {/* Left Side: Royal Branding & Hero */}
        <div className="lg:col-span-5 p-8 bg-gradient-to-br from-amber-950/40 via-dark-950 to-dark-900 border-b lg:border-b-0 lg:border-r border-gold-500/20 flex flex-col justify-between relative overflow-hidden">
          
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-xl shadow-gold-500/30">
                <Crown className="w-5 h-5 fill-dark-950" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  <span className="gold-gradient-text">NEXUS</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30">
                    ROYAL
                  </span>
                </h1>
                <p className="text-[11px] text-dark-400">Imperial Real-Time Platform</p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">
              Ultra-HD Video, Audio & Royal Messaging
            </h2>
            <p className="text-xs sm:text-sm text-dark-300 leading-relaxed mb-6">
              Experience seamless encrypted WebRTC calling, screen sharing, custom VIP passports, and instant voice notes.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-xl bg-gold-500/15 text-gold-400 border border-gold-500/30">
                  <Video className="w-4 h-4" />
                </div>
                <span className="font-bold">1-on-1 4K WebRTC Video & Screen Share</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="font-bold">WhatsApp Voice Notes & Live Status</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Crown className="w-4 h-4 fill-amber-300" />
                </div>
                <span className="font-bold">24K Gold VIP Privileges</span>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Demo Login Bar */}
          <div className="pt-4 border-t border-gold-500/15 relative z-10">
            <p className="text-[11px] font-bold text-gold-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-gold-400" />
              <span>Instant 1-Click Demo Access:</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  onClick={() => handleQuickDemoLogin(demo.username)}
                  disabled={loading}
                  className="flex items-center gap-2 p-2 rounded-xl bg-dark-850 hover:bg-gold-500/15 border border-gold-500/15 hover:border-gold-400/40 transition-all text-left group shadow-xs active:scale-95"
                >
                  <Avatar src={demo.avatar} name={demo.name} size="xs" planId={demo.tier} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-dark-200 group-hover:text-amber-200 truncate">{demo.name}</p>
                    <p className="text-[9px] text-gold-400 uppercase font-bold">{demo.tier}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Login / Register Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-gold-500/15">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`text-sm font-black pb-2 border-b-2 transition-all ${
                  !isRegister ? 'border-gold-400 text-amber-200' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`text-sm font-black pb-2 border-b-2 transition-all ${
                  isRegister ? 'border-gold-400 text-amber-200' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                Create Account
              </button>
            </div>
            <span className="text-[11px] font-mono text-gold-400/80">256-Bit Vault</span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 mb-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 border border-slate-200"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center mb-4">
            <div className="flex-grow border-t border-gold-500/15"></div>
            <span className="flex-shrink mx-3 text-dark-500 text-[10px] uppercase font-bold tracking-wider">or with credentials</span>
            <div className="flex-grow border-t border-gold-500/15"></div>
          </div>

          {!isRegister ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-dark-300 mb-1.5">Email or Handle</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gold-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. demo@nexus.app or demo_user"
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-dark-300">Password</label>
                  <span className="text-[11px] text-dark-400">Demo: <code className="text-amber-300">password123</code></span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gold-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-dark-300">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-850 text-gold-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-dark-300 text-xs">Remember my username</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs sm:text-sm shadow-xl shadow-gold-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Enter Nexus Royal'}
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-dark-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-dark-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-dark-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2 bg-dark-850 border border-gold-500/20 rounded-xl text-xs sm:text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-dark-300 mb-1.5">Choose Avatar</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {avatarOptions.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`relative rounded-full p-0.5 transition-all ${
                        selectedAvatar === av ? 'ring-2 ring-gold-400 scale-105' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={av} alt="avatar option" className="w-8 h-8 rounded-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs sm:text-sm shadow-xl shadow-gold-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
              >
                {loading ? 'Creating account...' : 'Create Royal Account'}
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
