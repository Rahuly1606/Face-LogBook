import { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, CameraOff, Loader2, Check, Users, Play, Pause, BookOpen } from 'lucide-react';
import { attendanceApi, groupApi } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type OverlayEntry } from '@/components/RecognitionFeed';
import { UnrecognizedCarousel, type UnrecognizedFace } from '@/components/UnrecognizedCarousel';

export default function LiveAttendance() {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [continuousMode, setContinuousMode] = useState(false);
    const [loading, setLoading] = useState(false);

    // Group/Section selection state
    const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Queue system: Keep max 5 students with name and time
    const [detectedQueue, setDetectedQueue] = useState<Array<{
        id: string;
        name: string;
        time: string;
        status: 'in' | 'out';
    }>>([]);

    // Overlay entries shown directly on the camera feed (auto-expire after 4.5 s)
    const [overlayEntries, setOverlayEntries] = useState<OverlayEntry[]>([]);

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
            setCapturing(true);

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
            toast({
                title: 'Camera Error',
                description: error.message || 'Could not access camera. Please check permissions.',
                variant: 'destructive',
            });
            setCapturing(false);
            setStream(null);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setCapturing(false);
            setVideoReady(false);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    };

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

        setLoading(true);
        setWrongSectionStudents([]);

        try {
            const blob = await captureFrame();
            if (!blob) {
                throw new Error('Failed to capture frame from camera');
            }

            console.log('Captured blob size:', blob.size);
            const result = await attendanceApi.submitLive(blob, selectedGroupId);

            // Handle detected faces from correct section
            const correctFaces = result.detected_faces || [];
            const wrongFaces = result.wrong_section_students || [];
            const unrecognizedCount = result.unrecognized_count || 0;

            // Add new students to queue (max 5, FIFO)
            if (correctFaces.length > 0) {
                const currentTime = new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                const newEntries = correctFaces.map(face => ({
                    id: `${Date.now()}-${face.name}-${Math.random().toString(36).slice(2)}`,
                    name: face.name,
                    time: currentTime,
                    status: 'in' as const,
                }));

                setDetectedQueue(prev => {
                    // Add new entries at the beginning (most recent first)
                    const updated = [...newEntries, ...prev];
                    // Keep only the latest 5 entries
                    return updated.slice(0, 5);
                });

                // Push to camera overlay and auto-expire each after 4.5 s
                setOverlayEntries(prev => [...newEntries, ...prev].slice(0, 5));
                newEntries.forEach(entry => {
                    setTimeout(() => {
                        setOverlayEntries(prev => prev.filter(e => e.id !== entry.id));
                    }, 4500);
                });
            }

            setWrongSectionStudents(wrongFaces);

            // Update unrecognised faces carousel
            const rawUnrecognized = result.unrecognized_faces || [];
            setUnrecognizedFaces(
                rawUnrecognized.map(f => ({
                    id: f.id,
                    image_base64: f.image_base64 ?? null,
                    score: f.score,
                }))
            );

            // Update live stats
            const total = correctFaces.length + wrongFaces.length + unrecognizedCount;
            const recognized = correctFaces.length;

            setLiveStats({
                totalInFrame: total,
                recognizedCount: recognized,
                unrecognizedCount: unrecognizedCount,
                lastUpdate: new Date(),
            });

            // Show appropriate toast message
            if (total === 0) {
                toast({
                    title: 'No Faces Detected',
                    description: result.message || 'No faces were detected in the image',
                    variant: 'destructive',
                });
            } else if (wrongFaces.length > 0) {
                toast({
                    title: 'Section Mismatch',
                    description: `${recognized} from selected section, ${wrongFaces.length} from other sections`,
                    variant: 'default',
                });
            } else {
                toast({
                    title: 'Success',
                    description: `Detected ${total} face(s) - ${recognized} recognized`,
                });
            }

            // Refresh present students list if any attendance was marked
            if (correctFaces.length > 0) {
                loadPresentStudents();
            }
        } catch (error: any) {
            console.error('Capture error:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to process attendance',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const startContinuousCapture = () => {
        setContinuousMode(true);
        intervalRef.current = setInterval(async () => {
            if (!loading) {
                await handleCapture();
            }
        }, 3000); // Capture every 3 seconds
    };

    const stopContinuousCapture = () => {
        setContinuousMode(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
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

    useEffect(() => {
        loadGroups();
        loadPresentStudents();
        return () => {
            stopCamera();
            stopContinuousCapture();
        };
    }, []);

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
                                    <div className="text-center">
                                        <CameraOff className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground" />
                                        <p className="text-sm sm:text-base text-muted-foreground">Camera is off</p>
                                    </div>
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

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
                                {overlayEntries.length > 0 ? (
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

                        {/* Animated name pills */}
                        {overlayEntries.length === 0 ? (
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
                                    {overlayEntries.map((entry) => (
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
                                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white border border-green-400/30"
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
                                                    <span className="text-[10px] text-green-100/80 leading-tight">
                                                        Marked · {entry.time}
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
        </div>
    );
}
