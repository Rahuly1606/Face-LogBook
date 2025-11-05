import { LucideIcon } from 'lucide-react';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  variant?: 'default' | 'dark';
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  variant = 'dark',
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'p-6 border-0 transition-all hover:shadow-lg',
        variant === 'dark' && 'bg-card text-card-foreground',
        variant === 'default' && 'bg-card-light text-card-light-foreground'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(
            'text-sm font-medium',
            variant === 'dark' ? 'text-gray-400' : 'text-muted-foreground'
          )}>
            {title}
          </p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
          {change && (
            <p
              className={cn(
                'text-sm mt-2 font-medium',
                changeType === 'positive' && 'text-success',
                changeType === 'negative' && 'text-destructive',
                changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div
          className={cn(
            'p-3 rounded-xl',
            variant === 'dark' ? 'bg-sidebar-accent' : 'bg-accent/10'
          )}
        >
          <Icon className={cn(
            'h-6 w-6',
            variant === 'dark' ? 'text-accent' : 'text-accent-foreground'
          )} />
        </div>
      </div>
    </Card>
  );
}
