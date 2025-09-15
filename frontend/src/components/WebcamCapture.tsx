import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Play, Pause, RefreshCw, Users, Clock, CheckCircle2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitLiveAttendance, RecognizedStudent as BaseRecognizedStudent, UnrecognizedFace } from '@/api/attendance';

// Extend RecognizedStudent to include optional goodbye_message property (should be string, not boolean)
export interface RecognizedStudent extends BaseRecognizedStudent {
  goodbye_message?: string;
}
import { useAppContext } from '@/context/AppContext';
import LiveStudentList from './LiveStudentList';

interface WebcamCaptureProps {
  groupId?: number;
  standalone?: boolean;
  onFaceRecognized?: () => void;
}

interface TrackedStudent {
  student_id: string;
  name: string;
  lastSeen: number;
  isPresent: boolean;
  bbox?: number[];
  confidence: number;
  hasAttendanceMarked: boolean;
}

// Removed earlier pop message type (GreetingToast)

// Attendance message stream for right-side overlay
interface AttendanceMessage {
  id: string; // unique
  text: string;
  kind: 'enter' | 'leave';
  name: string;
  at: number;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onFaceRecognized }) => {
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessing = useRef<boolean>(false);
  const trackedStudents = useRef<Map<string, TrackedStudent>>(new Map());
  const lastProcessedFrame = useRef<string | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  // Removed earlier pop messages (GreetingToast)
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudent[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [unrecognizedFaces, setUnrecognizedFaces] = useState<UnrecognizedFace[]>([]);
  const [totalFaces, setTotalFaces] = useState(0);
  const [currentFacesInView, setCurrentFacesInView] = useState(0);
  const [fps, setFps] = useState(0);

  // Right-side attendance messages overlay state
  const [messages, setMessages] = useState<AttendanceMessage[]>([]); // newest first
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [userAtTop, setUserAtTop] = useState(true);
  const lastAnnouncementRef = useRef('');
  // Dedup map: key `${id}-${kind}` -> timestamp
  const recentEventRef = useRef<Map<string, number>>(new Map());

  const { captureInterval } = useAppContext();
  const { toast } = useToast();

  // Performance tracking
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  const clearStudentList = useCallback(() => {
    setRecognizedStudents([]);
    setUnrecognizedCount(0);
    setUnrecognizedFaces([]);
    setTotalFaces(0);
    trackedStudents.current.clear();
  }, []);

  // Add message to right panel (newest first) with deduplication window
  const pushAttendanceMessage = useCallback((name: string, kind: 'enter' | 'leave') => {
    const now = Date.now();
    const key = `${name}-${kind}`;
    const last = recentEventRef.current.get(key) || 0;
    const DEDUP_MS = 5000; // configurable
    if (now - last < DEDUP_MS) {
      return;
    }
    recentEventRef.current.set(key, now);

    const text = kind === 'enter' ? `Welcome ${name} — attendance marked` : `Goodbye ${name} — left`;
    const msg: AttendanceMessage = {
      id: `${key}-${now}`,
      text,
      kind,
      name,
      at: now,
    };

    setMessages(prev => [msg, ...prev].slice(0, 500)); // cap to avoid unbounded growth

    // Announce for screen readers
    lastAnnouncementRef.current = text;
    // Auto-scroll to top only if user is already near top
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      if (userAtTop) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, [userAtTop]);

  // Track scroll to decide auto-scroll behavior
  const handlePanelScroll = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    // Newest at top: user "at top" means scrollTop <= threshold
    const threshold = 8;
    setUserAtTop(el.scrollTop <= threshold);
  }, []);

  const updateTrackedStudents = useCallback((recognizedStudents: RecognizedStudent[]) => {
    const currentTime = Date.now();
    const currentStudents = new Set<string>();
    
    // Update existing tracked students and mark new ones
    recognizedStudents.forEach(student => {
      const studentId = student.student_id;
      currentStudents.add(studentId);
      
      const existing = trackedStudents.current.get(studentId);
      
      if (existing) {
        // Update existing student
        existing.lastSeen = currentTime;
        existing.bbox = student.bbox;
        existing.confidence = student.score;
        
        // Update attendance status based on action
        if (student.action === 'checkin') {
          console.log(`Attendance marked for ${student.name}`);
          existing.hasAttendanceMarked = true;
          // Panel message
          if (student.name) pushAttendanceMessage(student.name, 'enter');
        } else if (student.action === 'checkout') {
          console.log(`Checkout processed for ${student.name}`);
          existing.hasAttendanceMarked = true; // They had attendance, now checking out
          if (student.name) pushAttendanceMessage(student.name, 'leave');
        }
        
        // Check if student was absent and now present
        if (!existing.isPresent) {
          existing.isPresent = true;
        }
      } else {
        // New student detected
        const newTrackedStudent: TrackedStudent = {
          student_id: studentId,
          name: student.name,
          lastSeen: currentTime,
          isPresent: true,
          bbox: student.bbox,
          confidence: student.score,
          hasAttendanceMarked: student.action === 'checkin' || student.action === 'checkout'
        };
        
        trackedStudents.current.set(studentId, newTrackedStudent);
        
        // Show appropriate message based on action
        if (student.action === 'checkin') {
          console.log(`New student ${student.name} - attendance marked, showing welcome`);
          if (student.name) pushAttendanceMessage(student.name, 'enter');
        } else if (student.action === 'checkout') {
          console.log(`New student ${student.name} - checkout processed, showing goodbye`);
          if (student.name) pushAttendanceMessage(student.name, 'leave');
        } else {
          console.log(`New student ${student.name} detected but no attendance action`);
        }
      }
    });
    
    // Check for students who left the view
    trackedStudents.current.forEach((student, studentId) => {
      if (!currentStudents.has(studentId) && student.isPresent) {
        // Student left the view
        console.log(`Student ${student.name} left view. Has attendance marked: ${student.hasAttendanceMarked}`);
        student.isPresent = false;
        
        // Goodbye message only if they had attendance
        if (student.hasAttendanceMarked && student.name) {
          pushAttendanceMessage(student.name, 'leave');
        }
      }
    });
    
    // Clean up old tracked students (not seen for more than 10 seconds)
    const cleanupTime = currentTime - 10000;
    trackedStudents.current.forEach((student, studentId) => {
      if (student.lastSeen < cleanupTime) {
        trackedStudents.current.delete(studentId);
      }
    });
    
    setCurrentFacesInView(currentStudents.size);
  }, [pushAttendanceMessage]);

  const captureAndProcess = useCallback(async () => {
    if (!webcamRef.current) return;

    // Skip if already processing
    if (isProcessing.current) {
      return;
    }

    // Performance optimization: Skip frames if processing is taking too long
    const currentTime = Date.now();
    if (lastProcessedFrame.current && currentTime - parseInt(lastProcessedFrame.current) < 100) {
      return;
    }

    isProcessing.current = true;
    lastProcessedFrame.current = currentTime.toString();

    // Update FPS counter
    frameCount.current++;
    if (currentTime - lastFpsTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsTime.current = currentTime;
    }

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (isProcessing.current) {
        console.warn('Processing timeout - resetting flag');
        isProcessing.current = false;
      }
    }, 30000);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        isProcessing.current = false;
        clearTimeout(safetyTimeout);
        return;
      }

      setLastCapture(imageSrc);

      // Convert base64 to blob
      const base64Response = await fetch(imageSrc);
      const blob = await base64Response.blob();

      // Submit to backend
      const response = await submitLiveAttendance(blob);
      
      // Check if there was an error
      if (response.error) {
        console.error('API error:', response.errorMessage);
        
        // Check if this is a timeout error
        if (response.errorMessage?.includes('timeout') || response.errorMessage?.includes('too many faces')) {
          toast({
            title: "Processing Timeout",
            description: "Too many faces detected - try with fewer people in frame",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Connection Error",
            description: "Could not connect to the backend server. Retrying...",
            variant: "destructive",
          });
        }
        
        isProcessing.current = false;
        clearTimeout(safetyTimeout);
        return;
      }
      
      setProcessingTime(response.processing_time_ms);
      setTotalFaces(response.total_faces || 0);
      
      // Update unrecognized count
      setUnrecognizedCount(response.unrecognized_count || 0);
      
      // Update unrecognized faces
      if (response.unrecognized_faces) {
        setUnrecognizedFaces(response.unrecognized_faces);
      }

      // Handle recognized students with tracking
      if (response.recognized && response.recognized.length > 0) {
        console.log('Received recognized students:', response.recognized);
        // Show goodbye or attendance message in panel if present in API response
        response.recognized.forEach(student => {
          if ((student as any).goodbye_message) {
            if (student.name) pushAttendanceMessage(student.name, 'leave');
          } else if (student.action === 'checkin') {
            if (student.name) pushAttendanceMessage(student.name, 'enter');
          }
        });
        // Update tracked students (handles greeting messages internally)
        updateTrackedStudents(response.recognized);
        // Add timestamp to each student
        const studentsWithTimestamp = response.recognized.map(student => ({
          ...student,
          timestamp: new Date().toISOString()
        }));
        // Update the recognized students list (avoid duplicates)
        setRecognizedStudents(prev => {
          const existingIds = new Set(prev.map(s => s.student_id));
          const newStudents = studentsWithTimestamp.filter(s => !existingIds.has(s.student_id));
          return [...prev, ...newStudents];
        });
        if (onFaceRecognized) {
          onFaceRecognized();
        }
      }

      // Reset the processing flag and clear safety timeout
      isProcessing.current = false;
      clearTimeout(safetyTimeout);
    } catch (error: any) {
      console.error('Capture error:', error);
      toast({
        title: "Capture Error",
        description: error.message || "Failed to process image",
        variant: "destructive",
      });
      
      // Make sure to reset the processing flag on error and clear safety timeout
      isProcessing.current = false;
      clearTimeout(safetyTimeout);
    }
  }, [toast, pushAttendanceMessage, onFaceRecognized, updateTrackedStudents]);

  const startAutoCapture = useCallback(() => {
    setIsCapturing(true);
    frameCount.current = 0;
    lastFpsTime.current = Date.now();
    setMessages([]); // clear panel on new session start
    recentEventRef.current.clear();
    
    // Initial capture
    captureAndProcess();
    
    // Set up interval with optimized timing
    intervalRef.current = setInterval(() => {
      captureAndProcess();
    }, Math.max(captureInterval, 500)); // Minimum 500ms interval for performance
  }, [captureInterval, captureAndProcess]);

  const stopAutoCapture = useCallback(() => {
    setIsCapturing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Clear messages immediately; could be replaced with fade-out if desired
    setMessages([]);
  }, []);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Restart interval if capturing and interval changes
    if (isCapturing) {
      stopAutoCapture();
      startAutoCapture();
    }
  }, [captureInterval, startAutoCapture, stopAutoCapture, isCapturing]);

  return (
    <>
      {/* Offscreen live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {lastAnnouncementRef.current}
      </div>

      {/* Right-side attendance messages overlay */}
      {isCapturing && (
        <div
          ref={panelRef}
          onScroll={handlePanelScroll}
          className="fixed z-50 overflow-y-auto 
inset-x-2 bottom-24 top-auto h-56 max-w-none 
md:right-4 md:top-4 md:bottom-4 md:inset-x-auto md:w-80 md:h-auto 
bg-white/5 backdrop-blur-md rounded-xl p-3 md:p-4 shadow-lg space-y-2 md:space-y-3"
        >
          {/* Newest on top: list already ordered newest-first */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className="bg-white/5 rounded-md p-2.5 md:p-3 flex items-start gap-2.5 md:gap-3 shadow-sm"
            >
              <div className={`mt-0.5 ${msg.kind === 'enter' ? 'text-green-700' : 'text-amber-700'}`}>
                {msg.kind === 'enter' ? <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" /> : <LogOut className="h-4 w-4 md:h-5 md:w-5" />}
              </div>
              <div className="text-sm md:text-base font-semibold text-gray-900">
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">Live Camera Feed</h3>
            <div className="flex gap-2">
              {!isCapturing ? (
                <Button 
                  onClick={startAutoCapture}
                  variant="default"
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Capture
                </Button>
              ) : (
                <Button 
                  onClick={stopAutoCapture}
                  variant="destructive"
                  className="gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Stop Capture
                </Button>
              )}
              <Button
                onClick={captureAndProcess}
                variant="outline"
                className="gap-2"
                disabled={isProcessing.current}
              >
                <Camera className="h-4 w-4" />
                Manual Capture
              </Button>
            </div>
          </div>
          
          <div className="relative rounded-lg overflow-hidden bg-secondary">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-auto"
            />
            {isCapturing && (
              <div className="absolute top-4 right-4 bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                Recording
              </div>
            )}
            
            {/* Performance indicators */}
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{currentFacesInView} in view</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{fps} FPS</span>
                </div>
                {processingTime && (
                  <div className="flex items-center gap-1">
                    <span>{processingTime}ms</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">Last Capture</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearStudentList}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Reset List
            </Button>
          </div>
          <div className="rounded-lg overflow-hidden bg-secondary">
            {lastCapture ? (
              <img 
                src={lastCapture} 
                alt="Last capture" 
                className="w-full h-auto"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <CameraOff className="h-12 w-12 mx-auto mb-2" />
                  <p>No capture yet</p>
                </div>
              </div>
            )}
          </div>
          
          {processingTime !== null && (
            <div className="mt-4 text-sm text-muted-foreground">
              Processing time: {processingTime}ms
            </div>
          )}
        </Card>
      </div>

      <LiveStudentList
        recognizedStudents={recognizedStudents}
        unrecognizedCount={unrecognizedCount}
        unrecognizedFaces={unrecognizedFaces}
        totalFaces={totalFaces}
        processingTime={processingTime || undefined}
        clearList={clearStudentList}
      />

      {/* Earlier pop messages removed */}
    </>
  );
};

export default WebcamCapture;