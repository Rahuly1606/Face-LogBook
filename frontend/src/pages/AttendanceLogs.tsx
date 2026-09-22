import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Download, Filter, Search, Loader2, History, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { attendanceApi, groupApi, AttendanceRecord, Group } from '@/services/api';
import { PageHeader } from '@/components/layout/PageHeader';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

function StatusBadge({ status }: { status: string }) {
    if (status === 'present') {
        return <Badge variant="success"><CheckCircle2 className="h-3 w-3" />On Time</Badge>;
    }
    if (status === 'late') {
        return <Badge variant="warning"><Clock className="h-3 w-3" />Late</Badge>;
    }
    if (status === 'absent') {
        return <Badge variant="destructive"><XCircle className="h-3 w-3" />Absent</Badge>;
    }
    return <Badge variant="muted">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export default function AttendanceLogs() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [filters, setFilters] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        groupId: 'all',
        searchQuery: '',
    });

    useEffect(() => {
        loadGroups();
        loadAttendance();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await groupApi.getAll();
            setGroups(data);
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    };

    const loadAttendance = async () => {
        setLoading(true);
        try {
            let result;
            if (filters.groupId && filters.groupId !== 'all') {
                result = await attendanceApi.getByGroup(parseInt(filters.groupId), filters.startDate, filters.endDate);
            } else if (filters.startDate === filters.endDate) {
                result = await attendanceApi.getByDate(filters.startDate);
            } else {
                result = await attendanceApi.getByDateRange(filters.startDate, filters.endDate);
            }
            setAttendance(result.attendance || []);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to load attendance logs',
                variant: 'destructive',
            });
            setAttendance([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredAttendance = attendance.filter((record) => {
        if (!filters.searchQuery) return true;
        const query = filters.searchQuery.toLowerCase();
        const recordName = (record as any).name || record.student_name || '';
        return (
            record.student_id?.toLowerCase().includes(query) ||
            recordName.toLowerCase().includes(query) ||
            record.group_name?.toLowerCase().includes(query)
        );
    });

    const handleExport = () => {
        if (filteredAttendance.length === 0) {
            toast({
                title: 'No Data',
                description: 'No attendance records to export',
                variant: 'destructive',
            });
            return;
        }

        // Create CSV content
        const headers = ['Student ID', 'Student Name', 'Group', 'Date', 'Status', 'In Time', 'Out Time', 'Confidence'];
        const rows = filteredAttendance.map((record) => {
            const status = record.status || (record.in_time ? 'present' : 'absent');
            const statusLabel = status === 'present' ? 'On Time' : status === 'late' ? 'Late' : status === 'absent' ? 'Absent' : status.charAt(0).toUpperCase() + status.slice(1);
            return [
                record.student_id,
                (record as any).name || record.student_name || 'N/A',
                record.group_name || 'N/A',
                record.date,
                statusLabel,
                record.in_time ? new Date(record.in_time).toLocaleTimeString() : '-',
                record.out_time ? new Date(record.out_time).toLocaleTimeString() : '-',
                record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A',
            ];
        });

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${filters.startDate}_to_${filters.endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
            title: 'Success',
            description: 'Attendance logs exported successfully',
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Attendance Logs"
                description="View, filter and export attendance records"
                icon={History}
                actions={
                    <Button
                        onClick={handleExport}
                        variant="outline"
                        disabled={filteredAttendance.length === 0}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                }
            />

            {/* Filters */}
            <Card className="p-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="group">Filter by Group</Label>
                        <Select value={filters.groupId} onValueChange={(value) => setFilters({ ...filters, groupId: value })}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Groups" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Groups</SelectItem>
                                {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id.toString()}>
                                        {group.name} ({group.id})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="Student ID or Name"
                                value={filters.searchQuery}
                                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={loadAttendance} disabled={loading} variant="accent">
                        {loading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                        ) : (
                            <><Filter className="h-4 w-4" />Apply Filters</>
                        )}
                    </Button>
                </div>
            </Card>

            {/* Results */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h2 className="text-base font-semibold text-foreground">Records</h2>
                    <Badge variant="secondary" className="tnum">{filteredAttendance.length}</Badge>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    </div>
                ) : filteredAttendance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Calendar className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No records found</h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Try adjusting your date range, group, or search filters.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Group</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>In Time</TableHead>
                                    <TableHead>Out Time</TableHead>
                                    <TableHead className="text-right">Confidence</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAttendance.map((record) => {
                                    const status = record.status || (record.in_time ? 'present' : 'absent');
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-mono text-foreground">{record.student_id}</TableCell>
                                            <TableCell className="font-medium text-foreground">{(record as any).name || record.student_name || 'N/A'}</TableCell>
                                            <TableCell className="text-muted-foreground">{record.group_name || '—'}</TableCell>
                                            <TableCell className="text-muted-foreground tnum">{record.date}</TableCell>
                                            <TableCell><StatusBadge status={status} /></TableCell>
                                            <TableCell className="text-muted-foreground tnum">
                                                {record.in_time ? new Date(record.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground tnum">
                                                {record.out_time ? new Date(record.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {record.confidence ? (
                                                    <span className="font-semibold tnum text-success">
                                                        {(record.confidence * 100).toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </div>
    );
}
