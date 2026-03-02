/**
 * SelfRegister – public student self-registration page.
 *
 * Accessible at: /register/:token
 * No authentication required.
 * The token is validated server-side; the page never touches the admin UI.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, ShieldAlert, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import CameraCapture from '@/components/CameraCapture';

// ─── API helpers (no auth token required) ────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000') as string;

async function validateToken(token: string) {
    const res = await fetch(`${API_BASE}/public/register/${token}`, { method: 'GET' });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

async function submitRegistration(
    token: string,
    name: string,
    idNumber: string,
    imageDataUrl: string
) {
    const res = await fetch(`${API_BASE}/public/register/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id_number: idNumber, image: imageDataUrl }),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
    | 'validating'   // checking token on mount
    | 'invalid'      // token bad / expired / group gone
    | 'form'         // showing registration form
    | 'submitting'   // POST in flight
    | 'success'      // registration accepted
    | 'already_done';// localStorage flag: student already registered on this device

interface TokenInfo {
    group_id: number;
    group_name: string;
    expires_at: string;
}

// ─── Error message helpers ────────────────────────────────────────────────────

const FACE_ERROR_HINTS: Record<string, string> = {
    no_face:
        'No face was detected. Make sure your face fills the oval guide, the lighting is good, and there are no obstructions (glasses are fine).',
    multiple_faces:
        'Multiple faces were detected. Please make sure you are alone in the frame.',
    model_unavailable:
        'Face recognition is temporarily unavailable. Please wait a moment and try again.',
    duplicate_face:
        'This face is already registered with a different ID. Contact your administrator if you think this is a mistake.',
    duplicate_id:
        'This ID number is already registered. If you need help, contact your administrator.',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SelfRegister() {
    const { token = '' } = useParams<{ token: string }>();

    const [pageState, setPageState] = useState<PageState>('validating');
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [invalidMessage, setInvalidMessage] = useState('');

    // form fields
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [photoConfirmed, setPhotoConfirmed] = useState(false);

    // submission feedback
    const [submitError, setSubmitError] = useState('');
    const [successName, setSuccessName] = useState('');
    const [successGroup, setSuccessGroup] = useState('');

    // Prevent duplicate camera tear-down on StrictMode double-render
    const tokenChecked = useRef(false);

    // ── Token validation on mount ───────────────────────────────────────────

    useEffect(() => {
        if (!token || tokenChecked.current) return;
        tokenChecked.current = true;

        // Client-side guard: if this browser already completed registration for
        // this token, show "already done" immediately (UX only – not security).
        if (localStorage.getItem(`reg_done_${token}`)) {
            setPageState('already_done');
            return;
        }

        validateToken(token).then(({ ok, data }) => {
            if (ok && data.success) {
                setTokenInfo({
                    group_id: data.group_id,
                    group_name: data.group_name,
                    expires_at: data.expires_at,
                });
                setPageState('form');
            } else {
                setInvalidMessage(data.message || 'This registration link is invalid or has expired.');
                setPageState('invalid');
            }
        }).catch(() => {
            setInvalidMessage('Unable to connect to the server. Please check your internet connection.');
            setPageState('invalid');
        });
    }, [token]);

    // ── Camera callbacks ────────────────────────────────────────────────────

    const handleCapture = (dataUrl: string) => {
        setCapturedImage(dataUrl);
        setPhotoConfirmed(false); // user still needs to click "Use Photo" → already done inside CameraCapture
    };

    const handlePhotoConfirmed = (dataUrl: string) => {
        setCapturedImage(dataUrl);
        setPhotoConfirmed(true);
        setSubmitError('');
    };

    const handleClear = () => {
        setCapturedImage(null);
        setPhotoConfirmed(false);
    };

    // ── Form submission ─────────────────────────────────────────────────────

    const handleSubmit = async () => {
        setSubmitError('');

        // Client-side validation
        if (!name.trim() || name.trim().length < 2) {
            setSubmitError('Please enter your full name (at least 2 characters).');
            return;
        }
        if (!idNumber.trim() || idNumber.trim().length < 2) {
            setSubmitError('Please enter your ID number.');
            return;
        }
        if (!capturedImage || !photoConfirmed) {
            setSubmitError('Please take a photo and click "Use Photo" to confirm it.');
            return;
        }

        setPageState('submitting');

        try {
            const { ok, data } = await submitRegistration(
                token,
                name.trim(),
                idNumber.trim(),
                capturedImage
            );

            if (ok && data.success) {
                // Mark as done in localStorage to prevent duplicate submissions
                localStorage.setItem(`reg_done_${token}`, '1');
                setSuccessName(data.name || name.trim());
                setSuccessGroup(data.group_name || tokenInfo?.group_name || '');
                setPageState('success');
            } else {
                const hint = data.error ? FACE_ERROR_HINTS[data.error] : null;
                setSubmitError(hint || data.message || 'Registration failed. Please try again.');
                setPageState('form');
            }
        } catch {
            setSubmitError('Network error. Please check your connection and try again.');
            setPageState('form');
        }
    };

    // ── Render helpers ──────────────────────────────────────────────────────

    const isSubmitting = pageState === 'submitting';

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-start py-8 px-4">
            {/* Header */}
            <div className="w-full max-w-md mb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <UserPlus className="h-7 w-7 text-accent" />
                    <h1 className="text-2xl font-bold">Student Registration</h1>
                </div>
                {tokenInfo && (
                    <p className="text-muted-foreground text-sm">
                        Registering for group:{' '}
                        <span className="font-semibold text-foreground">{tokenInfo.group_name}</span>
                    </p>
                )}
            </div>

            {/* ── Validating ── */}
            {pageState === 'validating' && (
                <div className="flex flex-col items-center gap-3 mt-20">
                    <Loader2 className="h-10 w-10 animate-spin text-accent" />
                    <p className="text-muted-foreground">Checking registration link…</p>
                </div>
            )}

            {/* ── Invalid / Expired token ── */}
            {pageState === 'invalid' && (
                <Card className="w-full max-w-md p-8 text-center border-0 bg-card-dark shadow-lg">
                    <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Link Unavailable</h2>
                    <p className="text-muted-foreground text-sm">{invalidMessage}</p>
                </Card>
            )}

            {/* ── Already registered (localStorage) ── */}
            {pageState === 'already_done' && (
                <Card className="w-full max-w-md p-8 text-center border-0 bg-card-dark shadow-lg">
                    <ShieldAlert className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Already Registered</h2>
                    <p className="text-muted-foreground text-sm">
                        It looks like you have already completed registration on this device.
                        If you believe this is incorrect, please contact your administrator.
                    </p>
                </Card>
            )}

            {/* ── Success ── */}
            {pageState === 'success' && (
                <Card className="w-full max-w-md p-8 text-center border-0 bg-card-dark shadow-lg">
                    <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
                    <p className="text-muted-foreground text-sm mb-1">
                        Welcome, <span className="font-semibold text-foreground">{successName}</span>!
                    </p>
                    {successGroup && (
                        <p className="text-muted-foreground text-sm">
                            You are now enrolled in{' '}
                            <span className="font-semibold text-foreground">{successGroup}</span>.
                        </p>
                    )}
                    <p className="mt-6 text-xs text-muted-foreground">
                        You may close this page.
                    </p>
                </Card>
            )}

            {/* ── Registration form ── */}
            {(pageState === 'form' || pageState === 'submitting') && (
                <Card className="w-full max-w-md p-6 border-0 bg-card-dark shadow-lg space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="reg-name" className="text-black font-medium">
                            Full Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="reg-name"
                            placeholder="As it appears on your ID card"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSubmitting}
                            autoComplete="name"
                            inputMode="text"
                        />
                    </div>

                    {/* ID Number */}
                    <div className="space-y-2">
                        <Label htmlFor="reg-id" className="text-black font-medium">
                            ID Number <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="reg-id"
                            placeholder="e.g. STU20240001"
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                            disabled={isSubmitting}
                            autoCapitalize="characters"
                            autoComplete="off"
                        />
                    </div>

                    {/* Camera */}
                    <div className="space-y-2">
                        <Label className="text-black font-medium">
                            Face Photo <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Position your face inside the oval. Ensure good lighting and look
                            directly at the camera.
                        </p>
                        <CameraCapture
                            onCapture={handlePhotoConfirmed}
                            onClear={handleClear}
                            disabled={isSubmitting}
                        />
                        {photoConfirmed && (
                            <p className="text-xs text-green-500 text-center">
                                ✓ Photo confirmed
                            </p>
                        )}
                    </div>

                    {/* Error feedback */}
                    {submitError && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                            {submitError}
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full bg-accent hover:bg-accent/90 text-black font-semibold"
                        size="lg"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Registering…
                            </>
                        ) : (
                            'Submit Registration'
                        )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        Your photo and ID are used only for attendance recognition. They are
                        stored securely and never shared.
                    </p>
                </Card>
            )}
        </div>
    );
}
