import apiClient from './apiClient';
import api from './auth';  // Import the auth-enabled API client

export interface RecognizedStudent {
  student_id: string;
  name: string;
  group_id?: number;
  group_name?: string;
  score: number;
  action?: 'checkin' | 'checkout';
  timestamp?: string;
  bbox?: number[]; // Bounding box coordinates [x1, y1, x2, y2]
}

export interface UnrecognizedFace {
  id: string;
  bbox: number[]; // Bounding box coordinates [x1, y1, x2, y2]
  score: number;
}

export interface LiveAttendanceResponse {
  recognized: RecognizedStudent[];
  unrecognized_count: number;
  unrecognized_faces: UnrecognizedFace[];
  processing_time_ms: number;
  total_faces?: number;
  error?: boolean;
  errorMessage?: string;
}

export interface UploadAttendanceResponse {
  recognized: RecognizedStudent[];
  unrecognized_count: number;
  unrecognized_faces?: UnrecognizedFace[];
  processing_time_ms?: number;
  total_faces?: number;
}

export interface AttendanceRecord {
  id?: number;
  student_id: string;
  student_name?: string;
  name?: string;
  group_id?: number;
  group_name?: string;
  in_time: string;
  out_time?: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

export interface StudentStatus {
  student_id: string;
  name: string;
  group_id?: number;
  group_name?: string;
  in_time: string | null;
  out_time: string | null;
  status: 'present' | 'absent' | 'late';
  date: string;
}

export interface AllStudentsStatusResponse {
  date: string;
  students: StudentStatus[];
}

export interface EmbeddingDebugInfo {
  exists: boolean;
  shape?: number[];
  dtype?: string;
  min_value?: number;
  max_value?: number;
  norm?: number;
}

// Live attendance capture with improved error handling and timeout
export const submitLiveAttendance = async (imageBlob: Blob, retryCount = 0): Promise<LiveAttendanceResponse> => {
  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'capture.jpg');

    const response = await apiClient.post('/attendance/live', formData, {
      headers: {
        // Let the browser set the Content-Type with proper boundary
        'Content-Type': undefined
      },
      // Increase timeout for images with multiple faces
      timeout: 30000 // 30 seconds
    });
    return response.data;
  } catch (error: any) {
    console.error('Error submitting live attendance:', error);

    // Handle timeout errors specifically
    if (error.isTimeout) {
      console.warn('Processing timeout detected - likely due to many faces');
      return {
        recognized: [],
        unrecognized_count: 0,
        unrecognized_faces: [],
        processing_time_ms: 0,
        error: true,
        errorMessage: 'Processing timeout - too many faces or complex image'
      } as LiveAttendanceResponse;
    }

    // Implement automatic retry for network errors (max 1 retry)
    if (error.isNetworkError && retryCount < 1) {
      console.log(`Retrying live attendance (attempt ${retryCount + 1})...`);
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return submitLiveAttendance(imageBlob, retryCount + 1);
    }

    // Return a fallback response to prevent UI errors
    return {
      recognized: [],
      unrecognized_count: 0,
      unrecognized_faces: [],
      processing_time_ms: 0,
      error: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    } as LiveAttendanceResponse;
  }
};

// Upload group photo for attendance
export const uploadGroupAttendance = async (image: File): Promise<UploadAttendanceResponse> => {
  const formData = new FormData();
  formData.append('image', image);

  const response = await api.post('/attendance/upload', formData, {
    headers: {
      // Let the browser set the Content-Type with proper boundary
      'Content-Type': undefined
    },
    // Extended timeout for face processing (90 seconds)
    timeout: 90000
  });
  return response.data;
};

// Get today's attendance
export const getTodayAttendance = async (): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await api.get('/attendance/logs');
    return response.data;
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    // Return a fallback response to prevent UI errors
    return { attendance: [] };
  }
};

// Get attendance by group
export const getAttendanceByGroup = async (groupId: number): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await api.get(`/attendance/logs/${groupId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching attendance for group ${groupId}:`, error);
    // Return a fallback response to prevent UI errors
    return { attendance: [] };
  }
};

// Get attendance by group and specific date
export const getGroupAttendanceByDate = async (groupId: number, date: string): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await api.get(`/attendance/logs/${groupId}/date?date=${date}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching attendance for group ${groupId} on date ${date}:`, error);
    // Return a fallback response to prevent UI errors
    return { attendance: [] };
  }
};

// Get embedding debug info for a student
export const getEmbeddingDebugInfo = async (studentId: string): Promise<EmbeddingDebugInfo> => {
  try {
    const response = await api.get(`/attendance/debug/embeddings/${studentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching embedding debug info for student ${studentId}:`, error);
    // Return a fallback response
    return { exists: false };
  }
};

// Legacy endpoints for backward compatibility
// Get attendance by specific date
export const getAttendanceByDate = async (date: string): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await api.get(`/attendance/logs?date=${date}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching attendance for date ${date}:`, error);
    // Return a fallback response to prevent UI errors
    return { attendance: [] };
  }
};

// Get student attendance history
export const getStudentAttendance = async (studentId: string): Promise<{ attendance: AttendanceRecord[] }> => {
  const response = await apiClient.get(`/attendance/${studentId}`);
  return response.data;
};

// Get attendance by date range
export const getAttendanceByDateRange = async (startDate: string, endDate: string): Promise<{ attendance: AttendanceRecord[] }> => {
  const response = await apiClient.get('/attendance', {
    params: { start_date: startDate, end_date: endDate }
  });
  return response.data;
};

// Get all students with their current attendance status
export const getAllStudentsStatus = async (): Promise<AllStudentsStatusResponse> => {
  try {
    const response = await apiClient.get('/attendance/status/all');
    return response.data;
  } catch (error) {
    console.error('Error fetching student status:', error);
    // Return a fallback response to prevent UI errors
    return {
      date: new Date().toISOString().split('T')[0],
      students: []
    };
  }
};

// Manually reset daily attendance
export const resetDailyAttendance = async (): Promise<{ success: boolean; count: number }> => {
  const response = await apiClient.post('/attendance/reset/daily');
  return response.data;
};