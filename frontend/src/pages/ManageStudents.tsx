import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import StudentTable from '@/components/StudentTable';
import { getStudents, deleteStudent, Student } from '@/api/students';
import { useToast } from '@/hooks/use-toast';

const ManageStudents: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await getStudents();
      if (data && data.students) {
        setStudents(data.students);
      } else {
        // Handle empty data
        setStudents([]);
        toast({
          title: "Warning",
          description: "No students data available",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Failed to fetch students. Server might be unreachable.",
        variant: "destructive",
      });
      // Set empty array to prevent UI errors
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`Delete student ${student.name}?`)) return;
    
    try {
      await deleteStudent(student.student_id);
      toast({
        title: "Success",
        description: "Student deleted successfully",
      });
      fetchStudents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete student",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manage Students</h1>
        <Button onClick={() => navigate('/admin/register')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <StudentTable 
          students={students} 
          onEdit={() => {}} 
          onDelete={handleDelete} 
        />
      )}
    </div>
  );
};

export default ManageStudents;