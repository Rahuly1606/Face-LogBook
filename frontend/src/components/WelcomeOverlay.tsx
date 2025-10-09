import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Types ---
interface OverlayMessage {
    id: number;
    name: string;
    studentId: string;
    type: 'welcome' | 'goodbye';
    timerId?: NodeJS.Timeout;
    isLeaving: boolean;
    colorIndex: number;
}

const MAX_MESSAGES = 3;
const MESSAGE_DURATION = 5000; // 5 seconds

// Unified color palette - each person gets one color from this array
const PERSON_COLORS = [
    'bg-gradient-to-r from-purple-600 to-pink-500',
    'bg-gradient-to-r from-blue-600 to-cyan-500',
    'bg-gradient-to-r from-green-600 to-emerald-500',
    'bg-gradient-to-r from-indigo-600 to-purple-500',
    'bg-gradient-to-r from-amber-500 to-orange-600',
    'bg-gradient-to-r from-red-500 to-pink-600',
    'bg-gradient-to-r from-teal-500 to-cyan-600',
    'bg-gradient-to-r from-violet-500 to-purple-600',
    'bg-gradient-to-r from-lime-500 to-green-600',
    'bg-gradient-to-r from-rose-500 to-pink-600',
];

// --- Component ---
const WelcomeOverlay: React.FC = () => {
    const [messages, setMessages] = useState<OverlayMessage[]>([]);

    // Track which students have been welcomed today (session-based)
    const welcomedToday = useRef<Set<string>>(new Set());

    // Map student IDs to their assigned color index (persistent within session)
    const studentColorMap = useRef<Map<string, number>>(new Map());

    // Counter for assigning new colors
    const nextColorIndex = useRef<number>(0);

    // Function to remove a message after its animation
    const removeMessage = useCallback((id: number) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
    }, []);

    // Function to schedule the fade-out and removal of a message
    const scheduleRemoval = useCallback((id: number) => {
        const timerId = setTimeout(() => {
            setMessages(prev =>
                prev.map(msg => (msg.id === id ? { ...msg, isLeaving: true } : msg))
            );
            // Wait for the fade-out animation to complete before removing from DOM
            setTimeout(() => removeMessage(id), 400);
        }, MESSAGE_DURATION);
        return timerId;
    }, [removeMessage]);

    // Get or assign color for a student
    const getColorForStudent = useCallback((studentId: string): number => {
        if (studentColorMap.current.has(studentId)) {
            return studentColorMap.current.get(studentId)!;
        }

        // Assign new color
        const colorIndex = nextColorIndex.current % PERSON_COLORS.length;
        studentColorMap.current.set(studentId, colorIndex);
        nextColorIndex.current++;

        return colorIndex;
    }, []);

    // Add a greeting message for a student
    const addGreeting = useCallback((name: string, studentId: string) => {
        if (!studentId || !name) return;

        // Determine if this is first appearance today
        const isFirstAppearance = !welcomedToday.current.has(studentId);
        const messageType = isFirstAppearance ? 'welcome' : 'goodbye';

        // Mark as welcomed if first time
        if (isFirstAppearance) {
            welcomedToday.current.add(studentId);
        }

        // Get consistent color for this student
        const colorIndex = getColorForStudent(studentId);

        // Create new message
        const newMessage: OverlayMessage = {
            id: Date.now() + Math.random(), // Ensure uniqueness
            name,
            studentId,
            type: messageType,
            isLeaving: false,
            colorIndex,
        };

        setMessages(prev => {
            // If we're at max capacity, remove the oldest (first) message
            let updatedMessages = [...prev];
            if (updatedMessages.length >= MAX_MESSAGES) {
                // Cancel timer for the oldest message
                const oldestMsg = updatedMessages[0];
                if (oldestMsg.timerId) {
                    clearTimeout(oldestMsg.timerId);
                }
                // Remove oldest message (shift removes from beginning)
                updatedMessages.shift();
            }

            // Add new message at the end (bottom of visual stack)
            const timerId = scheduleRemoval(newMessage.id);
            return [...updatedMessages, { ...newMessage, timerId }];
        });
    }, [getColorForStudent, scheduleRemoval]);

    // Expose function globally
    useEffect(() => {
        (window as any).addGreeting = addGreeting;

        // Cleanup
        return () => {
            delete (window as any).addGreeting;
        };
    }, [addGreeting]);

    // Cleanup all timers on component unmount
    useEffect(() => {
        return () => {
            messages.forEach(msg => {
                if (msg.timerId) clearTimeout(msg.timerId);
            });
        };
    }, [messages]);

    const handleMouseEnter = (id: number) => {
        setMessages(prev =>
            prev.map(msg => {
                if (msg.id === id && msg.timerId) {
                    clearTimeout(msg.timerId);
                    return { ...msg, timerId: undefined };
                }
                return msg;
            })
        );
    };

    const handleMouseLeave = (id: number) => {
        setMessages(prev =>
            prev.map(msg => {
                if (msg.id === id && !msg.timerId) {
                    const newTimerId = scheduleRemoval(id);
                    return { ...msg, timerId: newTimerId };
                }
                return msg;
            })
        );
    };

    return (
        <div
            aria-live="polite"
            className="absolute bottom-4 left-4 w-full max-w-xs flex flex-col space-y-2 z-50"
        >
            {messages.map(msg => {
                const colorClass = PERSON_COLORS[msg.colorIndex % PERSON_COLORS.length];

                return (
                    <div
                        key={msg.id}
                        onMouseEnter={() => handleMouseEnter(msg.id)}
                        onMouseLeave={() => handleMouseLeave(msg.id)}
                        className={`
                            ${colorClass}
                            text-white px-3 py-1.5 rounded-lg shadow-md 
                            border border-white/20 backdrop-blur-sm max-w-[70%] text-sm
                            ${msg.isLeaving ? 'animate-fade-out' : 'animate-fade-in'}
                        `}
                    >
                        <span className="font-semibold text-xs">{msg.name}:</span>
                        <span className="text-xs">{msg.type === 'welcome' ? ' Welcome 🎉' : ' Goodbye 👋'}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default WelcomeOverlay;
