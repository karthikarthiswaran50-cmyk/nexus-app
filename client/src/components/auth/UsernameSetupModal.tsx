import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Crown, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({ isOpen, onClose }) => {
  const { user, claimUsername } = useAuth();
  const [usernameInput, setUsernameInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username) {
      // Suggest clean handle based on current username
      const clean = user.username.replace(/_[a-z0-9]{4}$/i, '');
      setUsernameInput(clean);
    }
  }, [user]);

  // Debounced real-time availability check
  useEffect(() => {
    const raw = usernameInput.trim().replace(/^@/, '').toLowerCase();

    if (!raw) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

    if (raw.length < 3) {
      setValidationError('Must be at least 3 characters');
      setIsAvailable(false);
      return;
    }

    if (raw.length > 25) {
      setValidationError('Must be at most 25 characters');
      setIsAvailable(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(raw)) {
      setValidationError('Only letters, numbers, and underscores are allowed');
      setIsAvailable(false);
      return;
    }

    // If matches user's current username
    if (user && raw === user.username.toLowerCase()) {
      setIsAvailable(true);
      setValidationError(null);
      return;
    }

    setValidationError(null);
    setIsChecking(true);

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/users/check-username/${encodeURIComponent(raw)}`);
        setIsAvailable(res.data.available);
        if (!res.data.available) {
          setValidationError('This username is already taken. Try another!');
        }
      } catch (e) {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameInput, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@/, '').toLowerCase();

    if (!clean || !isAvailable || validationError) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await claimUsername(clean);
      if (user?.id) {
        localStorage.setItem(`nexus_custom_username_set_${user.id}`, 'true');
      }
      if (onClose) onClose();
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to claim username. Please try another.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/90 backdrop-blur-2xl animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/35 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 royal-card space-y-6">
        
        {/* Glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 bg-gold-500/10 rounded-full blur-3xl" />

        {/* Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-xl shadow-gold-500/25">
            <Crown className="w-7 h-7 fill-dark-950" />
          </div>
          <h2 className="text-xl font-black text-white flex items-center justify-center gap-1.5">
            <span>Choose Your</span>
            <span className="gold-gradient-text">Unique Royal ID</span>
          </h2>
          <p className="text-xs text-dark-300 leading-relaxed">
            Create your personalized <strong>@username</strong> handle. Friends can search and find your profile on Nexus just like on Instagram.
          </p>
        </div>

        {submitError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-dark-300 mb-1.5">Your Unique Username Handle</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-400 font-black text-sm">
                @
              </div>
              <input
                type="text"
                required
                autoFocus
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="your_handle"
                className="w-full pl-9 pr-10 py-3 bg-dark-850 border border-gold-500/30 rounded-2xl text-sm font-bold text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400 transition-all font-mono shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                {isChecking && (
                  <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                )}
                {!isChecking && isAvailable === true && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {!isChecking && isAvailable === false && (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>

            {/* Validation Feedback */}
            <div className="mt-2 text-xs flex items-center justify-between min-h-[1.25rem]">
              {validationError ? (
                <span className="text-rose-400 font-semibold">{validationError}</span>
              ) : isAvailable === true ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  ✓ Available! This Royal ID is yours to claim.
                </span>
              ) : (
                <span className="text-dark-400 text-[11px]">3–25 chars (letters, numbers, underscores)</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !isAvailable || !!validationError}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-sm shadow-xl shadow-gold-500/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            <span>{submitting ? 'Claiming Identity...' : 'Confirm & Claim Royal ID'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
          </button>
        </form>

      </div>
    </div>
  );
};
