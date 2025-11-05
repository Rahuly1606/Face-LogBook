import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { studentApi, Student } from '@/services/api';
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
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadStudents();
    }, []);

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

    const filteredStudents = students
        .filter((student) =>
            student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.student_id.toLowerCase().includes(searchQuery.toLowerCase())
        )
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

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Students</h1>
                    <p className="text-muted-foreground mt-1">Manage registered students</p>
                </div>
                <Button
                    onClick={() => navigate('/register')}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Register Student
                </Button>
            </div>

            {/* Search and Stats */}
            <Card className="p-4 bg-card-light border-0">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
                    {!loading && filteredStudents.length > 0 && (
                        <div className="text-sm text-muted-foreground whitespace-nowrap">
                            Showing {startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length}
                        </div>
                    )}
                </div>
            </Card>

            {/* Students Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
            ) : filteredStudents.length === 0 ? (
                <Card className="p-12 text-center bg-card-light border-0">
                    <p className="text-muted-foreground">
                        {students.length === 0 ? 'No students registered yet' : 'No students found matching your search'}
                    </p>
                    {students.length === 0 && (
                        <Button
                            onClick={() => navigate('/register')}
                            className="mt-4 bg-accent hover:bg-accent/90 text-black"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Register First Student
                        </Button>
                    )}
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {paginatedStudents.map((student) => (
                            <Card
                                key={student.student_id}
                                className="p-6 bg-card-dark text-card-foreground border-0 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-black">
                                        {student.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-lg truncate text-foreground">{student.name}</h3>
                                        <p className="text-sm text-muted-foreground truncate">{student.student_id}</p>
                                        {student.group_name && (
                                            <Badge variant="secondary" className="text-xs mt-2">
                                                {student.group_name}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-black hover:text-black border-black hover:bg-black/10"
                                        onClick={() => setDeleteId(student.student_id)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1 text-black" />
                                        Delete
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Card className="p-4 bg-card-light border-0">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="text-black border-black hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>

                                    {/* Page Numbers */}
                                    <div className="flex gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                            // Show first page, last page, current page, and pages around current
                                            const showPage =
                                                page === 1 ||
                                                page === totalPages ||
                                                (page >= currentPage - 1 && page <= currentPage + 1);

                                            const showEllipsis =
                                                (page === currentPage - 2 && currentPage > 3) ||
                                                (page === currentPage + 2 && currentPage < totalPages - 2);

                                            if (showEllipsis) {
                                                return (
                                                    <div key={page} className="px-2 py-1 text-muted-foreground">
                                                        ...
                                                    </div>
                                                );
                                            }

                                            if (!showPage) return null;

                                            return (
                                                <Button
                                                    key={page}
                                                    variant={currentPage === page ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => goToPage(page)}
                                                    className={
                                                        currentPage === page
                                                            ? "bg-accent hover:bg-accent/90 text-black font-semibold"
                                                            : "text-black border-black hover:bg-black/10"
                                                    }
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
                                        className="text-black border-black hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
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
        </div>
    );
}
