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

  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  // Clean avatar ring styling
  const ringStyle = 'ring-1 ring-gold-500/20 shadow-md';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {src && !hasError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          className={`${sizeClasses[size]} rounded-full object-cover shadow-xl bg-dark-900 ${ringStyle}`}
          onError={() => {
            setHasError(true);
          }}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr from-amber-600/90 via-amber-500 to-yellow-500 text-dark-950 font-extrabold flex items-center justify-center shadow-xl ${ringStyle}`}
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
    </div>
  );
};
