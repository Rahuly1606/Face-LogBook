import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import StudentTable from '@/components/StudentTable';
import { getStudents, deleteStudent, Student } from '@/api/students';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ManageStudents: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const data = await getStudents();
        setStudents(data?.students || []);
      } catch (error) {
        console.error("Error fetching students:", error);
        toast({
          title: "Error",
          description: "Failed to fetch students. The server might be down.",
          variant: "destructive",
        });
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [refreshTrigger, toast]);

  const handleDelete = async (student: Student) => {
    // A simple confirmation dialog
    if (window.confirm(`Are you sure you want to delete ${student.name}? This action cannot be undone.`)) {
        try {
          await deleteStudent(student.student_id);
          toast({
            title: "Success",
            description: "Student deleted successfully.",
          });
          setRefreshTrigger(prev => prev + 1); // Refresh the table
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to delete the student.",
            variant: "destructive",
          });
        }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Manage Students
          </h1>
          <p className="text-muted-foreground mt-2">
            View, edit, or delete student records from the system.
          </p>
        </div>
        <Button size="lg" className="gap-2 w-full md:w-auto" onClick={() => navigate('/admin/register')}>
          <Plus className="h-5 w-5" />
          Register New Student
        </Button>
      </header>

      <main>
        <Card>
            <CardHeader>
                <CardTitle>All Students</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading 
                    ? <div className="text-center py-12">Loading students...</div>
                    : <StudentTable 
                        students={students}
                        refreshTrigger={refreshTrigger}
                        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
                      />
                }
            </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ManageStudents;