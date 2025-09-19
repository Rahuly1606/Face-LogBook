import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  Edit, 
  Trash2, 
  UserPlus, 
  RefreshCw, 
  FileSpreadsheet, 
  AlertTriangle, 
  Loader2, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { getStudentsByGroup, deleteStudent, updateStudent, Student, bulkDeleteStudents } from '@/api/students';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
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
  
  // New state for bulk deletion
  const [selectedStudents, setSelectedStudents] = useState<{ [key: string]: boolean }>({});
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const [deleteResults, setDeleteResults] = useState<{
    deleted: string[];
    failed: { id: string; reason: string }[];
  } | null>(null);
  
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

  // Bulk selection handlers
  const toggleSelectAll = () => {
    const newSelectAll = !isSelectAll;
    setIsSelectAll(newSelectAll);
    
    const newSelectedStudents = { ...selectedStudents };
    students.forEach(student => {
      newSelectedStudents[student.student_id] = newSelectAll;
    });
    
    setSelectedStudents(newSelectedStudents);
  };
  
  const toggleSelectStudent = (studentId: string) => {
    const newSelectedStudents = { 
      ...selectedStudents, 
      [studentId]: !selectedStudents[studentId] 
    };
    
    setSelectedStudents(newSelectedStudents);
    
    // Check if all are selected to update the selectAll state
    const allSelected = students.every(student => 
      newSelectedStudents[student.student_id]
    );
    
    setIsSelectAll(allSelected);
  };

  // Get the list of selected student IDs
  const getSelectedStudentIds = (): string[] => {
    return Object.entries(selectedStudents)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id);
  };

  // Count selected students
  const selectedCount = Object.values(selectedStudents).filter(Boolean).length;

  // Handle bulk delete confirmation
  const confirmBulkDelete = () => {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) return;
    
    setShowDeleteConfirmDialog(true);
  };
  
  // Execute bulk delete
  const executeBulkDelete = async () => {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
      setShowDeleteConfirmDialog(false);
      return;
    }
    
    setIsDeletingBulk(true);
    setBulkDeleteProgress({ current: 0, total: ids.length });
    
    try {
      const result = await bulkDeleteStudents(ids);
      
      // Update local state by removing deleted students
      setStudents(prevStudents => 
        prevStudents.filter(student => !result.deleted.includes(student.student_id))
      );
      
      // Reset selections
      setSelectedStudents({});
      setIsSelectAll(false);
      
      // Store results for display
      setDeleteResults(result);
      
      // Show success toast
      toast({
        title: 'Students deleted',
        description: `Successfully deleted ${result.deleted.length} students${
          result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
        }`,
        variant: result.failed.length > 0 ? 'destructive' : 'default',
      });
      
      // Trigger parent update if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
      toast({
        title: 'Bulk delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete students',
        variant: 'destructive'
      });
    } finally {
      setIsDeletingBulk(false);
      setShowDeleteConfirmDialog(false);
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

  // Reset delete results when closing the dialog
  const handleCloseDeleteResults = () => {
    setDeleteResults(null);
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

      {/* Show action bar when students are selected */}
      {selectedCount > 0 && (
        <div className="bg-muted p-3 rounded-lg flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="font-medium">
            {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected
          </div>
          <Button 
            variant="destructive" 
            onClick={confirmBulkDelete}
            className="flex items-center gap-2"
            disabled={isDeletingBulk}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
        </div>
      )}

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
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={isSelectAll && students.length > 0}
                      onCheckedChange={toggleSelectAll}
                      disabled={isLoading || students.length === 0}
                      aria-label="Select all students"
                    />
                  </TableHead>
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
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No students registered in this group yet
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <Checkbox 
                          checked={!!selectedStudents[student.student_id]}
                          onCheckedChange={() => toggleSelectStudent(student.student_id)}
                          aria-label={`Select ${student.name}`}
                        />
                      </TableCell>
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

      {/* Edit Student Dialog */}
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

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete {selectedCount} Student{selectedCount !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected students
              and remove their data from the system.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCount <= 10 && (
            <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
              <ul className="space-y-1">
                {students
                  .filter(student => selectedStudents[student.student_id])
                  .map(student => (
                    <li key={student.student_id} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>
                        <strong>{student.name}</strong> ({student.student_id})
                      </span>
                    </li>
                  ))
                }
              </ul>
            </div>
          )}

          {selectedCount > 10 && (
            <Alert variant="destructive" className="my-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                You are about to delete <strong>{selectedCount} students</strong>. 
                This is a large number of students and cannot be undone.
              </span>
            </Alert>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirmDialog(false)}
              disabled={isDeletingBulk}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeBulkDelete}
              disabled={isDeletingBulk}
              className="gap-2"
            >
              {isDeletingBulk ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting {bulkDeleteProgress.current}/{bulkDeleteProgress.total}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Results Dialog */}
      <Dialog open={!!deleteResults} onOpenChange={handleCloseDeleteResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete Results</DialogTitle>
          </DialogHeader>
          
          {deleteResults && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{deleteResults.deleted.length} Successfully Deleted</span>
                </div>
                {deleteResults.failed.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="font-medium">{deleteResults.failed.length} Failed</span>
                  </div>
                )}
              </div>
              
              {deleteResults.failed.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Failed Deletions</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deleteResults.failed.map((failure) => (
                        <TableRow key={failure.id}>
                          <TableCell>{failure.id}</TableCell>
                          <TableCell>{failure.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={handleCloseDeleteResults}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentTable;