import apiClient from './apiClient';

export interface RecognizedStudent {
  student_id: string;
  name: string;
  score: number;
  action?: 'checkin' | 'checkout';
  timestamp?: string;
}

export interface LiveAttendanceResponse {
  recognized: RecognizedStudent[];
  processing_time_ms: number;
}

export interface UploadAttendanceResponse {
  recognized: RecognizedStudent[];
  unrecognized_count: number;
  processing_time_ms?: number;
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

// Live attendance capture
export const submitLiveAttendance = async (imageBlob: Blob): Promise<LiveAttendanceResponse> => {
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');

  const response = await apiClient.post('/attendance/live', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Upload group photo for attendance
export const uploadGroupAttendance = async (image: File): Promise<UploadAttendanceResponse> => {
  const formData = new FormData();
  formData.append('image', image);

  const response = await apiClient.post('/attendance/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get today's attendance
export const getTodayAttendance = async (): Promise<{ attendance: AttendanceRecord[] }> => {
  const response = await apiClient.get('/attendance/today');
  return response.data;
};

// Get attendance by specific date
export const getAttendanceByDate = async (date: string): Promise<{ attendance: AttendanceRecord[] }> => {
  const response = await apiClient.get(`/attendance/date/${date}`);
  return response.data;
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