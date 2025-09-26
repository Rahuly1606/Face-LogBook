import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CapturePhotoProps {
    onCapture: (file: File) => void;
    isOpen: boolean;
    onClose: () => void;
}

const CapturePhoto: React.FC<CapturePhotoProps> = ({ onCapture, isOpen, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Start camera when dialog opens
    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
            setCapturedImage(null);
            setError(null);
        }

        return () => {
            stopCamera();
        };
    }, [isOpen]);

    const startCamera = async () => {
        setIsCapturing(true);
        setError(null);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => {
                    setIsCameraReady(true);
                    setIsCapturing(false);
                };
            }
        } catch (err: any) {
            console.error('Error accessing camera:', err);
            setError(err.message || 'Could not access camera. Please check permissions.');
            setIsCapturing(false);
            toast({
                title: "Camera Error",
                description: err.name === 'NotAllowedError' ?
                    "Camera access denied. Please allow camera permissions in your browser settings." :
                    "Error accessing camera. Please check your device.",
                variant: "destructive",
            });
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraReady(false);
    };

    const takePhoto = useCallback(() => {
        if (!isCameraReady || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas dimensions to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(dataUrl);

            // Stop camera stream after capturing
            stopCamera();
        }
    }, [isCameraReady]);

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    const usePhoto = useCallback(() => {
        if (!capturedImage) return;

        // Convert data URL to File object
        canvasRef.current?.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `captured-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
                onClose();
            }
        }, 'image/jpeg', 0.8);
    }, [capturedImage, onCapture, onClose]);

    // Handle keyboard accessibility
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'Enter':
                    if (capturedImage) {
                        usePhoto();
                    } else if (isCameraReady) {
                        takePhoto();
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
                case 'r':
                    if (capturedImage) {
                        retakePhoto();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, capturedImage, isCameraReady, usePhoto, takePhoto]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md" aria-labelledby="camera-dialog-title">
                <DialogHeader>
                    <DialogTitle id="camera-dialog-title">Capture Photo</DialogTitle>
                </DialogHeader>

                <div className="relative w-full">
                    {/* Error state */}
                    {error && (
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-destructive rounded-md bg-destructive/10 text-center space-y-4">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                            <div>
                                <p className="font-medium text-destructive">{error}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Please check your camera permissions or try a different device.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={startCamera}
                                aria-label="Try again"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {/* Loading state */}
                    {isCapturing && !error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-md">
                            <div className="flex flex-col items-center">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                <span className="mt-2 text-sm">Initializing camera...</span>
                            </div>
                        </div>
                    )}

                    {/* Live camera view */}
                    {!capturedImage && !error && (
                        <div className={cn(
                            "overflow-hidden rounded-md bg-muted transition-opacity",
                            isCameraReady ? "opacity-100" : "opacity-50"
                        )}>
                            <video
                                ref={videoRef}
                                className="w-full h-auto object-cover aspect-video"
                                autoPlay
                                playsInline
                                muted
                                aria-label="Camera preview"
                            />
                        </div>
                    )}

                    {/* Captured image preview */}
                    {capturedImage && (
                        <div className="overflow-hidden rounded-md bg-muted">
                            <img
                                src={capturedImage}
                                alt="Captured"
                                className="w-full h-auto object-contain aspect-video"
                                aria-label="Captured photo preview"
                            />
                        </div>
                    )}

                    {/* Hidden canvas for processing */}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <DialogFooter className="flex sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        aria-label="Cancel and close camera"
                    >
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>

                    <div className="flex gap-2">
                        {capturedImage ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={retakePhoto}
                                    aria-label="Retake photo"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" /> Retake
                                </Button>
                                <Button
                                    type="button"
                                    onClick={usePhoto}
                                    aria-label="Use this photo"
                                >
                                    <Check className="mr-2 h-4 w-4" /> Use Photo
                                </Button>
                            </>
                        ) : (
                            <Button
                                type="button"
                                onClick={takePhoto}
                                disabled={!isCameraReady || isCapturing || !!error}
                                aria-label="Take photo"
                            >
                                <Camera className="mr-2 h-4 w-4" /> Take Photo
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CapturePhoto;