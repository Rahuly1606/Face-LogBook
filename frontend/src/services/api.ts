import { api } from '@/lib/api';

// ============= TYPES =============
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

export interface Group {
    id: number;
    name: string;
    student_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface AttendanceRecord {
    id: number;
    student_id: string;
    student_name?: string;
    name?: string; // From /attendance/today endpoint
    group_id?: number;
    group_name?: string;
    timestamp?: string;
    in_time?: string; // From /attendance/today endpoint
    out_time?: string; // From /attendance/today endpoint
    date: string;
    status?: string; // present, absent, late
    confidence?: number;
    photo_url?: string;
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

export interface LiveAttendanceResponse {
    success: boolean;
    detected_faces: Array<{
        student_id: string;
        name: string;
        confidence: number;
        confidence_tier?: string;
        group_name?: string;
        status?: string;
        attendance_status?: string; // 'on_time' | 'late'
    }>;
    wrong_section_students?: Array<{
        student_id: string;
        name: string;
        confidence: number;
        group_name?: string;
        status?: string;
        message?: string;
    }>;
    unrecognized_faces?: Array<{
        id: string;
        bbox?: number[];
        score?: number;
        image_url?: string | null;
    }>;
    message?: string;
    total_detected?: number;
    unrecognized_count?: number;
    window_status?: string;   // 'on_time' | 'late'
    window?: AttendanceWindow;
}

export interface AttendanceWindow {
    window_start: string;
    window_end: string;
    late_end: string;
    late_policy: string;
    current_time: string;
}

export interface WindowStatusResponse {
    allowed: boolean;
    status: string;  // 'on_time' | 'late' | 'early' | 'rejected' | 'closed'
    message: string;
    window: AttendanceWindow;
}

export interface UploadAttendanceResponse {
    success: boolean;
    message: string;
    detected_count: number;
    students: Array<{
        student_id: string;
        name: string;
        confidence: number;
    }>;
    wrong_section_students?: Array<{
        student_id: string;
        name: string;
        confidence: number;
        group_name?: string;
        message?: string;
    }>;
    unrecognized_count?: number;
}

export interface DashboardStats {
    total_students: number;
    total_groups: number;
    today_attendance: number;
    attendance_rate: number;
}

// ============= STUDENT APIs =============
export const studentApi = {
    async getAll(): Promise<{ students: Student[] }> {
        const response = await api.get<{ students: Student[] }>('/students');
        return response;
    },

    async getById(id: string): Promise<{ student: Student } | null> {
        try {
            const response = await api.get<{ student: Student }>(`/students/${id}`);
            return response;
        } catch (error) {
            console.error('Error fetching student:', error);
            return null;
        }
    },

    async getByGroup(groupId: number): Promise<{ students: Student[] }> {
        const response = await api.get<{ students: Student[] }>(`/groups/${groupId}/students`);
        return response;
    },

    async register(data: RegisterStudentData) {
        const formData = new FormData();
        formData.append('student_id', data.student_id);
        formData.append('name', data.name);

        if (data.image) {
            formData.append('image', data.image);
        }
        if (data.drive_link) {
            formData.append('drive_link', data.drive_link);
        }
        if (data.group_id) {
            formData.append('group_id', data.group_id.toString());
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/students/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Failed to register student');
        }

        return response.json();
    },

    async update(id: string, data: UpdateStudentData) {
        const formData = new FormData();

        if (data.student_id) formData.append('student_id', data.student_id);
        if (data.name) formData.append('name', data.name);
        if (data.image) formData.append('image', data.image);
        if (data.drive_link) formData.append('drive_link', data.drive_link);
        if (data.group_id) formData.append('group_id', data.group_id.toString());

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/students/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update student');
        }

        return response.json();
    },

    async delete(id: string) {
        return api.delete(`/students/${id}`);
    },

    async bulkDelete(ids: string[]) {
        return api.post('/students/bulk-delete', { ids });
    },
};

// ============= GROUP APIs =============
export const groupApi = {
    async getAll(): Promise<Group[]> {
        const response = await api.get<{ groups: Group[] }>('/groups');
        return response.groups || [];
    },

    async getById(id: number): Promise<Group | null> {
        try {
            const response = await api.get<{ group: Group }>(`/groups/${id}`);
            return response.group;
        } catch (error) {
            console.error('Error fetching group:', error);
            return null;
        }
    },

    async create(data: { name: string }): Promise<Group> {
        const response = await api.post<{ group: Group }>('/groups', data);
        return response.group;
    },

    async update(id: number, data: { name?: string }): Promise<Group> {
        const response = await api.put<{ group: Group }>(`/groups/${id}`, data);
        return response.group;
    },

    async delete(id: number): Promise<boolean> {
        try {
            await api.delete(`/groups/${id}`);
            return true;
        } catch (error) {
            console.error('Error deleting group:', error);
            return false;
        }
    },
};

// ============= ATTENDANCE APIs =============
export const attendanceApi = {
    async getWindowStatus(groupId?: string): Promise<WindowStatusResponse> {
        const params = groupId ? `?group_id=${groupId}` : '';
        return api.get<WindowStatusResponse>(`/attendance/window-status${params}`);
    },

    async submitLive(imageBlob: Blob, groupId?: string): Promise<LiveAttendanceResponse> {
        const formData = new FormData();
        formData.append('image', imageBlob, 'live_capture.jpg');
        if (groupId) {
            formData.append('group_id', groupId);
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/attendance/live`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to submit live attendance');
        }

        return response.json();
    },

    async uploadPhoto(image: File, groupId?: string): Promise<UploadAttendanceResponse> {
        const formData = new FormData();
        formData.append('image', image);
        if (groupId) {
            formData.append('group_id', groupId);
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/attendance/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to upload attendance photo');
        }

        return response.json();
    },

    async getToday(): Promise<{ attendance: AttendanceRecord[] }> {
        return api.get<{ attendance: AttendanceRecord[] }>('/attendance/today');
    },

    async getByDate(date: string): Promise<{ attendance: AttendanceRecord[] }> {
        return api.get<{ attendance: AttendanceRecord[] }>(`/attendance/logs?date=${date}`);
    },

    async getByDateRange(startDate: string, endDate: string): Promise<{ attendance: AttendanceRecord[] }> {
        return api.get<{ attendance: AttendanceRecord[] }>(`/attendance/logs?date_from=${startDate}&date_to=${endDate}`);
    },

    async getByGroup(groupId: number, dateFrom?: string, dateTo?: string): Promise<{ attendance: AttendanceRecord[] }> {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return api.get<{ attendance: AttendanceRecord[] }>(`/attendance/logs/${groupId}${qs}`);
    },

    async getByStudent(studentId: string): Promise<{ attendance: AttendanceRecord[] }> {
        return api.get<{ attendance: AttendanceRecord[] }>(`/students/${studentId}/attendance`);
    },
};

// ============= DASHBOARD APIs =============
export const dashboardApi = {
    async getStats(): Promise<DashboardStats> {
        try {
            const response = await api.get<DashboardStats>('/dashboard/stats');
            return response;
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            // Return mock data as fallback
            return {
                total_students: 0,
                total_groups: 0,
                today_attendance: 0,
                attendance_rate: 0,
            };
        }
    },
};

// ============= BULK IMPORT APIs =============
export interface BulkImportSuccess {
    student_id: string;
    name: string;
    message: string;
}

export interface BulkImportFailure {
    student_id?: string;
    name?: string;
    row?: number;
    message: string;
}

export interface BulkImportResult {
    success?: boolean;
    message?: string;
    successes: BulkImportSuccess[];
    failures: BulkImportFailure[];
}

export interface ImportJob {
    id: number;
    group_id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_records: number;
    processed_records: number;
    successful_records: number;
    failed_records: number;
    error_message?: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    progress_percentage: number;
}

export const bulkImportApi = {
    async validateImport(groupId: number, file: File): Promise<BulkImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('dry_run', 'true');

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/groups/${groupId}/students/bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Validation failed');
        }

        return response.json();
    },

    async bulkImport(groupId: number, file: File): Promise<BulkImportResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/groups/${groupId}/students/bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Import failed');
        }

        return response.json();
    },

    async startAsyncImport(groupId: number, file: File): Promise<{ success: boolean; job_id: number; total_records: number; message: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/v1/groups/${groupId}/students/bulk-async`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('faceattend_auth_token')}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to start import');
        }

        return response.json();
    },

    async getJobStatus(jobId: number): Promise<ImportJob> {
        return api.get<ImportJob>(`/groups/import-jobs/${jobId}`);
    },

    async getAllJobs(groupId?: number, status?: string): Promise<{ jobs: ImportJob[] }> {
        const params = new URLSearchParams();
        if (groupId) params.append('group_id', groupId.toString());
        if (status) params.append('status', status);

        return api.get<{ jobs: ImportJob[] }>(`/groups/import-jobs?${params.toString()}`);
    },

    async deleteJob(jobId: number): Promise<boolean> {
        try {
            await api.delete(`/groups/import-jobs/${jobId}`);
            return true;
        } catch (error) {
            console.error(`Error deleting import job ${jobId}:`, error);
            return false;
        }
    },
};

// ============= SETTINGS APIs =============
export interface AttendanceWindowSettings {
    window_start: string;
    window_end: string;
    late_end: string;
    late_policy: string;
    has_custom?: boolean;
}

export interface DefaultGroupSettings {
    default_group_id: string;
    default_group_name: string | null;
}

export const settingsApi = {
    async getAttendanceWindow(groupId?: string): Promise<AttendanceWindowSettings> {
        const params = groupId ? `?group_id=${groupId}` : '';
        return api.get<AttendanceWindowSettings & { success: boolean }>(`/settings/attendance-window${params}`);
    },

    async updateAttendanceWindow(data: Partial<AttendanceWindowSettings>, groupId?: string): Promise<AttendanceWindowSettings & { message: string }> {
        const params = groupId ? `?group_id=${groupId}` : '';
        return api.put<AttendanceWindowSettings & { success: boolean; message: string }>(`/settings/attendance-window${params}`, data);
    },

    async getDefaultGroup(): Promise<DefaultGroupSettings> {
        return api.get<DefaultGroupSettings & { success: boolean }>('/settings/default-group');
    },

    async updateDefaultGroup(groupId: string): Promise<DefaultGroupSettings & { message: string }> {
        return api.put<DefaultGroupSettings & { success: boolean; message: string }>('/settings/default-group', { default_group_id: groupId });
    },

    async removeGroupWindow(groupId: string): Promise<{ message: string }> {
        return api.delete<{ success: boolean; message: string }>(`/settings/attendance-window?group_id=${groupId}`);
    },
};

// ============= REGISTRATION LINK APIs =============

export interface RegistrationLink {
    id: number;
    group_id: number;
    group_name?: string;
    label?: string | null;
    expires_at: string;
    is_active: boolean;
    is_expired: boolean;
    created_at?: string;
    /** Only present immediately after creation */
    token?: string;
}

export interface CreateRegistrationLinkData {
    label?: string;
    expiry_days?: number;
}

export interface CreateRegistrationLinkResponse {
    success: boolean;
    link: RegistrationLink;
    /** Full public URL the admin should share with students */
    url: string;
}

export const registrationLinkApi = {
    /** Generate a new registration link for a group (admin only). */
    async create(
        groupId: number,
        data: CreateRegistrationLinkData = {}
    ): Promise<CreateRegistrationLinkResponse> {
        return api.post<CreateRegistrationLinkResponse>(
            `/groups/${groupId}/registration-links`,
            data
        );
    },

    /** List all registration links for a group (admin only). */
    async list(groupId: number): Promise<{ links: RegistrationLink[] }> {
        return api.get<{ success: boolean; links: RegistrationLink[] }>(
            `/groups/${groupId}/registration-links`
        );
    },

    /** Deactivate / revoke a registration link (admin only). */
    async deactivate(linkId: number): Promise<{ success: boolean; message: string }> {
        return api.delete<{ success: boolean; message: string }>(
            `/groups/registration-links/${linkId}`
        );
    },
};
