import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  Video,
  Upload,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { studentApi, groupApi, attendanceApi, AttendanceRecord } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface GroupStat {
  name: string;
  attendance: number;
  total: number;
  rate: number;
}

const CHART = {
  bar: 'hsl(214 90% 50%)',
  present: 'hsl(142 62% 42%)',
  remaining: 'hsl(214 16% 88%)',
};

export default function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalGroups: 0,
    todayAttendance: 0,
    attendanceRate: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [groupStats, setGroupStats] = useState<GroupStat[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [studentsData, groupsData, attendanceData] = await Promise.all([
        studentApi.getAll().catch(() => ({ students: [] })),
        groupApi.getAll().catch(() => []),
        attendanceApi.getToday().catch(() => ({ attendance: [] })),
      ]);

      const students = studentsData.students || [];
      const records = attendanceData.attendance || [];
      const totalStudents = students.length;
      const totalGroups = groupsData.length;
      const presentRecords = records.filter((r: AttendanceRecord) => r.status === 'present');
      const todayAttendance = presentRecords.length;
      const attendanceRate = totalStudents > 0 ? (todayAttendance / totalStudents) * 100 : 0;

      setStats({ totalStudents, totalGroups, todayAttendance, attendanceRate });
      setRecentAttendance([...presentRecords].reverse().slice(0, 6));

      // Real per-group attendance derived from actual students + today's records.
      const computed: GroupStat[] = groupsData
        .map((group) => {
          const groupStudents = students.filter((s) => {
            if (s.group_id === group.id) return true;
            return s.groups?.some((g) => g.id === group.id) ?? false;
          });
          const studentIds = new Set(groupStudents.map((s) => s.student_id));
          const attendance = presentRecords.filter((r: AttendanceRecord) =>
            studentIds.has(r.student_id),
          ).length;
          const total = groupStudents.length;
          return {
            name: group.name || 'Unknown',
            attendance,
            total,
            rate: total > 0 ? (attendance / total) * 100 : 0,
          };
        })
        .filter((g) => g.total > 0)
        .sort((a, b) => b.rate - a.rate);

      setGroupStats(computed);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) return <DashboardSkeleton />;

  const notPresent = Math.max(stats.totalStudents - stats.todayAttendance, 0);
  const donutData = [
    { name: 'Present', value: stats.todayAttendance, fill: CHART.present },
    { name: 'Not yet', value: notPresent, fill: CHART.remaining },
  ];
  const topGroups = groupStats.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Attendance overview for ${today}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/attendance/upload')}>
              <Upload className="h-4 w-4" />
              Upload Photo
            </Button>
            <Button variant="accent" onClick={() => navigate('/attendance/live')}>
              <Video className="h-4 w-4" />
              Live Attendance
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents.toLocaleString()}
          change="Registered"
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Total Groups"
          value={stats.totalGroups.toString()}
          change="Active sections"
          icon={FolderKanban}
          tone="accent"
        />
        <StatCard
          title="Present Today"
          value={stats.todayAttendance.toLocaleString()}
          change={`of ${stats.totalStudents} students`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats.attendanceRate.toFixed(1)}%`}
          change={stats.attendanceRate >= 80 ? 'On track today' : 'Below target'}
          changeType={stats.attendanceRate >= 80 ? 'positive' : 'neutral'}
          icon={TrendingUp}
          tone="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance by group */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Attendance by Group</h2>
              <p className="text-sm text-muted-foreground">Present vs. registered, today</p>
            </div>
            <Award className="h-5 w-5 text-muted-foreground" />
          </div>
          {topGroups.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No group data yet"
              hint="Register students into groups to see attendance breakdowns."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topGroups}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke="hsl(214 16% 92%)" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: 'hsl(215 14% 42%)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: 'hsl(220 18% 20%)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    cursor={{ fill: 'hsl(214 16% 95%)' }}
                    contentStyle={tooltipStyle}
                    formatter={(value: number, _n, p: any) => [
                      `${value.toFixed(0)}%  (${p.payload.attendance}/${p.payload.total})`,
                      'Attendance',
                    ]}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18} background={{ fill: 'hsl(214 16% 96%)', radius: 4 } as any}>
                    {topGroups.map((g, i) => (
                      <Cell
                        key={i}
                        fill={g.rate >= 80 ? CHART.present : g.rate >= 50 ? CHART.bar : 'hsl(38 92% 50%)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Today's split donut */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Today's Coverage</h2>
            <p className="text-sm text-muted-foreground">Present vs. remaining</p>
          </div>
          {stats.totalStudents === 0 ? (
            <EmptyState icon={Users} title="No students yet" hint="Register students to begin." />
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="hsl(0 0% 100%)"
                      strokeWidth={2}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tnum">{stats.attendanceRate.toFixed(0)}%</span>
                  <span className="text-xs text-muted-foreground">present</span>
                </div>
              </div>
              <div className="mt-2 flex w-full items-center justify-center gap-5 text-sm">
                <LegendDot color={CHART.present} label="Present" value={stats.todayAttendance} />
                <LegendDot color={CHART.remaining} label="Not yet" value={notPresent} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent attendance */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h2 className="text-base font-semibold">Recent Check-ins</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Today
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/attendance/logs')}>
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {recentAttendance.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No check-ins today"
            hint="Start a live session or upload a photo to mark attendance."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentAttendance.map((record) => {
              const name = (record as any).name || record.student_name || 'Unknown';
              const confidence = record.confidence ? record.confidence * 100 : null;
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-base font-semibold text-accent-foreground">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{record.student_id}</span>
                      {record.in_time && (
                        <>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          {new Date(record.in_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {confidence !== null && (
                    <span
                      className={`shrink-0 text-sm font-semibold tnum ${
                        confidence >= 90
                          ? 'text-success'
                          : confidence >= 75
                            ? 'text-info'
                            : 'text-warning-foreground'
                      }`}
                    >
                      {confidence.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid hsl(214 16% 89%)',
  boxShadow: '0 4px 12px -2px hsl(220 20% 20% / 0.12)',
  fontSize: 12,
} as const;

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground tnum">{value}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Users;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
