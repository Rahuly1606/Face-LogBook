/**
 * CameraCapture
 *
 * A mobile-friendly camera component that:
 *  - Shows a live video preview
 *  - Allows switching between front (user) and rear (environment) camera
 *  - Captures a single frame on demand
 *  - Lets the user retake until satisfied
 *  - Calls `onCapture(base64DataUrl)` with the confirmed image
 *  - Calls `onClear()` when the user retakes a photo
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, RotateCcw, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CameraCaptureProps {
    /** Called once the user confirms ("Use Photo") with a JPEG data-URL */
    onCapture: (dataUrl: string) => void;
    /** Called when the user clicks "Retake" – clears the confirmed image */
    onClear: () => void;
    /** Whether to show the component in a disabled/loading state */
    disabled?: boolean;
}

type CameraState = 'idle' | 'requesting' | 'streaming' | 'captured' | 'error';
type FacingMode = 'user' | 'environment';

// ─── Component ──────────────────────────────────────────────────────────────

export default function CameraCapture({ onCapture, onClear, disabled = false }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [cameraState, setCameraState] = useState<CameraState>('idle');
    const [facingMode, setFacingMode] = useState<FacingMode>('user');
    const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // ── Stream management ──────────────────────────────────────────────────

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const startStream = useCallback(
        async (facing: FacingMode) => {
            stopStream();
            setCameraState('requesting');
            setErrorMessage('');

            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorMessage('Camera not supported in this browser.');
                setCameraState('error');
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing },
                    audio: false,
                });

                streamRef.current = stream;
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;

                    // Wait for the video to have actual frame data available
                    await new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Video timeout')), 10000);

                        const checkVideo = () => {
                            // Check if video has loaded enough data to show frames
                            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                                clearTimeout(timeout);
                                resolve();
                            } else {
                                video.onloadeddata = () => {
                                    clearTimeout(timeout);
                                    resolve();
                                };
                            }
                        };

                        checkVideo();
                    });

                    // Ensure video is playing
                    try {
                        await video.play();
                    } catch (playErr) {
                        console.log('Play started automatically or error:', playErr);
                    }
                }
                setCameraState('streaming');
            } catch (err: any) {
                const isDenied =
                    err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
                setErrorMessage(
                    isDenied
                        ? 'Camera access denied. Please allow camera access and try again.'
                        : 'Unable to start camera. Make sure no other app is using it.'
                );
                setCameraState('error');
            }
        },
        [stopStream]
    );

    // Start camera when component mounts
    useEffect(() => {
        startStream(facingMode);
        return () => stopStream();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Switch camera (front ↔ back) ──────────────────────────────────────

    const handleSwitch = async () => {
        if (cameraState === 'captured') return;
        const next: FacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(next);
        try {
            await startStream(next);
        } catch {
            // If the target facing mode doesn't exist, flip back
            setFacingMode(facingMode);
            startStream(facingMode);
        }
    };

    // ── Capture a frame ────────────────────────────────────────────────────

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Mirror front-camera so the preview feels natural
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedDataUrl(dataUrl);
        setCameraState('captured');
        stopStream();
    };

    // ── Confirm the captured photo ─────────────────────────────────────────

    const handleConfirm = () => {
        if (capturedDataUrl) onCapture(capturedDataUrl);
    };

    // ── Retake ─────────────────────────────────────────────────────────────

    const handleRetake = () => {
        setCapturedDataUrl(null);
        setCameraState('streaming');
        onClear();
        startStream(facingMode);
    };

    // ── UI helpers ─────────────────────────────────────────────────────────

    const isMirrored = facingMode === 'user' && cameraState === 'streaming';

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            {/* ── Video / Preview area ── */}
            <div className="relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border shadow-lg">
                {/* Live video stream */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-opacity duration-200 ${cameraState === 'streaming' ? 'opacity-100' : 'opacity-0'
                        } ${isMirrored ? '-scale-x-100' : ''}`}
                />

                {/* Captured still */}
                {cameraState === 'captured' && capturedDataUrl && (
                    <img
                        src={capturedDataUrl}
                        alt="Captured photo"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {/* Loading state */}
                {cameraState === 'requesting' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">Starting camera&hellip;</p>
                    </div>
                )}

                {/* Error state */}
                {cameraState === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-4 text-center">
                        <CameraOff className="h-10 w-10 text-destructive" />
                        <p className="text-sm text-destructive-foreground">{errorMessage}</p>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startStream(facingMode)}
                            className="mt-1"
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* Idle placeholder */}
                {cameraState === 'idle' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-4">
                        <Camera className="h-10 w-10 text-muted-foreground" />
                        <Button size="sm" onClick={() => startStream(facingMode)}>
                            Open Camera
                        </Button>
                    </div>
                )}

                {/* Face-guidance overlay (only while streaming) */}
                {cameraState === 'streaming' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-52 rounded-full border-2 border-white/60 opacity-50" />
                    </div>
                )}

                {/* Switch-camera button (top-right) — always show while streaming */}
                {cameraState === 'streaming' && (
                    <button
                        onClick={handleSwitch}
                        disabled={disabled}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 active:scale-95 transition-all"
                        aria-label="Flip camera"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Hidden canvas – used for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* ── Action buttons ── */}
            {cameraState === 'streaming' && (
                <Button
                    onClick={handleCapture}
                    disabled={disabled}
                    size="lg"
                    className="w-full max-w-sm bg-accent hover:bg-accent/90 text-black font-semibold"
                >
                    <Camera className="h-5 w-5 mr-2" />
                    Take Photo
                </Button>
            )}

            {cameraState === 'captured' && (
                <div className="flex gap-3 w-full max-w-sm">
                    <Button
                        onClick={handleRetake}
                        disabled={disabled}
                        variant="outline"
                        className="flex-1"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Retake
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={disabled}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Use Photo
                    </Button>
                </div>
            )}

            {cameraState === 'error' && (
                <p className="text-sm text-destructive text-center px-4">{errorMessage}</p>
            )}
        </div>
    );
}
