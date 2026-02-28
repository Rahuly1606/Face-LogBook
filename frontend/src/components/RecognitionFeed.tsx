import { AnimatePresence, motion } from 'framer-motion';
import { UserCheck, Sparkles } from 'lucide-react';

export interface OverlayEntry {
    id: string;
    name: string;
    time: string;
}

interface RecognitionFeedProps {
    entries: OverlayEntry[];
}

/**
 * RecognitionFeed — Instagram/YouTube-Live-style animated overlay
 * that displays recognised student names directly on the camera feed.
 *
 * - New names slide in from the right with a spring pop
 * - A pulsing glow ring fires on entry
 * - Oldest entries float up and fade away after 4.5 s (managed by parent)
 * - Stacks cleanly when several students are detected simultaneously
 */
export function RecognitionFeed({ entries }: RecognitionFeedProps) {
    return (
        // Positioned bottom-right inside the camera container
        <div className="absolute bottom-4 right-4 flex flex-col-reverse gap-2.5 pointer-events-none z-10 w-60">
            <AnimatePresence mode="popLayout" initial={false}>
                {entries.map((entry, index) => (
                    <motion.div
                        key={entry.id}
                        layout
                        /* ── Entry: slide in from the right with a spring pop ── */
                        initial={{ opacity: 0, x: 80, scale: 0.72 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        /* ── Exit: float upward and fade out ── */
                        exit={{
                            opacity: 0,
                            y: -28,
                            scale: 0.88,
                            transition: { duration: 0.35, ease: [0.4, 0, 1, 1] },
                        }}
                        transition={{
                            type: 'spring',
                            stiffness: 480,
                            damping: 32,
                            mass: 0.9,
                            delay: index === 0 ? 0 : index * 0.06, // stagger when multiple arrive at once
                        }}
                    >
                        {/* Pill card */}
                        <motion.div
                            className="flex items-center gap-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3.5 py-2.5 rounded-2xl border border-green-400/40 backdrop-blur-sm"
                            /* Glow pulse on entry */
                            initial={{ boxShadow: '0 0 0px rgba(34,197,94,0)' }}
                            animate={{
                                boxShadow: [
                                    '0 0 0px rgba(34,197,94,0)',
                                    '0 0 22px rgba(34,197,94,0.65)',
                                    '0 0 12px rgba(34,197,94,0.25)',
                                ],
                            }}
                            transition={{ duration: 1, times: [0, 0.25, 1] }}
                        >
                            {/* Animated checkmark icon */}
                            <motion.div
                                initial={{ rotate: -30, scale: 0 }}
                                animate={{ rotate: 0, scale: 1 }}
                                transition={{
                                    delay: 0.12,
                                    type: 'spring',
                                    stiffness: 700,
                                    damping: 18,
                                }}
                            >
                                <UserCheck className="h-4 w-4 flex-shrink-0 text-green-100" />
                            </motion.div>

                            {/* Name + sub-label */}
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-bold text-sm leading-tight truncate">
                                    {entry.name}
                                </span>
                                <span className="text-[10px] text-green-100/75 leading-tight">
                                    Attendance marked · {entry.time}
                                </span>
                            </div>

                            {/* Live dot */}
                            <motion.span
                                className="w-2 h-2 rounded-full bg-green-200 flex-shrink-0"
                                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                            />
                        </motion.div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* "LIVE" badge that shows whenever the feed has entries */}
            <AnimatePresence>
                {entries.length > 0 && (
                    <motion.div
                        key="live-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1 self-end"
                    >
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-red-500"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                        />
                        <span className="text-[9px] font-bold tracking-widest text-white/70 uppercase">
                            LIVE
                        </span>
                        <Sparkles className="w-3 h-3 text-yellow-300/80" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
