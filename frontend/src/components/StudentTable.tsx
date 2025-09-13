import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, UserPlus, RefreshCw, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { getStudentsByGroup, deleteStudent, updateStudent, Student } from '@/api/students';
import { useToast } from '@/hooks/use-toast';
import StudentForm from './StudentForm';
import CSVBulkImport from './CSVBulkImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StudentTableProps {
  groupId?: number;
  students?: Student[];
  refreshTrigger?: number;
  onUpdate?: () => void;
  onDelete?: (student: Student) => void;
  onEdit?: (student: Student) => void;
}

const StudentTable: React.FC<StudentTableProps> = ({ 
  groupId, 
  students: propStudents,
  refreshTrigger = 0,
  onUpdate,
  onDelete,
  onEdit
}) => {
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [isLoading, setIsLoading] = useState(!propStudents);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');
  const { toast } = useToast();

  // Only fetch students if groupId is provided and propStudents is not
  useEffect(() => {
    if (propStudents) {
      setStudents(propStudents);
      setIsLoading(false);
      return;
    }
    
    if (!groupId) return;
    
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching students for group:', groupId);
        const response = await getStudentsByGroup(groupId);
        console.log('Students data received:', response);
        
        if (response && Array.isArray(response.students)) {
          // Validate each student object to ensure it has the required fields
          const validStudents = response.students.filter(student => 
            student && typeof student === 'object' && student.student_id && student.name
          );
          
          if (validStudents.length !== response.students.length) {
            console.warn('Some student objects were invalid and filtered out');
          }
          
          setStudents(validStudents);
        } else {
          console.warn('Unexpected students data format:', response);
          setStudents([]);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        toast({
          title: 'Error',
          description: 'Failed to load students. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [groupId, refreshTrigger, propStudents, toast]);

  const handleEdit = (student: Student) => {
    if (onEdit) {
      onEdit(student);
    } else {
      setEditStudent(student);
      setShowEditDialog(true);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.name}?`)) {
      return;
    }

    try {
      await deleteStudent(student.student_id);
      
      // Update local state
      setStudents(students.filter(s => s.student_id !== student.student_id));
      
      toast({
        title: 'Student deleted',
        description: `${student.name} has been deleted successfully`,
      });
      
      if (onDelete) {
        onDelete(student);
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete student. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSuccess = () => {
    setShowEditDialog(false);
    toast({
      title: 'Student updated',
      description: 'Student information has been updated successfully',
    });
    
    // Refresh student list
    if (onUpdate) {
      onUpdate();
    } else {
      // Refresh locally
      setStudents(prevStudents => 
        prevStudents.map(s => s.student_id === editStudent?.student_id ? 
          { ...s, ...editStudent } : 
          s
        )
      );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Students in this Group</h2>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'import' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('import')}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Import
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'list' | 'import')}>
        <TabsContent value="list" className="space-y-4">
          <div className="flex justify-between items-center">
            {isLoading ? (
              <Button disabled>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">
                {students.length} student{students.length !== 1 ? 's' : ''} registered
              </div>
            )}
            <Button
              onClick={() => {
                setEditStudent(null);
                setShowEditDialog(true);
              }}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add Student
            </Button>
          </div>

          <div className="rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Photo</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Registered Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No students registered in this group yet
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.photo_url} alt={student.name} />
                          <AvatarFallback className="bg-primary/10">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{student.student_id}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        {student.created_at
                          ? new Date(student.created_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                            className="gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(student)}
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="import">
          <CSVBulkImport 
            groupId={groupId} 
            onSuccess={() => {
              setActiveTab('list');
              if (onUpdate) onUpdate();
            }} 
          />
        </TabsContent>
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
          </DialogHeader>
          <StudentForm 
            student={editStudent || undefined}
            groupId={groupId}
            onSuccess={handleUpdateSuccess}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentTable;