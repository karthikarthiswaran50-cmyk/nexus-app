import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Video, MessageSquare, Shield, ArrowRight, UserCheck, Lock, Mail, User as UserIcon } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const AuthModal: React.FC = () => {
  const { login, register, loginDemoUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-dark-900 border border-dark-800 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 my-8">
        
        {/* Left Side: Brand presentation */}
        <div className="lg:col-span-5 p-8 bg-gradient-to-br from-brand-950 via-dark-900 to-dark-950 border-b lg:border-b-0 lg:border-r border-dark-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Nexus <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">PRO</span>
                </h1>
                <p className="text-xs text-dark-400">Connect, Call & Collaborate</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">
              Ultra HD Video, Audio & Real-time Messaging
            </h2>
            <p className="text-sm text-dark-300 leading-relaxed mb-6">
              Experience seamless peer-to-peer encrypted calls, screen sharing, custom subscriber profiles, and rich messaging.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Video className="w-4 h-4" />
                </div>
                <span>1-on-1 HD Video & Screen Sharing</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span>Real-Time Instant Chat & Status</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-dark-200">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>Pro & VIP Subscription Tiers</span>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Demo Login Bar */}
          <div className="pt-4 border-t border-dark-800/80">
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-400" />
              Quick 1-Click Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  onClick={() => handleQuickDemoLogin(demo.username)}
                  disabled={loading}
                  className="flex items-center gap-2 p-2 rounded-xl bg-dark-800/60 hover:bg-brand-600/20 border border-dark-700/60 hover:border-brand-500/40 transition-all text-left group"
                >
                  <Avatar src={demo.avatar} name={demo.name} size="xs" planId={demo.tier} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-200 group-hover:text-white truncate">{demo.name}</p>
                    <p className="text-[10px] text-dark-400 uppercase">{demo.tier}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Login / Register Form */}
        <div className="lg:col-span-7 p-8 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-dark-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`text-sm font-semibold pb-2 border-b-2 transition-all ${
                  !isRegister ? 'border-brand-500 text-white' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`text-sm font-semibold pb-2 border-b-2 transition-all ${
                  isRegister ? 'border-brand-500 text-white' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                Create Account
              </button>
            </div>
            <span className="text-xs text-dark-400">Secure & Encrypted</span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isRegister ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1.5">Email or Username</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. demo@nexus.app or demo_user"
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-dark-300">Password</label>
                  <span className="text-[11px] text-dark-400">Demo password: <code className="text-brand-400">password123</code></span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Nexus'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-300 mb-1.5">Choose Avatar</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {avatarOptions.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`relative rounded-full p-0.5 transition-all ${
                        selectedAvatar === av ? 'ring-2 ring-brand-500 scale-105' : 'opacity-60 hover:opacity-100'
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
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Free Account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
