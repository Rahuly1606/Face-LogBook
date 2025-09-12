import apiClient from './api_client_fixed';

export interface RecognizedStudent {
  student_id: string;
  name: string;
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
  in_time: string;
  out_time?: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

export interface StudentStatus {
  student_id: string;
  name: string;
  in_time: string | null;
  out_time: string | null;
  status: 'present' | 'absent' | 'late';
  date: string;
}

export interface AllStudentsStatusResponse {
  date: string;
  students: StudentStatus[];
}

// Live attendance capture
export const submitLiveAttendance = async (imageBlob: Blob): Promise<LiveAttendanceResponse> => {
  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'capture.jpg');

    const response = await apiClient.post('/attendance/live', formData, {
      headers: {
        // Let the browser set the Content-Type with proper boundary
        'Content-Type': undefined
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting live attendance:', error);
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

  const response = await apiClient.post('/attendance/upload', formData, {
    headers: {
      // Let the browser set the Content-Type with proper boundary
      'Content-Type': undefined
    },
  });
  return response.data;
};

// Get today's attendance
export const getTodayAttendance = async (): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await apiClient.get('/attendance/today');
    return response.data;
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    // Return a fallback response to prevent UI errors
    return { attendance: [] };
  }
};

// Get attendance by specific date
export const getAttendanceByDate = async (date: string): Promise<{ attendance: AttendanceRecord[] }> => {
  try {
    const response = await apiClient.get(`/attendance/date/${date}`);
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