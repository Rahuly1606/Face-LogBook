import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AttendanceRecord } from '@/api/attendance';
import { cn } from '@/lib/utils';
import { Clock, UserX, History } from 'lucide-react';
import EventLogModal from './EventLogModal';
import { getStudentEvents, getStudentEventPairs, CameraEvent, CameraEventPair } from '@/api/camera-events';
import { useToast } from '@/components/ui/use-toast';

interface AttendanceTableProps {
  records: AttendanceRecord[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ records }) => {
  const { toast } = useToast();
  const [isEventLogOpen, setIsEventLogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    date: string;
    eventPairs: CameraEventPair[];
    rawEvents: CameraEvent[];
  } | null>(null);

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      present: 'bg-green-100 text-green-800 border-green-200',
      late: 'bg-amber-100 text-amber-800 border-amber-200',
      absent: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
      <Badge
        variant="outline"
        className={cn("font-semibold capitalize", statusStyles[status] || 'bg-gray-100 text-gray-800')}
      >
        {status}
      </Badge>
    );
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return <span className="text-muted-foreground">-</span>;
    try {
      return new Date(timeString).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata' // Explicitly use IST timezone
      });
    } catch {
      return <span className="text-muted-foreground">Invalid</span>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Asia/Kolkata' // Explicitly use IST timezone
    });
  };

  const handleViewEvents = async (record: AttendanceRecord) => {
    if (!record.student_id || !record.date) {
      toast({
        title: "Error",
        description: "Missing student ID or date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch both raw events and event pairs in parallel
      const [rawEventsResponse, eventPairsResponse] = await Promise.all([
        getStudentEvents(record.student_id, record.date),
        getStudentEventPairs(record.student_id, record.date)
      ]);

      setSelectedStudent({
        id: record.student_id,
        name: record.name || record.student_name || '',
        date: record.date,
        eventPairs: eventPairsResponse.event_pairs,
        rawEvents: rawEventsResponse.events
      });
      setIsEventLogOpen(true);
    } catch (error) {
      console.error("Error fetching event data:", error);
      toast({
        title: "Error",
        description: "Failed to load event data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[120px]">Check In</TableHead>
                <TableHead className="w-[120px]">Check Out</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <UserX className="h-10 w-10" />
                      <p className="font-semibold text-lg">No Records Found</p>
                      <p className="text-sm">There are no attendance records to display.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm text-muted-foreground">{record.student_id}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{record.name || record.student_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatTime(record.in_time)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatTime(record.out_time)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEvents(record)}
                        disabled={loading}
                        title="View In/Out Events"
                      >
                        <History className="h-4 w-4 mr-1" />
                        Events
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedStudent && (
        <EventLogModal
          isOpen={isEventLogOpen}
          onClose={() => setIsEventLogOpen(false)}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          date={selectedStudent.date}
          eventPairs={selectedStudent.eventPairs}
          rawEvents={selectedStudent.rawEvents}
        />
      )}
    </>
  );
};

export default AttendanceTable;