import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AttendanceRecord } from '@/api/attendance';

interface AttendanceTableProps {
  records: AttendanceRecord[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ records }) => {
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

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <div className="min-w-[720px]">
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
                  <TableCell className="font-medium whitespace-nowrap">{record.student_id}</TableCell>
                  <TableCell className="whitespace-nowrap">{record.name || record.student_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{record.date ? new Date(record.date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatTime(record.in_time)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatTime(record.out_time)}</TableCell>
                  <TableCell className="whitespace-nowrap">{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AttendanceTable;