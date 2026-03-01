import type { AttendanceWindowSettings } from '@/services/api';

export interface ValidationError {
    title: string;
    description: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateTimeFormat(time: string, fieldName: string): ValidationError | null {
    if (!TIME_REGEX.test(time)) {
        return {
            title: 'Invalid Time',
            description: `${fieldName} must be in HH:MM format (e.g. 09:00)`
        };
    }
    return null;
}

export function validateTimeWindow(form: AttendanceWindowSettings): ValidationError | null {
    // Validate formats
    const startError = validateTimeFormat(form.window_start, 'Window Start');
    if (startError) return startError;

    const endError = validateTimeFormat(form.window_end, 'Window End');
    if (endError) return endError;

    const lateError = validateTimeFormat(form.late_end, 'Late Cutoff');
    if (lateError) return lateError;

    // Validate logical order
    if (form.window_start >= form.window_end) {
        return {
            title: 'Invalid Range',
            description: 'Window Start must be before Window End'
        };
    }

    if (form.window_end >= form.late_end) {
        return {
            title: 'Invalid Range',
            description: 'Window End must be before Late Cutoff'
        };
    }

    return null;
}

export function getEffectiveGroupId(selectedGroupId: string): string | undefined {
    return (selectedGroupId && selectedGroupId !== 'none') ? selectedGroupId : undefined;
}
