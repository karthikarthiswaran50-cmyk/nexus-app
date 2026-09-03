import React from 'react';
import { Crown, Sparkles, Shield } from 'lucide-react';
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
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  if (planId === 'vip') {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10 ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <Crown className={`${iconSizes[size]} text-amber-400 fill-amber-400`} />}
        VIP
      </span>
    );
  }

  if (planId === 'pro') {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-gradient-to-r from-brand-500/20 via-indigo-500/20 to-accent-violet/20 text-indigo-300 border border-brand-500/40 shadow-sm shadow-brand-500/10 ${sizeClasses[size]} ${className}`}
      >
        {showIcon && <Sparkles className={`${iconSizes[size]} text-brand-400`} />}
        PRO
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full bg-dark-800 text-dark-400 border border-dark-700 ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Shield className={`${iconSizes[size]} text-dark-400`} />}
      Starter
    </span>
  );
};
