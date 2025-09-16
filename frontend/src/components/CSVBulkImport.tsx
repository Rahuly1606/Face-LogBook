import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileSpreadsheet, Upload, CheckCircle, XCircle, Download, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { bulkImportStudents, BulkImportResult, BulkImportSuccess, BulkImportFailure } from '@/api/students';
import { getGroups, Group } from '@/api/groups';

interface BulkImportProps {
  groupId?: number;
  onSuccess?: () => void;
}

const CSVBulkImport: React.FC<BulkImportProps> = ({ groupId: propGroupId, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(propGroupId);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch groups on component mount (only once)
  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const fetchedGroups = await getGroups();
        setGroups(fetchedGroups);
        // If no group is selected and we have groups, select the first one
        if (!propGroupId && fetchedGroups.length > 0) {
          setSelectedGroupId(fetchedGroups[0].id);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load groups. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setImportResult(null);
    // Note: We don't reset selectedGroupId to preserve the user's selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Only CSV files are supported.',
        variant: 'destructive'
      });
      resetForm();
      return;
    }

    setSelectedFile(file);

    // Parse and preview CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        
        if (rows.length === 0) {
          toast({
            title: 'Empty CSV file',
            description: 'The uploaded CSV file appears to be empty',
            variant: 'destructive'
          });
          resetForm();
          return;
        }
        
        setPreviewData(rows.slice(0, 10)); // Preview first 10 rows
        
        // Debug
        console.log('CSV preview data:', rows.slice(0, 3));
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: 'CSV parsing error',
          description: 'Failed to parse the CSV file. Please check the format.',
          variant: 'destructive'
        });
        resetForm();
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string): string[][] => {
    // First, try to handle the case where the CSV might have been exported from Excel or Google Sheets
    // These often use CRLF and have quoted fields
    const lines = text.split(/\r?\n/);
    const rows: string[][] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue; // Skip empty lines
      
      // Simple CSV parsing - this can be enhanced for more complex CSV formats
      // Handle quoted fields with commas inside
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
      
      // Don't forget the last cell
      cells.push(currentCell.trim());
      
      // Only add non-empty rows
      if (cells.some(cell => cell.trim() !== '')) {
        rows.push(cells);
      }
    }
    
    console.log('Parsed CSV rows:', rows.length);
    return rows;
  };

  const validateCSV = (): boolean => {
    if (!selectedFile || previewData.length === 0) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive'
      });
      return false;
    }

    // Check if headers are present and valid
    const requiredHeaderVariations = {
      'student_id': ['student_id', 'student id', 'studentid', 'id', 'your college id', 'college id'],
      'name': ['name', 'full name', 'student name', 'your name'],
      'drive_link': ['drive_link', 'drive link', 'drivelink', 'photo', 'image', 'upload your clear image']
    };
    
    const headers = previewData[0].map(h => h.toLowerCase().trim());
    
    const missingHeaders = [];
    if (!headers.some(h => requiredHeaderVariations['student_id'].includes(h))) {
      missingHeaders.push('student_id');
    }
    if (!headers.some(h => requiredHeaderVariations['name'].includes(h))) {
      missingHeaders.push('name');
    }
    if (!headers.some(h => requiredHeaderVariations['drive_link'].includes(h))) {
      missingHeaders.push('drive_link');
    }
    
    if (missingHeaders.length > 0) {
      toast({
        title: 'Invalid CSV format',
        description: `Missing required headers: ${missingHeaders.join(', ')}. File must include: student_id,name,drive_link`,
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateCSV() || !selectedFile) return;

    // Verify groupId is valid
    if (!selectedGroupId) {
      toast({
        title: 'Invalid group',
        description: 'No group selected. Please select a group first.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Submitting with groupId:', selectedGroupId);
      const result = await bulkImportStudents(selectedGroupId, selectedFile);
      
      // Handle the current backend response which might be in a different format
      // Check if result has the expected structure
      const compatibleResult: BulkImportResult = {
        successes: result.successes || [],
        failures: result.failures || []
      };
      
      // If the backend returns a success message but no arrays
      if (result.success === true && (!result.successes || !result.failures)) {
        toast({
          title: 'Import processing',
          description: result.message || 'CSV file uploaded successfully and is being processed',
          variant: 'default'
        });
        
        if (onSuccess) onSuccess();
        
        // Don't show the dialog for a placeholder response
        setIsLoading(false);
        resetForm();
        return;
      }
      
      // If the backend returns an error message but no failure array
      if (result.success === false && !result.failures) {
        toast({
          title: 'Import failed',
          description: result.message || 'Unknown error occurred during import',
          variant: 'destructive'
        });
        
        setIsLoading(false);
        return;
      }
      
      setImportResult(compatibleResult);
      
      // If successful and no failures, show toast
      if (compatibleResult.successes && compatibleResult.successes.length > 0 && 
         (!compatibleResult.failures || compatibleResult.failures.length === 0)) {
        toast({
          title: 'Import successful',
          description: `Successfully imported ${compatibleResult.successes.length} students`,
          variant: 'default'
        });
        if (onSuccess) onSuccess();
      }
      
      // Show the results dialog if there are actual results to display
      if ((compatibleResult.successes && compatibleResult.successes.length > 0) || 
          (compatibleResult.failures && compatibleResult.failures.length > 0)) {
        setShowResultDialog(true);
      }
    } catch (error) {
      console.error('Error importing students:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import students',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFailuresAsCSV = () => {
    if (!importResult || !importResult.failures || importResult.failures.length === 0) return;

    // Create CSV content
    const headers = 'student_id,name,drive_link,error\n';
    const rows = importResult.failures.map(failure => 
      `${failure.student_id || ''},,,"${failure.message}"`
    ).join('\n');
    
    const content = headers + rows;
    
    // Create download link
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
  
  const downloadTemplate = () => {
    // Create template CSV content
    const content = 'student_id,name,drive_link\n' +
      '2300001001,John Smith,https://drive.google.com/file/d/ABC123XYZ/view\n' +
      '2300001002,Jane Doe,https://drive.google.com/open?id=DEF456UVW';
    
    // Create download link
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
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
              className="p-0 h-auto font-normal text-blue-600 underline" 
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
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-white
                hover:file:bg-primary/90"
            />
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Select Group:</label>
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
                      {group.name || `Group ${group.id}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="0">No groups available</SelectItem>
                )}
              </SelectContent>
            </Select>
            {isLoadingGroups && <p className="text-sm text-muted-foreground mt-1">Loading groups...</p>}
          </div>

          {previewData.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Preview (first {Math.min(previewData.length, 10)} rows):</h3>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData[0].map((header, i) => (
                        <TableHead key={i}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(1, 10).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} disabled={isLoading}>
              Reset
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedFile || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? 'Uploading...' : 'Upload and Import'}
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Import Results Dialog */}
        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Results</DialogTitle>
            </DialogHeader>
            
            {importResult && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">{importResult.successes?.length || 0} Successful</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{importResult.failures?.length || 0} Failed</span>
                    </div>
                  </div>
                  
                  {importResult.failures && importResult.failures.length > 0 && (
                    <Button variant="outline" onClick={downloadFailuresAsCSV} className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download Failures
                    </Button>
                  )}
                </div>
                
                {importResult.successes && importResult.successes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Successful Imports
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.successes.map((success, i) => (
                          <TableRow key={i}>
                            <TableCell>{success.row}</TableCell>
                            <TableCell>{success.student_id}</TableCell>
                            <TableCell>{success.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {importResult.failures && importResult.failures.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Failed Imports
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.failures.map((failure, i) => (
                          <TableRow key={i}>
                            <TableCell>{failure.row}</TableCell>
                            <TableCell>{failure.student_id}</TableCell>
                            <TableCell>{failure.reason_code}</TableCell>
                            <TableCell>{failure.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button onClick={() => {
                setShowResultDialog(false);
                if (importResult && importResult.successes.length > 0 && onSuccess) {
                  onSuccess();
                }
                resetForm();
              }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CSVBulkImport;