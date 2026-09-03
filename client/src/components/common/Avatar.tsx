import React from 'react';
import { Sparkles, Crown } from 'lucide-react';
import { SubscriptionPlanId } from '../../types';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  planId?: SubscriptionPlanId;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
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
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-3',
    '2xl': 'w-5 h-5 ring-4',
  };

  const badgeSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
    '2xl': 'w-8 h-8',
  };

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover ring-1 ring-white/10 shadow-inner bg-dark-800`}
          onError={(e) => {
            // fallback to initials on broken image
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr from-brand-600 to-accent-violet text-white font-bold flex items-center justify-center shadow-inner`}
        >
          {getInitials(name || 'Nexus')}
        </div>
      )}

      {/* Online indicator */}
      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSizes[size]} rounded-full ring-dark-950 ${
            isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-dark-600'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}

      {/* Subscription tier badge icon */}
      {planId === 'vip' && (
        <div
          className={`absolute -top-1 -right-1 ${badgeSizes[size]} rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 text-dark-950 shadow-md flex items-center justify-center ring-1 ring-dark-950`}
          title="VIP Member"
        >
          <Crown className="w-full h-full fill-dark-950" />
        </div>
      )}
      {planId === 'pro' && (
        <div
          className={`absolute -top-1 -right-1 ${badgeSizes[size]} rounded-full bg-gradient-to-tr from-brand-500 to-accent-violet p-0.5 text-white shadow-md flex items-center justify-center ring-1 ring-dark-950`}
          title="Pro Member"
        >
          <Sparkles className="w-full h-full fill-white" />
        </div>
      )}
    </div>
  );
};
