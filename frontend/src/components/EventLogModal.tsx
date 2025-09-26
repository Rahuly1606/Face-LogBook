import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Clock, AlertCircle } from 'lucide-react';
import { CameraEvent, CameraEventPair } from '@/api/camera-events';
import { cn } from '@/lib/utils';

interface EventLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
    date: string;
    eventPairs: CameraEventPair[];
    rawEvents: CameraEvent[];
}

const EventLogModal: React.FC<EventLogModalProps> = ({
    isOpen,
    onClose,
    studentId,
    studentName,
    date,
    eventPairs,
    rawEvents
}) => {
    const [activeTab, setActiveTab] = useState<string>('pairs');

    const formatTime = (timeString: string | null | undefined) => {
        if (!timeString) return <span className="text-muted-foreground">-</span>;
        try {
            // The backend now sends timestamps with proper IST timezone info
            // Parse the ISO string with timezone information and format it for display
            return new Date(timeString).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                timeZone: 'Asia/Kolkata' // Explicitly use IST timezone for consistent display
            });
        } catch {
            return <span className="text-muted-foreground">Invalid</span>;
        }
    };

    const formatDuration = (inTime: string | null | undefined, outTime: string | null | undefined) => {
        if (!inTime || !outTime) return <span className="text-muted-foreground">-</span>;

        try {
            // Parse ISO strings with timezone information
            const inDate = new Date(inTime);
            const outDate = new Date(outTime);
            const diff = outDate.getTime() - inDate.getTime();

            // Convert to hours, minutes, seconds
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            return (
                <span>
                    {hours > 0 ? `${hours}h ` : ''}
                    {minutes > 0 ? `${minutes}m ` : ''}
                    {seconds}s
                </span>
            );
        } catch {
            return <span className="text-muted-foreground">Invalid</span>;
        }
    };

    const getEventTypeIcon = (type: string) => {
        return type === 'in' ? (
            <LogIn className="h-4 w-4 text-green-600" />
        ) : (
            <LogOut className="h-4 w-4 text-amber-600" />
        );
    };

    const getEventTypeBadge = (type: string) => {
        return (
            <Badge
                variant="outline"
                className={cn(
                    "font-semibold capitalize",
                    type === 'in'
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                )}
            >
                {type === 'in' ? 'Check In' : 'Check Out'}
            </Badge>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        Attendance Events: {studentName}
                    </DialogTitle>
                    <DialogDescription>
                        <div className="flex flex-col gap-1 mt-1">
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Student ID:</span> {studentId}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Date:</span> {new Date(date).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    timeZone: 'Asia/Kolkata' // Explicitly use IST timezone
                                })}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="pairs" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="pairs">In/Out Pairs</TabsTrigger>
                        <TabsTrigger value="raw">Raw Events</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pairs" className="mt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[100px]">Pair</TableHead>
                                    <TableHead className="w-[200px]">Check In</TableHead>
                                    <TableHead className="w-[200px]">Check Out</TableHead>
                                    <TableHead>Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eventPairs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <Clock className="h-8 w-8" />
                                                <p>No event pairs found for this date</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    eventPairs.map((pair, index) => (
                                        <TableRow key={`pair-${index}`}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>
                                                {pair.in_event ? (
                                                    <div className="flex items-center gap-2">
                                                        <LogIn className="h-4 w-4 text-green-600" />
                                                        {formatTime(pair.in_event.timestamp)}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {pair.out_event ? (
                                                    <div className="flex items-center gap-2">
                                                        <LogOut className="h-4 w-4 text-amber-600" />
                                                        {formatTime(pair.out_event.timestamp)}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <span>Not checked out</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {formatDuration(
                                                    pair.in_event?.timestamp,
                                                    pair.out_event?.timestamp
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="raw" className="mt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[80px]">Event</TableHead>
                                    <TableHead className="w-[100px]">Type</TableHead>
                                    <TableHead className="w-[200px]">Timestamp</TableHead>
                                    <TableHead>Created At</TableHead>
                                    {/* Additional admin fields could be shown conditionally */}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rawEvents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <Clock className="h-8 w-8" />
                                                <p>No events found for this date</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rawEvents.map((event) => (
                                        <TableRow key={event.id}>
                                            <TableCell className="font-medium">{event.id}</TableCell>
                                            <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getEventTypeIcon(event.event_type)}
                                                    {formatTime(event.timestamp)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatTime(event.created_at)}
                                                {event.modified_by && (
                                                    <div className="text-xs mt-1">
                                                        <span className="font-medium">Modified by:</span> {event.modified_by}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default EventLogModal;