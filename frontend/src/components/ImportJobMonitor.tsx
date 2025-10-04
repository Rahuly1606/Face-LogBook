import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    Download,
    Trash2,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { getImportJobStatus, deleteImportJob, ImportJob } from '@/api/groups';
import { useToast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ImportJobMonitorProps {
    jobId: number;
    onComplete?: (job: ImportJob) => void;
    onClose?: () => void;
}

const ImportJobMonitor: React.FC<ImportJobMonitorProps> = ({ jobId, onComplete, onClose }) => {
    const [job, setJob] = useState<ImportJob | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showFailuresDialog, setShowFailuresDialog] = useState(false);
    const { toast } = useToast();

    // Poll for job status
    useEffect(() => {
        let interval: number | null = null;

        const fetchJobStatus = async () => {
            try {
                const jobData = await getImportJobStatus(jobId);
                setJob(jobData);
                setIsLoading(false);

                // If job is completed or failed, stop polling and notify parent
                if (jobData.status === 'completed' || jobData.status === 'failed') {
                    if (interval) clearInterval(interval);

                    // Show completion toast
                    if (jobData.status === 'completed') {
                        toast({
                            title: 'Import completed!',
                            description: `Successfully imported ${jobData.successful_records} students${jobData.failed_records > 0 ? ` (${jobData.failed_records} failed)` : ''}`,
                            variant: 'default',
                        });
                    } else {
                        toast({
                            title: 'Import failed',
                            description: jobData.error_message || 'An error occurred during import',
                            variant: 'destructive',
                        });
                    }

                    if (onComplete) {
                        onComplete(jobData);
                    }
                }
            } catch (error) {
                console.error('Error fetching job status:', error);
                setIsLoading(false);
            }
        };

        // Initial fetch
        fetchJobStatus();

        // Poll every 2 seconds if job is not completed
        interval = window.setInterval(() => {
            if (job?.status === 'pending' || job?.status === 'processing') {
                fetchJobStatus();
            }
        }, 2000);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [jobId, job?.status, onComplete, toast]);

    const handleDelete = async () => {
        if (!job) return;

        const success = await deleteImportJob(jobId);
        if (success) {
            toast({
                title: 'Job deleted',
                description: 'Import job record has been deleted',
                variant: 'default',
            });
            if (onClose) onClose();
        } else {
            toast({
                title: 'Error',
                description: 'Failed to delete import job',
                variant: 'destructive',
            });
        }
    };

    const downloadFailuresCSV = () => {
        if (!job || !job.failures || job.failures.length === 0) return;

        const headers = 'row,student_id,name,error\n';
        const rows = job.failures.map(failure =>
            `${failure.row},${failure.student_id || ''},"${failure.name || ''}","${failure.message}"`
        ).join('\n');

        const content = headers + rows;
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import_failures_${jobId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading || !job) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading import status...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getStatusIcon = () => {
        switch (job.status) {
            case 'completed':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'processing':
                return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
            default:
                return <Clock className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusBadge = () => {
        const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
            pending: 'outline',
            processing: 'default',
            completed: 'default',
            failed: 'destructive',
        };

        return (
            <Badge variant={variants[job.status] || 'outline'}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
        );
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {getStatusIcon()}
                            <CardTitle>Import Progress</CardTitle>
                        </div>
                        <div className="flex items-center space-x-2">
                            {getStatusBadge()}
                            {(job.status === 'completed' || job.status === 'failed') && (
                                <Button variant="ghost" size="icon" onClick={handleDelete}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <CardDescription>{job.filename}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{job.progress_percentage}%</span>
                        </div>
                        <Progress value={job.progress_percentage} className="h-2" />
                        <div className="text-sm text-muted-foreground">
                            {job.processed_records} of {job.total_records} records processed
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col items-center p-3 border rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{job.successful_records}</div>
                            <div className="text-xs text-muted-foreground">Successful</div>
                        </div>
                        <div className="flex flex-col items-center p-3 border rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{job.failed_records}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                        <div className="flex flex-col items-center p-3 border rounded-lg">
                            <div className="text-2xl font-bold text-gray-600">
                                {job.total_records - job.processed_records}
                            </div>
                            <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {job.error_message && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{job.error_message}</AlertDescription>
                        </Alert>
                    )}

                    {/* Failures Section */}
                    {job.failures && job.failures.length > 0 && (
                        <div className="space-y-2">
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>{job.failures.length} records failed to import</AlertTitle>
                                <AlertDescription className="mt-2 flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setShowFailuresDialog(true)}>
                                        View Details
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={downloadFailuresCSV}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download CSV
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {/* Completion Info */}
                    {job.completed_at && (
                        <div className="text-sm text-muted-foreground">
                            Completed at {new Date(job.completed_at).toLocaleString()}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Failures Dialog */}
            <Dialog open={showFailuresDialog} onOpenChange={setShowFailuresDialog}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Failed Imports ({job.failures?.length || 0})</DialogTitle>
                        <DialogDescription>
                            Records that could not be imported due to errors
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Row</TableHead>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Error</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {job.failures?.map((failure, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{failure.row}</TableCell>
                                        <TableCell>{failure.student_id || '-'}</TableCell>
                                        <TableCell>{failure.name || '-'}</TableCell>
                                        <TableCell className="text-red-600 text-sm">{failure.message}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ImportJobMonitor;
