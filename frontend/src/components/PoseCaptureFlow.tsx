/**
 * PoseCaptureFlow
 *
 * Guides the user through 3-pose face capture for registration:
 *   1. Front  – look straight at the camera
 *   2. Left   – turn head slightly left
 *   3. Right  – turn head slightly right
 *
 * After all 3 poses are captured the user sees a review grid and can
 * retake any individual pose before calling onComplete.
 *
 * Props:
 *   onComplete(images: PoseCaptureResult)  – called when user clicks "Confirm & Submit"
 *   disabled                               – disables all controls
 *   poseErrors                             – per-pose error strings from the server
 *                                           (keyed by 'front' | 'left' | 'right')
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronRight, RotateCcw, CheckCircle2, Loader2, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Pose = 'front' | 'left' | 'right';

export interface PoseCaptureResult {
    front: string;
    left: string;
    right: string;
}

interface PoseCaptureFlowProps {
    onComplete: (images: PoseCaptureResult) => void;
    disabled?: boolean;
    /** Per-pose error messages returned from the server */
    poseErrors?: Partial<Record<Pose, string>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POSE_ORDER: Pose[] = ['front', 'left', 'right'];

const POSE_CONFIG: Record<Pose, { label: string; instruction: string; icon: string }> = {
    front: {
        label: 'Front',
        instruction: 'Look straight at the camera. Keep your face level and centred.',
        icon: '😐',
    },
    left: {
        label: 'Left',
        instruction: 'Slowly turn your head slightly to the LEFT. Your entire face should still be visible.',
        icon: '👈',
    },
    right: {
        label: 'Right',
        instruction: 'Slowly turn your head slightly to the RIGHT. Your entire face should still be visible.',
        icon: '👉',
    },
};

type FlowStep = 'capturing' | 'reviewing';
type CamState = 'idle' | 'requesting' | 'streaming' | 'captured' | 'error';
type FacingMode = 'user' | 'environment';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PoseCaptureFlow({
    onComplete,
    disabled = false,
    poseErrors = {},
}: PoseCaptureFlowProps) {
    // All three base64 images — null means not yet captured
    const [captures, setCaptures] = useState<Partial<Record<Pose, string>>>({});

    // Which step the flow is at
    const [flowStep, setFlowStep] = useState<FlowStep>('capturing');

    // During 'capturing', which pose is active
    const [activePose, setActivePose] = useState<Pose>('front');

    // Camera state for the active capture
    const [camState, setCamState] = useState<CamState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [facingMode, setFacingMode] = useState<FacingMode>('user');

    // 'camera' or 'upload' input mode
    const [inputMode, setInputMode] = useState<'camera' | 'upload'>('camera');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

    // ── Camera management ────────────────────────────────────────────────────

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const startStream = useCallback(
        async (facing: FacingMode) => {
            stopStream();
            setCamState('requesting');
            setErrorMsg('');
            setCapturedPreview(null);

            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorMsg('Camera not supported in this browser.');
                setCamState('error');
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
                    await new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('timeout')), 10000);
                        const check = () => {
                            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                                clearTimeout(timeout);
                                resolve();
                            } else {
                                video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
                            }
                        };
                        check();
                    });
                    try { await video.play(); } catch { /* autoplay may have already started */ }
                }
                setCamState('streaming');
            } catch (err: any) {
                const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
                setErrorMsg(
                    denied
                        ? 'Camera access denied. Please allow camera access.'
                        : 'Unable to start camera. Ensure no other app is using it.'
                );
                setCamState('error');
            }
        },
        [stopStream]
    );

    // Start camera when flow mounts or active pose changes (camera mode only)
    useEffect(() => {
        if (flowStep === 'capturing' && inputMode === 'camera') {
            startStream(facingMode);
        }
        return () => { if (flowStep === 'capturing') stopStream(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePose, flowStep, inputMode]);

    // Cleanup on unmount
    useEffect(() => () => stopStream(), [stopStream]);

    // ── Capture a frame ───────────────────────────────────────────────────────

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedPreview(dataUrl);
        setCamState('captured');
        stopStream();
    };

    const handleRetakeCurrent = () => {
        setCapturedPreview(null);
        if (inputMode === 'camera') {
            setCamState('streaming');
            startStream(facingMode);
        } else {
            setCamState('idle');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handle file selected from device gallery / file picker
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrorMsg('Please select an image file (JPEG, PNG, WEBP).');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
                setCapturedPreview(dataUrl);
                setCamState('captured');
            }
        };
        reader.readAsDataURL(file);
    };

    // Switch input mode — stop camera stream when switching to upload
    const handleSwitchMode = (mode: 'camera' | 'upload') => {
        if (mode === inputMode) return;
        stopStream();
        setCapturedPreview(null);
        setCamState('idle');
        setErrorMsg('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setInputMode(mode);
    };

    // Accept the current capture and advance to next pose (or review)
    const handleAccept = () => {
        if (!capturedPreview) return;
        const updated = { ...captures, [activePose]: capturedPreview };
        setCaptures(updated);

        const currentIdx = POSE_ORDER.indexOf(activePose);
        const nextPose = POSE_ORDER[currentIdx + 1];
        if (nextPose) {
            setActivePose(nextPose);
            // Camera will restart via useEffect
        } else {
            // All 3 poses captured → move to review
            stopStream();
            setFlowStep('reviewing');
        }
    };

    // ── Review step ───────────────────────────────────────────────────────────

    const handleRetakePose = (pose: Pose) => {
        setActivePose(pose);
        setCapturedPreview(null);
        setFlowStep('capturing');
    };

    const handleConfirmAll = () => {
        const front = captures.front;
        const left = captures.left;
        const right = captures.right;
        if (front && left && right) {
            onComplete({ front, left, right });
        }
    };

    const allCaptured = !!captures.front && !!captures.left && !!captures.right;
    const isMirrored = facingMode === 'user' && camState === 'streaming';
    const currentCfg = POSE_CONFIG[activePose];
    const hasServerError = poseErrors && Object.keys(poseErrors).length > 0;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Reviewing
    // ─────────────────────────────────────────────────────────────────────────

    if (flowStep === 'reviewing') {
        return (
            <div className="flex flex-col gap-4 w-full">
                {/* Server-side error banner */}
                {hasServerError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Please retake the indicated photo(s):</p>
                            <ul className="mt-1 list-disc list-inside">
                                {Object.entries(poseErrors).map(([pose, msg]) => (
                                    <li key={pose}>
                                        <strong className="capitalize">{pose}:</strong> {msg}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* 3-column photo grid */}
                <div className="grid grid-cols-3 gap-2">
                    {POSE_ORDER.map((pose) => {
                        const src = captures[pose];
                        const serverErr = poseErrors?.[pose];
                        return (
                            <div key={pose} className="flex flex-col items-center gap-1">
                                <div
                                    className={`relative w-full aspect-square rounded-lg overflow-hidden bg-black border-2 ${serverErr ? 'border-destructive' : 'border-border'
                                        }`}
                                >
                                    {src ? (
                                        <img
                                            src={src}
                                            alt={`${pose} pose`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                            <Camera className="h-6 w-6" />
                                        </div>
                                    )}
                                    {src && !serverErr && (
                                        <CheckCircle2 className="absolute top-1 right-1 h-4 w-4 text-green-400 drop-shadow" />
                                    )}
                                    {serverErr && (
                                        <AlertTriangle className="absolute top-1 right-1 h-4 w-4 text-destructive drop-shadow" />
                                    )}
                                </div>
                                <span className="text-xs font-medium capitalize text-center">
                                    {POSE_CONFIG[pose].label}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-black border-black"
                                    onClick={() => handleRetakePose(pose)}
                                    disabled={disabled}
                                >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Retake
                                </Button>
                            </div>
                        );
                    })}
                </div>

                {/* Confirm button */}
                <Button
                    onClick={handleConfirmAll}
                    disabled={!allCaptured || disabled}
                    className="w-full bg-accent hover:bg-accent/90 text-black font-semibold"
                >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm All 3 Photos &amp; Submit
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                    You can retake any photo before submitting.
                </p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: Capturing
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
                {POSE_ORDER.map((pose, idx) => {
                    const done = !!captures[pose] && activePose !== pose;
                    const active = activePose === pose;
                    return (
                        <div key={pose} className="flex items-center gap-1">
                            <div
                                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${done
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : active
                                        ? 'bg-accent border-accent text-black'
                                        : 'bg-background border-muted-foreground text-muted-foreground'
                                    }`}
                            >
                                {done ? '✓' : idx + 1}
                            </div>
                            <span
                                className={`text-xs font-medium ${active ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                            >
                                {POSE_CONFIG[pose].label}
                            </span>
                            {idx < POSE_ORDER.length - 1 && (
                                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Instruction */}
            <div className="text-center px-2">
                <span className="text-2xl">{currentCfg.icon}</span>
                <p className="text-sm font-medium mt-1">{currentCfg.instruction}</p>
            </div>

            {/* Mode switcher tabs */}
            {camState !== 'captured' && (
                <div className="flex w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border">
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('camera')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${inputMode === 'camera'
                            ? 'bg-accent text-black'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        <Camera className="h-3.5 w-3.5" />
                        Use Camera
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSwitchMode('upload')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${inputMode === 'upload'
                            ? 'bg-accent text-black'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Photo
                    </button>
                </div>
            )}

            {/* ── Camera viewport (camera mode) ── */}
            {inputMode === 'camera' && (
                <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border shadow-lg">
                    {/* Live video */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover transition-opacity duration-200 ${camState === 'streaming' ? 'opacity-100' : 'opacity-0'
                            } ${isMirrored ? '-scale-x-100' : ''}`}
                    />

                    {/* Captured still */}
                    {camState === 'captured' && capturedPreview && (
                        <img
                            src={capturedPreview}
                            alt="Captured frame"
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}

                    {/* Oval guide overlay (only during streaming) */}
                    {camState === 'streaming' && (
                        <div className="absolute inset-0 pointer-events-none">
                            <svg viewBox="0 0 300 225" className="w-full h-full">
                                <defs>
                                    <mask id="oval-mask-pose">
                                        <rect width="300" height="225" fill="white" />
                                        <ellipse cx="150" cy="112" rx="80" ry="95" fill="black" />
                                    </mask>
                                </defs>
                                <rect
                                    width="300"
                                    height="225"
                                    fill="rgba(0,0,0,0.35)"
                                    mask="url(#oval-mask-pose)"
                                />
                                <ellipse
                                    cx="150"
                                    cy="112"
                                    rx="80"
                                    ry="95"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.85)"
                                    strokeWidth="2"
                                    strokeDasharray="6 4"
                                />
                            </svg>
                        </div>
                    )}

                    {/* Loading state */}
                    {(camState === 'idle' || camState === 'requesting') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="text-xs">Starting camera…</span>
                        </div>
                    )}

                    {/* Camera error */}
                    {camState === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
                            <Camera className="h-8 w-8 opacity-40" />
                            <span className="text-xs text-red-300">{errorMsg}</span>
                            <p className="text-xs text-gray-400">
                                Or switch to <strong>Upload Photo</strong> above to use a saved image.
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-white border-white"
                                onClick={() => startStream(facingMode)}
                            >
                                Retry Camera
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Upload area (upload mode) ── */}
            {inputMode === 'upload' && camState !== 'captured' && (
                <div
                    className="w-full max-w-sm mx-auto aspect-[4/3] rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center px-4">
                        <p className="text-sm font-medium">Tap to select a photo</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {currentCfg.label} pose — JPEG, PNG or WEBP
                        </p>
                    </div>
                </div>
            )}

            {/* Preview for uploaded image */}
            {inputMode === 'upload' && camState === 'captured' && capturedPreview && (
                <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-lg">
                    <img
                        src={capturedPreview}
                        alt="Uploaded photo"
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Hidden file input & canvas */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* ── Action buttons ── */}
            {camState !== 'captured' ? (
                /* Before capture */
                inputMode === 'camera' ? (
                    <div className="flex flex-col items-center gap-2">
                        <Button
                            size="lg"
                            className="w-full max-w-sm bg-accent hover:bg-accent/90 text-black font-semibold"
                            disabled={camState !== 'streaming'}
                            onClick={handleCapture}
                        >
                            <Camera className="h-5 w-5 mr-2" />
                            Capture Photo
                        </Button>
                        {camState === 'streaming' && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground"
                                onClick={() => {
                                    const next: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
                                    setFacingMode(next);
                                    startStream(next);
                                }}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Flip Camera
                            </Button>
                        )}
                        {camState === 'streaming' && (
                            <p className="text-xs text-muted-foreground">
                                {POSE_ORDER.filter((p) => !captures[p]).length} photo
                                {POSE_ORDER.filter((p) => !captures[p]).length !== 1 ? 's' : ''} remaining
                            </p>
                        )}
                    </div>
                ) : (
                    /* Upload mode idle */
                    <Button
                        size="lg"
                        className="w-full max-w-sm bg-accent hover:bg-accent/90 text-black font-semibold mx-auto"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-5 w-5 mr-2" />
                        Select Photo
                    </Button>
                )
            ) : (
                /* After capture — retake / use */
                <div className="flex gap-3 w-full max-w-sm mx-auto">
                    <Button
                        size="lg"
                        variant="outline"
                        className="flex-1"
                        onClick={handleRetakeCurrent}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Retake
                    </Button>
                    <Button
                        size="lg"
                        className="flex-1 bg-accent hover:bg-accent/90 text-black font-semibold"
                        onClick={handleAccept}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Use Photo
                    </Button>
                </div>
            )}
        </div>
    );
}
