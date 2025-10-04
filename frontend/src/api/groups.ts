import api from '../services/api';

export interface Group {
  id: number;
  name?: string; // backend returns `name`
  code?: string; // optional; not always present
  created_at?: string;
  updated_at?: string;
  student_count?: number;
}

// Get all groups
export const getGroups = async (): Promise<Group[]> => {
  try {
    const response = await api.get('/groups');
    // Check if the response is an array or an object with a groups property
    if (Array.isArray(response.data)) {
      return response.data as Group[];
    } else if (response.data && typeof response.data === 'object') {
      // Handle case where API returns {groups: [...]} instead of just array
      const groups = (response.data.groups || []) as Group[];
      return Array.isArray(groups) ? groups : [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
};

// Get a single group by ID
export const getGroup = async (id: number): Promise<Group | null> => {
  try {
    const response = await api.get(`/groups/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching group ${id}:`, error);
    return null;
  }
};

// Create a new group
export const createGroup = async (data: { name: string; code: string }): Promise<Group | null> => {
  try {
    const response = await api.post('/groups', data);
    return response.data;
  } catch (error) {
    console.error('Error creating group:', error);
    return null;
  }
};

// Update a group
export const updateGroup = async (id: number, data: { name?: string; code?: string }): Promise<Group | null> => {
  try {
    const response = await api.put(`/groups/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating group ${id}:`, error);
    return null;
  }
};

// Delete a group
export const deleteGroup = async (id: number): Promise<boolean> => {
  try {
    await api.delete(`/groups/${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting group ${id}:`, error);
    return false;
  }
};

// Import job interfaces
export interface ImportJob {
  id: number;
  group_id: number;
  filename: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  successes: Array<{ student_id: string; name: string; id: number }>;
  failures: Array<{ row: number; student_id: string; name: string; message: string }>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  progress_percentage: number;
}

// Start async bulk import
export const startBulkImportAsync = async (groupId: number, file: File): Promise<{ success: boolean; job_id: number; total_records: number; message: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post(`/groups/${groupId}/students/bulk-async`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
};

// Get import job status
export const getImportJobStatus = async (jobId: number): Promise<ImportJob> => {
  const response = await api.get(`/groups/import-jobs/${jobId}`);
  return response.data;
};

// Get all import jobs
export const getAllImportJobs = async (groupId?: number, status?: string): Promise<ImportJob[]> => {
  const params = new URLSearchParams();
  if (groupId) params.append('group_id', groupId.toString());
  if (status) params.append('status', status);

  const response = await api.get(`/groups/import-jobs?${params.toString()}`);
  return response.data.jobs || [];
};

// Delete import job
export const deleteImportJob = async (jobId: number): Promise<boolean> => {
  try {
    await api.delete(`/groups/import-jobs/${jobId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting import job ${jobId}:`, error);
    return false;
  }
};
