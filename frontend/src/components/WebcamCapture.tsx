import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, CameraOff, Play, Pause, RefreshCw, Users, Clock, CheckCircle2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitLiveAttendance, RecognizedStudent as BaseRecognizedStudent, UnrecognizedFace } from '@/api/attendance';
import { useAppContext } from '@/context/AppContext';
import LiveStudentList from './LiveStudentList';

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

  const captureAndProcess = useCallback(async () => {
    if (!webcamRef.current || isProcessing.current) return;
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

    const safetyTimeout = setTimeout(() => {
      if (isProcessing.current) {
        console.warn('Processing timeout - resetting flag');
        isProcessing.current = false;
      }
    }, 30000);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not get screenshot.");
      
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
      toast({
        title: "Capture Error",
        description: error.message || "Failed to process image",
        variant: "destructive",
      });
    } finally {
      isProcessing.current = false;
      clearTimeout(safetyTimeout);
    }
  }, [toast, onFaceRecognized, updateTrackedStudents]);
  
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
    setIsCapturing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isCapturing) {
      const currentInterval = intervalRef.current;
      if(currentInterval) clearInterval(currentInterval);
      startAutoCapture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureInterval]);

  // JSX
  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8" data-groupid={groupId}>
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {lastAnnouncementRef.current}
      </div>

      {isCapturing && (
        <div
          ref={panelRef}
          onScroll={handlePanelScroll}
          className="fixed z-50 top-4 inset-x-4 md:inset-x-auto md:right-6 md:top-6 md:bottom-6 md:w-72 max-h-[30vh] md:max-h-none overflow-y-auto bg-background/20 dark:bg-black/20 backdrop-blur-xl rounded-2xl ring-1 ring-border shadow-2xl space-y-3 p-3 md:p-4"
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className="bg-background/80 dark:bg-white/10 rounded-lg p-3 flex items-center gap-3 shadow-md transition-transform hover:scale-[1.02]"
            >
              <div className={`flex-shrink-0 rounded-full p-1.5 ${msg.kind === 'enter' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                {msg.kind === 'enter' ? <CheckCircle2 className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              </div>
              <div className="text-sm font-medium text-foreground">{msg.text}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <CardTitle>Live Camera Feed</CardTitle>
            <div className="flex flex-grow sm:flex-grow-0 items-center gap-2">
              {!isCapturing ? (
                <Button onClick={startAutoCapture} className="gap-2 w-full sm:w-auto">
                  <Play className="h-4 w-4" /> Start
                </Button>
              ) : (
                <Button onClick={stopAutoCapture} variant="destructive" className="gap-2 w-full sm:w-auto">
                  <Pause className="h-4 w-4" /> Stop
                </Button>
              )}
              <Button onClick={captureAndProcess} variant="outline" className="gap-2 w-full sm:w-auto" disabled={isProcessing.current}>
                <Camera className="h-4 w-4" /> Manual
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-secondary shadow-inner ring-1 ring-border">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
              />
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Last Capture</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearStudentList} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Reset List
            </Button>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-secondary shadow-inner ring-1 ring-border">
              {lastCapture ? (
                <img src={lastCapture} alt="Last capture" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <CameraOff className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium">No Capture Yet</p>
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
