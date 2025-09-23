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