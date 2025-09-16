import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import StudentForm from '@/components/StudentForm';
import { registerStudent } from '@/api/students';
import { useToast } from '@/hooks/use-toast';

const RegisterStudent: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSuccess = () => {
      toast({
        title: "Success!",
        description: "Student has been registered successfully.",
      });
      // Navigate to the main student list after successful registration
      navigate('/admin/students');
  };
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-2xl">
      <header className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/students')}
          className="pl-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Students
        </Button>
      </header>
      
      <main>
        <StudentForm 
          onSuccess={handleSuccess} 
          onCancel={() => navigate('/admin/students')}
        />
      </main>
    </div>
  );
};

export default RegisterStudent;