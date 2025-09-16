import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AttendanceRecord } from '@/api/attendance';
import { cn } from '@/lib/utils';
import { Clock, UserX } from 'lucide-react';

interface AttendanceTableProps {
  records: AttendanceRecord[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ records }) => {

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
      return new Date(timeString).toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', hour12: true 
      });
    } catch {
      return <span className="text-muted-foreground">Invalid</span>;
    }
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  return (
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
              <TableHead className="w-[110px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
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
                  <TableCell className="text-right">{getStatusBadge(record.status)}</TableCell>
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