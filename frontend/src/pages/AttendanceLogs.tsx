import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Calendar as CalendarIcon, RotateCcw, Users, UserCheck, UserX, Clock } from 'lucide-react';
import AttendanceTable from '@/components/AttendanceTable';
import { getTodayAttendance, getAttendanceByDate, AttendanceRecord } from '@/api/attendance';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AttendanceLogs: React.FC = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    setRecords([]);
    try {
      const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const data = await getAttendanceByDate(dateStr);
      
      if (data && data.attendance) {
        setRecords(data.attendance);
      } else {
        toast({
          title: "No Records",
          description: "No attendance records found for the selected date.",
        });
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Error",
        description: "Failed to fetch attendance records.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetToToday = () => setSelectedDate(new Date());

  const handleExportCsv = () => {
    if (records.length === 0) {
      toast({ title: 'No Data', description: 'There is no data to export.' });
      return;
    }
    const headers = ['Student ID', 'Name', 'Date', 'Check In', 'Check Out', 'Status'];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [r.student_id, r.name, r.date, r.in_time, r.out_time, r.status].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'all_records';
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
  };

  const statItems = [
    { title: 'Total Students', value: stats.total, icon: Users, color: 'text-blue-500' },
    { title: 'Present', value: stats.present, icon: UserCheck, color: 'text-green-500' },
    { title: 'Absent', value: stats.absent, icon: UserX, color: 'text-red-500' },
    { title: 'Late', value: stats.late, icon: Clock, color: 'text-yellow-500' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Attendance Logs</h1>
          <p className="text-muted-foreground mt-1">Review and export daily attendance records.</p>
        </div>
        <div className="flex items-center gap-2">
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
            <Button variant="outline" size="icon" onClick={resetToToday} title="Reset to today">
                <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={handleExportCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
            </Button>
        </div>
      </header>

      {!isLoading && records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statItems.map(item => (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className={`h-4 w-4 text-muted-foreground ${item.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <main>
        <Card>
          <CardHeader>
            <CardTitle>
              Records for {selectedDate ? format(selectedDate, 'PPP') : 'Today'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading 
              ? <div className="text-center py-12">Loading records...</div>
              : <AttendanceTable records={records} />
            }
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AttendanceLogs;