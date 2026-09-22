import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  /** dark = ink surface w/ accent icon; default = white surface w/ tinted icon */
  variant?: 'default' | 'dark';
  /** accent color of the icon chip on the default variant */
  tone?: 'accent' | 'success' | 'info' | 'warning';
  className?: string;
}

const toneMap = {
  accent: 'bg-accent/15 text-accent-foreground',
  success: 'bg-success/12 text-success',
  info: 'bg-info/12 text-info',
  warning: 'bg-warning/15 text-warning-foreground',
} as const;

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  variant = 'default',
  tone = 'accent',
  className,
}: StatCardProps) {
  const isDark = variant === 'dark';
  const TrendIcon = changeType === 'positive' ? TrendingUp : changeType === 'negative' ? TrendingDown : null;

  return (
    <Card
      style={isDark ? { background: 'var(--gradient-dark)' } : undefined}
      className={cn(
        'group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        isDark && 'border-transparent text-white',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', isDark ? 'text-white/60' : 'text-muted-foreground')}>
            {title}
          </p>
          <h3 className={cn('mt-2 text-3xl font-bold tracking-tight tnum', isDark ? 'text-white' : 'text-foreground')}>
            {value}
          </h3>
          {change && (
            <p
              className={cn(
                'mt-2 flex items-center gap-1 text-xs font-medium',
                changeType === 'positive' && 'text-success',
                changeType === 'negative' && 'text-destructive',
                changeType === 'neutral' && (isDark ? 'text-white/50' : 'text-muted-foreground'),
              )}
            >
              {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
              {change}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
            isDark ? 'bg-white/10 text-accent' : toneMap[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
