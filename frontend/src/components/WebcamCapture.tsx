import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Pause, Play, RefreshCw, Users, Clock, LogOut, Smartphone, AlertTriangle, CheckCircle2, CameraOff, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { IPCameraInput } from './IPCameraInput';
import { submitLiveAttendance, RecognizedStudent as BaseRecognizedStudent, UnrecognizedFace } from '@/api/attendance';
import { useAppContext } from '@/context/AppContext';
import LiveStudentList from './LiveStudentList';
import { checkMediaDeviceSupport, getCameraErrorMessage } from '@/utils/mediaDeviceUtils';
import WelcomeOverlay from './WelcomeOverlay';

// Add a global declaration for our custom window function
declare global {
  interface Window {
    addGreeting: (name: string, studentId: string) => void;
  }
}

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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(true);

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
    facingMode: facingMode,
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
          // Person has returned after leaving - show greeting!
          existing.attendanceStatus = 'present';
          if (student.name) {
            pushAttendanceMessage(student.name, 'enter');
            if (window.addGreeting) {
              window.addGreeting(student.name, studentId);
            }
          }
          return;
        }

        if (student.action === 'checkin' && existing.attendanceStatus === 'none') {
          existing.attendanceStatus = 'present';
          if (student.name) {
            pushAttendanceMessage(student.name, 'enter');
            if (window.addGreeting) {
              window.addGreeting(student.name, studentId);
            }
          }
        } else if (student.action === 'checkout') {
          existing.attendanceStatus = 'departed';
          if (student.name) {
            pushAttendanceMessage(student.name, 'leave');
            if (window.addGreeting) {
              window.addGreeting(student.name, studentId);
            }
          }
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
          if (window.addGreeting) {
            window.addGreeting(student.name, studentId);
          }
        } else if (initialStatus === 'departed' && student.name) {
          pushAttendanceMessage(student.name, 'leave');
          if (window.addGreeting) {
            window.addGreeting(student.name, studentId);
          }
        }
      }
    });

    trackedStudents.current.forEach((student, studentId) => {
      if (!currentStudentsInView.has(studentId) && student.isPresent) {
        student.isPresent = false;
        if (student.attendanceStatus === 'present' && student.name) {
          student.attendanceStatus = 'departed';
          pushAttendanceMessage(student.name, 'leave');
          if (window.addGreeting) {
            window.addGreeting(student.name, studentId);
          }
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
      const isVideoElement = webcamRef.current instanceof HTMLVideoElement || useIpCamera;
      if (isVideoElement) {
        const video = webcamRef.current as unknown as HTMLVideoElement;
        if (!video.videoWidth || !video.videoHeight) {
          if (video.paused) {
            video.play().catch(err => console.warn('Could not play video:', err));
          }
          return null;
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Reduced quality from 0.9 to 0.7 for faster upload and processing
        return canvas.toDataURL('image/jpeg', 0.7);
      } else {
        const webcam = webcamRef.current as Webcam;
        return typeof webcam.getScreenshot === 'function' ? webcam.getScreenshot() : null;
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
    // Reduced from 100ms to 50ms for faster response
    if (lastProcessedFrame.current && currentTime - parseInt(lastProcessedFrame.current) < 50) {
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

    let imageSrc = null;
    for (let attempt = 0; attempt < 3 && !imageSrc; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 100));
      imageSrc = captureScreenshot();
    }

    // Reduced safety timeout from 30s to 10s for faster recovery
    const safetyTimeout = setTimeout(() => {
      if (isProcessing.current) {
        console.warn('Processing timeout - resetting flag');
        isProcessing.current = false;
      }
    }, 10000);

    try {
      if (!imageSrc) {
        if (useIpCamera && webcamRef.current) {
          const video = webcamRef.current as unknown as HTMLVideoElement;
          const needsRestart = video.paused || video.ended || video.readyState < 2 || !video.srcObject;
          if (needsRestart) {
            if (!video.srcObject && ipCameraStream) video.srcObject = ipCameraStream;
            try {
              if (!(video as any)._screenshotPlayInProgress) {
                (video as any)._screenshotPlayInProgress = true;
                await video.play();
                await new Promise(resolve => setTimeout(resolve, 500));
                (video as any)._screenshotPlayInProgress = false;
              }
            } catch (playErr) {
              setTimeout(() => { (video as any)._screenshotPlayInProgress = false; }, 1000);
            }
          }
        }
        throw new Error("Could not get screenshot. Check camera connection.");
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
          // Log the response for debugging
          console.log("Recognition API response:", JSON.stringify(response.recognized));

          updateTrackedStudents(response.recognized);
          const studentsWithTimestamp = response.recognized.map(student => ({
            ...student,
            timestamp: new Date().toISOString()
          }));
          setRecognizedStudents(prev => {
            // Create a map of existing students for quick lookup
            const existingMap = new Map(prev.map(s => [s.student_id, s]));

            // Process all incoming students
            const updatedStudents = studentsWithTimestamp.map(student => {
              const existingStudent = existingMap.get(student.student_id);

              // If student exists, update their action and messages
              if (existingStudent) {
                existingMap.delete(student.student_id); // Remove from map to track processed students

                // Always use the most recent action from the API
                const action = student.action || existingStudent.action;

                // Use the appropriate message based on action type
                let greetingMessage = null;
                let goodbyeMessage = null;

                if (action === 'checkin') {
                  greetingMessage = student.greeting_message || existingStudent.greeting_message;
                } else if (action === 'checkout') {
                  goodbyeMessage = student.goodbye_message || existingStudent.goodbye_message;
                }

                return {
                  ...existingStudent,
                  action: action,
                  greeting_message: greetingMessage,
                  goodbye_message: goodbyeMessage,
                  score: student.score,
                  timestamp: new Date().toISOString()
                };
              } else {
                // New student - ensure the action is correctly set
                const action = student.action || 'checkin'; // Default to checkin if not set

                // Set appropriate message based on action type
                let newStudent = { ...student };

                if (action === 'checkin' && !student.greeting_message) {
                  newStudent.greeting_message = `Welcome, ${student.name}!`;
                } else if (action === 'checkout' && !student.goodbye_message) {
                  newStudent.goodbye_message = `Goodbye, ${student.name}!`;
                }

                newStudent.action = action;
                return newStudent;
              }
            });

            // Keep any students not in the current recognition batch
            const remainingStudents = Array.from(existingMap.values());

            return [...updatedStudents, ...remainingStudents];
          });
          if (onFaceRecognized) onFaceRecognized();
        }
      }
    } catch (error: any) {
      console.error('Capture error:', error);
      const now = Date.now();
      const lastErrorTime = lastProcessedFrame.current ? parseInt(lastProcessedFrame.current) : 0;
      if (now - lastErrorTime > 5000) {
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
  }, [toast, onFaceRecognized, updateTrackedStudents, captureScreenshot, useIpCamera, ipCameraStream]);

  const startAutoCapture = useCallback(() => {
    setIsCapturing(true);
    frameCount.current = 0;
    lastFpsTime.current = Date.now();
    recentEventRef.current.clear();
    captureAndProcess();
    intervalRef.current = setInterval(captureAndProcess, Math.max(captureInterval, 500));
  }, [captureInterval, captureAndProcess]);

  const stopAutoCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (useIpCamera && ipCameraStream) {
      try {
        ipCameraStream.getTracks().forEach(track => track.stop());
        if (webcamRef.current) {
          const videoEl = webcamRef.current as unknown as HTMLVideoElement;
          if (videoEl.srcObject) videoEl.srcObject = null;
          if (!videoEl.paused) videoEl.pause();
        }
        setIpCameraStream(null);
      } catch (err) {
        console.error("Error stopping IP camera stream:", err);
      }
    }
    isProcessing.current = false;
    setIsCapturing(false);
  }, [useIpCamera, ipCameraStream]);

  const toggleCamera = useCallback(() => {
    const wasCapturing = isCapturing;
    if (wasCapturing) {
      stopAutoCapture();
    }

    // Toggle between front and back camera
    setFacingMode(prevMode => prevMode === "user" ? "environment" : "user");

    // Force any existing stream to stop
    if (webcamRef.current) {
      try {
        const videoEl = webcamRef.current as unknown as HTMLVideoElement;
        if (videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoEl.srcObject = null;
        }
      } catch (err) {
        console.error("Error stopping camera stream:", err);
      }
    }

    // Show a toast notification indicating the camera change
    toast({
      title: `Switching Camera`,
      description: `Attempting to switch to ${facingMode === "user" ? "back" : "front"} camera...`,
      duration: 2000
    });

    // Resume capturing if it was active before
    if (wasCapturing) {
      // Small delay to allow camera to switch before resuming
      setTimeout(() => startAutoCapture(), 1000);
    }
  }, [facingMode, isCapturing, startAutoCapture, stopAutoCapture, toast]);

  const [webcamError, setWebcamError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ipCameraStream) ipCameraStream.getTracks().forEach(track => track.stop());
      setIsCapturing(false);
      isProcessing.current = false;
    };
  }, [ipCameraStream]);

  useEffect(() => {
    if (useIpCamera) {
      stopAutoCapture();
      isProcessing.current = false;
    } else {
      if (ipCameraStream) {
        ipCameraStream.getTracks().forEach(track => track.stop());
        setIpCameraStream(null);
      }
    }
  }, [useIpCamera, ipCameraStream, stopAutoCapture]);

  useEffect(() => {
    if (useIpCamera && ipCameraStream && isCapturing) {
      const recoveryTimer = setInterval(() => {
        const video = webcamRef.current as unknown as HTMLVideoElement;
        if (!video) return;
        const isVideoStalled = video.paused || video.readyState < 2 || (video.currentTime > 0 && video.readyState > 2 && !video.played.length);
        if (isVideoStalled) {
          console.warn('IP camera stream appears stalled, attempting recovery...');
          if (video.paused) {
            if (!(video as any)._recoveryPlayInProgress) {
              (video as any)._recoveryPlayInProgress = true;
              video.play().then(() => {
                (video as any)._recoveryPlayInProgress = false;
              }).catch(err => {
                setTimeout(() => { (video as any)._recoveryPlayInProgress = false; }, 2000);
              });
            }
          }
        }
      }, 5000);
      return () => clearInterval(recoveryTimer);
    }
  }, [useIpCamera, ipCameraStream, isCapturing, toast]);

  const handleUserMedia = useCallback(() => {
    setWebcamError(null);
    toast({ title: "Camera Connected", description: "Webcam access granted successfully" });

    // Always set hasMultipleCameras to true to ensure the flip button is visible
    // This is especially important for mobile devices
    setHasMultipleCameras(true);

    // Still try to detect multiple cameras for logging purposes
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log(`Detected ${videoDevices.length} video input devices`);
          // We don't update hasMultipleCameras here anymore
        })
        .catch(err => {
          console.error("Error checking camera devices:", err);
        });
    }
  }, [toast]);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    const userFriendlyMessage = getCameraErrorMessage(error);
    setWebcamError(userFriendlyMessage);
    const support = checkMediaDeviceSupport();
    const isSecurityIssue = !support.isSecureContext;
    toast({
      title: isSecurityIssue ? "Security Restriction" : "Camera Error",
      description: userFriendlyMessage,
      variant: "destructive",
    });
    stopAutoCapture();
  }, [stopAutoCapture, toast]);

  useEffect(() => {
    const support = checkMediaDeviceSupport();
    if (!support.isSupported) {
      setWebcamError(support.error || "Camera not supported");
      if (!support.isSecureContext) {
        toast({
          title: "Security Restriction",
          description: "Camera access requires HTTPS.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    if (isCapturing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      startAutoCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureInterval]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-1 xs:p-2 pt-4 xs:pt-5 sm:p-4 sm:pt-5 lg:p-6" data-groupid={groupId}>
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {lastAnnouncementRef.current}
      </div>

      <div className="space-y-6 xs:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xs:gap-5 sm:gap-6">
          <Card className="bg-slate-700/50 border-slate-700 overflow-hidden shadow-2xl shadow-black/20">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 xs:gap-4 p-3 xs:p-4 pb-1 xs:pb-2">
              <CardTitle className="text-lg font-bold text-white">Live Camera Feed</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-2">
                  {!isCapturing ? (
                    <Button onClick={startAutoCapture} size="sm" className="h-8 px-3 py-0 gap-1 bg-green-500 hover:bg-green-600 text-white font-semibold transition-transform hover:scale-105 active:scale-95">
                      <Play className="h-3 w-3" /> Start
                    </Button>
                  ) : (
                    <Button onClick={stopAutoCapture} size="sm" variant="destructive" className="h-8 px-3 py-0 gap-1 font-semibold transition-transform hover:scale-105 active:scale-95">
                      <Pause className="h-3 w-3" /> Stop
                    </Button>
                  )}
                  <Button onClick={toggleCamera} variant="outline" size="sm" className="h-8 px-2 py-0 gap-1 bg-black hover:bg-black/80 text-white transition-transform hover:scale-105 active:scale-95">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
                <Button onClick={captureAndProcess} variant="outline" size="sm" className="h-8 px-2 py-0 gap-1 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition-transform hover:scale-105 active:scale-95" disabled={isProcessing.current}>
                  <Camera className="h-3 w-3" /> Manual
                </Button>
                <Button
                  onClick={() => {
                    if (isCapturing) stopAutoCapture();
                    if (ipCameraStream) {
                      ipCameraStream.getTracks().forEach(track => track.stop());
                      setIpCameraStream(null);
                    }
                    setUseIpCamera(false);
                    setShowIpCamera(true);
                  }}
                  variant="outline" size="sm" className="h-8 px-2 py-0 gap-1 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition-transform hover:scale-105 active:scale-95" disabled={isProcessing.current}>
                  <Smartphone className="h-3 w-3" /> IP Cam
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-3 pb-6 sm:p-4 sm:pt-4 sm:pb-8">
              <div className="relative w-full rounded-lg overflow-hidden bg-black shadow-inner ring-1 ring-slate-700 aspect-[3/4] xs:aspect-[3.5/4] sm:aspect-[4/3] md:aspect-[16/11]">
                <WelcomeOverlay />
                {showIpCamera ? (
                  <div className="absolute inset-0 bg-black/90 p-4 z-10">
                    <IPCameraInput
                      onStreamReady={(stream) => {
                        setIpCameraStream(stream);
                        setUseIpCamera(true);
                        setShowIpCamera(false);
                        toast({ title: "Camera Connected", description: "IP camera connected successfully" });
                        setWebcamError(null);
                        setTimeout(() => { if (!isCapturing) startAutoCapture(); }, 1500);
                      }}
                      onError={(error) => toast({ title: "Camera Error", description: error, variant: "destructive" })}
                      onCancel={() => setShowIpCamera(false)}
                    />
                  </div>
                ) : useIpCamera && ipCameraStream ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        webcamRef.current = el as any;
                        el.muted = true;
                        el.autoplay = true;
                        el.playsInline = true;
                        if (el.srcObject !== ipCameraStream) el.srcObject = ipCameraStream;
                        el.onloadedmetadata = () => { setTimeout(() => el.play().catch(console.error), 100); };
                      }
                    }}
                    autoPlay playsInline muted
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <div className="text-center p-4 max-w-md">
                      <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                      <p className="text-white font-medium mb-3 text-lg">Camera Access Error</p>
                      <p className="text-sm text-slate-300 mb-4">{webcamError}</p>
                      <Button onClick={() => window.location.reload()} className="gap-2 bg-black hover:bg-black/80">
                        <RefreshCw className="h-4 w-4" /> Retry
                      </Button>
                    </div>
                  </div>
                )}
                {isCapturing && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold z-10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Live
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-white font-medium">
                    <div className="flex items-center gap-1.5" title="Faces in View"><Users className="h-4 w-4" /><span>{currentFacesInView}</span></div>
                    <div className="flex items-center gap-1.5" title="Frames Per Second"><Clock className="h-4 w-4" /><span>{fps} FPS</span></div>
                    {processingTime && (<div className="flex items-center gap-1.5" title="Server Processing Time"><span>{processingTime}ms</span></div>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-700/50 border-slate-700 overflow-hidden shadow-2xl shadow-black/20">
            <CardHeader className="flex flex-row items-center justify-between gap-3 xs:gap-4 p-3 xs:p-4 pb-1 xs:pb-2">
              <CardTitle className="text-lg font-bold text-white">Last Capture</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearStudentList} className="gap-1.5 text-slate-300 hover:bg-slate-700 hover:text-white">
                <RefreshCw className="h-4 w-4" /> Reset List
              </Button>
            </CardHeader>
            <CardContent className="p-2 pt-3 pb-6 sm:p-4 sm:pt-4 sm:pb-8">
              <div className="aspect-[3/4] xs:aspect-[3.5/4] sm:aspect-[4/3] md:aspect-[16/11] w-full rounded-lg overflow-hidden bg-black shadow-inner ring-1 ring-slate-700">
                {lastCapture ? (
                  <img src={lastCapture} alt="Last capture" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <CameraOff className="h-12 w-12 mx-auto mb-3 text-slate-500" />
                      <p className="font-medium">No Capture Yet</p>
                      <p className="text-xs text-slate-500">Press 'Start' to begin</p>
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
    </div>
  );
};

export default WebcamCapture;
