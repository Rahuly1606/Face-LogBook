import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, CameraOff, Play, Pause, RefreshCw, Users, Clock, CheckCircle2, LogOut, Smartphone, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { IPCameraInput } from './IPCameraInput';
import { submitLiveAttendance, RecognizedStudent as BaseRecognizedStudent, UnrecognizedFace } from '@/api/attendance';
import { useAppContext } from '@/context/AppContext';
import LiveStudentList from './LiveStudentList';
import { checkMediaDeviceSupport, getCameraErrorMessage } from '@/utils/mediaDeviceUtils';

// Extend RecognizedStudent to include optional goodbye_message property
export interface RecognizedStudent extends BaseRecognizedStudent {
  goodbye_message?: string;
}

// Props interface for the component
interface WebcamCaptureProps {
  groupId: number;
  onFaceRecognized?: () => void;
}

interface TrackedStudent {
  student_id: string;
  name: string;
  lastSeen: number;
  isPresent: boolean;
  bbox?: number[];
  confidence: number;
  attendanceStatus: 'present' | 'departed' | 'none';
}

interface AttendanceMessage {
  id: string;
  text: string;
  kind: 'enter' | 'leave';
  name: string;
  at: number;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ groupId, onFaceRecognized }) => {
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessing = useRef<boolean>(false);
  const trackedStudents = useRef<Map<string, TrackedStudent>>(new Map());
  const lastProcessedFrame = useRef<string | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudent[]>([]);
  const [showIpCamera, setShowIpCamera] = useState(false);
  const [useIpCamera, setUseIpCamera] = useState(false);
  const [ipCameraStream, setIpCameraStream] = useState<MediaStream | null>(null);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [unrecognizedFaces, setUnrecognizedFaces] = useState<UnrecognizedFace[]>([]);
  const [totalFaces, setTotalFaces] = useState(0);
  const [currentFacesInView, setCurrentFacesInView] = useState(0);
  const [fps, setFps] = useState(0);

  const [messages, setMessages] = useState<AttendanceMessage[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [userAtTop, setUserAtTop] = useState(true);
  const lastAnnouncementRef = useRef('');
  const recentEventRef = useRef<Map<string, number>>(new Map());

  const { captureInterval } = useAppContext();
  const { toast } = useToast();

  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const videoConstraints = {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    facingMode: "user",
    aspectRatio: { ideal: 1.7777777778 }
  };

  const clearStudentList = useCallback(() => {
    setRecognizedStudents([]);
    setUnrecognizedCount(0);
    setUnrecognizedFaces([]);
    setTotalFaces(0);
    trackedStudents.current.clear();
  }, []);

  const pushAttendanceMessage = useCallback((name: string, kind: 'enter' | 'leave') => {
    const now = Date.now();
    const key = `${name}-${kind}`;
    const last = recentEventRef.current.get(key) || 0;
    const DEDUP_MS = 5000;
    if (now - last < DEDUP_MS) {
      return;
    }
    recentEventRef.current.set(key, now);

    const text = kind === 'enter' ? `Welcome, ${name}!` : `Goodbye, ${name}.`;
    const msg: AttendanceMessage = { id: `${key}-${now}`, text, kind, name, at: now };

    setMessages(prev => [msg, ...prev].slice(0, 500));

    lastAnnouncementRef.current = text;
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (el && userAtTop) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, [userAtTop]);

  const handlePanelScroll = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    setUserAtTop(el.scrollTop <= 8);
  }, []);

  const updateTrackedStudents = useCallback((recognized: RecognizedStudent[]) => {
    const currentTime = Date.now();
    const currentStudentsInView = new Set<string>();

    recognized.forEach(student => {
      const studentId = student.student_id;
      currentStudentsInView.add(studentId);
      const existing = trackedStudents.current.get(studentId);

      if (existing) {
        existing.lastSeen = currentTime;
        existing.isPresent = true;

        if (existing.attendanceStatus === 'departed') {
          if (student.name) pushAttendanceMessage(student.name, 'leave');
          return;
        }

        if (student.action === 'checkin' && existing.attendanceStatus === 'none') {
          existing.attendanceStatus = 'present';
          if (student.name) pushAttendanceMessage(student.name, 'enter');
        } else if (student.action === 'checkout') {
          existing.attendanceStatus = 'departed';
          if (student.name) pushAttendanceMessage(student.name, 'leave');
        }
      } else {
        const initialStatus = student.action === 'checkin' ? 'present' : student.action === 'checkout' ? 'departed' : 'none';
        const newTrackedStudent: TrackedStudent = {
          student_id: studentId,
          name: student.name,
          lastSeen: currentTime,
          isPresent: true,
          bbox: student.bbox,
          confidence: student.score,
          attendanceStatus: initialStatus,
        };
        trackedStudents.current.set(studentId, newTrackedStudent);

        if (initialStatus === 'present' && student.name) {
          pushAttendanceMessage(student.name, 'enter');
        } else if (initialStatus === 'departed' && student.name) {
          pushAttendanceMessage(student.name, 'leave');
        }
      }
    });

    trackedStudents.current.forEach((student, studentId) => {
      if (!currentStudentsInView.has(studentId) && student.isPresent) {
        student.isPresent = false;
        if (student.attendanceStatus === 'present' && student.name) {
          student.attendanceStatus = 'departed';
          pushAttendanceMessage(student.name, 'leave');
        }
      }
    });

    const cleanupTime = currentTime - 30000;
    trackedStudents.current.forEach((student, studentId) => {
      if (student.lastSeen < cleanupTime) {
        trackedStudents.current.delete(studentId);
      }
    });

    setCurrentFacesInView(currentStudentsInView.size);
  }, [pushAttendanceMessage]);

  const captureScreenshot = useCallback((): string | null => {
    if (!webcamRef.current) return null;

    try {
      // Check if we're using IP camera by looking at the element type
      // or explicitly checking the useIpCamera flag
      const isVideoElement = webcamRef.current instanceof HTMLVideoElement || useIpCamera;

      if (isVideoElement) {
        console.log("Using IP camera capture method (video element)");
        // For IP camera, use canvas to capture from video element
        const video = webcamRef.current as unknown as HTMLVideoElement;

        // Make sure video is playing and has dimensions
        if (!video.videoWidth || !video.videoHeight) {
          console.warn('Video dimensions not available yet');
          // Try to play the video if it's paused
          if (video.paused) {
            video.play().catch(err => console.warn('Could not play video:', err));
          }
          return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get canvas context');
          return null;
        }

        // Draw the current video frame to the canvas
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.9);
        } catch (err) {
          console.error('Error capturing frame from video:', err);
          return null;
        }
      } else {
        console.log("Using regular webcam capture method");
        // For regular webcam, use the Webcam component's getScreenshot method
        const webcam = webcamRef.current as Webcam;
        if (typeof webcam.getScreenshot === 'function') {
          return webcam.getScreenshot();
        } else {
          console.error('getScreenshot method not available on webcam');
          return null;
        }
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      return null;
    }
  }, [useIpCamera]);

  const captureAndProcess = useCallback(async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    const currentTime = Date.now();
    if (lastProcessedFrame.current && currentTime - parseInt(lastProcessedFrame.current) < 100) {
      isProcessing.current = false;
      return;
    }
    lastProcessedFrame.current = currentTime.toString();

    frameCount.current++;
    if (currentTime - lastFpsTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsTime.current = currentTime;
    }

    // Use the captureScreenshot function to get a screenshot from either webcam or IP camera
    let imageSrc = null;
    // Try up to 3 times to get a screenshot
    for (let attempt = 0; attempt < 3 && !imageSrc; attempt++) {
      if (attempt > 0) {
        console.log(`Screenshot attempt ${attempt + 1}...`);
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      imageSrc = captureScreenshot();
    }

    const safetyTimeout = setTimeout(() => {
      if (isProcessing.current) {
        console.warn('Processing timeout - resetting flag');
        isProcessing.current = false;
      }
    }, 30000);

    try {
      if (!imageSrc) {
        // For IP camera, if we can't get a screenshot, try to restart the stream
        if (useIpCamera && webcamRef.current) {
          const video = webcamRef.current as unknown as HTMLVideoElement;
          console.warn("Attempting to recover IP camera stream for screenshot...");

          // Check if video element exists and has a valid state
          if (video) {
            // Check if the video is in a problematic state
            const needsRestart = video.paused || video.ended ||
              video.readyState < 2 || // Not enough data
              !video.srcObject; // No source object

            if (needsRestart) {
              console.log("Video in bad state, attempting restart:", {
                paused: video.paused,
                ended: video.ended,
                readyState: video.readyState,
                hasSrcObject: !!video.srcObject
              });

              // If no srcObject but we have ipCameraStream, reconnect them
              if (!video.srcObject && ipCameraStream) {
                video.srcObject = ipCameraStream;
                console.log("Reconnected video element to IP camera stream");
              }

              // Try to restart the video
              try {
                // Check if we already have a play attempt in progress to avoid AbortError
                if (!(video as any)._screenshotPlayInProgress) {
                  console.log("Attempting to restart video playback for screenshot capture");

                  // Mark that we have a play attempt in progress
                  (video as any)._screenshotPlayInProgress = true;

                  await video.play();
                  console.log("Successfully restarted video playback");

                  // Give it a moment to stabilize, then try again on next cycle
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // Clear the flag
                  (video as any)._screenshotPlayInProgress = false;
                } else {
                  console.log("Screenshot play attempt already in progress, skipping duplicate attempt");
                  // Wait a moment in case the other attempt succeeds
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              } catch (playErr) {
                console.error("Failed to restart video playback:", playErr);
                // Clear the flag after a delay
                setTimeout(() => {
                  (video as any)._screenshotPlayInProgress = false;
                }, 1000);
              }
            }
          }
        }

        throw new Error("Could not get screenshot. Please check if the camera is working.");
      }

      setLastCapture(imageSrc);
      const base64Response = await fetch(imageSrc);
      const blob = await base64Response.blob();
      const response = await submitLiveAttendance(blob);

      if (response.error) {
        const isTimeoutError = response.errorMessage?.includes('timeout') || response.errorMessage?.includes('too many faces');
        toast({
          title: isTimeoutError ? "Processing Overload" : "Connection Error",
          description: isTimeoutError ? "Too many faces detected." : "Could not connect to the backend.",
          variant: "destructive",
        });
      } else {
        setProcessingTime(response.processing_time_ms);
        setTotalFaces(response.total_faces || 0);
        setUnrecognizedCount(response.unrecognized_count || 0);
        setUnrecognizedFaces(response.unrecognized_faces || []);

        if (response.recognized && response.recognized.length > 0) {
          updateTrackedStudents(response.recognized);
          const studentsWithTimestamp = response.recognized.map(student => ({
            ...student,
            timestamp: new Date().toISOString()
          }));
          setRecognizedStudents(prev => {
            const existingIds = new Set(prev.map(s => s.student_id));
            const newStudents = studentsWithTimestamp.filter(s => !existingIds.has(s.student_id));
            return [...prev, ...newStudents];
          });
          if (onFaceRecognized) onFaceRecognized();
        }
      }
    } catch (error: any) {
      console.error('Capture error:', error);

      // Don't show toast for every error to avoid overwhelming the user
      // Only show if we haven't shown an error recently
      const now = Date.now();
      const lastErrorTime = lastProcessedFrame.current ? parseInt(lastProcessedFrame.current) : 0;

      if (now - lastErrorTime > 5000) {  // Only show error toast every 5 seconds
        toast({
          title: "Capture Error",
          description: error.message || "Failed to process image",
          variant: "destructive",
        });
      }

    } finally {
      isProcessing.current = false;
      clearTimeout(safetyTimeout);
    }
  }, [toast, onFaceRecognized, updateTrackedStudents, captureScreenshot, useIpCamera]);

  const startAutoCapture = useCallback(() => {
    setIsCapturing(true);
    frameCount.current = 0;
    lastFpsTime.current = Date.now();
    setMessages([]);
    recentEventRef.current.clear();
    captureAndProcess();
    intervalRef.current = setInterval(captureAndProcess, Math.max(captureInterval, 500));
  }, [captureInterval, captureAndProcess]);

  const stopAutoCapture = useCallback(() => {
    console.log("Stopping auto capture and cleaning up resources...");

    // Stop the capture interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("Cleared capture interval");
    }

    // Stop IP camera stream if active
    if (useIpCamera && ipCameraStream) {
      console.log("Stopping IP camera stream...");
      try {
        ipCameraStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}, enabled: ${track.enabled}`);
          track.stop();
        });

        // Reset video element if it exists
        if (webcamRef.current) {
          const videoEl = webcamRef.current as unknown as HTMLVideoElement;
          if (videoEl.srcObject) {
            videoEl.srcObject = null;
            console.log("Cleared video srcObject");
          }

          // Pause the video element
          if (!videoEl.paused) {
            videoEl.pause();
            console.log("Paused video element");
          }
        }

        setIpCameraStream(null);
        console.log("IP camera stream stopped and reset");
      } catch (err) {
        console.error("Error stopping IP camera stream:", err);
      }
    }

    // Reset processing flags
    isProcessing.current = false;

    // Update state
    setIsCapturing(false);
    setMessages([]);

    console.log("Auto capture stopped successfully");
  }, [useIpCamera, ipCameraStream]);

  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Cleanup effect for intervals and streams
  useEffect(() => {
    // Cleanup function for streams and intervals
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ipCameraStream) {
        ipCameraStream.getTracks().forEach(track => track.stop());
      }
      setIsCapturing(false);
      isProcessing.current = false;
    };
  }, [ipCameraStream]);

  // Handle camera source changes
  useEffect(() => {
    if (useIpCamera) {
      // When switching to IP camera, stop the webcam capture
      stopAutoCapture();
      isProcessing.current = false;
    } else {
      // When switching back to webcam, cleanup IP camera
      if (ipCameraStream) {
        ipCameraStream.getTracks().forEach(track => track.stop());
        setIpCameraStream(null);
      }
    }
  }, [useIpCamera, ipCameraStream, stopAutoCapture]);

  // Add automatic IP camera error recovery
  useEffect(() => {
    if (useIpCamera && ipCameraStream && isCapturing) {
      console.log("Setting up IP camera recovery monitoring");

      // Recovery check timer - check video playback every 5 seconds
      const recoveryTimer = setInterval(() => {
        const video = webcamRef.current as unknown as HTMLVideoElement;
        if (!video) return;

        const isVideoStalled =
          video.paused || // Video is paused
          video.readyState < 2 || // Not enough data
          (video.currentTime > 0 && video.readyState > 2 && !video.played.length); // No playback recorded

        if (isVideoStalled) {
          console.warn('IP camera stream appears stalled, attempting recovery...');

          // Check if the stream is still active
          const isStreamActive = ipCameraStream.getTracks().some(track =>
            track.readyState === 'live' && !track.muted
          );

          if (!isStreamActive) {
            console.log('Stream tracks not active, attempting to restart stream...');
            // Try to restart playback
            video.play().catch(err => {
              console.error('Could not restart video after stall:', err);

              // If we can't restart, refresh the stream
              toast({
                title: "Stream Stalled",
                description: "Trying to reconnect to camera...",
                variant: "default",
              });
            });
          } else if (video.paused) {
            // If video is just paused, try to play it again
            console.log('Video paused, attempting to resume playback...');

            // Track if we already have a play attempt in progress to avoid AbortError
            if (!(video as any)._recoveryPlayInProgress) {
              (video as any)._recoveryPlayInProgress = true;

              video.play()
                .then(() => {
                  console.log('Successfully resumed video playback');
                  (video as any)._recoveryPlayInProgress = false;
                })
                .catch(err => {
                  console.warn('Could not resume stalled video:', err);
                  // Clear the flag after a delay to allow retry
                  setTimeout(() => {
                    (video as any)._recoveryPlayInProgress = false;
                  }, 2000);
                });
            } else {
              console.log('Recovery play already in progress, skipping additional attempt');
            }
          }
        }
      }, 5000);

      // Clean up timer
      return () => {
        console.log("Cleaning up IP camera recovery monitoring");
        clearInterval(recoveryTimer);
      };
    }
  }, [useIpCamera, ipCameraStream, isCapturing, toast]);

  const handleUserMedia = useCallback(() => {
    setWebcamError(null);
    toast({
      title: "Camera Connected",
      description: "Webcam access granted successfully",
    });
  }, [toast]);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Webcam error:', error);

    // Get a user-friendly error message
    const userFriendlyMessage = getCameraErrorMessage(error);

    setWebcamError(userFriendlyMessage);

    // Check if this is likely a secure context issue
    const support = checkMediaDeviceSupport();
    const isSecurityIssue = !support.isSecureContext;

    toast({
      title: isSecurityIssue ? "Security Restriction" : "Camera Error",
      description: userFriendlyMessage,
      variant: "destructive",
    });

    stopAutoCapture();
  }, [stopAutoCapture, toast]);

  // Check media device support on component mount
  useEffect(() => {
    const support = checkMediaDeviceSupport();
    if (!support.isSupported) {
      setWebcamError(support.error || "Camera not supported");
      if (!support.isSecureContext) {
        toast({
          title: "Security Restriction",
          description: "Camera access requires HTTPS. You're currently on an insecure connection.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    if (isCapturing) {
      const currentInterval = intervalRef.current;
      if (currentInterval) clearInterval(currentInterval);
      startAutoCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureInterval]);

  // JSX
  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6" data-groupid={groupId}>
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {lastAnnouncementRef.current}
      </div>

      {isCapturing && (
        <div
          ref={panelRef}
          onScroll={handlePanelScroll}
          className="fixed z-50 bottom-16 sm:bottom-auto sm:top-4 inset-x-2 sm:inset-x-4 md:inset-x-auto md:right-6 md:top-6 md:bottom-auto md:w-72 max-h-[30vh] sm:max-h-[40vh] md:max-h-none overflow-y-auto bg-background/30 dark:bg-black/30 backdrop-blur-xl rounded-xl sm:rounded-2xl ring-1 ring-border shadow-2xl space-y-2 sm:space-y-3 p-2 sm:p-3 md:p-4"
        >
          {messages.length > 0 ? (
            messages.map(msg => (
              <div
                key={msg.id}
                className="bg-background/80 dark:bg-white/10 rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3 shadow-md transition-transform hover:scale-[1.02]"
              >
                <div className={`flex-shrink-0 rounded-full p-1 sm:p-1.5 ${msg.kind === 'enter' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                  {msg.kind === 'enter' ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <div className="text-xs sm:text-sm font-medium text-foreground line-clamp-2">{msg.text}</div>
              </div>
            ))
          ) : (
            <div className="text-xs sm:text-sm text-center text-muted-foreground py-2">
              No attendance events yet
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 px-3 py-2 sm:px-4 sm:py-3">
            <CardTitle className="text-base sm:text-lg">Live Camera Feed</CardTitle>
            <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
              {!isCapturing ? (
                <Button onClick={startAutoCapture} className="gap-1.5 h-8 text-xs sm:text-sm px-2.5 sm:px-3 flex-1 sm:flex-none">
                  <Play className="h-3.5 w-3.5" /> Start
                </Button>
              ) : (
                <Button onClick={stopAutoCapture} variant="destructive" className="gap-1.5 h-8 text-xs sm:text-sm px-2.5 sm:px-3 flex-1 sm:flex-none">
                  <Pause className="h-3.5 w-3.5" /> Stop
                </Button>
              )}
              <Button onClick={captureAndProcess} variant="outline" className="gap-1.5 h-8 text-xs sm:text-sm px-2.5 sm:px-3 flex-1 sm:flex-none" disabled={isProcessing.current}>
                <Camera className="h-3.5 w-3.5" /> Manual
              </Button>
              <Button
                onClick={() => {
                  if (isCapturing) {
                    stopAutoCapture();
                  }
                  // Clean up existing IP camera stream if any
                  if (ipCameraStream) {
                    ipCameraStream.getTracks().forEach(track => track.stop());
                    setIpCameraStream(null);
                  }
                  setUseIpCamera(false);
                  setShowIpCamera(true);
                }}
                variant="outline"
                className="gap-1.5 h-8 text-xs sm:text-sm px-2.5 sm:px-3 flex-1 sm:flex-none"
                disabled={isProcessing.current}
              >
                <Smartphone className="h-3.5 w-3.5" /> Use IP Camera
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-secondary shadow-inner ring-1 ring-border">
              {showIpCamera ? (
                <div className="absolute inset-0 bg-black/90 p-4">
                  <IPCameraInput
                    onStreamReady={(stream) => {
                      console.log("IP camera stream received, setting up...");
                      setIpCameraStream(stream);
                      setUseIpCamera(true);
                      setShowIpCamera(false);
                      toast({
                        title: "Camera Connected",
                        description: "IP camera connected successfully",
                      });

                      // Reset any previous errors
                      setWebcamError(null);

                      // Start auto capture once IP camera is connected
                      setTimeout(() => {
                        console.log("Initializing auto capture with IP camera...");
                        if (!isCapturing) {
                          startAutoCapture();
                        }
                      }, 2000); // Give more time for everything to initialize
                    }}
                    onError={(error) => {
                      toast({
                        title: "Camera Error",
                        description: error,
                        variant: "destructive",
                      });
                    }}
                    onCancel={() => {
                      setShowIpCamera(false);
                    }}
                  />
                </div>
              ) : useIpCamera && ipCameraStream ? (
                <video
                  ref={(el) => {
                    if (el) {
                      // Set the IP camera stream as the source for the video element
                      console.log("Setting up IP camera video element");

                      // IMPORTANT: Assign to webcamRef immediately so the capture function can use it
                      webcamRef.current = el as any;
                      console.log("Set webcamRef to video element");

                      // Set up video element properties BEFORE assigning srcObject
                      // This avoids triggering unnecessary load events that could interrupt play attempts
                      el.muted = true;
                      el.autoplay = true;
                      el.playsInline = true;
                      el.setAttribute('playsinline', '');
                      el.setAttribute('webkit-playsinline', '');

                      // Now that all properties are set, assign the srcObject
                      if (el.srcObject !== ipCameraStream) {
                        console.log("Assigning IP camera stream to video element");
                        el.srcObject = ipCameraStream;
                      }

                      // Track play attempts to prevent multiple simultaneous attempts
                      let playAttemptInProgress = false;

                      // Centralized play function with debouncing
                      const attemptPlay = () => {
                        if (playAttemptInProgress || !el.paused) {
                          console.log('Play already in progress or video already playing, skipping attempt');
                          return Promise.resolve(); // Already playing or attempt in progress
                        }

                        console.log('Attempting to play video...');
                        playAttemptInProgress = true;

                        return el.play()
                          .then(() => {
                            console.log('Video playback started successfully');
                            playAttemptInProgress = false;
                          })
                          .catch(err => {
                            console.error('Error playing IP camera stream:', err);
                            playAttemptInProgress = false;
                            return Promise.reject(err); // Propagate error
                          });
                      };

                      // Only try to play after metadata is loaded - this is critical for reliable playback
                      el.onloadedmetadata = () => {
                        console.log('Video metadata loaded, dimensions:', el.videoWidth, 'x', el.videoHeight);
                        // Slight delay after metadata loads before playing
                        setTimeout(() => attemptPlay(), 100);
                      };

                      // Try again with a longer delay as fallback
                      setTimeout(() => {
                        if (el.paused) {
                          console.log('Delayed play attempt...');
                          attemptPlay();
                        }
                      }, 1000);

                      console.log('IP camera stream connected to video element successfully');
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onClick={(e) => {
                    // Attempt to play on click (helps with autoplay restrictions)
                    const video = e.currentTarget;

                    // Check if we already have a play attempt in progress
                    if ((video as any)._clickPlayInProgress) {
                      console.log("Play attempt already in progress, ignoring additional click");
                      return;
                    }

                    // Check if the video is paused before attempting to play
                    if (video.paused || video.ended) {
                      console.log("User clicked video to start playback");

                      // Set flag to prevent multiple click attempts
                      (video as any)._clickPlayInProgress = true;

                      toast({
                        title: "Starting Camera",
                        description: "Attempting to start camera stream...",
                        variant: "default",
                      });

                      video.play()
                        .then(() => {
                          console.log("Video playback started successfully via click");
                          // Clear the flag
                          (video as any)._clickPlayInProgress = false;
                          toast({
                            title: "Camera Active",
                            description: "Camera stream started successfully",
                            variant: "default",
                          });
                        })
                        .catch(err => {
                          console.warn('Could not play video on click:', err);
                          // Clear the flag after a delay
                          setTimeout(() => {
                            (video as any)._clickPlayInProgress = false;
                          }, 1000);

                          toast({
                            title: "Playback Failed",
                            description: "Could not start camera. Please check browser permissions.",
                            variant: "destructive",
                          });
                        });
                    } else {
                      console.log("Video already playing, user click ignored");
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              ) : !showIpCamera ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMedia={handleUserMedia}
                  onUserMediaError={handleUserMediaError}
                  className="w-full h-full object-cover"
                />
              ) : null}
              {webcamError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-4 max-w-md">
                    <div className="flex justify-center mb-3">
                      <AlertTriangle className="h-12 w-12 text-yellow-500" />
                    </div>
                    <p className="text-white font-medium mb-3 text-lg">Camera Access Error</p>
                    <p className="text-sm text-gray-300 mb-4">{webcamError}</p>

                    <div className="bg-slate-800 p-4 rounded-lg mb-4 text-left">
                      <p className="text-sm text-white font-medium mb-2">Possible solutions:</p>
                      <ul className="text-xs text-gray-300 list-disc pl-5 space-y-1">
                        <li>Use HTTPS instead of HTTP when accessing from other devices</li>
                        <li>Run the app on the device itself using localhost</li>
                        <li>Try using an IP camera instead (click "Use IP Camera" button)</li>
                        <li>Check browser permissions for camera access</li>
                        <li>Try a different browser or device</li>
                      </ul>
                    </div>

                    <div className="flex justify-center">
                      <Button onClick={() => window.location.reload()} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {isCapturing && (
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  Live
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white font-medium">
                  <div className="flex items-center gap-1.5" title="Faces in View">
                    <Users className="h-4 w-4" />
                    <span>{currentFacesInView}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Frames Per Second">
                    <Clock className="h-4 w-4" />
                    <span>{fps} FPS</span>
                  </div>
                  {processingTime && (
                    <div className="flex items-center gap-1.5" title="Server Processing Time">
                      <span>{processingTime}ms</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
            <CardTitle className="text-base sm:text-lg">Last Capture</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearStudentList} className="gap-1.5 h-8 text-xs sm:text-sm px-2.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Reset List
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-secondary shadow-inner ring-1 ring-border">
              {lastCapture ? (
                <img src={lastCapture} alt="Last capture" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <CameraOff className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                    <p className="font-medium text-sm sm:text-base">No Capture Yet</p>
                    <p className="text-xs text-gray-500">Press 'Start' to begin</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <LiveStudentList
        recognizedStudents={recognizedStudents}
        unrecognizedCount={unrecognizedCount}
        unrecognizedFaces={unrecognizedFaces}
        totalFaces={totalFaces}
        processingTime={processingTime || undefined}
      />
    </div>
  );
};

export default WebcamCapture;
