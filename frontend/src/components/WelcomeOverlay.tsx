import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Types ---
interface OverlayMessage {
    id: number;
    name: string;
    type: 'welcome' | 'goodbye';
    timerId?: NodeJS.Timeout;
    isLeaving: boolean;
    colorIndex: number; // For alternating colors
}

interface PendingGoodbye {
    name: string;
    studentId: string;
    timerId: NodeJS.Timeout;
}

const MAX_MESSAGES = 3;
const MESSAGE_DURATION = 5000; // 5 seconds
const GOODBYE_DELAY = 30000; // 30 seconds delay for same person

// Color schemes for alternating messages
const WELCOME_COLORS = [
    'bg-gradient-to-r from-purple-600 to-pink-500',
    'bg-gradient-to-r from-blue-600 to-cyan-500',
    'bg-gradient-to-r from-green-600 to-emerald-500',
    'bg-gradient-to-r from-indigo-600 to-purple-500',
];

const GOODBYE_COLORS = [
    'bg-gradient-to-r from-amber-500 to-orange-600',
    'bg-gradient-to-r from-red-500 to-pink-600',
    'bg-gradient-to-r from-orange-500 to-red-500',
    'bg-gradient-to-r from-yellow-500 to-orange-500',
];

// --- Component ---
const WelcomeOverlay: React.FC = () => {
    const [messages, setMessages] = useState<OverlayMessage[]>([]);
    const messageQueue = useRef<{ name: string, type: 'welcome' | 'goodbye', studentId?: string }[]>([]);
    const pendingGoodbye = useRef<PendingGoodbye | null>(null);
    const lastSeenStudent = useRef<{ studentId: string, name: string } | null>(null);
    const messageColorIndex = useRef<number>(0); // Track color index for alternating colors

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
            setTimeout(() => removeMessage(id), 400); // Matches fade-out duration
        }, MESSAGE_DURATION);
        return timerId;
    }, [removeMessage]);

    // Processes the next message in the queue if there's space
    const processQueue = useCallback(() => {
        setMessages(currentMessages => {
            if (currentMessages.length < MAX_MESSAGES && messageQueue.current.length > 0) {
                const message = messageQueue.current.shift();
                if (message) {
                    // Get color index and increment for next message
                    const colorIndex = messageColorIndex.current;
                    messageColorIndex.current = (messageColorIndex.current + 1) %
                        (message.type === 'welcome' ? WELCOME_COLORS.length : GOODBYE_COLORS.length);

                    const newMessage: OverlayMessage = {
                        id: Date.now(),
                        name: message.name,
                        type: message.type,
                        isLeaving: false,
                        colorIndex: colorIndex,
                    };
                    // Schedule removal and store the timer ID
                    const timerId = scheduleRemoval(newMessage.id);
                    return [...currentMessages, { ...newMessage, timerId }];
                }
            }
            return currentMessages;
        });
    }, [scheduleRemoval]);

    // Main function to add a new welcome message
    const addWelcome = useCallback((name: string, studentId?: string) => {
        // Requirement: Remove any legacy greeting elements
        document.querySelectorAll('.legacy-greeting').forEach(el => el.remove());

        // If this person had a pending goodbye, cancel it (they're back!)
        if (studentId && pendingGoodbye.current && pendingGoodbye.current.studentId === studentId) {
            clearTimeout(pendingGoodbye.current.timerId);
            pendingGoodbye.current = null;
        }

        // Update last seen student when they enter
        if (studentId) {
            lastSeenStudent.current = { studentId, name };
        }

        messageQueue.current.push({ name, type: 'welcome', studentId });
        processQueue();
    }, [processQueue]);

    // Main function to add a new goodbye message
    const addGoodbye = useCallback((name: string, studentId?: string) => {
        // If a different person appears, cancel the pending goodbye for the previous person
        // and show goodbye immediately
        if (studentId && lastSeenStudent.current && lastSeenStudent.current.studentId !== studentId) {
            // Different person detected - show goodbye immediately for previous person
            if (pendingGoodbye.current) {
                clearTimeout(pendingGoodbye.current.timerId);
                // Show the goodbye message immediately
                messageQueue.current.push({
                    name: pendingGoodbye.current.name,
                    type: 'goodbye',
                    studentId: pendingGoodbye.current.studentId
                });
                pendingGoodbye.current = null;
                processQueue();
            }
        }

        // If same person is still in view, set up a REPEATING goodbye every 30 seconds
        if (studentId && lastSeenStudent.current && lastSeenStudent.current.studentId === studentId) {
            // Cancel any existing pending goodbye for this person
            if (pendingGoodbye.current && pendingGoodbye.current.studentId === studentId) {
                clearTimeout(pendingGoodbye.current.timerId);
            }

            // Set up REPEATING goodbye - shows message and schedules next one
            const scheduleNextGoodbye = () => {
                // Show the goodbye message
                messageQueue.current.push({ name, type: 'goodbye', studentId });
                processQueue();

                // Schedule the next goodbye in 30 seconds (REPEATING)
                const timerId = setTimeout(scheduleNextGoodbye, GOODBYE_DELAY);
                pendingGoodbye.current = { name, studentId, timerId };
            };

            // Start the first goodbye after 30 seconds
            const timerId = setTimeout(scheduleNextGoodbye, GOODBYE_DELAY);
            pendingGoodbye.current = { name, studentId, timerId };

        } else {
            // No studentId provided or first time seeing someone - show immediately
            messageQueue.current.push({ name, type: 'goodbye', studentId });
            processQueue();
        }

        // Update last seen student
        if (studentId) {
            lastSeenStudent.current = { studentId, name };
        }
    }, [processQueue]);

    // Expose functions globally and process queue when messages are removed
    useEffect(() => {
        (window as any).addWelcome = addWelcome;
        (window as any).addGoodbye = addGoodbye;
        processQueue(); // Process queue in case a spot opened up

        // Cleanup global functions on unmount
        return () => {
            delete (window as any).addWelcome;
            delete (window as any).addGoodbye;
        };
    }, [addWelcome, addGoodbye, messages.length, processQueue]);

    // Cleanup all timers on component unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            messages.forEach(msg => {
                if (msg.timerId) clearTimeout(msg.timerId);
            });
            // Clear pending goodbye timer
            if (pendingGoodbye.current) {
                clearTimeout(pendingGoodbye.current.timerId);
            }
        };
    }, [messages]);

    const handleMouseEnter = (id: number) => {
        setMessages(prev =>
            prev.map(msg => {
                if (msg.id === id && msg.timerId) {
                    clearTimeout(msg.timerId); // Pause removal
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
                    const newTimerId = scheduleRemoval(id); // Resume removal
                    return { ...msg, timerId: newTimerId };
                }
                return msg;
            })
        );
    };

    return (
        <div
            aria-live="polite"
            className="absolute bottom-4 left-4 w-full max-w-xs flex flex-col-reverse space-y-2 space-y-reverse z-50"
        >
            {messages.map(msg => {
                // Get the color based on type and color index
                const colorClass = msg.type === 'welcome'
                    ? WELCOME_COLORS[msg.colorIndex % WELCOME_COLORS.length]
                    : GOODBYE_COLORS[msg.colorIndex % GOODBYE_COLORS.length];

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
