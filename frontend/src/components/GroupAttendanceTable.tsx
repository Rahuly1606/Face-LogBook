import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getGroupAttendanceByDate, AttendanceRecord } from '@/api/attendance';
import { Download, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

interface GroupAttendanceTableProps {
  groupId: number;
}

const GroupAttendanceTable: React.FC<GroupAttendanceTableProps> = ({ groupId }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, groupId]);

  const fetchAttendance = async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      let data;
      if (!selectedDate) {
        // Default to today if no date selected
        const today = new Date();
        const dateStr = format(today, 'yyyy-MM-dd');
        data = await getGroupAttendanceByDate(groupId, dateStr);
      } else {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        data = await getGroupAttendanceByDate(groupId, dateStr);
      }
      
      if (data && data.attendance) {
        setRecords(data.attendance.map(record => ({
          ...record,
          // Ensure name is available by using either name or student_name field
          name: record.name || record.student_name,
          // Ensure date is available
          date: record.date || new Date().toISOString().split('T')[0]
        })));
      } else {
        // Handle empty data
        setRecords([]);
        toast({
          title: "Information",
          description: "No attendance records found for the selected date",
        });
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Error",
        description: "Failed to fetch attendance records. Server might be unreachable.",
        variant: "destructive",
      });
      // Set empty array to prevent UI errors
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const resetToToday = () => {
    setSelectedDate(new Date());
  };

  const getAttendanceStats = () => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    
    return { total, present, absent, late };
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      present: 'default',
      late: 'secondary',
      absent: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return '-';
    }
  };

  const handleExportCsv = () => {
    // Create CSV content
    const headers = ['Student ID', 'Name', 'Date', 'Check In', 'Check Out', 'Status'];
    const csvContent = [
      headers.join(','),
      ...records.map(record => [
        record.student_id,
        record.name || record.student_name || '',
        record.date,
        record.in_time || '',
        record.out_time || '',
        record.status
      ].join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_group_${groupId}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: "CSV file downloaded successfully",
    });
  };

  const stats = getAttendanceStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Attendance Logs</h2>
        <Button onClick={handleExportCsv} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 max-w-xs">
          <DatePicker
            date={selectedDate}
            setDate={setSelectedDate}
            placeholder="Filter by date"
          />
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={resetToToday}
          title="Reset to today"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Attendance Statistics */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Students</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <div className="text-sm text-muted-foreground">Present</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <div className="text-sm text-muted-foreground">Absent</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <div className="text-sm text-muted-foreground">Late</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No attendance records found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.student_id}</TableCell>
                    <TableCell>{record.name || record.student_name}</TableCell>
                    <TableCell>{record.date ? new Date(record.date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{formatTime(record.in_time)}</TableCell>
                    <TableCell>{formatTime(record.out_time)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default GroupAttendanceTable;