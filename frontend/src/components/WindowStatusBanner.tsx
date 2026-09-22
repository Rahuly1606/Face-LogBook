import { Clock, CheckCircle2, AlertTriangle, Lock, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WindowStatusResponse } from '@/services/api';

const STATUS = {
  on_time: {
    wrap: 'border-success/30 bg-success/8',
    icon: 'text-success',
    text: 'text-success',
    Icon: CheckCircle2,
    label: 'Window Open — On Time',
  },
  late: {
    wrap: 'border-warning/30 bg-warning/10',
    icon: 'text-warning-foreground',
    text: 'text-warning-foreground',
    Icon: AlertTriangle,
    label: 'Late Window — entries marked LATE',
  },
  early: {
    wrap: 'border-info/30 bg-info/8',
    icon: 'text-info',
    text: 'text-info',
    Icon: Clock,
    label: 'Window Not Open Yet',
  },
  rejected: {
    wrap: 'border-destructive/30 bg-destructive/8',
    icon: 'text-destructive',
    text: 'text-destructive',
    Icon: Ban,
    label: 'Late Entries Rejected',
  },
  closed: {
    wrap: 'border-destructive/30 bg-destructive/8',
    icon: 'text-destructive',
    text: 'text-destructive',
    Icon: Lock,
    label: 'Attendance Window Closed',
  },
} as const;

/** Shared attendance-window status banner used by Live + Upload pages. */
export function WindowStatusBanner({ windowStatus }: { windowStatus: WindowStatusResponse }) {
  const s = STATUS[windowStatus.status as keyof typeof STATUS] ?? STATUS.closed;
  const { Icon } = s;
  const w = windowStatus.window;

  return (
    <Card className={cn('border p-4', s.wrap)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className={cn('h-5 w-5 shrink-0', s.icon)} />
          <div>
            <p className={cn('text-sm font-semibold', s.text)}>{s.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{windowStatus.message}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground tnum sm:text-right">
          <span className="font-medium text-foreground">On-time:</span> {w.window_start}–{w.window_end}
          <span className="mx-1.5 text-border">|</span>
          <span className="font-medium text-foreground">Late until:</span> {w.late_end}
          <span className="mx-1.5 text-border">|</span>
          <span className="font-medium text-foreground">Now:</span> {w.current_time} IST
        </div>
      </div>
    </Card>
  );
}
