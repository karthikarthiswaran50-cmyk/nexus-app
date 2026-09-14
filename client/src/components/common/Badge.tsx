import { Sparkles } from 'lucide-react';
import { SubscriptionPlanId } from '../../types';

interface PlanBadgeProps {
  planId?: SubscriptionPlanId;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
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

  return (
    <span
      className={`inline-flex items-center font-extrabold rounded-full bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-amber-600/15 text-amber-300 border border-amber-400/30 shadow-xs tracking-wider uppercase ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Sparkles className={`${iconSizes[size]} text-amber-300`} />}
      <span>MEMBER</span>
    </span>
  );
};
