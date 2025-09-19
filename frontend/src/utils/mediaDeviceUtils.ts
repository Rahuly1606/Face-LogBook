/**
 * Utility functions for working with browser media devices
 */

/**
 * Checks if the current browser environment supports media device access
 * Covers both API support and secure context checks
 */
export function checkMediaDeviceSupport(): {
    isSupported: boolean;
    error?: string;
    isSecureContext: boolean;
    hasMediaDevices: boolean;
    hasGetUserMedia: boolean;
} {
    // Check if we're in a secure context (HTTPS or localhost)
    const isSecureContext = window.isSecureContext;

    // Check if navigator.mediaDevices exists
    const hasMediaDevices = !!(navigator.mediaDevices);

    // Check if getUserMedia exists
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    let error = undefined;
    let isSupported = true;

    if (!isSecureContext) {
        error = "Camera access requires a secure context (HTTPS or localhost). Please use HTTPS or access via localhost.";
        isSupported = false;
    } else if (!hasMediaDevices) {
        error = "This browser doesn't support media devices.";
        isSupported = false;
    } else if (!hasGetUserMedia) {
        error = "This browser doesn't support getUserMedia.";
        isSupported = false;
    }

    return {
        isSupported,
        error,
        isSecureContext,
        hasMediaDevices,
        hasGetUserMedia
    };
}

/**
 * Provides a user-friendly error message when camera access fails
 */
export function getCameraErrorMessage(error: any): string {
    // First check if this is a secure context issue
    const support = checkMediaDeviceSupport();
    if (!support.isSupported) {
        return support.error || "Camera access is not supported in this browser environment.";
    }

    // Handle specific error types
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        return "Camera access was denied. Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return "No camera was found on this device.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        return "Camera is already in use by another application.";
    } else if (error.name === "OverconstrainedError") {
        return "Camera cannot satisfy the requested constraints.";
    } else if (error.name === "TypeError" && error.message.includes("getUserMedia")) {
        return "Camera access requires a secure connection (HTTPS). Try opening this page over HTTPS or via localhost.";
    }

    // Generic error
    return `Camera error: ${error.message || "Unknown error"}`;
}