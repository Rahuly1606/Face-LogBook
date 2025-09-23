import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Types ---
interface OverlayMessage {
    id: number;
    name: string;
    type: 'welcome' | 'goodbye';
    timerId?: NodeJS.Timeout;
    isLeaving: boolean;
}

const MAX_MESSAGES = 3;
const MESSAGE_DURATION = 5000; // 5 seconds

// --- Component ---
const WelcomeOverlay: React.FC = () => {
    const [messages, setMessages] = useState<OverlayMessage[]>([]);
    const messageQueue = useRef<{name: string, type: 'welcome' | 'goodbye'}[]>([]);

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
                    const newMessage: OverlayMessage = {
                        id: Date.now(),
                        name: message.name,
                        type: message.type,
                        isLeaving: false,
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
    const addWelcome = useCallback((name: string) => {
        // Requirement: Remove any legacy greeting elements
        document.querySelectorAll('.legacy-greeting').forEach(el => el.remove());
        messageQueue.current.push({name, type: 'welcome'});
        processQueue();
    }, [processQueue]);

    // Main function to add a new goodbye message
    const addGoodbye = useCallback((name: string) => {
        messageQueue.current.push({name, type: 'goodbye'});
        processQueue();
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
            className="absolute bottom-4 left-4 w-full max-w-sm flex flex-col-reverse space-y-2 space-y-reverse z-50"
        >
            {messages.map(msg => (
                <div
                    key={msg.id}
                    onMouseEnter={() => handleMouseEnter(msg.id)}
                    onMouseLeave={() => handleMouseLeave(msg.id)}
                    className={`
                        ${msg.type === 'welcome' 
                            ? 'bg-gradient-to-r from-purple-600 to-pink-500' 
                            : 'bg-gradient-to-r from-amber-500 to-orange-600'
                        }
                        text-white px-4 py-2 rounded-2xl shadow-lg 
                        border border-white/20 backdrop-blur-sm max-w-[80%] sm:max-w-xs md:max-w-sm
                        ${msg.isLeaving ? 'animate-fade-out' : 'animate-fade-in'}
                    `}
                >
                    <span className="font-semibold">{msg.name}:</span> 
                    {msg.type === 'welcome' ? ' Welcome 🎉' : ' Goodbye 👋'}
                </div>
            ))}
        </div>
    );
};

export default WelcomeOverlay;
