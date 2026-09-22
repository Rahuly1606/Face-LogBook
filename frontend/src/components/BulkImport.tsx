import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Upload,
    Loader2,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    Download
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { groupApi, bulkImportApi, BulkImportResult } from '@/services/api';
import type { Group } from '@/services/api';

interface BulkImportProps {
    groupId?: number;
    onSuccess?: () => void;
}

export default function BulkImport({ groupId: propGroupId, onSuccess }: BulkImportProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<string[][]>([]);
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(propGroupId);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [isDryRun, setIsDryRun] = useState(false);
    const [progress, setProgress] = useState(0);
    const [totalRows, setTotalRows] = useState(0);
    const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([]);
    const [useAsyncImport, setUseAsyncImport] = useState(true);
    const [currentJobId, setCurrentJobId] = useState<number | null>(null);

    // Fetch groups on mount
    useEffect(() => {
        const fetchGroups = async () => {
            setIsLoadingGroups(true);
            try {
                const fetchedGroups = await groupApi.getAll();
                setGroups(fetchedGroups);
                if (!propGroupId && fetchedGroups.length > 0) {
                    setSelectedGroupId(fetchedGroups[0].id);
                }
            } catch (error) {
                console.error('Error fetching groups:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load groups',
                    variant: 'destructive',
                });
            } finally {
                setIsLoadingGroups(false);
            }
        };
        fetchGroups();
    }, [propGroupId, toast]);

    const resetForm = () => {
        setSelectedFile(null);
        setPreviewData([]);
        setImportResult(null);
        setValidationErrors([]);
        setProgress(0);
        setTotalRows(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const parseCSV = (text: string): string[][] => {
        const lines = text.split(/\r?\n/);
        const rows: string[][] = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            const cells: string[] = [];
            let currentCell = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }

            cells.push(currentCell.trim());

            if (cells.some(cell => cell.trim() !== '')) {
                rows.push(cells);
            }
        }

        return rows;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast({
                title: 'Invalid file type',
                description: 'Only CSV files are supported',
                variant: 'destructive',
            });
            resetForm();
            return;
        }

        setSelectedFile(file);
        setValidationErrors([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const rows = parseCSV(text);

                if (rows.length === 0) {
                    toast({
                        title: 'Empty CSV file',
                        description: 'The uploaded file appears to be empty',
                        variant: 'destructive',
                    });
                    resetForm();
                    return;
                }

                setTotalRows(rows.length - 1);
                setPreviewData(rows.slice(0, Math.min(rows.length, 11)));
            } catch (error) {
                console.error('Error parsing CSV:', error);
                toast({
                    title: 'CSV parsing error',
                    description: 'Failed to parse the file',
                    variant: 'destructive',
                });
                resetForm();
            }
        };
        reader.readAsText(file);
    };

    const validateData = async () => {
        if (!selectedFile || !selectedGroupId) {
            toast({
                title: 'Missing information',
                description: 'Please select a file and a group',
                variant: 'destructive',
            });
            return false;
        }

        setIsValidating(true);
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(90, prev + 5));
        }, 500);

        try {
            setValidationErrors([]);
            const result = await bulkImportApi.validateImport(selectedGroupId, selectedFile);

            clearInterval(progressInterval);
            setProgress(100);

            if (result.failures && result.failures.length > 0) {
                setValidationErrors(result.failures.map((failure) => ({
                    row: failure.row || 0,
                    message: failure.message || 'Unknown error'
                })));

                toast({
                    title: 'Validation issues found',
                    description: `${result.failures.length} issues need to be fixed`,
                    variant: 'destructive',
                });
                return false;
            }

            toast({
                title: 'Validation successful',
                description: `${previewData.length - 1} students ready to import`,
            });

            return true;
        } catch (error) {
            clearInterval(progressInterval);
            setProgress(100);

            toast({
                title: 'Validation failed',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile || !selectedGroupId) {
            toast({
                title: 'Missing information',
                description: 'Please select a file and a group',
                variant: 'destructive',
            });
            return;
        }

        if (isDryRun) {
            await validateData();
            return;
        }

        setIsLoading(true);

        try {
            if (useAsyncImport) {
                const response = await bulkImportApi.startAsyncImport(selectedGroupId, selectedFile);

                if (response.success && response.job_id) {
                    setCurrentJobId(response.job_id);
                    toast({
                        title: 'Import started',
                        description: `Processing ${response.total_records} records in the background`,
                    });
                    resetForm();
                } else {
                    toast({
                        title: 'Error',
                        description: response.message || 'Failed to start import',
                        variant: 'destructive',
                    });
                }
                setIsLoading(false);
                return;
            }

            setProgress(0);
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(90, prev + 5));
            }, 500);

            const result = await bulkImportApi.bulkImport(selectedGroupId, selectedFile);

            clearInterval(progressInterval);
            setProgress(100);

            setImportResult(result);

            if (result.successes && result.successes.length > 0 &&
                (!result.failures || result.failures.length === 0)) {
                toast({
                    title: 'Import successful',
                    description: `Successfully imported ${result.successes.length} students`,
                });
                if (onSuccess) onSuccess();
            }

            if ((result.successes && result.successes.length > 0) ||
                (result.failures && result.failures.length > 0)) {
                setShowResultDialog(true);
            }
        } catch (error) {
            setProgress(100);
            toast({
                title: 'Import failed',
                description: error instanceof Error ? error.message : 'Failed to import students',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        const content = 'student_id,name,drive_link\n' +
            '2300001001,John Smith,https://drive.google.com/file/d/ABC123XYZ/view\n' +
            '2300001002,Jane Doe,https://drive.google.com/open?id=DEF456UVW';

        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student_import_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadFailuresAsCSV = () => {
        if (!importResult || !importResult.failures || importResult.failures.length === 0) return;

        const headers = 'student_id,name,drive_link,error\n';
        const rows = importResult.failures.map(failure =>
            `${failure.student_id || ''},,,"${failure.message}"`
        ).join('\n');

        const content = headers + rows;
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'failed_imports.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-accent-foreground" />
                    Bulk Import Students
                </CardTitle>
                <CardDescription>
                    Upload a CSV file with student information and Google Drive links to photos
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>CSV Format Requirements</AlertTitle>
                    <AlertDescription>
                        <p>Upload CSV file with header: <strong>student_id,name,drive_link</strong></p>
                        <p>The service account must have access to the Google Drive files.</p>
                        <Button
                            variant="link"
                            className="h-auto p-0 font-normal text-accent-foreground underline"
                            onClick={downloadTemplate}
                        >
                            Download CSV Template
                        </Button>
                    </AlertDescription>
                </Alert>

                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="block w-full text-sm text-foreground
                                file:mr-4 file:rounded-md file:border-0
                                file:bg-accent file:px-4 file:py-2
                                file:text-sm file:font-semibold file:text-accent-foreground
                                hover:file:bg-accent/90"
                        />
                    </div>

                    <div className="mt-4">
                        <label className="mb-2 block text-sm font-medium">Select Group:</label>
                        <Select
                            value={selectedGroupId?.toString()}
                            onValueChange={(value) => setSelectedGroupId(Number(value))}
                            disabled={isLoadingGroups}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.isArray(groups) && groups.length > 0 ? (
                                    groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id.toString()}>
                                            {group.name} ({group.id})
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="0" disabled>No groups available</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {isLoadingGroups && <p className="text-sm text-muted-foreground mt-1">Loading groups...</p>}
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                        <Switch
                            id="async-import"
                            checked={useAsyncImport}
                            onCheckedChange={setUseAsyncImport}
                        />
                        <Label htmlFor="async-import" className="font-medium">
                            Background processing
                        </Label>
                        <div className="text-sm text-muted-foreground ml-2">
                            (recommended for large batches)
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                        <Switch
                            id="dry-run"
                            checked={isDryRun}
                            onCheckedChange={setIsDryRun}
                        />
                        <Label htmlFor="dry-run" className="font-medium">
                            Validation mode (dry run)
                        </Label>
                        <div className="text-sm text-muted-foreground ml-2">
                            Only check data without importing
                        </div>
                    </div>

                    {previewData.length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 text-sm font-medium">Preview (first {Math.min(previewData.length, 10)} rows):</h3>
                            <div className="overflow-x-auto rounded-md border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {previewData[0].map((header, idx) => (
                                                <TableHead key={idx}>{header}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(1, 11).map((row, rowIdx) => (
                                            <TableRow key={rowIdx}>
                                                {row.map((cell, cellIdx) => (
                                                    <TableCell key={cellIdx}>{cell}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {totalRows > 100 && (
                        <Alert className="mt-4 border-warning/30 bg-warning/10">
                            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                            <AlertTitle className="text-warning-foreground">Large Import Detected</AlertTitle>
                            <AlertDescription className="text-warning-foreground">
                                You're about to import {totalRows} students. Large imports may take several minutes.
                            </AlertDescription>
                        </Alert>
                    )}

                    {validationErrors.length > 0 && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Validation Errors</AlertTitle>
                            <AlertDescription>
                                <ul className="mt-2 list-inside list-disc">
                                    {validationErrors.slice(0, 5).map((error, idx) => (
                                        <li key={idx}>
                                            Row {error.row}: {error.message}
                                        </li>
                                    ))}
                                    {validationErrors.length > 5 && (
                                        <li>... and {validationErrors.length - 5} more errors</li>
                                    )}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {(isLoading || isValidating || progress > 0) && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>{isValidating ? 'Validating' : 'Importing'}...</span>
                                <span className="tnum">{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full" />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={resetForm}
                            disabled={isLoading || isValidating}
                        >
                            Reset
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedFile || isLoading || isValidating}
                            variant="accent"
                        >
                            {isValidating ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Validating...</>
                            ) : isLoading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Importing...</>
                            ) : isDryRun ? (
                                <>Validate Only</>
                            ) : (
                                <>Upload and Import<Upload className="h-4 w-4" /></>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Import Results Dialog */}
                <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                    <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Import Results</DialogTitle>
                        </DialogHeader>

                        {importResult && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="flex items-center gap-1.5 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-success" />
                                            Successful: <strong>{importResult.successes?.length || 0}</strong>
                                        </p>
                                        <p className="flex items-center gap-1.5 text-sm">
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                            Failed: <strong>{importResult.failures?.length || 0}</strong>
                                        </p>
                                    </div>

                                    {importResult.failures && importResult.failures.length > 0 && (
                                        <Button onClick={downloadFailuresAsCSV} variant="outline" size="sm">
                                            <Download className="h-4 w-4" />
                                            Download Failures
                                        </Button>
                                    )}
                                </div>

                                {importResult.successes && importResult.successes.length > 0 && (
                                    <div>
                                        <h3 className="mb-2 font-semibold text-success">Successfully Imported</h3>
                                        <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Student ID</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {importResult.successes.map((student, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{student.student_id}</TableCell>
                                                            <TableCell>{student.name}</TableCell>
                                                            <TableCell className="font-medium text-success">{student.message}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                {importResult.failures && importResult.failures.length > 0 && (
                                    <div>
                                        <h3 className="mb-2 font-semibold text-destructive">Failed Imports</h3>
                                        <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Row</TableHead>
                                                        <TableHead>Student ID</TableHead>
                                                        <TableHead>Error</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {importResult.failures.map((failure, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{failure.row || '-'}</TableCell>
                                                            <TableCell>{failure.student_id || '-'}</TableCell>
                                                            <TableCell className="font-medium text-destructive">{failure.message}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                variant="accent"
                                onClick={() => {
                                    setShowResultDialog(false);
                                    if (importResult && importResult.successes.length > 0 && onSuccess) {
                                        onSuccess();
                                    }
                                    resetForm();
                                }}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
