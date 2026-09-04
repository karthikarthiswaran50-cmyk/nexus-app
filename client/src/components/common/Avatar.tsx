import React from 'react';
import { Sparkles, Crown } from 'lucide-react';
import { SubscriptionPlanId } from '../../types';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  isReachable?: boolean;
  showOnlineStatus?: boolean;
  planId?: SubscriptionPlanId;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  isReachable = false,
  showOnlineStatus = false,
  planId,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
    '2xl': 'w-28 h-28 text-3xl',
  };

  const statusDotSizes = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-2',
    md: 'w-3.5 h-3.5 ring-2',
    lg: 'w-4 h-4 ring-2',
    xl: 'w-5 h-5 ring-3',
    '2xl': 'w-6 h-6 ring-4',
  };

  const badgeSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
    '2xl': 'w-9 h-9',
  };

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Royal frame styling
  const ringStyle =
    planId === 'vip'
      ? 'ring-2 ring-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
      : planId === 'pro'
      ? 'ring-2 ring-brand-400/80 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
      : 'ring-1 ring-white/10';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover shadow-xl bg-dark-900 ${ringStyle}`}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full ${
            planId === 'vip'
              ? 'bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 text-dark-950 font-extrabold'
              : 'bg-gradient-to-tr from-brand-600 to-accent-violet text-white font-bold'
          } flex items-center justify-center shadow-xl ${ringStyle}`}
        >
          {getInitials(name || 'Nexus')}
        </div>
      )}

      {/* Online / Reachable indicator */}
      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSizes[size]} rounded-full ring-dark-950 ${
            isOnline
              ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse'
              : isReachable
              ? 'bg-amber-400 shadow-sm shadow-amber-400/80'
              : 'bg-dark-600'
          }`}
          title={isOnline ? 'Active Now' : isReachable ? 'Available on Mobile' : 'Offline'}
        />
      )}

      {/* Royal VIP Crown Badge */}
      {planId === 'vip' && (
        <div
          className={`absolute -top-1.5 -right-1.5 ${badgeSizes[size]} rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 p-0.5 text-dark-950 shadow-lg shadow-amber-500/30 flex items-center justify-center ring-2 ring-dark-950`}
          title="Imperial VIP Member"
        >
          <Crown className="w-full h-full fill-dark-950" />
        </div>
      )}

      {/* Pro Badge */}
      {planId === 'pro' && (
        <div
          className={`absolute -top-1.5 -right-1.5 ${badgeSizes[size]} rounded-full bg-gradient-to-tr from-brand-500 to-accent-violet p-0.5 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center ring-2 ring-dark-950`}
          title="Pro Member"
        >
          <Sparkles className="w-full h-full fill-white" />
        </div>
      )}
    </div>
  );
};
