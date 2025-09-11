import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitLiveAttendance } from '@/api/attendance';
import { useAppContext } from '@/context/AppContext';
import GreetingToast from './GreetingToast';

const WebcamCapture: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [greetingData, setGreetingData] = useState<{ name: string; action: string } | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const { captureInterval } = useAppContext();
  const { toast } = useToast();

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  const captureAndProcess = useCallback(async () => {
    if (!webcamRef.current) return;

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      setLastCapture(imageSrc);

      // Convert base64 to blob
      const base64Response = await fetch(imageSrc);
      const blob = await base64Response.blob();

      // Submit to backend
      const response = await submitLiveAttendance(blob);
      setProcessingTime(response.processing_time_ms);

      // Handle recognized students
      if (response.recognized && response.recognized.length > 0) {
        response.recognized.forEach((student) => {
          if (student.action) {
            setGreetingData({
              name: student.name,
              action: student.action
            });
          }
        });
      }
    } catch (error: any) {
      console.error('Capture error:', error);
      toast({
        title: "Capture Error",
        description: error.message || "Failed to process image",
        variant: "destructive",
      });
    }
  }, [toast]);

  const startAutoCapture = useCallback(() => {
    setIsCapturing(true);
    // Initial capture
    captureAndProcess();
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      captureAndProcess();
    }, captureInterval);
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
  }, [captureInterval]);

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
          </div>

          {processingTime !== null && (
            <div className="mt-4 text-sm text-muted-foreground">
              Processing time: {processingTime}ms
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground">Last Capture</h3>
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
        </Card>
      </div>

      {greetingData && (
        <GreetingToast
          name={greetingData.name}
          action={greetingData.action}
          onClose={() => setGreetingData(null)}
        />
      )}
    </>
  );
};

export default WebcamCapture;