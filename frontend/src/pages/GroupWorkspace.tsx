import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useToast } from '../hooks/use-toast';
import { getGroup } from '../api/auth';
import { getAllImportJobs, ImportJob } from '../api/groups';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import WebcamCapture from '../components/WebcamCapture';
import GroupUploadPhoto from '../components/GroupUploadPhoto';
import GroupAttendanceTable from '../components/GroupAttendanceTable';
import { ChevronRight, FileText, CheckCircle, XCircle, Activity, Clock, AlertTriangle, UserPlus, FileSpreadsheet } from 'lucide-react';

interface GroupDetailsState {
  groupName?: string;
}

const GroupWorkspace: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const state = location.state as GroupDetailsState;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('register');
  const [groupName, setGroupName] = useState(state?.groupName || 'Loading Group...');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showImportReports, setShowImportReports] = useState(false);
  const [allImportJobs, setAllImportJobs] = useState<ImportJob[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [triggerBulkImport, setTriggerBulkImport] = useState(false);
  const [triggerAddStudent, setTriggerAddStudent] = useState(false);

  useEffect(() => {
    const numericGroupId = groupId ? parseInt(groupId) : NaN;
    if (isNaN(numericGroupId)) {
      navigate('/groups');
      return;
    }

    if (!state?.groupName) {
      const fetchGroupDetails = async () => {
        try {
          const response = await getGroup(numericGroupId);
          setGroupName(response.group?.name || 'Unknown Group');
        } catch (error) {
          console.error('Error fetching group details:', error);
          toast({
            title: 'Error',
            description: 'Could not fetch group details.',
            variant: 'destructive',
          });
          navigate('/groups');
        }
      };
      fetchGroupDetails();
    }
  }, [groupId, navigate, state, toast]);

  const handleSuccess = (description: string, targetTab?: string) => {
    toast({ title: 'Success', description });
    setRefreshTrigger(prev => prev + 1);
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  const fetchAllImportJobs = async () => {
    setIsLoadingReports(true);
    try {
      const jobs = await getAllImportJobs(numericGroupId); // Filter by current group
      setAllImportJobs(jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error("Error fetching all import jobs:", error);
      toast({
        title: "Error",
        description: "Failed to load import reports.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleViewReports = () => {
    setShowImportReports(true);
    fetchAllImportJobs();
  };

  const numericGroupId = parseInt(groupId || '0');

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <header>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link to="/groups" className="hover:text-primary">Groups</Link>
          <ChevronRight className="h-4 w-4 mx-1" />
          <span className="font-medium text-foreground">{groupName}</span>
        </div>
        <h1 className="text-3xl font-bold mt-2">{groupName} Workspace</h1>
        <p className="text-sm text-muted-foreground">Group ID: {groupId}</p>
      </header>

      <Tabs defaultValue="register" value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex w-full sm:w-auto">
            <TabsTrigger value="register" className="flex-1">Register Student</TabsTrigger>
            <TabsTrigger value="manage" className="flex-1">Manage Students</TabsTrigger>
            <TabsTrigger value="live" className="flex-1">Live Attendance</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Upload Photo</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">Attendance Logs</TabsTrigger>
          </TabsList>
        </div>

        <main className="mt-6">
          <TabsContent value="register">
            <StudentForm
              groupId={numericGroupId}
              onSuccess={() => handleSuccess('Student registered successfully.', 'manage')}
            />
          </TabsContent>

          <TabsContent value="manage">
            <div className="space-y-4">
              {/* Action buttons row */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Students in this Group</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleViewReports}
                    disabled={isLoadingReports}
                  >
                    <FileText className="h-4 w-4" />
                    {isLoadingReports ? 'Loading...' : 'Import Reports'}
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setTriggerBulkImport(true)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Bulk Import
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => setTriggerAddStudent(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Student
                  </Button>
                </div>
              </div>
              <StudentTable
                groupId={numericGroupId}
                onUpdate={() => handleSuccess('Student updated successfully.')}
                onDelete={() => handleSuccess('Student deleted successfully.')}
                refreshTrigger={refreshTrigger}
                hasExternalControls={true}
                triggerBulkImport={triggerBulkImport}
                onBulkImportComplete={() => setTriggerBulkImport(false)}
                triggerAddStudent={triggerAddStudent}
                onAddStudentComplete={() => setTriggerAddStudent(false)}
              />
            </div>
          </TabsContent>

          <TabsContent value="live">
            <WebcamCapture groupId={numericGroupId} />
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Group Photo for Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupUploadPhoto groupId={numericGroupId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <GroupAttendanceTable groupId={numericGroupId} />
          </TabsContent>
        </main>
      </Tabs>

      {/* Import Reports Dialog */}
      <Dialog open={showImportReports} onOpenChange={setShowImportReports}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Reports - {groupName}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {isLoadingReports ? (
              <div className="text-center py-12">Loading import reports...</div>
            ) : (
              <div className="space-y-4">
                {allImportJobs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No import jobs found for this group
                  </div>
                ) : (
                  allImportJobs.map((job) => (
                    <Card key={job.id} className="border">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                job.status === 'completed' ? 'default' :
                                  job.status === 'failed' ? 'destructive' :
                                    job.status === 'processing' ? 'secondary' : 'outline'
                              }
                            >
                              {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {job.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                              {job.status === 'processing' && <Activity className="h-3 w-3 mr-1" />}
                              {job.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {job.status}
                            </Badge>
                            <span className="font-medium">Import Job #{job.id}</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(job.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {job.successful_records} / {job.total_records} successful
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {job.failed_records} failed
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Tabs defaultValue="summary" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="successful">Successful ({job.successful_records})</TabsTrigger>
                            <TabsTrigger value="failed">Failed ({job.failed_records})</TabsTrigger>
                          </TabsList>

                          <TabsContent value="summary" className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold">{job.total_records}</div>
                                <div className="text-sm text-muted-foreground">Total Records</div>
                              </div>
                              <div className="text-center p-3 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{job.successful_records}</div>
                                <div className="text-sm text-muted-foreground">Successful</div>
                              </div>
                              <div className="text-center p-3 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">{job.failed_records}</div>
                                <div className="text-sm text-muted-foreground">Failed</div>
                              </div>
                              <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{job.progress_percentage}%</div>
                                <div className="text-sm text-muted-foreground">Completed</div>
                              </div>
                            </div>
                            {job.error_message && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  Error Message
                                </div>
                                <div className="text-sm text-red-600">{job.error_message}</div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="successful">
                            {job.successes && job.successes.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {job.successes.map((success: any, index: number) => (
                                    <TableRow key={index}>
                                      <TableCell className="font-medium">{success.student_id}</TableCell>
                                      <TableCell>{success.name}</TableCell>
                                      <TableCell>
                                        <Badge variant="default" className="bg-green-100 text-green-800">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Imported
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                No successful imports
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="failed">
                            {job.failures && job.failures.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Row #</TableHead>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Error Message</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {job.failures.map((failure: any, index: number) => (
                                    <TableRow key={index}>
                                      <TableCell>{failure.row}</TableCell>
                                      <TableCell className="font-medium">{failure.student_id}</TableCell>
                                      <TableCell>{failure.name}</TableCell>
                                      <TableCell>
                                        <div className="max-w-md">
                                          <span className="text-sm text-red-600">{failure.message}</span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                No failed imports
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportReports(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupWorkspace;