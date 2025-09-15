import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Webcam from 'react-webcam';
import { Camera, XCircle } from 'lucide-react';

interface WebcamDiagnosticProps {
  onCapture?: (imageSrc: string) => void;
}

const WebcamDiagnostic: React.FC<WebcamDiagnosticProps> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  const handleCapture = () => {
    if (!webcamRef.current) return;
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        if (onCapture) onCapture(imageSrc);
      } else {
        setError('Failed to capture image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error capturing image');
      console.error('Webcam capture error:', err);
    }
  };

  const handleUserMedia = () => {
    setHasCamera(true);
    setError(null);
  };

  const handleUserMediaError = (err: string | DOMException) => {
    setHasCamera(false);
    const errorMessage = err instanceof DOMException ? err.message : String(err);
    setError(`Webcam access error: ${errorMessage}`);
    console.error('Webcam error:', err);
  };

  const resetCapture = () => {
    setCapturedImage(null);
  };

  return (
    <div>
      {hasCamera === false && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <h3 className="text-red-700 font-medium mb-2">Camera not available</h3>
          <p className="text-red-600 text-sm">{error || 'Could not access webcam. Please check permissions and try again.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative rounded-lg overflow-hidden bg-secondary">
          {!capturedImage ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="w-full h-auto"
            />
          ) : (
            <div className="relative">
              <img src={capturedImage} alt="Captured" className="w-full h-auto" />
              <Button 
                className="absolute top-2 right-2" 
                size="icon" 
                variant="secondary"
                onClick={resetCapture}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-4">
          <Button 
            onClick={handleCapture} 
            disabled={hasCamera === false || capturedImage !== null}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Capture Image
          </Button>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium mb-1">Camera diagnostic instructions:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ensure your browser has camera permissions</li>
              <li>Click "Capture Image" to test the camera</li>
              <li>Check if your face is correctly detected</li>
              <li>If there are issues, try refreshing or using a different browser</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebcamDiagnostic;