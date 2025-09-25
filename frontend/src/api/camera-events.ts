import api from '../services/api';

export interface CameraEvent {
    id: number;
    event_uuid: string;
    student_id: string;
    timestamp: string;
    local_date: string;
    event_type: 'in' | 'out';
    created_at: string;
    updated_at: string;
    modified_by?: string;
    modification_reason?: string;
}

export interface CameraEventPair {
    in_event: CameraEvent | null;
    out_event: CameraEvent | null;
}

export interface StudentEventsResponse {
    success: boolean;
    student_id: string;
    student_name: string;
    date: string;
    events: CameraEvent[];
}

export interface StudentEventPairsResponse {
    success: boolean;
    student_id: string;
    student_name: string;
    date: string;
    event_pairs: CameraEventPair[];
}

export interface CreateEventRequest {
    student_id: string;
    timestamp: string;
    event_type: 'in' | 'out';
    modified_by?: string;
    reason?: string;
}

export interface DeleteEventRequest {
    modified_by?: string;
    reason?: string;
}

// Get all events for a student on a specific date
export const getStudentEvents = async (
    studentId: string,
    date: string
): Promise<StudentEventsResponse> => {
    const response = await api.get(`/camera-events/student/${studentId}/date/${date}`);
    return response.data;
};

// Get in/out pairs for a student on a specific date
export const getStudentEventPairs = async (
    studentId: string,
    date: string
): Promise<StudentEventPairsResponse> => {
    const response = await api.get(`/camera-events/student/${studentId}/date/${date}/pairs`);
    return response.data;
};

// Create a new event (admin function)
export const createEvent = async (
    eventData: CreateEventRequest
): Promise<{ success: boolean, message: string, event?: CameraEvent }> => {
    const response = await api.post('/camera-events/event', eventData);
    return response.data;
};

// Delete an event (admin function)
export const deleteEvent = async (
    eventId: number,
    data?: DeleteEventRequest
): Promise<{ success: boolean, message: string }> => {
    const response = await api.delete(`/camera-events/event/${eventId}`, {
        data
    });
    return response.data;
};