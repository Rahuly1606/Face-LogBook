import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAttendanceByGroup, AttendanceRecord } from '@/api/attendance';
import { RefreshCw, Download, Calendar, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GroupAttendanceTableProps {
  groupId: number;
}

const GroupAttendanceTable: React.FC<GroupAttendanceTableProps> = ({ groupId }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [studentFilter, setStudentFilter] = useState<string>('');
  const { toast } = useToast();

  const fetchAttendance = useCallback(async () => {
    if (!groupId) return;
    
    setIsLoading(true);
    try {
      // Call the API with filters
      console.log(`Fetching attendance records for group ${groupId}`);
      const response = await getAttendanceByGroup(groupId);
      console.log('Attendance response:', response);
      setRecords(response.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load attendance records. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [groupId, dateFrom, dateTo, studentFilter, toast]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const getStatusBadge = (status: string) => {
    const variants: any = {
      present: 'default',
      late: 'secondary',
      absent: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_group_${groupId}_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearch = () => {
    fetchAttendance();
  };

  const filteredRecords = records.filter(record => {
    if (studentFilter && !record.student_id.includes(studentFilter) && 
        !(record.name || record.student_name || '').toLowerCase().includes(studentFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Attendance Logs</h2>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="space-y-2 flex-1">
          <Label htmlFor="dateFrom">From Date</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        
        <div className="space-y-2 flex-1">
          <Label htmlFor="dateTo">To Date</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        
        <div className="space-y-2 flex-1">
          <Label htmlFor="studentFilter">Student Filter</Label>
          <div className="flex gap-2">
            <Input
              id="studentFilter"
              placeholder="ID or Name"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
            />
            <Button onClick={handleSearch} className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm text-muted-foreground">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
          </span>
        </div>
        <Button onClick={handleExportCsv} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No attendance records found. Take attendance using the webcam or upload a group photo.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record, index) => (
                <TableRow key={record.id || index}>
                  <TableCell className="font-medium">{record.student_id}</TableCell>
                  <TableCell>{record.name || record.student_name || '-'}</TableCell>
                  <TableCell>{record.date ? new Date(record.date).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    {record.in_time 
                      ? new Date(record.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {record.out_time 
                      ? new Date(record.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default GroupAttendanceTable;