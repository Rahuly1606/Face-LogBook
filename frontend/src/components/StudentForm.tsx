import React, { useState } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UploadPhoto from './UploadPhoto';
import { Student, addStudentToGroup, registerStudent } from '@/api/students';
import { useToast } from '@/hooks/use-toast';

interface StudentFormProps {
  student?: Student;
  groupId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const validationSchema = Yup.object({
  student_id: Yup.string()
    .required('Student ID is required')
    .matches(/^[A-Za-z0-9-]+$/, 'Student ID can only contain letters, numbers, and hyphens'),
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
});

const StudentForm: React.FC<StudentFormProps> = ({ 
  student, 
  groupId,
  onSuccess,
  onCancel,
  isSubmitting: externalSubmitting 
}) => {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driveLink, setDriveLink] = useState('');
  const [useImageUpload, setUseImageUpload] = useState(true);

  const initialValues = {
    student_id: student?.student_id || '',
    name: student?.name || '',
  };

  const handleSubmit = async (values: any) => {
    setIsLoading(true);
    let registrationSuccess = false;
    
    try {
      if (groupId) {
        console.log('Adding student to group:', groupId);
        // Add student to group
        await addStudentToGroup(groupId, {
          student_id: values.student_id,
          name: values.name,
          image: useImageUpload ? selectedImage : undefined,
          drive_link: !useImageUpload ? driveLink : undefined,
          group_id: groupId
        });
        registrationSuccess = true;
      } else {
        console.log('Using legacy registration path (no group ID)');
        // Fallback to legacy registration if no group ID
        await registerStudent({
          student_id: values.student_id,
          name: values.name,
          image: selectedImage
        });
        registrationSuccess = true;
      }
      
      toast({
        title: "Success",
        description: "Student registered successfully",
        variant: "default",
      });
      
    } catch (error: any) {
      console.error('Error registering student:', error);
      // Show error in a user-friendly way
      if (error.message && error.message.includes('already exists')) {
        toast({
          title: "Registration Error",
          description: `Student ID ${values.student_id} already exists. Please use a different ID.`,
          variant: "destructive",
        });
      } else if (error.message && error.message.includes('No face detected')) {
        toast({
          title: "Registration Error",
          description: "No face was detected in the uploaded image. Please try a clearer photo.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration Error",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      
      // Always call onSuccess after registration attempt, regardless of outcome
      // This allows the parent component to refresh the student list or navigate away
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting: formSubmitting }) => {
        // Use external isSubmitting state if provided, otherwise use form's internal state
        const submitting = externalSubmitting !== undefined ? externalSubmitting : formSubmitting || isLoading;
        
        return (
          <Form className="space-y-4">
            <div>
              <Label htmlFor="student_id">Student ID</Label>
              <Field
                as={Input}
                id="student_id"
                name="student_id"
                placeholder="e.g., STU001"
                disabled={!!student}
                className={errors.student_id && touched.student_id ? 'border-destructive' : ''}
              />
              {errors.student_id && touched.student_id && (
                <p className="text-sm text-destructive mt-1">{errors.student_id as string}</p>
              )}
            </div>

            <div>
              <Label htmlFor="name">Full Name</Label>
              <Field
                as={Input}
                id="name"
                name="name"
                placeholder="e.g., John Doe"
                className={errors.name && touched.name ? 'border-destructive' : ''}
              />
              {errors.name && touched.name && (
                <p className="text-sm text-destructive mt-1">{errors.name as string}</p>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <Button 
                type="button" 
                variant={useImageUpload ? "default" : "outline"}
                onClick={() => setUseImageUpload(true)}
              >
                Upload Image
              </Button>
              <Button 
                type="button" 
                variant={!useImageUpload ? "default" : "outline"}
                onClick={() => setUseImageUpload(false)}
              >
                Google Drive Link
              </Button>
            </div>

            {useImageUpload ? (
              <UploadPhoto
                onImageSelect={setSelectedImage}
                currentImage={student?.photo_url}
                label="Student Photo"
              />
            ) : (
              <div>
                <Label htmlFor="drive_link">Google Drive Link</Label>
                <Input
                  id="drive_link"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="e.g., https://drive.google.com/file/d/..."
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={submitting || (!student && useImageUpload && !selectedImage) || (!student && !useImageUpload && !driveLink)}
              >
                {submitting ? 'Saving...' : student ? 'Update' : 'Register'} Student
              </Button>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default StudentForm;