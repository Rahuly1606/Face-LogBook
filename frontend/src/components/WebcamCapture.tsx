import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Play, Pause, RefreshCw, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitLiveAttendance, RecognizedStudent, UnrecognizedFace } from '@/api/attendance';
import { useAppContext } from '@/context/AppContext';
import GreetingToast from './GreetingToast';
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
}

interface GreetingMessage {
  id: string;
  name: string;
  action: 'welcome' | 'goodbye';
  timestamp: number;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onFaceRecognized }) => {
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessing = useRef<boolean>(false);
  const trackedStudents = useRef<Map<string, TrackedStudent>>(new Map());
  const lastProcessedFrame = useRef<string | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [greetingMessages, setGreetingMessages] = useState<GreetingMessage[]>([]);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudent[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [unrecognizedFaces, setUnrecognizedFaces] = useState<UnrecognizedFace[]>([]);
  const [totalFaces, setTotalFaces] = useState(0);
  const [currentFacesInView, setCurrentFacesInView] = useState(0);
  const [fps, setFps] = useState(0);
  
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

  const addGreetingMessage = useCallback((name: string, action: 'welcome' | 'goodbye') => {
    const message: GreetingMessage = {
      id: `${name}-${action}-${Date.now()}`,
      name,
      action,
      timestamp: Date.now()
    };
    
    setGreetingMessages(prev => [...prev, message]);
    
    // Auto-remove message after 3 seconds
    setTimeout(() => {
      setGreetingMessages(prev => prev.filter(msg => msg.id !== message.id));
    }, 3000);
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
        
        // Check if student was absent and now present
        if (!existing.isPresent) {
          existing.isPresent = true;
          addGreetingMessage(student.name, 'welcome');
        }
      } else {
        // New student detected
        const newTrackedStudent: TrackedStudent = {
          student_id: studentId,
          name: student.name,
          lastSeen: currentTime,
          isPresent: true,
          bbox: student.bbox,
          confidence: student.score
        };
        
        trackedStudents.current.set(studentId, newTrackedStudent);
        addGreetingMessage(student.name, 'welcome');
      }
    });
    
    // Check for students who left the view
    trackedStudents.current.forEach((student, studentId) => {
      if (!currentStudents.has(studentId) && student.isPresent) {
        // Student left the view
        student.isPresent = false;
        addGreetingMessage(student.name, 'goodbye');
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
  }, [addGreetingMessage]);

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
        // Update tracked students
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
  }, [toast]);

  const startAutoCapture = useCallback(() => {
    setIsCapturing(true);
    frameCount.current = 0;
    lastFpsTime.current = Date.now();
    
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
  }, [captureInterval, startAutoCapture, stopAutoCapture]);

  return (
    <>
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

      {/* Multiple greeting messages */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {greetingMessages.map((message) => (
          <GreetingToast
            key={message.id}
            name={message.name}
            action={message.action === 'welcome' ? 'checkin' : 'checkout'}
            onClose={() => {
              setGreetingMessages(prev => prev.filter(msg => msg.id !== message.id));
            }}
          />
        ))}
      </div>
    </>
  );
};

export default WebcamCapture;