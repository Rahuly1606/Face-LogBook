import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { studentApi, Student, groupApi, Group } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STUDENTS_PER_PAGE = 12;

export default function Students() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadStudents();
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const groupsData = await groupApi.getAll();
            setGroups(groupsData || []);
        } catch (error: any) {
            console.error('Failed to load groups:', error);
        }
    };

    const loadStudents = async () => {
        setLoading(true);
        try {
            const data = await studentApi.getAll();
            setStudents(data.students || []);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to load students',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await studentApi.delete(id);
            toast({
                title: 'Success',
                description: 'Student deleted successfully',
            });
            loadStudents();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete student',
                variant: 'destructive',
            });
        }
        setDeleteId(null);
    };

    const handleBulkDelete = async () => {
        try {
            const idsArray = Array.from(selectedIds);
            await studentApi.bulkDelete(idsArray);
            toast({
                title: 'Success',
                description: `Successfully deleted ${idsArray.length} student${idsArray.length > 1 ? 's' : ''}`,
            });
            setSelectedIds(new Set());
            loadStudents();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete students',
                variant: 'destructive',
            });
        }
        setBulkDeleteMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedStudents.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(paginatedStudents.map(s => s.student_id));
            setSelectedIds(allIds);
        }
    };

    const toggleSelectStudent = (studentId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedIds(newSelected);
    };

    const filteredStudents = students
        .filter((student) => {
            // Filter by search query
            const matchesSearch =
                student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                student.student_id.toLowerCase().includes(searchQuery.toLowerCase());

            // Filter by group
            const matchesGroup = selectedGroupId === 'all' ||
                student.group_id?.toString() === selectedGroupId;

            return matchesSearch && matchesGroup;
        })
        .sort((a, b) => {
            const numA = parseInt(a.student_id);
            const numB = parseInt(b.student_id);
            return numA - numB;
        });

    // Pagination calculations
    const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
    const endIndex = startIndex + STUDENTS_PER_PAGE;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    // Reset to page 1 when search or group filter changes
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Clear selection when filter changes
    }, [searchQuery, selectedGroupId]);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Students"
                description="Manage registered students and their groups"
                icon={Users}
                actions={
                    <Button variant="accent" onClick={() => navigate('/register')}>
                        <Plus className="h-4 w-4" />
                        Register Student
                    </Button>
                }
            />

            {/* Search and Filters */}
            <Card className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="relative flex-1 w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by name or student ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Groups" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Groups</SelectItem>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Stats and Bulk Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                            {!loading && filteredStudents.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="select-all"
                                            checked={paginatedStudents.length > 0 && selectedIds.size === paginatedStudents.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                        <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                                            Select All
                                        </label>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Showing {startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length}
                                    </div>
                                </>
                            )}
                        </div>
                        {selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setBulkDeleteMode(true)}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Students Grid */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-xl" />
                    ))}
                </div>
            ) : filteredStudents.length === 0 ? (
                <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Users className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">
                        {students.length === 0 ? 'No students registered yet' : 'No matching students'}
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {students.length === 0
                            ? 'Register your first student to get started.'
                            : 'Try adjusting your search or group filter.'}
                    </p>
                    {students.length === 0 && (
                        <Button variant="accent" className="mt-5" onClick={() => navigate('/register')}>
                            <Plus className="h-4 w-4" />
                            Register First Student
                        </Button>
                    )}
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {paginatedStudents.map((student) => {
                            const selected = selectedIds.has(student.student_id);
                            return (
                                <Card
                                    key={student.student_id}
                                    className={`group p-5 transition-all duration-200 hover:shadow-md ${
                                        selected ? 'border-accent ring-1 ring-accent/40' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={selected}
                                            onCheckedChange={() => toggleSelectStudent(student.student_id)}
                                            className="mt-1"
                                            aria-label={`Select ${student.name}`}
                                        />
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xl font-bold text-accent-foreground">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-base font-semibold text-foreground">{student.name}</h3>
                                            <p className="truncate font-mono text-sm text-muted-foreground">{student.student_id}</p>
                                            {(student.groups && student.groups.length > 0) ? (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {student.groups.map((g) => (
                                                        <Badge key={g.id} variant="secondary" className="text-xs">
                                                            {g.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : student.group_name ? (
                                                <Badge variant="secondary" className="mt-2 text-xs">
                                                    {student.group_name}
                                                </Badge>
                                            ) : (
                                                <Badge variant="muted" className="mt-2 text-xs">No group</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2 border-t border-border pt-4">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => setDeleteId(student.student_id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Card className="p-3">
                            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                                <div className="text-sm text-muted-foreground">
                                    Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>

                                    {/* Page Numbers */}
                                    <div className="flex gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                            const showPage =
                                                page === 1 ||
                                                page === totalPages ||
                                                (page >= currentPage - 1 && page <= currentPage + 1);

                                            const showEllipsis =
                                                (page === currentPage - 2 && currentPage > 3) ||
                                                (page === currentPage + 2 && currentPage < totalPages - 2);

                                            if (showEllipsis) {
                                                return (
                                                    <div key={page} className="px-2 py-1 text-sm text-muted-foreground">
                                                        …
                                                    </div>
                                                );
                                            }

                                            if (!showPage) return null;

                                            return (
                                                <Button
                                                    key={page}
                                                    variant={currentPage === page ? 'accent' : 'ghost'}
                                                    size="icon"
                                                    className="h-9 w-9"
                                                    onClick={() => goToPage(page)}
                                                >
                                                    {page}
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the student
                            from the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && handleDelete(deleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirmation Dialog */}
            <AlertDialog open={bulkDeleteMode} onOpenChange={setBulkDeleteMode}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Multiple Students?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete {selectedIds.size} student{selectedIds.size > 1 ? 's' : ''} from the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete {selectedIds.size} Student{selectedIds.size > 1 ? 's' : ''}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
