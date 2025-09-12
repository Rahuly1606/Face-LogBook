import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Calendar, RotateCcw } from 'lucide-react';
import AttendanceTable from '@/components/AttendanceTable';
import { getTodayAttendance, getAttendanceByDate, AttendanceRecord } from '@/api/attendance';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

const AttendanceLogs: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let data;
      if (!selectedDate) {
        data = await getTodayAttendance();
      } else {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        data = await getAttendanceByDate(dateStr);
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

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Attendance Logs</h1>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <AttendanceTable records={records} />
      )}
    </div>
  );
};

export default AttendanceLogs;