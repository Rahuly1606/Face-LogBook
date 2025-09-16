import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Webcam from 'react-webcam';
import { Camera, CameraOff, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebcamDiagnosticProps {
  onCapture?: (imageSrc: string) => void;
}

const WebcamDiagnostic: React.FC<WebcamDiagnosticProps> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoConstraints = { width: 1280, height: 720, facingMode: "user" };

  const handleCapture = useCallback(() => {
    if (!webcamRef.current) return;
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        onCapture?.(imageSrc);
      } else {
        setError('Failed to capture an image from the webcam.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during capture.');
    }
  }, [onCapture]);

  const resetCapture = useCallback(() => {
    setCapturedImage(null);
    setError(null);
  }, []);

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle>Webcam Diagnostic Tool</CardTitle>
        <CardDescription>Use this tool to test your camera and ensure it's working correctly for facial recognition.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-secondary shadow-inner ring-1 ring-border flex items-center justify-center">
          {hasCamera === false ? (
            <div className="text-center text-destructive p-4">
              <CameraOff className="h-12 w-12 mx-auto mb-3" />
              <p className="font-bold">Camera Not Available</p>
              <p className="text-sm">{error || "Check browser permissions."}</p>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMedia={() => { setHasCamera(true); setError(null); }}
              onUserMediaError={(err) => { setHasCamera(false); setError(err instanceof DOMException ? err.message : String(err)); }}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleCapture} disabled={hasCamera === false || !!capturedImage} className="gap-2">
              <Camera className="h-4 w-4" /> Capture Test Image
            </Button>
            <Button onClick={resetCapture} variant="outline" disabled={!capturedImage} className="gap-2">
              <RefreshCw className="h-4 w-4" /> New Test
            </Button>
          </div>
          
          {error && hasCamera && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                  <h4 className="font-semibold">An error occurred:</h4>
                  <p>{error}</p>
              </div>
            </div>
          )}

          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <h4 className="font-semibold text-foreground mb-2">Instructions</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ensure your browser has permission to access the camera.</li>
              <li>Position your face clearly in the center of the frame.</li>
              <li>Click <strong>"Capture Test Image"</strong> to take a picture.</li>
              <li>Review the captured image to ensure it is clear and well-lit.</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebcamDiagnostic;