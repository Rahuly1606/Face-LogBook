import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, CameraOff, Loader2, Check, Users, Play, Pause } from 'lucide-react';
import { attendanceApi } from '@/services/api';

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
    const [detectedFaces, setDetectedFaces] = useState<Array<{
        student_id: string;
        name: string;
        confidence: number;
        group_name?: string;
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

    const startCamera = async () => {
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

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        return new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Failed to create blob from canvas');
                }
                resolve(blob);
            }, 'image/jpeg', 0.95);
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

        setLoading(true);
        setDetectedFaces([]);

        try {
            const blob = await captureFrame();
            if (!blob) {
                throw new Error('Failed to capture frame from camera');
            }

            console.log('Captured blob size:', blob.size);
            const result = await attendanceApi.submitLive(blob);

            if (result.success && result.detected_faces) {
                setDetectedFaces(result.detected_faces);

                // Update live stats
                const total = result.total_detected || result.detected_faces.length;
                const recognized = result.detected_faces.length;
                const unrecognized = total - recognized;

                setLiveStats({
                    totalInFrame: total,
                    recognizedCount: recognized,
                    unrecognizedCount: unrecognized,
                    lastUpdate: new Date(),
                });

                toast({
                    title: 'Success',
                    description: `Detected ${total} face(s) - ${recognized} recognized`,
                });
                // Refresh present students list
                loadPresentStudents();
            } else {
                setLiveStats({
                    totalInFrame: 0,
                    recognizedCount: 0,
                    unrecognizedCount: 0,
                    lastUpdate: new Date(),
                });
                toast({
                    title: 'No Faces Detected',
                    description: result.message || 'No faces were detected in the image',
                    variant: 'destructive',
                });
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
                                    size="sm"
                                    className="w-full sm:flex-1 bg-accent hover:bg-accent/90 text-black font-medium"
                                >
                                    <Camera className="mr-2 h-3.5 w-3.5" />
                                    <span className="text-sm">Start Camera</span>
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
                <div className="space-y-4 sm:space-y-6">
                    {/* Last Detection */}
                    <Card className="p-4 sm:p-6 bg-card-light border-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Check className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">Last Detection</h2>
                        </div>

                        {detectedFaces.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No faces detected yet</p>
                                <p className="text-sm mt-1">Capture an image to see results</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {detectedFaces.slice(0, 5).map((face, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-lg bg-background border border-border"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-foreground">{face.name}</h3>
                                                <p className="text-sm text-muted-foreground">ID: {face.student_id}</p>
                                                {face.group_name && (
                                                    <p className="text-xs text-muted-foreground mt-1">Group: {face.group_name}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-success">
                                                    {(face.confidence * 100).toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-muted-foreground">confidence</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {detectedFaces.length > 5 && (
                                    <p className="text-xs text-center text-muted-foreground pt-2">
                                        +{detectedFaces.length - 5} more detected
                                    </p>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Recent Present Students */}
                    <Card className="p-4 sm:p-6 bg-card-light border-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                                <h2 className="text-base sm:text-lg font-semibold">Recent Present</h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadPresentStudents}
                                className="text-xs sm:text-sm"
                            >
                                Refresh
                            </Button>
                        </div>

                        {presentStudents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No students present yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {presentStudents.slice(0, 5).map((student) => (
                                        <div
                                            key={student.student_id}
                                            className="p-3 rounded-lg bg-background border border-border hover:border-accent/50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-foreground">{student.name}</h3>
                                                    <p className="text-xs text-muted-foreground">ID: {student.student_id}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-success font-medium">Present</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {student.in_time ? new Date(student.in_time).toLocaleTimeString() : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {presentStudents.length > 5 && (
                                    <p className="text-xs text-center text-muted-foreground pt-3 border-t border-border mt-3">
                                        +{presentStudents.length - 5} more students present today
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
