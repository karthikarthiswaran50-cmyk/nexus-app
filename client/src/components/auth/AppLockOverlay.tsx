import React, { useState, useEffect } from 'react';
import { Crown, Lock, Delete, ShieldCheck } from 'lucide-react';

interface AppLockOverlayProps {
  onUnlock?: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({ onUnlock }) => {
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const pin = localStorage.getItem('nexus_app_pin');
    const unlocked = sessionStorage.getItem('nexus_app_unlocked');
    return Boolean(pin && pin.length === 4 && unlocked !== 'true');
  });

  const [enteredPin, setEnteredPin] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Listen for custom lock trigger event
    const handleLockTrigger = () => {
      sessionStorage.removeItem('nexus_app_unlocked');
      setEnteredPin('');
      setIsLocked(true);
    };

    window.addEventListener('nexus_lock_app', handleLockTrigger);
    return () => window.removeEventListener('nexus_lock_app', handleLockTrigger);
  }, []);

  if (!isLocked) return null;

  const correctPin = localStorage.getItem('nexus_app_pin') || '';

  const handleDigit = (digit: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    if (nextPin.length === 4) {
      if (nextPin === correctPin) {
        sessionStorage.setItem('nexus_app_unlocked', 'true');
        setIsLocked(false);
        onUnlock?.();
      } else {
        setIsError(true);
        setTimeout(() => {
          setEnteredPin('');
          setIsError(false);
        }, 600);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setEnteredPin('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-dark-950/98 backdrop-blur-3xl select-none font-['Plus_Jakarta_Sans',sans-serif] animate-in fade-in duration-300">
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
        
        {/* Crown & Lock Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-dark-950 shadow-2xl shadow-gold-500/30 animate-pulse">
            <Crown className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-dark-900 border border-gold-400 text-gold-300 shadow-md">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight">Nexus Royal Vault</h2>
          <p className="text-xs text-amber-200/80 font-medium">Enter your 4-digit PIN to access</p>
        </div>

        {/* 4 PIN Dots */}
        <div className={`flex items-center gap-4 py-2 ${isError ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = enteredPin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isError
                    ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] scale-110'
                    : isFilled
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_12px_#f59e0b] scale-110'
                    : 'bg-dark-800 border-2 border-dark-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {isError && (
          <p className="text-xs font-bold text-rose-400 animate-in fade-in">Incorrect PIN. Try again.</p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl bg-dark-900 hover:bg-gold-500/20 active:bg-gold-500 active:text-dark-950 active:scale-95 text-white text-xl font-black border border-gold-500/20 hover:border-gold-400 transition-all shadow-md flex items-center justify-center font-mono"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-dark-900/60 hover:bg-dark-850 text-dark-400 hover:text-white text-xs font-bold transition-all flex items-center justify-center"
          >
            Clear
          </button>

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-dark-900 hover:bg-gold-500/20 active:bg-gold-500 active:text-dark-950 active:scale-95 text-white text-xl font-black border border-gold-500/20 hover:border-gold-400 transition-all shadow-md flex items-center justify-center font-mono"
          >
            0
          </button>

          {/* Backspace Delete */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-dark-900/60 hover:bg-dark-850 text-dark-400 hover:text-white transition-all flex items-center justify-center"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4 flex items-center gap-1.5 text-[11px] text-dark-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted Local App Lock</span>
        </div>
      </div>
    </div>
  );
};
