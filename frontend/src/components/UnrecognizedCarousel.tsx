import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserX, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UnrecognizedFace {
    id: string;
    image_base64?: string | null;
    score?: number;
}

interface UnrecognizedCarouselProps {
    faces: UnrecognizedFace[];
}

// Slide direction determines which axis the slides travel on
const SLIDE_DISTANCE = 180;

export function UnrecognizedCarousel({ faces }: UnrecognizedCarouselProps) {
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState<1 | -1>(1); // 1 = forward, -1 = back

    // Reset to first slide whenever the faces list changes (new detection cycle)
    useEffect(() => {
        setIndex(0);
    }, [faces]);

    if (faces.length === 0) return null;

    const current = faces[index];

    const go = (delta: 1 | -1) => {
        setDirection(delta);
        setIndex(prev => (prev + delta + faces.length) % faces.length);
    };

    const variants = {
        enter: (d: number) => ({
            x: d * SLIDE_DISTANCE,
            opacity: 0,
            scale: 0.92,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                type: 'spring' as const,
                stiffness: 380,
                damping: 32,
            },
        },
        exit: (d: number) => ({
            x: d * -SLIDE_DISTANCE,
            opacity: 0,
            scale: 0.92,
            transition: { duration: 0.22, ease: 'easeIn' as const },
        }),
    };

    return (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                        Unrecognised Faces
                    </span>
                </div>
                <span className="text-[11px] text-orange-500 dark:text-orange-400 font-medium">
                    {index + 1} / {faces.length}
                </span>
            </div>

            {/* Carousel frame */}
            <div className="relative flex items-center justify-center py-3 px-2 gap-2">
                {/* Left arrow */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 rounded-full text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-30"
                    onClick={() => go(-1)}
                    disabled={faces.length <= 1}
                    aria-label="Previous face"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Slide window */}
                <div className="flex-1 overflow-hidden" style={{ minHeight: 120 }}>
                    <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                        <motion.div
                            key={current.id}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="flex flex-col items-center gap-2"
                        >
                            {/* Face image or placeholder */}
                            <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-orange-300 dark:border-orange-700 bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                {current.image_base64 ? (
                                    <img
                                        src={current.image_base64}
                                        alt="Unrecognised face"
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                ) : (
                                    <UserX className="w-10 h-10 text-orange-400 dark:text-orange-500" />
                                )}

                                {/* "?" badge overlay */}
                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow">
                                    <span className="text-[10px] font-bold text-white">?</span>
                                </div>
                            </div>

                            {/* Label */}
                            <div className="text-center">
                                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                                    Unknown Person
                                </p>
                                {current.score != null && (
                                    <p className="text-[10px] text-orange-500 dark:text-orange-400">
                                        Best match: {(current.score * 100).toFixed(0)}%
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Right arrow */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 rounded-full text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-30"
                    onClick={() => go(1)}
                    disabled={faces.length <= 1}
                    aria-label="Next face"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Dot indicators */}
            {faces.length > 1 && (
                <div className="flex justify-center gap-1 pb-2">
                    {faces.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === index
                                    ? 'bg-orange-500 w-3'
                                    : 'bg-orange-300 dark:bg-orange-700'
                                }`}
                            aria-label={`Go to face ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Footer note */}
            <div className="text-center pb-2">
                <p className="text-[10px] text-orange-400 dark:text-orange-500">
                    ⚠ Not registered · Attendance not marked
                </p>
            </div>
        </div>
    );
}
