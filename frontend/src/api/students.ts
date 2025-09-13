import apiClient from './apiClient';

export interface Student {
  id?: number;
  student_id: string;
  name: string;
  group_id?: number;
  group_name?: string;
  photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RegisterStudentData {
  student_id: string;
  name: string;
  image?: File;
  drive_link?: string;
  group_id?: number;
}

export interface UpdateStudentData {
  student_id?: string;
  name?: string;
  image?: File;
  drive_link?: string;
  group_id?: number;
}

export interface BulkImportSuccess {
  row: number;
  student_id: string;
  name: string;
}

export interface BulkImportFailure {
  row: number;
  student_id: string;
  reason_code: string;
  message: string;
}

// Enhanced interface to handle both the expected structure and the placeholder API response
export interface BulkImportResult {
  successes: BulkImportSuccess[];
  failures: BulkImportFailure[];
  // Additional fields for the placeholder API response
  success?: boolean;
  message?: string;
  group_id?: number;
}

// Register a new student (legacy API - keep for backward compatibility)
export const registerStudent = async (data: RegisterStudentData) => {
  const formData = new FormData();
  formData.append('student_id', data.student_id);
  formData.append('name', data.name);
  
  if (data.image) {
    formData.append('image', data.image);
  }
  
  // Log formData contents for debugging (in development only)
  if (import.meta.env.DEV) {
    console.log('Registering student with form data:', {
      student_id: data.student_id,
      name: data.name,
      imageFile: data.image ? data.image.name : 'No image'
    });
  }

  try {
    // Use the fixed API client that doesn't set Content-Type by default
    const response = await apiClient.post('/students/register', formData, {
      headers: {
        // Let the browser set the Content-Type with the proper boundary for FormData
        'Content-Type': undefined
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error in registerStudent:', error);
    
    // If the error has a response with data, return that to preserve the error messages
    if (error.response && error.response.data) {
      throw new Error(error.response.data.error || error.response.data.message || 'Registration failed');
    }
    
    // Otherwise throw a generic error
    throw new Error('Student registration failed. Please try again.');
  }
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

// Get students by group
export const getStudentsByGroup = async (groupId: number): Promise<{ students: Student[] }> => {
  try {
    console.log(`Fetching students for group ${groupId} from ${apiClient.defaults.baseURL}/groups/${groupId}/students`);
    const response = await apiClient.get(`/groups/${groupId}/students`);
    console.log('Response data:', response.data);
    
    // Ensure we always return the expected structure
    if (!response.data) {
      console.warn('No data in API response');
      return { students: [] };
    }
    
    // Check if the response has the expected structure
    if (response.data.students) {
      // This is the expected format, use it directly
      return response.data;
    } else if (response.data.group && Array.isArray(response.data.students)) {
      // This is also valid format with group info
      return { students: response.data.students };
    } else {
      // For any other format, log and return empty array
      console.warn('Unexpected API response format:', response.data);
      return { students: [] };
    }
  } catch (error) {
    console.error(`Error fetching students for group ${groupId}:`, error);
    return { students: [] };
  }
};

// Get a single student
export const getStudent = async (id: string): Promise<{ student: Student } | null> => {
  try {
    const response = await apiClient.get(`/students/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching student ${id}:`, error);
    return null;
  }
};

// Add a student to a group
export const addStudentToGroup = async (groupId: number, data: RegisterStudentData) => {
  const formData = new FormData();
  formData.append('student_id', data.student_id);
  formData.append('name', data.name);
  
  if (data.image) {
    formData.append('image', data.image);
  }
  
  if (data.drive_link) {
    formData.append('drive_link', data.drive_link);
  }
  
  try {
    const response = await apiClient.post(`/groups/${groupId}/students`, formData, {
      headers: {
        // Let the browser set the Content-Type with the proper boundary for FormData
        'Content-Type': undefined
      },
    });
    return response.data;
  } catch (error: any) {
    console.error(`Error adding student to group ${groupId}:`, error);
    
    // If the error has a response with data, return that to preserve the error messages
    if (error.response && error.response.data) {
      throw new Error(error.response.data.error || error.response.data.message || 'Registration failed');
    }
    
    // Otherwise throw a generic error
    throw new Error('Failed to add student to group. Please try again.');
  }
};

// Bulk import students to a group
export const bulkImportStudents = async (groupId: number, file: File): Promise<BulkImportResult> => {
  if (!groupId) {
    throw new Error('Invalid group ID. Please select a group before importing students.');
  }
  
  console.log(`Bulk importing students to group ${groupId}`);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // The correct endpoint is under the groups blueprint
    const response = await apiClient.post(`/groups/${groupId}/students/bulk`, formData, {
      headers: {
        // Let the browser set the Content-Type with the proper boundary for FormData
        'Content-Type': undefined
      },
    });
    return response.data;
  } catch (error) {
    console.error('Bulk import error:', error);
    throw error;
  }
};

// Update a student
export const updateStudent = async (id: string, data: UpdateStudentData) => {
  const formData = new FormData();
  
  if (data.student_id) formData.append('student_id', data.student_id);
  if (data.name) formData.append('name', data.name);
  if (data.image) formData.append('image', data.image);
  if (data.group_id) formData.append('group_id', data.group_id.toString());

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
