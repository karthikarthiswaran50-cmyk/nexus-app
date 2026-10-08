import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Coins,
  Play,
  Flame,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Smartphone,
  Wallet,
  ShieldCheck,
  RefreshCw,
  Gift,
} from 'lucide-react';
import { RewardedAdPlayer } from './RewardedAdPlayer';
import { useAuth } from '../../context/AuthContext';

interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletData {
  user_id: string;
  coins_balance: number;
  cash_earned_inr: number;
  ads_watched_total: number;
  ads_watched_today: number;
  streak_days: number;
  last_ad_watched_at?: string;
  can_claim_streak: boolean;
}

interface PayoutItem {
  id: string;
  amount_inr: number;
  coins_redeemed: number;
  upi_id: string;
  account_holder_name?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  admin_notes?: string;
  transaction_ref?: string;
  created_at: string;
}

export const RewardsModal: React.FC<RewardsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Ad Watching State
  const [isAdPlayerOpen, setIsAdPlayerOpen] = useState(false);
  const [claimingAdReward, setClaimingAdReward] = useState(false);

  // Active Tab: 'earn' | 'withdraw' | 'history' | 'info'
  const [activeTab, setActiveTab] = useState<'earn' | 'withdraw' | 'history' | 'info'>('earn');

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(10);
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Streak State
  const [claimingStreak, setClaimingStreak] = useState(false);
  const [streakMessage, setStreakMessage] = useState<string | null>(null);

  // Toast / General Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      setLoadingWallet(true);
      const res = await axios.get('/api/rewards/wallet');
      setWallet(res.data.wallet);
      setPayouts(res.data.payouts || []);
    } catch (err) {
      console.error('Failed to load rewards wallet:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWallet();
      setPayoutMessage(null);
      setStreakMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle ad completed by user in RewardedAdPlayer
  const handleAdCompleted = async () => {
    try {
      setClaimingAdReward(true);
      const res = await axios.post('/api/rewards/complete-ad');
      if (res.data?.wallet) {
        setWallet((prev) => prev ? { ...prev, ...res.data.wallet } : res.data.wallet);
      }
      setToastMessage(res.data?.message || '🎉 +50 Royal Coins added to your wallet!');
      setTimeout(() => setToastMessage(null), 4500);
      fetchWallet();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to claim ad reward. Please try again.';
      alert(errMsg);
    } finally {
      setClaimingAdReward(false);
    }
  };

  // Handle Claiming Daily Login Streak Bonus
  const handleClaimStreak = async () => {
    try {
      setClaimingStreak(true);
      const res = await axios.post('/api/rewards/claim-streak');
      setStreakMessage(res.data?.message || 'Daily streak claimed!');
      if (res.data?.wallet) {
        setWallet((prev) => prev ? { ...prev, ...res.data.wallet } : res.data.wallet);
      }
      setTimeout(() => setStreakMessage(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to claim streak bonus.');
    } finally {
      setClaimingStreak(false);
    }
  };

  // Handle Requesting UPI Cashout
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);

    if (!upiId.trim() || !upiId.includes('@')) {
      setPayoutMessage({ type: 'error', text: 'Please enter a valid UPI ID (e.g., yourname@okaxis).' });
      return;
    }

    if (withdrawAmount < 10) {
      setPayoutMessage({ type: 'error', text: 'Minimum withdrawal is ₹10.00 (1,000 Coins).' });
      return;
    }

    const requiredCoins = withdrawAmount * 100;
    if ((wallet?.coins_balance || 0) < requiredCoins) {
      setPayoutMessage({
        type: 'error',
        text: `Insufficient Coins. You need ${requiredCoins} Coins for ₹${withdrawAmount.toFixed(2)}, but currently have ${wallet?.coins_balance || 0} Coins.`,
      });
      return;
    }

    try {
      setSubmittingPayout(true);
      const res = await axios.post('/api/rewards/request-payout', {
        amountInr: withdrawAmount,
        upiId: upiId.trim(),
        accountHolderName: accountName.trim(),
      });

      setPayoutMessage({ type: 'success', text: res.data?.message || 'Payout request submitted successfully!' });
      if (res.data?.wallet) {
        setWallet((prev) => prev ? { ...prev, ...res.data.wallet } : res.data.wallet);
      }
      fetchWallet();
    } catch (err: any) {
      setPayoutMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit payout request.',
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const coinsBalance = wallet?.coins_balance || 0;
  const cashBalance = wallet?.cash_earned_inr || 0;
  const adsToday = wallet?.ads_watched_today || 0;
  const dailyLimit = 20;
  const remainingAds = Math.max(0, dailyLimit - adsToday);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-2xl bg-dark-900 border border-gold-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Ribbon */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-600/30 via-yellow-500/20 to-amber-600/30 border-b border-gold-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-dark-950 flex items-center justify-center shadow-lg shadow-gold-500/30">
              <Coins className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Watch Ads & Earn Money
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                  Real UPI Cashout
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Watch 15-second ads, collect Royal Coins, and withdraw cash to Google Pay, PhonePe & Paytm
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-dark-300 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-center gap-2 font-bold animate-in slide-in-from-top-2 duration-200 shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-white/10 bg-dark-950/60 px-3 shrink-0 overflow-x-auto">
          {[
            { id: 'earn', label: '🎬 Watch & Earn', icon: Play },
            { id: 'withdraw', label: '💸 Withdraw Cash', icon: ArrowUpRight },
            { id: 'history', label: '📋 Payout History', icon: Clock },
            { id: 'info', label: 'ℹ️ How It Works', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-dark-400 hover:text-dark-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* TAB 1: EARN & WALLET */}
          {activeTab === 'earn' && (
            <div className="space-y-6">
              
              {/* Royal Wallet Balance Card */}
              <div className="relative rounded-3xl p-6 sm:p-7 overflow-hidden bg-gradient-to-br from-amber-600/25 via-dark-850 to-dark-950 border border-gold-500/40 shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Available Balance</span>
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl sm:text-4xl font-black text-white">
                        🪙 {coinsBalance.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-amber-300">Coins</span>
                    </div>
                    <p className="text-xs text-dark-300 mt-1 flex items-center gap-1.5">
                      <span>Equivalent Cash Value:</span>
                      <strong className="text-emerald-400 font-black text-sm">₹{cashBalance.toFixed(2)} INR</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('withdraw')}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-dark-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      <span>Withdraw to UPI</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={fetchWallet}
                      disabled={loadingWallet}
                      className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-dark-300 hover:text-white border border-white/10 transition-colors"
                      title="Refresh Wallet"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingWallet ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Daily Ad Progress Counter */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2 relative z-10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-300 font-semibold">Today's Ads Watched</span>
                    <span className="text-amber-300 font-bold font-mono">
                      {adsToday} / {dailyLimit} Ads ({remainingAds} remaining)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-dark-950 border border-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (adsToday / dailyLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Watch Rewarded Ad Action Hero */}
              <div className="p-6 rounded-3xl bg-dark-950/70 border border-gold-500/25 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                <div className="space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                      Rewarded Video
                    </span>
                    <span className="text-xs text-emerald-400 font-extrabold">+50 Coins (₹0.50) Per Ad</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Watch 15-Second Sponsored Ad
                  </h3>
                  <p className="text-xs text-dark-300 max-w-md leading-relaxed">
                    Watch a short sponsor creative without skipping to immediately earn 50 Royal Coins. You can watch up to 20 ads per day!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAdPlayerOpen(true)}
                  disabled={remainingAds <= 0 || claimingAdReward}
                  className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all shrink-0 cursor-pointer ${
                    remainingAds > 0
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 shadow-gold-500/30 scale-102 hover:scale-105 active:scale-95'
                      : 'bg-dark-800 text-dark-500 cursor-not-allowed opacity-60 border border-white/10'
                  }`}
                >
                  <Play className="w-4 h-4 fill-dark-950" />
                  <span>{remainingAds > 0 ? 'Watch Video Ad (+50 🪙)' : 'Limit Reached for Today'}</span>
                </button>
              </div>

              {/* 7-Day Login Streak Bonus */}
              <div className="p-6 rounded-3xl bg-dark-950/70 border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center">
                      <Flame className="w-4 h-4 fill-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Daily Login Streak Bonus</h4>
                      <p className="text-[11px] text-dark-400">Claim free bonus coins every day without watching ads</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClaimStreak}
                    disabled={!wallet?.can_claim_streak || claimingStreak}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      wallet?.can_claim_streak
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md hover:scale-105'
                        : 'bg-white/5 text-dark-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    {claimingStreak
                      ? 'Claiming...'
                      : wallet?.can_claim_streak
                      ? 'Claim Today\'s Bonus'
                      : '✓ Claimed Today'}
                  </button>
                </div>

                {streakMessage && (
                  <p className="text-xs text-amber-300 font-bold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    {streakMessage}
                  </p>
                )}

                {/* 7 Days Streak Track */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {[20, 40, 60, 80, 100, 150, 250].map((coins, idx) => {
                    const dayNum = idx + 1;
                    const isPassed = (wallet?.streak_days || 1) >= dayNum;
                    const isCurrent = (wallet?.streak_days || 1) === dayNum;

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl text-center border transition-all ${
                          isCurrent
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 scale-105 shadow-md'
                            : isPassed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-white/5 border-white/5 text-dark-400'
                        }`}
                      >
                        <span className="text-[10px] block font-bold text-dark-400">D{dayNum}</span>
                        <span className="text-xs sm:text-sm font-black block mt-0.5">+{coins}</span>
                        <span className="text-[8px] uppercase tracking-wider font-semibold block text-dark-500">
                          {dayNum === 7 ? '🎁 JACKPOT' : '🪙'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: WITHDRAW CASH (UPI) */}
          {activeTab === 'withdraw' && (
            <div className="space-y-6">
              
              {/* Wallet Summary Bar */}
              <div className="p-4 rounded-2xl bg-dark-950/80 border border-gold-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-dark-400 font-semibold">Your Balance</span>
                  <div className="text-xl font-black text-white">
                    🪙 {coinsBalance.toLocaleString()} Coins
                    <span className="text-emerald-400 text-sm ml-2 font-bold">≈ ₹{cashBalance.toFixed(2)} INR</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-amber-300 font-bold block">100 Coins = ₹1.00</span>
                  <span className="text-[10px] text-dark-500">Min. Payout: ₹10.00</span>
                </div>
              </div>

              {/* Withdrawal Form */}
              <form onSubmit={handleRequestPayout} className="space-y-4">
                
                {payoutMessage && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                      payoutMessage.type === 'success'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {payoutMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{payoutMessage.text}</span>
                  </div>
                )}

                {/* Amount Quick Selector */}
                <div>
                  <label className="text-xs font-bold text-dark-300 block mb-2">
                    Select Amount to Withdraw (INR)
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 25, 50, 100, 200].map((amt) => {
                      const isSelected = withdrawAmount === amt;
                      const hasEnough = coinsBalance >= amt * 100;

                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setWithdrawAmount(amt)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black shadow-md'
                              : hasEnough
                              ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                              : 'bg-white/5 border-white/5 text-dark-500 opacity-60'
                          }`}
                        >
                          <span className="text-xs font-bold block">₹{amt}</span>
                          <span className="text-[9px] text-dark-400 block">{amt * 100} Coins</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* UPI ID Field */}
                <div>
                  <label className="text-xs font-bold text-dark-300 block mb-1.5">
                    UPI ID (Google Pay / PhonePe / Paytm) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. 9876543210@okaxis or name@paytm"
                      className="w-full bg-dark-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                      required
                    />
                    <Smartphone className="w-4 h-4 text-dark-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-[10px] text-dark-400 mt-1">
                    Payments are transferred directly to your bank account via UPI.
                  </p>
                </div>

                {/* Account Holder Name */}
                <div>
                  <label className="text-xs font-bold text-dark-300 block mb-1.5">
                    Full Name (As registered in Bank / UPI)
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Karthik A"
                    className="w-full bg-dark-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                {/* Submit Cashout Button */}
                <button
                  type="submit"
                  disabled={submittingPayout || coinsBalance < withdrawAmount * 100}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                    coinsBalance >= withdrawAmount * 100
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 hover:from-emerald-400 hover:to-teal-300 text-dark-950 shadow-emerald-500/25 active:scale-98'
                      : 'bg-dark-800 text-dark-500 cursor-not-allowed opacity-60 border border-white/10'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {submittingPayout
                      ? 'Processing Request...'
                      : `Request Instant Cashout of ₹${withdrawAmount.toFixed(2)}`}
                  </span>
                </button>
              </form>

              {/* Safety & Time Guarantee */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs text-dark-300">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-white block">100% Guaranteed Safe Payouts</span>
                  <p className="leading-relaxed text-[11px]">
                    Withdrawal requests are processed within 2 to 24 hours. If any issue occurs with your UPI ID, your coins will be automatically refunded back to your wallet.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAYOUT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white">Your Withdrawal Requests</h4>
                <button
                  type="button"
                  onClick={fetchWallet}
                  className="text-xs text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {payouts.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <Clock className="w-8 h-8 text-dark-500 mx-auto" />
                  <p className="text-xs text-dark-400">No withdrawal requests yet.</p>
                  <p className="text-[11px] text-dark-500">
                    Watch ads to earn at least 1,000 Coins (₹10.00) to make your first withdrawal!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {payouts.map((p) => {
                    const isPending = p.status === 'pending';
                    const isCompleted = p.status === 'completed';
                    const isRejected = p.status === 'rejected';

                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-2xl bg-dark-950/80 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white">
                              ₹{Number(p.amount_inr).toFixed(2)}
                            </span>
                            <span className="text-xs text-dark-400 font-mono">
                              ({p.coins_redeemed} Coins)
                            </span>
                          </div>
                          <div className="text-[11px] text-dark-400 font-mono">
                            UPI: <strong className="text-amber-300">{p.upi_id}</strong>
                            {p.transaction_ref && (
                              <span className="ml-2 text-emerald-400">Ref: {p.transaction_ref}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-dark-500 block">
                            {new Date(p.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          {isPending && (
                            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span>Pending</span>
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Paid ✅</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                              Refunded ❌
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HOW IT WORKS / FAQ */}
          {activeTab === 'info' && (
            <div className="space-y-4 text-xs text-dark-300 leading-relaxed">
              <div className="p-5 rounded-2xl bg-dark-950/80 border border-gold-500/30 space-y-3">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>How Nexus Royal Rewards Works</span>
                </h4>
                <ul className="space-y-2 list-disc list-inside text-dark-200">
                  <li><strong>Coin Rate:</strong> 100 Royal Coins = <strong>₹1.00 INR</strong>.</li>
                  <li><strong>Earn per Ad:</strong> Each 15-second rewarded video gives you <strong>+50 Coins (₹0.50)</strong>.</li>
                  <li><strong>Daily Limit:</strong> You can watch up to <strong>20 Ads per day</strong> (₹10.00 daily potential earnings).</li>
                  <li><strong>Daily Streak:</strong> Log in every day to claim up to <strong>+250 Coins Jackpot</strong> on Day 7.</li>
                  <li><strong>Minimum Cashout:</strong> ₹10.00 (1,000 Coins).</li>
                  <li><strong>Supported Methods:</strong> Google Pay, PhonePe, Paytm UPI, and all bank UPI handles.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  💼 How does Nexus Royal pay you?
                </h4>
                <p>
                  Nexus Royal partners with verified advertisers and brands. When you watch their short sponsored videos, our platform receives advertising revenue, and we share that revenue directly with you in real cash!
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Rewarded Video Ad Player Overlay */}
      <RewardedAdPlayer
        isOpen={isAdPlayerOpen}
        onClose={() => setIsAdPlayerOpen(false)}
        onAdCompleted={handleAdCompleted}
        coinsReward={50}
        cashReward={0.50}
      />
    </div>
  );
};
