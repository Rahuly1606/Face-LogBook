import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getGroupAttendanceByDate, AttendanceRecord } from '@/api/attendance';
import { Download, RotateCcw, Calendar as CalendarIcon, Loader2, User, UserCheck, UserX, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface GroupAttendanceTableProps {
  groupId: number;
}

const GroupAttendanceTable: React.FC<GroupAttendanceTableProps> = ({ groupId }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const fetchAttendance = useCallback(async () => {
    if (!groupId || !selectedDate) return;
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await getGroupAttendanceByDate(groupId, dateStr);
      setRecords(data.attendance || []);
      if (!data.attendance || data.attendance.length === 0) {
        toast({ title: "No Records", description: "No attendance found for the selected date." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch attendance records.", variant: "destructive" });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedDate, toast]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
    };
  }, [records]);

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      present: 'bg-green-100 text-green-800 border-green-200',
      late: 'bg-amber-100 text-amber-800 border-amber-200',
      absent: 'bg-red-100 text-red-800 border-red-200',
    };
    return <Badge variant="outline" className={cn("font-semibold capitalize", statusStyles[status])}>{status}</Badge>;
  };
  
  const formatTime = (timeString: string | null) => {
    if (!timeString) return <span className="text-muted-foreground">-</span>;
    return new Date(timeString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleExportCsv = () => {
    const headers = ['Student ID', 'Name', 'Date', 'Check In', 'Check Out', 'Status'];
    const csvContent = [headers.join(','), ...records.map(r => [r.student_id, `"${r.name || r.student_name}"`, r.date, formatTime(r.in_time), formatTime(r.out_time), r.status].join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_group_${groupId}_${format(selectedDate!, 'yyyy-MM-dd')}.csv`);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Successful", description: "Attendance log has been downloaded." });
  };

  const renderSkeleton = () => (
    <div className="rounded-lg border bg-card shadow-sm"><Table><TableHeader><TableRow>{[...Array(6)].map((_,i)=><TableHead key={i}><Skeleton className="h-5 w-24"/></TableHead>)}</TableRow></TableHeader><TableBody>{[...Array(5)].map((_,i)=><TableRow key={i}>{[...Array(6)].map((_,j)=><TableCell key={j}><Skeleton className="h-5 w-full"/></TableCell>)}</TableRow>)}</TableBody></Table></div>
  );

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle>Attendance Log</CardTitle>
        <CardDescription>Review and export daily attendance records for this group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(new Date())} title="Go to Today"><RotateCcw className="h-4 w-4" /></Button>
          </div>
          <Button onClick={handleExportCsv} variant="default" className="w-full sm:w-auto" disabled={records.length === 0}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={User} value={loading ? '...' : stats.total} label="Total Students" />
          <StatCard icon={UserCheck} value={loading ? '...' : stats.present} label="Present" />
          <StatCard icon={UserX} value={loading ? '...' : stats.absent} label="Absent" />
          <StatCard icon={Clock} value={loading ? '...' : stats.late} label="Late" />
        </div>

        {loading ? renderSkeleton() : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-48 text-muted-foreground">No records for this date.</TableCell></TableRow>
                ) : (records.map((record) => (
                  <TableRow key={record.id}><TableCell className="font-mono text-muted-foreground">{record.student_id}</TableCell><TableCell className="font-medium">{record.name}</TableCell><TableCell>{formatTime(record.in_time)}</TableCell><TableCell>{formatTime(record.out_time)}</TableCell><TableCell className="text-right">{getStatusBadge(record.status)}</TableCell></TableRow>
                )))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StatCard: React.FC<{ icon: React.ElementType, value: number | string, label: string }> = ({ icon: Icon, value, label }) => (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
        </div>
    </div>
);


export default GroupAttendanceTable;