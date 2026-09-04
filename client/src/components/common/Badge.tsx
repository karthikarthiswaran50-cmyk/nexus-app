import React from 'react';
import { Crown, Sparkles, Shield, Gem } from 'lucide-react';
import { SubscriptionPlanId } from '../../types';

interface PlanBadgeProps {
  planId?: SubscriptionPlanId;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  planId = 'free',
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  if (planId === 'vip') {
    return (
      <span
        className={`inline-flex items-center font-extrabold rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-600/25 text-amber-200 border border-amber-400/50 shadow-md shadow-amber-500/20 tracking-wider ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <Crown className={`${iconSizes[size]} text-amber-300 fill-amber-400 animate-pulse-subtle`} />}
        <span>IMPERIAL VIP</span>
      </span>
    );
  }

  if (planId === 'pro') {
    return (
      <span
        className={`inline-flex items-center font-bold rounded-full bg-gradient-to-r from-brand-500/25 via-indigo-400/20 to-accent-violet/25 text-brand-200 border border-brand-400/50 shadow-md shadow-brand-500/20 tracking-wide ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <Sparkles className={`${iconSizes[size]} text-brand-300`} />}
        <span>PRO</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full bg-dark-850 text-dark-300 border border-dark-700/80 shadow-xs ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Shield className={`${iconSizes[size]} text-dark-400`} />}
      <span>Starter</span>
    </span>
  );
};
