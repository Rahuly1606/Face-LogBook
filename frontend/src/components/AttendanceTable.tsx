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

  return (
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
                <TableCell>{record.in_time || '-'}</TableCell>
                <TableCell>{record.out_time || '-'}</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AttendanceTable;