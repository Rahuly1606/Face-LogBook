import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Users, FileText, CheckCircle, XCircle, Activity, Clock, AlertTriangle } from 'lucide-react';
import StudentTable from '@/components/StudentTable';
import { getStudents, deleteStudent, Student } from '@/api/students';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllImportJobs, ImportJob } from '@/api/groups';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ManageStudents: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showImportReports, setShowImportReports] = useState(false);
  const [allImportJobs, setAllImportJobs] = useState<ImportJob[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const data = await getStudents();
        setStudents(data?.students || []);
      } catch (error) {
        console.error("Error fetching students:", error);
        toast({
          title: "Error",
          description: "Failed to fetch students. The server might be down.",
          variant: "destructive",
        });
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [refreshTrigger, toast]);

  const fetchAllImportJobs = async () => {
    setIsLoadingReports(true);
    try {
      const jobs = await getAllImportJobs();
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

  const handleDelete = async (student: Student) => {
    // A simple confirmation dialog
    if (window.confirm(`Are you sure you want to delete ${student.name}? This action cannot be undone.`)) {
      try {
        await deleteStudent(student.student_id);
        toast({
          title: "Success",
          description: "Student deleted successfully.",
        });
        setRefreshTrigger(prev => prev + 1); // Refresh the table
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete the student.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Manage Students
          </h1>
          <p className="text-muted-foreground mt-2">
            View, edit, or delete student records from the system.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={handleViewReports}
            disabled={isLoadingReports}
          >
            <FileText className="h-5 w-5" />
            {isLoadingReports ? 'Loading...' : 'Import Reports'}
          </Button>
          <Button size="lg" className="gap-2 w-full md:w-auto" onClick={() => navigate('/admin/register')}>
            <Plus className="h-5 w-5" />
            Register New Student
          </Button>
        </div>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>All Students</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading
              ? <div className="text-center py-12">Loading students...</div>
              : <StudentTable
                students={students}
                refreshTrigger={refreshTrigger}
                onUpdate={() => setRefreshTrigger(prev => prev + 1)}
              />
            }
          </CardContent>
        </Card>
      </main>

      {/* Import Reports Dialog */}
      <Dialog open={showImportReports} onOpenChange={setShowImportReports}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Reports
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {isLoadingReports ? (
              <div className="text-center py-12">Loading import reports...</div>
            ) : (
              <div className="space-y-4">
                {allImportJobs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No import jobs found
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

export default ManageStudents;