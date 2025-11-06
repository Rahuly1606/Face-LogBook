import { useState, useEffect } from 'react';
import { Users, FolderKanban, CheckCircle2, TrendingUp, Loader2, Calendar, Clock, Award, Activity, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { studentApi, groupApi, attendanceApi, AttendanceRecord } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalGroups: 0,
    todayAttendance: 0,
    attendanceRate: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; rate: number; count: number }[]>([]);
  const [topGroups, setTopGroups] = useState<{ name: string; attendance: number; total: number }[]>([]);

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

      const totalStudents = studentsData.students?.length || 0;
      const totalGroups = groupsData.length || 0;
      // Count only students with status 'present' 
      const todayAttendance = attendanceData.attendance?.filter((record: any) => record.status === 'present').length || 0;
      const attendanceRate = totalStudents > 0 ? (todayAttendance / totalStudents) * 100 : 0;

      setStats({
        totalStudents,
        totalGroups,
        todayAttendance,
        attendanceRate,
      });

      // Get last 5 attendance records that are present (not absent)
      const presentRecords = attendanceData.attendance?.filter((record: any) => record.status === 'present') || [];
      setRecentAttendance(presentRecords.slice(0, 5));

      // Generate weekly data (mock data for visualization)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekly = days.map((day, index) => ({
        day,
        rate: Math.max(60, Math.min(100, attendanceRate + (Math.random() * 20 - 10))),
        count: Math.floor(totalStudents * (0.6 + Math.random() * 0.4))
      }));
      setWeeklyData(weekly);

      // Calculate top groups by attendance
      const groupStats = groupsData.map((group: any) => {
        const groupStudents = studentsData.students?.filter((s: any) => s.group_id === group.id) || [];

        // Debug: log group info
        console.log('Group:', group.name, 'Students:', groupStudents.length);

        // Count attendance by matching student_id (string) from attendance with student id or student_id
        const groupAttendance = attendanceData.attendance?.filter((a: any) => {
          if (a.status !== 'present') return false;

          // Try to match attendance record with group students
          // Check both a.student_id (string like "OSE001") and numeric IDs
          const matched = groupStudents.some((s: any) => {
            // Match by student_id (string identifier like "OSE001")
            if (a.student_id && s.student_id && a.student_id === s.student_id) {
              return true;
            }
            // Match by numeric id
            if (a.student_id && s.id && String(a.student_id) === String(s.id)) {
              return true;
            }
            return false;
          });

          if (matched) {
            console.log('Matched attendance:', a.student_id, 'to group:', group.name);
          }

          return matched;
        }).length || 0;

        console.log('Group attendance count:', groupAttendance);

        return {
          name: group.name || 'Unknown',
          attendance: groupAttendance,
          total: groupStudents.length
        };
      }).sort((a: any, b: any) => (b.attendance / b.total || 0) - (a.attendance / a.total || 0)).slice(0, 3);

      setTopGroups(groupStats);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with greeting */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-accent/20 via-primary/10 to-success/20 p-6 border border-accent/20">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-accent" />
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Welcome back! Here's your attendance overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-accent/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Stats Grid with enhanced animations */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-in slide-in-from-left duration-300">
          <StatCard
            title="Total Students"
            value={stats.totalStudents.toLocaleString()}
            change="Registered students"
            changeType="neutral"
            icon={Users}
            variant="dark"
          />
        </div>
        <div className="animate-in slide-in-from-left duration-500">
          <StatCard
            title="Total Groups"
            value={stats.totalGroups.toString()}
            change="Active groups"
            changeType="neutral"
            icon={FolderKanban}
            variant="dark"
          />
        </div>
        <div className="animate-in slide-in-from-right duration-500">
          <StatCard
            title="Today's Attendance"
            value={stats.todayAttendance.toLocaleString()}
            change={`${stats.attendanceRate.toFixed(1)}% attendance rate`}
            changeType={stats.attendanceRate > 80 ? "positive" : "neutral"}
            icon={CheckCircle2}
            variant="dark"
          />
        </div>
        <div className="animate-in slide-in-from-right duration-300">
          <StatCard
            title="Attendance Rate"
            value={`${stats.attendanceRate.toFixed(1)}%`}
            change="Today's rate"
            changeType={stats.attendanceRate > 80 ? "positive" : "neutral"}
            icon={TrendingUp}
            variant="dark"
          />
        </div>
      </div>

      {/* Top Performing Groups */}
      <Card className="p-6 bg-card-light border-0 shadow-lg animate-in slide-in-from-bottom duration-700">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-5 h-5 text-yellow-500" />
          <h2 className="text-xl font-semibold">Top Groups</h2>
        </div>
        <div className="space-y-4">
          {topGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No group data available</p>
            </div>
          ) : (
            topGroups.map((group, index) => {
              const rate = group.total > 0 ? (group.attendance / group.total) * 100 : 0;
              const medals = ['🥇', '🥈', '🥉'];

              return (
                <div
                  key={group.name}
                  className="relative overflow-hidden p-4 rounded-lg bg-gradient-to-br from-background to-accent/5 border border-border hover:border-accent transition-all duration-200 hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{medals[index]}</span>
                        <h3 className="font-semibold text-foreground">{group.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {group.attendance} / {group.total} students
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${rate >= 90 ? 'text-green-500' :
                        rate >= 75 ? 'text-blue-500' :
                          'text-yellow-500'
                        }`}>
                        {rate.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-1000"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Recent Attendance - Enhanced */}
      <Card className="p-6 bg-card-light border-0 shadow-lg animate-in slide-in-from-bottom duration-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h2 className="text-xl font-semibold">Recent Attendance</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 inline mr-1" />
              Today
            </span>
          </div>
        </div>
        <div className="space-y-3">
          {recentAttendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No attendance records today</p>
              <p className="text-sm mt-1">Start marking attendance to see records here</p>
            </div>
          ) : (
            recentAttendance.map((record, index) => (
              <div
                key={record.id}
                className="group flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-background to-accent/5 border border-border hover:border-accent transition-all duration-200 animate-in slide-in-from-left"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-105 transition-transform duration-200">
                    {((record as any).name || record.student_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg">
                      {(record as any).name || record.student_name || 'Unknown'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground">ID: {record.student_id}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{record.group_name || 'No Group'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {record.in_time ? new Date(record.in_time).toLocaleTimeString() : 'Invalid Time'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <div className={`text-2xl font-bold ${(record.confidence || 0) >= 0.9 ? 'text-green-500' :
                      (record.confidence || 0) >= 0.75 ? 'text-blue-500' :
                        'text-yellow-500'
                      }`}>
                      {record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
