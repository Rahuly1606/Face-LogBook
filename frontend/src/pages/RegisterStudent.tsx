import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import StudentForm from '@/components/StudentForm';
import { registerStudent, getStudents } from '@/api/students';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const RegisterStudent: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: any) => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Store admin token for future use
      if (values.adminToken) {
        localStorage.setItem('adminToken', values.adminToken);
      }
      
      // Register the student
      const result = await registerStudent({
        student_id: values.student_id,
        name: values.name,
        image: values.image
      });
      
      // Show success message
      toast({
        title: "Success",
        description: "Student registered successfully",
      });
      
      // Refresh student list and navigate to management page
      try {
        await getStudents(); // Refresh the student list
      } catch (refreshError) {
        console.error("Failed to refresh student list", refreshError);
      }
      
      navigate('/admin/students');
    } catch (error: any) {
      // Handle specific error cases
      if (error.status === 400 && error.message.includes('No face detected')) {
        setError('No face detected in the image. Please upload a clear photo with a visible face.');
      } else if (error.isNetworkError) {
        setError('Cannot reach backend — check if the server is running and CORS is properly configured.');
      } else {
        setError(error.message || "Failed to register student");
      }
      
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register student",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => navigate('/admin/students')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
      </Button>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Registration Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">Register New Student</h1>
        <StudentForm 
          onSubmit={handleSubmit} 
          onCancel={() => navigate('/admin/students')} 
          isSubmitting={isSubmitting}
        />
      </Card>
    </div>
  );
};

export default RegisterStudent;
