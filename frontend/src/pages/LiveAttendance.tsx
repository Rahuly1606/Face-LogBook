import { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, CameraOff, Loader2, Check, Users, Play, Pause, BookOpen, AlertCircle } from 'lucide-react';
import { attendanceApi, groupApi } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnrecognizedCarousel, type UnrecognizedFace } from '@/components/UnrecognizedCarousel';

// #10 — unified entry type (replaces separate detectedQueue + OverlayEntry)
interface DetectionEntry {
    id: string;
    name: string;
    time: string;
    status: 'in' | 'out';
    confidence_tier?: string;
}

export default function LiveAttendance() {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    // #1 — ref-based loading guard; reliable inside setInterval closures
    const loadingRef = useRef(false);
    // #3 — track overlay expiry timeouts so they can be cleared on unmount
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
    // #7 — consecutive-error counter for auto-stop
    const consecutiveErrorsRef = useRef(0);
    // #8 — rolling window of capture durations
    const captureTimesRef = useRef<number[]>([]);
    // #2 — stream ref so the cleanup effect always sees the current stream
    const streamRef = useRef<MediaStream | null>(null);
    // #5 — session tracking
    const sessionStartRef = useRef<Date | null>(null);
    const markedDuringSession = useRef<Set<string>>(new Set());

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [continuousMode, setContinuousMode] = useState(false);
    const [loading, setLoading] = useState(false);
    // #8 — average ms per full capture cycle
    const [captureRate, setCaptureRate] = useState<number | null>(null);
    // #9 — camera permission denial state
    const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
    // #5 — session summary shown after camera stops
    const [sessionSummary, setSessionSummary] = useState<{
        duration: number;
        uniqueStudents: number;
        startTime: Date;
    } | null>(null);

    // Group/Section selection state
    const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loadingGroups, setLoadingGroups] = useState(false);

    // #10 — single unified list (replaces detectedQueue + overlayEntries)
    const [detectionEntries, setDetectionEntries] = useState<DetectionEntry[]>([]);
    // Unrecognised faces returned from the last detection cycle
    const [unrecognizedFaces, setUnrecognizedFaces] = useState<UnrecognizedFace[]>([]);

    const [wrongSectionStudents, setWrongSectionStudents] = useState<Array<{
        student_id: string;
        name: string;
        confidence: number;
        group_name?: string;
        message?: string;
    }>>([]);
    const [presentStudents, setPresentStudents] = useState<Array<{
        student_id: string;
        name: string;
        in_time: string;
        group_name?: string;
    }>>([]);
    const [liveStats, setLiveStats] = useState({
        totalInFrame: 0,
        recognizedCount: 0,
        unrecognizedCount: 0,
        lastUpdate: null as Date | null,
    });

    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            const groups = await groupApi.getAll();
            setGroups(groups || []);
        } catch (error: any) {
            console.error('Failed to load groups:', error);
            toast({
                title: 'Error',
                description: 'Failed to load sections/groups',
                variant: 'destructive',
            });
        } finally {
            setLoadingGroups(false);
        }
    };

    const startCamera = async () => {
        // Validate group selection before starting camera
        if (!selectedGroupId) {
            toast({
                title: 'Section Required',
                description: 'Please select a section/group before starting the camera',
                variant: 'destructive',
            });
            return;
        }

        try {
            toast({
                title: 'Camera Starting',
                description: 'Initializing camera...',
            });

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
            });

            setStream(mediaStream);
            streamRef.current = mediaStream; // #2
            setCapturing(true);
            // #5 — record session start and reset tracking
            sessionStartRef.current = new Date();
            markedDuringSession.current.clear();
            setSessionSummary(null);
            // #9 — clear any previous denial on successful getUserMedia
            setCameraPermission('granted');

            // Wait for next frame to ensure video element is rendered
            await new Promise(resolve => setTimeout(resolve, 50));

            if (videoRef.current) {
                console.log('Setting video srcObject...');
                videoRef.current.srcObject = mediaStream;

                // Wait for metadata to load, then play
                videoRef.current.onloadedmetadata = () => {
                    console.log('Metadata loaded');
                    if (videoRef.current) {
                        videoRef.current.play().then(() => {
                            console.log('Video playing, dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                            setVideoReady(true);
                            toast({
                                title: 'Camera Ready',
                                description: 'You can now capture attendance',
                            });
                        }).catch(err => {
                            console.error('Play error:', err);
                            toast({
                                title: 'Error',
                                description: 'Could not start video playback',
                                variant: 'destructive',
                            });
                        });
                    }
                };
            } else {
                console.error('Video ref not available after waiting');
                toast({
                    title: 'Error',
                    description: 'Video element not ready',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Camera error:', error);
            // #9 — detect permission denial specifically
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setCameraPermission('denied');
            }
            toast({
                title: 'Camera Error',
                description: error.message || 'Could not access camera. Please check permissions.',
                variant: 'destructive',
            });
            setCapturing(false);
            setStream(null);
            streamRef.current = null;
        }
    };

    // #2 — stable stop functions using refs, safe in cleanup effects
    const stopContinuousCapture = useCallback(() => {
        setContinuousMode(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const stopCamera = useCallback(() => {
        stopContinuousCapture();
        const currentStream = streamRef.current;
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
            setCapturing(false);
            setVideoReady(false);
            if (videoRef.current) videoRef.current.srcObject = null;
            // #5 — compute and show session summary
            if (sessionStartRef.current) {
                const duration = Math.floor(
                    (Date.now() - sessionStartRef.current.getTime()) / 1000
                );
                setSessionSummary({
                    duration,
                    uniqueStudents: markedDuringSession.current.size,
                    startTime: sessionStartRef.current,
                });
                sessionStartRef.current = null;
            }
        }
    }, [stopContinuousCapture]);

    const captureFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) {
            console.error('Video or canvas ref not available');
            return null;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Check if video has dimensions (means it's ready)
        if (!video.videoWidth || !video.videoHeight) {
            console.error('Video not ready - no dimensions yet');
            // Try to play if paused
            if (video.paused) {
                video.play().catch(err => console.warn('Could not play video:', err));
            }
            return null;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            console.error('Could not get canvas context');
            return null;
        }

        // Optimize image size for faster upload and processing
        const maxSize = 640;
        let targetWidth = video.videoWidth;
        let targetHeight = video.videoHeight;

        // Resize if too large
        if (Math.max(targetWidth, targetHeight) > maxSize) {
            const scale = maxSize / Math.max(targetWidth, targetHeight);
            targetWidth = Math.floor(targetWidth * scale);
            targetHeight = Math.floor(targetHeight * scale);
        }

        // Set canvas to optimized dimensions
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw the video frame to canvas (scaled if needed)
        context.drawImage(video, 0, 0, targetWidth, targetHeight);

        return new Promise<Blob | null>((resolve) => {
            // Use 0.85 quality for faster processing (still good quality)
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Failed to create blob from canvas');
                }
                resolve(blob);
            }, 'image/jpeg', 0.85);
        });
    }, []);

    const handleCapture = async () => {
        if (!videoRef.current) {
            toast({
                title: 'Camera Not Ready',
                description: 'Please start the camera first',
                variant: 'destructive',
            });
            return;
        }

        if (!selectedGroupId) {
            toast({
                title: 'Section Required',
                description: 'Please select a section/group',
                variant: 'destructive',
            });
            return;
        }

        // #1 — synchronous ref guard prevents concurrent calls from stale-closure setInterval
        if (loadingRef.current) return;

        const captureStart = Date.now(); // #8
        loadingRef.current = true;       // #1
        setLoading(true);
        setWrongSectionStudents([]);

        try {
            const blob = await captureFrame();
            if (!blob) throw new Error('Failed to capture frame from camera');

            const result = await attendanceApi.submitLive(blob, selectedGroupId);
            consecutiveErrorsRef.current = 0; // #7 — reset on success

            // Handle detected faces from correct section
            const correctFaces = result.detected_faces || [];
            const wrongFaces = result.wrong_section_students || [];
            const unrecognizedCount = result.unrecognized_count || 0;

            // #10 — update single unified detection list; #4 — carry confidence_tier
            if (correctFaces.length > 0) {
                const currentTime = new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                });

                const newEntries: DetectionEntry[] = correctFaces.map(face => ({
                    id: `${Date.now()}-${face.name}-${Math.random().toString(36).slice(2)}`,
                    name: face.name,
                    time: currentTime,
                    status: 'in' as const,
                    confidence_tier: face.confidence_tier ?? 'high', // #4
                }));

                // #5 — track unique students marked this session via student_id
                correctFaces.forEach(f => markedDuringSession.current.add(f.student_id));

                setDetectionEntries(prev => [...newEntries, ...prev].slice(0, 5));

                // #3 — track timeout handles so we can clear them on unmount
                newEntries.forEach(entry => {
                    const t = setTimeout(() => {
                        setDetectionEntries(prev => prev.filter(e => e.id !== entry.id));
                    }, 4500);
                    timeoutRefs.current.push(t);
                });
            }

            setWrongSectionStudents(wrongFaces);

            // Update unrecognised faces carousel
            const rawUnrecognized = result.unrecognized_faces || [];
            const backendOrigin = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
            setUnrecognizedFaces(
                rawUnrecognized.map(f => ({
                    id: f.id,
                    image_url: f.image_url ? `${backendOrigin}${f.image_url}` : null,
                    score: f.score,
                }))
            );

            const total = correctFaces.length + wrongFaces.length + unrecognizedCount;
            const recognized = correctFaces.length;
            setLiveStats({ totalInFrame: total, recognizedCount: recognized, unrecognizedCount, lastUpdate: new Date() });

            if (total === 0) {
                toast({ title: 'No Faces Detected', description: result.message || 'No faces detected', variant: 'destructive' });
            } else if (wrongFaces.length > 0) {
                toast({ title: 'Section Mismatch', description: `${recognized} correct, ${wrongFaces.length} from other sections` });
            } else {
                toast({ title: 'Success', description: `Detected ${total} face(s) — ${recognized} recognized` });
            }

            if (correctFaces.length > 0) loadPresentStudents();
        } catch (error: any) {
            console.error('Capture error:', error);
            // #7 — auto-stop live mode after 3 consecutive failures
            consecutiveErrorsRef.current += 1;
            if (consecutiveErrorsRef.current >= 3 && continuousMode) {
                stopContinuousCapture();
                toast({
                    title: 'Live Mode Auto-stopped',
                    description: '3 consecutive errors — check your connection.',
                    variant: 'destructive',
                });
            } else {
                toast({ title: 'Error', description: error.message || 'Failed to process attendance', variant: 'destructive' });
            }
        } finally {
            setLoading(false);
            loadingRef.current = false; // #1
            // #8 — update rolling average capture duration
            const elapsed = Date.now() - captureStart;
            captureTimesRef.current.push(elapsed);
            if (captureTimesRef.current.length > 5) captureTimesRef.current.shift();
            setCaptureRate(Math.round(
                captureTimesRef.current.reduce((a, b) => a + b, 0) / captureTimesRef.current.length
            ));
        }
    };

    const startContinuousCapture = () => {
        setContinuousMode(true);
        intervalRef.current = setInterval(async () => {
            if (!loadingRef.current) { // #1 — ref is always fresh inside closures
                await handleCapture();
            }
        }, 3000);
    };

    const loadPresentStudents = async () => {
        try {
            const data = await attendanceApi.getToday();
            const present = data.attendance
                .filter((record: any) => record.status === 'present')
                .map((record: any) => ({
                    student_id: record.student_id,
                    name: record.name || record.student_name || 'Unknown',
                    in_time: record.in_time,
                    group_name: record.group_name,
                }));
            setPresentStudents(present);
        } catch (error) {
            console.error('Failed to load present students:', error);
        }
    };

    // #6 — keyboard shortcuts: Space = capture, L = toggle live, Esc = stop camera
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            if (e.code === 'Space' && capturing && videoReady && !continuousMode && !loading) {
                e.preventDefault();
                handleCapture();
            }
            if (e.code === 'KeyL' && capturing && videoReady) {
                e.preventDefault();
                continuousMode ? stopContinuousCapture() : startContinuousCapture();
            }
            if (e.code === 'Escape' && capturing) {
                stopCamera();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [capturing, videoReady, continuousMode, loading, stopCamera, stopContinuousCapture]);

    useEffect(() => {
        loadGroups();
        loadPresentStudents();
        return () => {
            // #2 — use stable refs so cleanup always sees current values
            stopContinuousCapture();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
            // #3 — clear all pending overlay expiry timers
            timeoutRefs.current.forEach(clearTimeout);
        };
    }, [stopContinuousCapture]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Live Attendance</h1>
                <p className="text-muted-foreground mt-1">Capture attendance using live camera feed</p>
            </div>

            {/* Section/Group Selection */}
            <Card className="p-4 bg-card-light border-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-accent" />
                        <label className="font-medium">Select Section:</label>
                    </div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={loadingGroups || capturing}>
                        <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder={loadingGroups ? "Loading sections..." : "Choose a section/group"} />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={String(group.id)}>
                                    {group.name} ({group.id})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedGroupId && (
                        <span className="text-sm text-muted-foreground">
                            Selected: {groups.find(g => String(g.id) === selectedGroupId)?.name}
                        </span>
                    )}
                </div>
            </Card>

            {/* Live Stats */}
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                <Card className="p-2 bg-card-light border-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">In Frame</p>
                            <p className="text-lg font-bold text-foreground">{liveStats.totalInFrame}</p>
                        </div>
                        <Users className="h-5 w-5 text-accent" />
                    </div>
                </Card>
                <Card className="p-2 bg-card-light border-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Recognized</p>
                            <p className="text-lg font-bold text-green-600">{liveStats.recognizedCount}</p>
                        </div>
                        <Check className="h-5 w-5 text-green-600" />
                    </div>
                </Card>
                <Card className="p-2 bg-card-light border-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Unknown</p>
                            <p className="text-lg font-bold text-orange-600">{liveStats.unrecognizedCount}</p>
                        </div>
                        <Users className="h-5 w-5 text-orange-600" />
                    </div>
                </Card>
                <Card className="p-2 bg-card-light border-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Present</p>
                            <p className="text-lg font-bold text-foreground">{presentStudents.length}</p>
                        </div>
                        <Check className="h-5 w-5 text-accent" />
                    </div>
                </Card>
            </div>

            <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
                {/* Camera Feed */}
                <div className="lg:col-span-2">
                    <Card className="p-4 sm:p-6 bg-card-dark border-0">
                        <div className="h-[400px] sm:h-[500px] bg-black rounded-lg overflow-hidden relative">
                            {capturing ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    {cameraPermission === 'denied' ? (
                                        <div className="text-center px-6">
                                            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-red-400" />
                                            <p className="text-sm sm:text-base font-semibold text-red-400 mb-1">Camera Permission Denied</p>
                                            <p className="text-xs text-muted-foreground">Go to browser settings → Site permissions → Allow camera access</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <CameraOff className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground" />
                                            <p className="text-sm sm:text-base text-muted-foreground">Camera is off</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        {/* #6 — keyboard hint bar */}
                        {capturing && (
                            <div className="flex items-center justify-between mt-2 mb-1 px-0.5">
                                <p className="text-[10px] text-muted-foreground">
                                    ⌨ <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Space</kbd> capture ·{' '}
                                    <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">L</kbd> live ·{' '}
                                    <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> stop
                                </p>
                                {/* #8 — capture rate indicator */}
                                {captureRate !== null && continuousMode && (
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                        ~{captureRate}ms/capture
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
                            {!capturing ? (
                                <Button
                                    onClick={startCamera}
                                    disabled={!selectedGroupId}
                                    size="sm"
                                    className="w-full sm:flex-1 bg-accent hover:bg-accent/90 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Camera className="mr-2 h-3.5 w-3.5" />
                                    <span className="text-sm">{!selectedGroupId ? 'Select Section First' : 'Start Camera'}</span>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={handleCapture}
                                        disabled={!videoReady || loading || continuousMode}
                                        size="sm"
                                        aria-label="Capture frame (Space)"
                                        className="flex-1 bg-accent hover:bg-accent/90 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {!videoReady ? (
                                            <>
                                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                <span className="text-sm">Initializing...</span>
                                            </>
                                        ) : loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                <span className="text-sm">Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check className="mr-2 h-3.5 w-3.5" />
                                                <span className="text-sm">Capture</span>
                                            </>
                                        )}
                                    </Button>
                                    {!continuousMode ? (
                                        <Button
                                            onClick={startContinuousCapture}
                                            disabled={!videoReady}
                                            size="sm"
                                            variant="outline"
                                            className="w-full sm:flex-1 text-black border-black hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Play className="mr-2 h-3.5 w-3.5" />
                                            <span className="text-sm">Live</span>
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={stopContinuousCapture}
                                            size="sm"
                                            variant="outline"
                                            className="w-full sm:flex-1 text-black border-black hover:bg-black/10"
                                        >
                                            <Pause className="mr-2 h-3.5 w-3.5" />
                                            <span className="text-sm">Stop Live</span>
                                        </Button>
                                    )}
                                    <Button
                                        onClick={stopCamera}
                                        size="sm"
                                        variant="outline"
                                        className="w-full sm:flex-1 text-black border-black hover:bg-black/10"
                                    >
                                        <CameraOff className="mr-2 h-3.5 w-3.5" />
                                        <span className="text-sm">Stop Camera</span>
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Detection Results & Present Students */}
                <div className="space-y-3">
                    {/* Live Recognition Feed with Present Count */}
                    <Card className="p-3 bg-card-light border-0">
                        {/* Header: title + live indicator */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <motion.div
                                    animate={{ scale: [1, 1.25, 1], opacity: [1, 0.5, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                                    className="w-2 h-2 rounded-full bg-green-500"
                                />
                                <h2 className="text-sm font-semibold">Live Detection Feed</h2>
                            </div>
                            <AnimatePresence mode="wait">
                                {detectionEntries.length > 0 ? (
                                    <motion.span
                                        key="live"
                                        initial={{ opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.7 }}
                                        className="text-[10px] font-bold tracking-widest text-red-500 uppercase flex items-center gap-1"
                                    >
                                        LIVE
                                    </motion.span>
                                ) : (
                                    <motion.span
                                        key="idle"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-xs text-muted-foreground"
                                    >
                                        Waiting…
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Present students count badge */}
                        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 mb-3">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-300">Present Today</span>
                            </div>
                            <motion.span
                                key={presentStudents.length}
                                initial={{ scale: 1.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                className="text-lg font-bold text-green-700 dark:text-green-300 leading-none"
                            >
                                {presentStudents.length}
                            </motion.span>
                        </div>

                        {/* Animated name pills — #4 confidence tier colours, #10 single list */}
                        {detectionEntries.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-6 text-muted-foreground"
                            >
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="text-xs">Waiting for detections…</p>
                            </motion.div>
                        ) : (
                            <div className="space-y-0 overflow-hidden">
                                <AnimatePresence initial={false}>
                                    {detectionEntries.map((entry) => (
                                        <motion.div
                                            key={entry.id}
                                            layout
                                            initial={{ opacity: 0, x: 40, height: 0 }}
                                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                                            exit={{ opacity: 0, x: -20, height: 0, transition: { duration: 0.25 } }}
                                            transition={{
                                                type: 'spring',
                                                stiffness: 420,
                                                damping: 30,
                                                opacity: { duration: 0.18 },
                                                height: { duration: 0.22 },
                                            }}
                                            className="pb-1.5 overflow-hidden"
                                        >
                                            <motion.div
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r text-white ${entry.confidence_tier === 'medium'
                                                        ? 'from-yellow-500 to-amber-500 border border-yellow-400/30'
                                                        : entry.confidence_tier === 'low'
                                                            ? 'from-orange-500 to-red-400 border border-orange-400/30'
                                                            : 'from-green-500 to-emerald-500 border border-green-400/30'
                                                    }`}
                                                initial={{ boxShadow: '0 0 0px rgba(34,197,94,0)' }}
                                                animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0)', '0 0 18px rgba(34,197,94,0.55)', '0 0 8px rgba(34,197,94,0.2)'] }}
                                                transition={{ duration: 0.9, times: [0, 0.25, 1] }}
                                            >
                                                {/* Animated check icon */}
                                                <motion.div
                                                    initial={{ scale: 0, rotate: -30 }}
                                                    animate={{ scale: 1, rotate: 0 }}
                                                    transition={{ type: 'spring', stiffness: 650, damping: 18, delay: 0.1 }}
                                                    className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
                                                >
                                                    <Check className="w-3.5 h-3.5 text-white" />
                                                </motion.div>

                                                {/* Name + sub-label */}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="font-bold text-sm leading-tight truncate">
                                                        {entry.name}
                                                    </span>
                                                    <span className="text-[10px] text-white/70 leading-tight">
                                                        {entry.confidence_tier === 'medium' ? '⚠ Medium match'
                                                            : entry.confidence_tier === 'low' ? '⚠ Low match'
                                                                : '✓ High match'} · {entry.time}
                                                    </span>
                                                </div>

                                                {/* Pulsing live dot */}
                                                <motion.span
                                                    className="w-2 h-2 rounded-full bg-green-200 flex-shrink-0"
                                                    animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                                                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                                                />
                                            </motion.div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </Card>

                    {/* Unrecognised Faces Carousel */}
                    <AnimatePresence>
                        {unrecognizedFaces.length > 0 && (
                            <motion.div
                                key="unrecognized-carousel"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <UnrecognizedCarousel faces={unrecognizedFaces} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Wrong Section Students Warning - Compact View */}
                    {wrongSectionStudents.length > 0 && (
                        <Card className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
                                    <h3 className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">Wrong Section</h3>
                                </div>
                                <span className="text-xs text-yellow-600 dark:text-yellow-500">
                                    {wrongSectionStudents.length}
                                </span>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {wrongSectionStudents.map((student, index) => (
                                    <div
                                        key={index}
                                        className="p-1.5 rounded bg-white dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800"
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className="font-medium text-xs text-yellow-900 dark:text-yellow-200 truncate">
                                                {student.name}
                                            </h4>
                                            {student.group_name && (
                                                <span className="text-xs text-yellow-600 dark:text-yellow-500 flex-shrink-0">
                                                    → {student.group_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1.5 text-center">
                                ⚠️ Not marked
                            </p>
                        </Card>
                    )}

                    {/* Recent Present Students */}
                    <Card className="p-3 bg-card-light border-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4" />
                                <h2 className="text-sm font-semibold">Recent Present</h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadPresentStudents}
                                className="text-xs h-7 px-2"
                            >
                                Refresh
                            </Button>
                        </div>

                        {presentStudents.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">No students present yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                                    {presentStudents.slice(0, 5).map((student) => (
                                        <div
                                            key={student.student_id}
                                            className="p-2 rounded bg-background border border-border"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-sm text-foreground truncate">{student.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <div className="text-xs text-muted-foreground">
                                                        {student.in_time ? new Date(student.in_time).toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        }) : 'N/A'}
                                                    </div>
                                                    <div className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium">
                                                        ✓
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {presentStudents.length > 5 && (
                                    <p className="text-xs text-center text-muted-foreground pt-2 border-t border-border mt-2">
                                        +{presentStudents.length - 5} more
                                    </p>
                                )}
                            </>
                        )}
                    </Card>
                </div>
            </div>
            {/* #5 — Session summary card shown after camera stops */}
            {sessionSummary && (
                <Card className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1">Session Complete</h3>
                            <p className="text-sm text-green-700 dark:text-green-400">
                                Attendance marked for{' '}
                                <strong>{sessionSummary.uniqueStudents}</strong>{' '}
                                student{sessionSummary.uniqueStudents !== 1 ? 's' : ''} in{' '}
                                {sessionSummary.duration >= 60
                                    ? `${Math.floor(sessionSummary.duration / 60)}m ${sessionSummary.duration % 60}s`
                                    : `${sessionSummary.duration}s`}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                                Started at{' '}
                                {sessionSummary.startTime.toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit', hour12: true,
                                })}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSessionSummary(null)}
                            className="text-green-700 dark:text-green-400 h-7 px-2 text-xs flex-shrink-0"
                        >
                            Dismiss
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
