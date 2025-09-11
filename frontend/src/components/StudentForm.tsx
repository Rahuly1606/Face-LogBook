import React, { useState } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UploadPhoto from './UploadPhoto';
import { Student } from '@/api/students';

interface StudentFormProps {
  student?: Student;
  onSubmit: (values: any) => Promise<void>;
  onCancel: () => void;
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
  onSubmit, 
  onCancel, 
  isSubmitting: externalSubmitting 
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const initialValues = {
    student_id: student?.student_id || '',
    name: student?.name || '',
    adminToken: (typeof window !== 'undefined' && localStorage.getItem('adminToken')) || '',
  };

  const handleSubmit = async (values: any) => {
    const formData = {
      ...values,
      image: selectedImage,
    };
    await onSubmit(formData);
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting: formSubmitting }) => {
        // Use external isSubmitting state if provided, otherwise use form's internal state
        const submitting = externalSubmitting !== undefined ? externalSubmitting : formSubmitting;
        
        return (
          <Form className="space-y-4">
            {!student && (
              <div>
                <Label htmlFor="adminToken">Admin Token</Label>
                <Field
                  as={Input}
                  id="adminToken"
                  name="adminToken"
                  placeholder="Enter admin token"
                />
              </div>
            )}
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

            <UploadPhoto
              onImageSelect={setSelectedImage}
              currentImage={student?.photo_url}
              label="Student Photo"
            />

            {!student && !selectedImage && (
              <p className="text-sm text-destructive">Photo is required for new students</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || (!student && !selectedImage)}
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