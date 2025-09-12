import apiClient from './apiClient';

export interface Student {
  id?: number;
  student_id: string;
  name: string;
  photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegisterStudentData {
  student_id: string;
  name: string;
  image: File;
}

export interface UpdateStudentData {
  student_id?: string;
  name?: string;
  image?: File;
}

// Register a new student
export const registerStudent = async (data: RegisterStudentData) => {
  const formData = new FormData();
  formData.append('student_id', data.student_id);
  formData.append('name', data.name);
  formData.append('image', data.image);
  
  // Log formData contents for debugging (in development only)
  if (import.meta.env.DEV) {
    console.log('Registering student with form data:', {
      student_id: data.student_id,
      name: data.name,
      imageFile: data.image.name,
      imageSize: data.image.size,
      imageType: data.image.type
    });
  }

  // Use the fixed API client that doesn't set Content-Type by default
  const response = await apiClient.post('/students/register', formData, {
    headers: {
      // Let the browser set the Content-Type with the proper boundary for FormData
      'Content-Type': undefined
    },
  });
  return response.data;
};

// Get all students
export const getStudents = async (): Promise<{ students: Student[] }> => {
  try {
    const response = await apiClient.get('/students');
    return response.data;
  } catch (error) {
    console.error('Error fetching students:', error);
    // Return a fallback response to prevent UI errors
    return { students: [] };
  }
};

// Get a single student
export const getStudent = async (id: string): Promise<Student | null> => {
  try {
    const response = await apiClient.get(`/students/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching student ${id}:`, error);
    return null;
  }
};

// Update a student
export const updateStudent = async (id: string, data: UpdateStudentData) => {
  const formData = new FormData();
  
  if (data.student_id) formData.append('student_id', data.student_id);
  if (data.name) formData.append('name', data.name);
  if (data.image) formData.append('image', data.image);

  const response = await apiClient.put(`/students/${id}`, formData, {
    headers: {
      // Let the browser set the Content-Type with the proper boundary for FormData
      'Content-Type': undefined
    },
  });
  return response.data;
};

// Delete a student
export const deleteStudent = async (id: string) => {
  const response = await apiClient.delete(`/students/${id}`);
  return response.data;
};