import { useState, useEffect } from 'react';
import { Users, FolderKanban, CheckCircle2, TrendingUp, Loader2 } from 'lucide-react';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your attendance overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents.toLocaleString()}
          change="Registered students"
          changeType="neutral"
          icon={Users}
          variant="dark"
        />
        <StatCard
          title="Total Groups"
          value={stats.totalGroups.toString()}
          change="Active groups"
          changeType="neutral"
          icon={FolderKanban}
          variant="dark"
        />
        <StatCard
          title="Today's Attendance"
          value={stats.todayAttendance.toLocaleString()}
          change={`${stats.attendanceRate.toFixed(1)}% attendance rate`}
          changeType={stats.attendanceRate > 80 ? "positive" : "neutral"}
          icon={CheckCircle2}
          variant="dark"
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats.attendanceRate.toFixed(1)}%`}
          change="Today's rate"
          changeType={stats.attendanceRate > 80 ? "positive" : "neutral"}
          icon={TrendingUp}
          variant="dark"
        />
      </div>

      {/* Recent Attendance */}
      <Card className="p-6 bg-card-light border-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Attendance</h2>
          <Button variant="ghost" size="sm" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>
        <div className="space-y-4">
          {recentAttendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No attendance records today</p>
            </div>
          ) : (
            recentAttendance.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-4 rounded-lg bg-background border border-border hover:border-accent transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{(record as any).name || record.student_name || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground">ID: {record.student_id}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {record.in_time ? new Date(record.in_time).toLocaleString() : 'Invalid Date'} • {record.group_name || 'No Group'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-success font-medium text-lg">
                    {record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 bg-gradient-to-br from-accent/20 to-accent/5 border-0 hover:shadow-glow transition-shadow cursor-pointer">
          <h3 className="font-semibold text-lg mb-2">Start Live Attendance</h3>
          <p className="text-sm text-muted-foreground">Begin a new attendance session with your webcam</p>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-success/20 to-success/5 border-0 hover:shadow-lg transition-shadow cursor-pointer">
          <h3 className="font-semibold text-lg mb-2">Upload Photo</h3>
          <p className="text-sm text-muted-foreground">Process attendance from a group photo</p>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-0 hover:shadow-lg transition-shadow cursor-pointer">
          <h3 className="font-semibold text-lg mb-2">Register Student</h3>
          <p className="text-sm text-muted-foreground">Add a new student to the system</p>
        </Card>
      </div>
    </div>
  );
}
