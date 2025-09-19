import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bookmark, X, AlertCircle, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface IPCameraInputProps {
    onStreamReady: (stream: MediaStream) => void;
    onError: (error: string) => void;
    onCancel: () => void;
}

interface IPCameraPreset {
    name: string;
    url: string;
}

interface UrlValidationResult {
    isValid: boolean;
    type?: 'mjpeg' | 'hls' | 'jpeg' | 'rtsp';
    error?: string;
    fullUrl?: string;
    isIpWebcam?: boolean;
}const PRESETS_STORAGE_KEY = 'ip-camera-presets';
const CONNECTION_TIMEOUT = 8000; // 8 seconds

export function IPCameraInput({ onStreamReady, onError, onCancel }: IPCameraInputProps) {
    const [url, setUrl] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [presets, setPresets] = useState<IPCameraPreset[]>([]);
    const [showPresetInput, setShowPresetInput] = useState(false);
    const [presetName, setPresetName] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Load presets from localStorage
    useEffect(() => {
        const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (savedPresets) {
            try {
                setPresets(JSON.parse(savedPresets));
            } catch (e) {
                console.error('Failed to parse saved presets:', e);
            }
        }
    }, []);

    const validateUrl = (input: string): UrlValidationResult => {
        try {
            console.log('Validating URL input:', input);

            // Check if it's just an IP address or IP:port format
            const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(input);
            if (isIpAddress) {
                console.log('Input is an IP address format');

                // Parse IP and port if provided
                let ip = input;
                let port = '8080'; // Default port for IP Webcam app

                if (input.includes(':')) {
                    const parts = input.split(':');
                    ip = parts[0];
                    port = parts[1];
                    console.log(`Parsed IP: ${ip}, Port: ${port}`);
                }

                // For IP Webcam app format - try the videofeed endpoint
                const fullUrl = `http://${ip}:${port}/videofeed`;
                console.log('Constructed IP Webcam URL:', fullUrl);

                return {
                    isValid: true,
                    type: 'mjpeg',
                    fullUrl,
                    isIpWebcam: true
                };
            }

            // Check if it's a hostname without protocol
            const isHostname = /^[\w.-]+$/.test(input);
            if (isHostname) {
                input = `http://${input}:8080/videofeed`;
            }

            const parsedUrl = new URL(input);

            // Automatically handle HTTP/HTTPS based on window location
            if (window.location.protocol === 'https:' && parsedUrl.protocol === 'http:') {
                parsedUrl.protocol = 'https:';
            }

            if (parsedUrl.protocol === 'rtsp:') {
                return {
                    isValid: false,
                    type: 'rtsp',
                    error: 'RTSP streams are not supported in browsers. Please use an RTSP to HLS proxy.'
                };
            }

            const path = parsedUrl.pathname.toLowerCase();
            if (path.endsWith('.m3u8')) return { isValid: true, type: 'hls' };
            if (path.endsWith('.jpg') || path.endsWith('shot.jpg')) return { isValid: true, type: 'jpeg' };
            if (path.includes('video') || path.endsWith('mjpg') || path.endsWith('mjpeg')) return { isValid: true, type: 'mjpeg' };

            return { isValid: true, fullUrl: parsedUrl.toString() }; // Return the full URL
        } catch (e) {
            return { isValid: false, error: 'Invalid URL format' };
        }
    };

    const savePreset = useCallback(() => {
        if (!url || !presetName) return;

        const newPreset = { name: presetName, url };
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
        setShowPresetInput(false);
        setPresetName('');

        toast({
            title: "Preset Saved",
            description: `Saved camera preset: ${presetName}`,
        });
    }, [url, presetName, presets]);

    const createStreamFromVideo = useCallback(() => {
        if (!videoRef.current) return null;
        try {
            // Try the standard method first
            if ((videoRef.current as any).captureStream) {
                return (videoRef.current as any).captureStream();
            }
            // Fallback for older browsers (mainly Safari)
            if ((videoRef.current as any).mozCaptureStream) {
                return (videoRef.current as any).mozCaptureStream();
            }
            // Fallback using canvas if direct capture is not supported
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            // Draw the current frame
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // Try to capture from canvas
            if (canvas.captureStream) {
                return canvas.captureStream(30); // 30 FPS
            }

            throw new Error('Video capture not supported in this browser');
        } catch (e) {
            console.error('Failed to capture video stream:', e);
            return null;
        }
    }, []);

    const createStreamFromImage = useCallback(() => {
        if (!imgRef.current || !canvasRef.current) return null;

        try {
            const refreshRate = 10; // frames per second
            const frameDuration = 1000 / refreshRate;
            let lastFrameTime = 0;

            // Create a new canvas for capturing frames
            const canvas = document.createElement('canvas');
            canvas.width = 640;  // Default size
            canvas.height = 480;

            // Adjust canvas size once the image loads
            const updateCanvasSize = () => {
                if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
                    canvas.width = imgRef.current.naturalWidth;
                    canvas.height = imgRef.current.naturalHeight;
                    console.log(`Canvas size set to ${canvas.width}x${canvas.height}`);
                }
            };

            if (imgRef.current) {
                if (imgRef.current.complete) {
                    updateCanvasSize();
                } else {
                    imgRef.current.onload = updateCanvasSize;
                }
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            // Create MediaStream from canvas
            let stream;
            try {
                if (canvas.captureStream) {
                    stream = canvas.captureStream(refreshRate);
                } else if ((canvas as any).mozCaptureStream) {
                    stream = (canvas as any).mozCaptureStream(refreshRate);
                } else {
                    throw new Error('Canvas capture not supported in this browser');
                }
            } catch (err) {
                console.error('Stream creation error:', err);
                throw new Error('Failed to create video stream. Your browser may not support this feature.');
            }

            // Function to draw current frame
            const drawCurrentFrame = () => {
                if (!imgRef.current) return;

                const now = Date.now();
                // Only draw at the specified frame rate
                if (now - lastFrameTime >= frameDuration) {
                    lastFrameTime = now;

                    try {
                        if (imgRef.current.complete && imgRef.current.naturalWidth > 0) {
                            ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
                        }
                    } catch (err) {
                        console.warn('Failed to draw frame:', err);
                    }
                }

                // Request next frame
                requestAnimationFrame(drawCurrentFrame);
            };

            // Start drawing frames
            drawCurrentFrame();

            // For MJPEG streams, refresh the image source periodically to get new frames
            let refreshInterval: NodeJS.Timeout | null = null;

            // Function to refresh the image source
            const refreshImageSource = () => {
                if (!imgRef.current) return;

                try {
                    const now = Date.now();
                    // For IP Webcam app or any endpoint that includes "videofeed"
                    if (imgRef.current.src.includes('videofeed')) {
                        // Track frame updates to detect stalls
                        const lastUpdate = (imgRef.current as any)._lastUpdate || 0;
                        const timeSinceUpdate = now - lastUpdate;

                        // More aggressive refresh for IP Webcam app - refresh every 3 seconds
                        // This ensures the stream keeps moving even if browser MJPEG handling stalls
                        if (timeSinceUpdate > 3000) {
                            console.log('MJPEG stream may be stalled, refreshing with cache buster...');

                            // Create a new URL with a unique cache buster
                            const baseUrl = imgRef.current.src.split('?')[0];
                            const refreshedUrl = `${baseUrl}?_mjpeg_refresh=${now}`;

                            // Force reload the image with the new URL
                            imgRef.current.src = refreshedUrl;
                            console.log(`Refreshed MJPEG stream: ${refreshedUrl}`);

                            // Track this update time
                            (imgRef.current as any)._lastUpdate = now;
                        }
                    }
                    // For static JPEG endpoints like shot.jpg, refresh frequently
                    else if (imgRef.current.src.includes('shot.jpg')) {
                        // For static JPEG images, we need to refresh with every request (100ms)
                        const baseUrl = imgRef.current.src.split('?')[0];
                        imgRef.current.src = `${baseUrl}?t=${now}`;
                        (imgRef.current as any)._lastUpdate = now;
                    }
                } catch (e) {
                    console.error('Error refreshing image source:', e);
                }
            };

            // Start the refresh interval - set different refresh rates for different stream types
            if (imgRef.current) {
                let refreshFrequency = 1000; // default 1 second refresh check

                // For static JPEG endpoints (shot.jpg), refresh very frequently (10 fps)
                if (imgRef.current.src.includes('shot.jpg')) {
                    refreshFrequency = 100;
                    console.log('Using high-frequency refresh for JPEG endpoint (10fps)');
                }
                // For MJPEG streams from IP Webcam app, check more often (every 500ms)
                else if (imgRef.current.src.includes('videofeed')) {
                    refreshFrequency = 500;
                    console.log('Using medium-frequency refresh checks for MJPEG stream (2 checks/sec)');
                }

                refreshInterval = setInterval(refreshImageSource, refreshFrequency);
                console.log(`Refresh interval set to ${refreshFrequency}ms`);

                // Add extra event listeners to ensure the image keeps updating
                imgRef.current.addEventListener('error', (e) => {
                    console.warn('Image stream error, attempting recovery:', e);
                    if (imgRef.current && imgRef.current.src) {
                        // Try to recover by adding a cache buster
                        const currentSrc = imgRef.current.src.split('?')[0];
                        imgRef.current.src = `${currentSrc}?recovery=${Date.now()}`;
                        console.log('Applied recovery to image stream');
                    }
                });

                // Also listen for load events to track updates
                imgRef.current.addEventListener('load', () => {
                    (imgRef.current as any)._lastUpdate = Date.now();
                });
            }

            // Cleanup function that will be called when the component unmounts
            const cleanup = () => {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
            };

            // Add the cleanup function to the stream object so it can be called when needed
            (stream as any).cleanup = cleanup;

            // Clean up the interval when the component unmounts
            return stream;
        } catch (e) {
            console.error('Failed to create image stream:', e);
            toast({
                title: "Stream Creation Failed",
                description: "Could not create stream from camera feed. Try using a different browser or enabling CORS on your camera.",
                variant: "destructive",
            });
            return null;
        }
    }, [toast]);

    const handleConnect = useCallback(async () => {
        setIsConnecting(true);
        setConnectionStatus('connecting');
        setErrorMessage(null);

        console.log('Attempting to connect to camera:', url);

        try {
            // Let the validation function handle all URL parsing
            const validation = validateUrl(url);

            if (!validation.isValid) {
                throw new Error(validation.error || 'Invalid URL');
            }

            // Get the fully formatted URL
            const targetUrl = validation.fullUrl || url;
            console.log('Processed camera URL:', targetUrl);

            let streamType = validation.type;

            // Handle RTSP streams
            if (streamType === 'rtsp') {
                throw new Error('RTSP streams are not supported in browsers. Please use an RTSP to HLS proxy.');
            }

            // For IP Webcam app, we know it's MJPEG
            if (!validation.isIpWebcam) {
                try {
                    // Test connection and determine stream type if not already known
                    const response = await fetch(targetUrl, {
                        method: 'HEAD',
                        mode: 'no-cors',
                        signal: AbortSignal.timeout(CONNECTION_TIMEOUT)
                    });

                    const contentType = response.headers.get('content-type');
                    streamType = streamType || (
                        contentType?.includes('video/x-motion-jpeg') ? 'mjpeg' :
                            contentType?.includes('application/vnd.apple.mpegurl') ? 'hls' :
                                contentType?.includes('image/jpeg') ? 'jpeg' : 'mjpeg'
                    );
                } catch (e) {
                    console.warn('Could not determine content type, using default type:', e);
                    streamType = streamType || 'mjpeg';
                }
            } else {
                streamType = 'mjpeg';
            }

            // Handle different stream types
            if (streamType === 'hls') {
                if (!videoRef.current) throw new Error('Video element not available');
                if (!window.MediaSource || !videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                    throw new Error('HLS playback not supported in this browser');
                }
                videoRef.current.src = targetUrl;
                await videoRef.current.play();
                const stream = createStreamFromVideo();
                if (!stream) throw new Error('Failed to create stream from video');
                setConnectionStatus('connected');
                onStreamReady(stream);
            } else {
                // Handle MJPEG and JPEG streams
                if (!imgRef.current) throw new Error('Image element not available');

                // Set cross-origin attribute before setting src
                imgRef.current.crossOrigin = 'anonymous';

                // For IP Webcam app, ensure we're using the videofeed endpoint
                let finalUrl = targetUrl;

                // If it's an IP Webcam app URL, make sure we're using the right endpoint
                if (validation.isIpWebcam || targetUrl.includes('8080')) {
                    // If the URL contains /video but not /videofeed, replace it
                    if (targetUrl.includes('/video') && !targetUrl.includes('/videofeed')) {
                        finalUrl = targetUrl.replace('/video', '/videofeed');
                        console.log('Switched to videofeed endpoint:', finalUrl);
                    }
                    // If it doesn't have either, append /videofeed
                    else if (!targetUrl.includes('/video')) {
                        // Make sure we don't append to a URL that already has a path
                        const endsWithPort = /:\d+$/.test(targetUrl);
                        finalUrl = endsWithPort ? `${targetUrl}/videofeed` : targetUrl;
                        console.log('Appended videofeed endpoint:', finalUrl);
                    }
                }

                console.log('Using final URL for image source:', finalUrl);

                // Clear any previous handlers
                imgRef.current.onload = null;
                imgRef.current.onerror = null;

                // Set the source
                imgRef.current.src = finalUrl;

                // Wait for image to load with a timeout and fallback
                try {
                    await new Promise((resolve, reject) => {
                        if (!imgRef.current) return reject('Image element not available');

                        const successTimeout = setTimeout(() => {
                            console.log('Image loaded successfully (timeout)');
                            resolve(true);
                        }, 2000); // Give 2 seconds to load

                        // Set both onload and onerror handlers
                        imgRef.current.onload = () => {
                            console.log('Image loaded successfully');
                            clearTimeout(successTimeout);

                            // Track when the image was last updated successfully
                            (imgRef.current as any)._lastUpdate = Date.now();

                            resolve(true);
                        };

                        imgRef.current.onerror = (e) => {
                            clearTimeout(successTimeout);
                            console.error('Image load error:', e);

                            // If videofeed fails, try the shot.jpg endpoint as fallback
                            if (finalUrl.includes('videofeed') && targetUrl.includes('8080')) {
                                console.log('Trying fallback to shot.jpg endpoint');
                                const shotUrl = targetUrl.replace('/video', '/shot.jpg');
                                imgRef.current!.src = shotUrl;

                                // Wait for the fallback to load
                                setTimeout(() => resolve(true), 1000); // Resolve anyway after 1 second
                            } else {
                                reject('Failed to load image stream. Please check if the camera is accessible and CORS is enabled.');
                            }
                        };
                        setTimeout(() => reject('Connection timeout - no response from camera after ' + (CONNECTION_TIMEOUT / 1000) + ' seconds'), CONNECTION_TIMEOUT);
                    });

                    console.log('Creating image stream...');
                    const stream = createStreamFromImage();
                    if (!stream) throw new Error('Failed to create stream from image');

                    console.log('Stream created successfully:', stream.id);
                    setConnectionStatus('connected');
                    onStreamReady(stream);
                } catch (innerError: any) {
                    // Re-throw to be caught by outer catch block
                    throw innerError;
                }
            }
        } catch (error: any) {
            console.error('Connection error:', error);
            const errorMsg = error?.message || 'Failed to connect to camera';
            setErrorMessage(errorMsg);
            setConnectionStatus('failed');

            // Provide more specific error messages based on the error
            if (errorMsg.includes('CORS')) {
                onError(`${errorMsg} - This might be a CORS issue. Try using the Android IP Webcam app and make sure to connect directly by IP address.`);
            } else if (errorMsg.includes('timeout')) {
                onError(`${errorMsg} - The camera is not responding. Check if the IP address is correct and the camera is on the same network.`);
            } else if (url.includes('192.168') || url.includes('10.0') || /^\d+\.\d+\.\d+\.\d+$/.test(url)) {
                // If it's a local IP address
                onError(`${errorMsg} - Make sure the IP Webcam app is running and the device is on the same network. The URL should look like '192.168.1.x:8080' (including the port).`);
            } else {
                onError(`${errorMsg} - For IP Webcam app, enter your phone's IP address and port (e.g., 192.168.1.10:8080).`);
            }
        } finally {
            setIsConnecting(false);
        }
    }, [url, createStreamFromVideo, createStreamFromImage, onStreamReady, onError]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter IP (e.g., 192.168.1.10) or full URL"
                        className="flex-1"
                        aria-label="IP Camera URL"
                        disabled={isConnecting}
                    />
                    <Button
                        onClick={handleConnect}
                        disabled={!url || isConnecting}
                        className="min-w-[100px]"
                    >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isConnecting}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Connection status */}
                {connectionStatus !== 'idle' && (
                    <div className={`flex items-center gap-2 text-sm ${connectionStatus === 'connected' ? 'text-green-600' :
                        connectionStatus === 'failed' ? 'text-red-600' :
                            'text-blue-600'
                        }`}>
                        {connectionStatus === 'connected' ? <Check className="h-4 w-4" /> :
                            connectionStatus === 'failed' ? <AlertCircle className="h-4 w-4" /> :
                                <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />}
                        {connectionStatus === 'connected' ? 'Connected' :
                            connectionStatus === 'failed' ? 'Connection failed' :
                                'Connecting...'}
                    </div>
                )}

                {/* Error message */}
                {errorMessage && (
                    <div className="text-sm text-red-600">
                        {errorMessage}
                    </div>
                )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
                {presets.map((preset, index) => (
                    <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setUrl(preset.url)}
                        className="text-xs"
                    >
                        {preset.name}
                    </Button>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPresetInput(true)}
                    className="text-xs"
                >
                    <Bookmark className="h-4 w-4 mr-1" />
                    Save Current
                </Button>
            </div>

            {/* Save preset input */}
            {showPresetInput && (
                <div className="flex gap-2">
                    <Input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Preset name"
                        className="flex-1"
                    />
                    <Button
                        onClick={savePreset}
                        disabled={!presetName}
                    >
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowPresetInput(false)}
                    >
                        Cancel
                    </Button>
                </div>
            )}

            {/* Hidden elements for stream handling */}
            <div className="hidden">
                <video ref={videoRef} autoPlay playsInline muted />
                <img ref={imgRef} alt="" />
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}