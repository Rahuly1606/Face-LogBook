import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Download, Filter, Search, Loader2 } from 'lucide-react';
import { attendanceApi, groupApi, AttendanceRecord, Group } from '@/services/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

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
            <div>
                <h1 className="text-3xl font-bold">Attendance Logs</h1>
                <p className="text-muted-foreground mt-1">View and export attendance records</p>
            </div>

            {/* Filters */}
            <Card className="p-6 bg-card-light border-0">
                <div className="grid gap-4 md:grid-cols-4">
                    <div>
                        <Label htmlFor="startDate" className="text-foreground font-medium">Start Date</Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="text-foreground"
                        />
                    </div>
                    <div>
                        <Label htmlFor="endDate" className="text-foreground font-medium">End Date</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="text-foreground"
                        />
                    </div>
                    <div>
                        <Label htmlFor="group" className="text-foreground font-medium">Filter by Group</Label>
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
                    <div>
                        <Label htmlFor="search" className="text-foreground font-medium">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                            <Input
                                id="search"
                                placeholder="Student ID or Name"
                                value={filters.searchQuery}
                                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                                className="pl-9 text-foreground"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 mt-4">
                    <Button onClick={loadAttendance} disabled={loading} className="bg-accent hover:bg-accent/90 text-black font-semibold">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <Filter className="mr-2 h-4 w-4" />
                                Apply Filters
                            </>
                        )}
                    </Button>
                    <Button onClick={handleExport} variant="outline" disabled={filteredAttendance.length === 0} className="text-black border-black hover:bg-black/10 font-semibold">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </Card>

            {/* Results */}
            <Card className="p-6 bg-card-dark border-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        Attendance Records ({filteredAttendance.length})
                    </h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    </div>
                ) : filteredAttendance.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No attendance records found</p>
                        <p className="text-sm mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-foreground font-semibold">Student ID</TableHead>
                                    <TableHead className="text-foreground font-semibold">Name</TableHead>
                                    <TableHead className="text-foreground font-semibold">Group</TableHead>
                                    <TableHead className="text-foreground font-semibold">Date</TableHead>
                                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                                    <TableHead className="text-foreground font-semibold">In Time</TableHead>
                                    <TableHead className="text-foreground font-semibold">Out Time</TableHead>
                                    <TableHead className="text-right text-foreground font-semibold">Confidence</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAttendance.map((record) => {
                                    const status = record.status || (record.in_time ? 'present' : 'absent');
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-mono text-foreground">{record.student_id}</TableCell>
                                            <TableCell className="font-medium text-foreground">{(record as any).name || record.student_name || 'N/A'}</TableCell>
                                            <TableCell className="text-foreground">{record.group_name || 'N/A'}</TableCell>
                                            <TableCell className="text-foreground">{record.date}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status === 'present'
                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                    : status === 'absent'
                                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                                        : status === 'late'
                                                            ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                                            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                    }`}>
                                                    {status === 'present' ? '✅ On Time'
                                                        : status === 'late' ? '⏰ Late'
                                                            : status === 'absent' ? '❌ Absent'
                                                                : status.charAt(0).toUpperCase() + status.slice(1)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {record.in_time ? new Date(record.in_time).toLocaleTimeString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {record.out_time ? new Date(record.out_time).toLocaleTimeString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {record.confidence ? (
                                                    <span className="text-success font-medium">
                                                        {(record.confidence * 100).toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-foreground">N/A</span>
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
