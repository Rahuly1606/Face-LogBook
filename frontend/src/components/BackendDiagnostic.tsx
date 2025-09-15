import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ServiceStatus {
  service: string;
  status: 'online' | 'offline' | 'degraded' | 'loading';
  message?: string;
  latency?: number;
}

const BackendDiagnostic: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<ServiceStatus>({
    service: 'Backend API',
    status: 'loading'
  });
  
  const [faceServiceStatus, setFaceServiceStatus] = useState<ServiceStatus>({
    service: 'Face Recognition Service',
    status: 'loading'
  });
  
  const [databaseStatus, setDatabaseStatus] = useState<ServiceStatus>({
    service: 'Database',
    status: 'loading'
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkBackendHealth = async () => {
    setBackendStatus({
      service: 'Backend API',
      status: 'loading'
    });
    
    setFaceServiceStatus({
      service: 'Face Recognition Service',
      status: 'loading'
    });
    
    setDatabaseStatus({
      service: 'Database',
      status: 'loading'
    });
    
    try {
      const startTime = performance.now();
      const response = await fetch(`${import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1'}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-ADMIN-TOKEN': localStorage.getItem('admin_token') || ''
        },
        credentials: 'include'
      });
      
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      if (response.ok) {
        const data = await response.json();
        
        // Update backend status
        setBackendStatus({
          service: 'Backend API',
          status: 'online',
          message: data.message || 'Service is running',
          latency
        });
        
        // Update face service status
        if (data.services?.face_service) {
          setFaceServiceStatus({
            service: 'Face Recognition Service',
            status: data.services.face_service.status === 'ok' ? 'online' : 'degraded',
            message: data.services.face_service.message || '',
            latency: data.services.face_service.latency || null
          });
        } else {
          setFaceServiceStatus({
            service: 'Face Recognition Service',
            status: 'offline',
            message: 'Status information unavailable'
          });
        }
        
        // Update database status
        if (data.services?.database) {
          setDatabaseStatus({
            service: 'Database',
            status: data.services.database.status === 'ok' ? 'online' : 'degraded',
            message: data.services.database.message || '',
            latency: data.services.database.latency || null
          });
        } else {
          setDatabaseStatus({
            service: 'Database',
            status: 'offline',
            message: 'Status information unavailable'
          });
        }
      } else {
        const errorData = await response.json().catch(() => null);
        setBackendStatus({
          service: 'Backend API',
          status: 'degraded',
          message: errorData?.message || `Error ${response.status}: ${response.statusText}`,
          latency
        });
        
        setFaceServiceStatus({
          service: 'Face Recognition Service',
          status: 'offline',
          message: 'Cannot connect to backend'
        });
        
        setDatabaseStatus({
          service: 'Database',
          status: 'offline',
          message: 'Cannot connect to backend'
        });
      }
    } catch (error) {
      setBackendStatus({
        service: 'Backend API',
        status: 'offline',
        message: error instanceof Error ? error.message : 'Unknown connection error'
      });
      
      setFaceServiceStatus({
        service: 'Face Recognition Service',
        status: 'offline',
        message: 'Cannot connect to backend'
      });
      
      setDatabaseStatus({
        service: 'Database',
        status: 'offline',
        message: 'Cannot connect to backend'
      });
    }
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    await checkBackendHealth();
    setIsRefreshing(false);
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Backend Status</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshStatus}
          disabled={isRefreshing}
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[backendStatus, faceServiceStatus, databaseStatus].map((status) => (
            <ServiceStatusDisplay key={status.service} status={status} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ServiceStatusDisplay: React.FC<{ status: ServiceStatus }> = ({ status }) => {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'loading':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };
  
  const getStatusText = () => {
    switch (status.status) {
      case 'online':
        return 'Online';
      case 'degraded':
        return 'Degraded';
      case 'offline':
        return 'Offline';
      case 'loading':
        return 'Checking...';
    }
  };
  
  const getStatusColor = () => {
    switch (status.status) {
      case 'online':
        return 'text-green-600';
      case 'degraded':
        return 'text-amber-600';
      case 'offline':
        return 'text-red-600';
      case 'loading':
        return 'text-blue-600';
    }
  };
  
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="pt-0.5">
        {getStatusIcon()}
      </div>
      <div className="flex-1">
        <div className="flex justify-between">
          <h3 className="font-medium">{status.service}</h3>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {status.message && (
          <p className="text-sm text-gray-500 mt-1">
            {status.message}
          </p>
        )}
        
        {status.latency !== undefined && (
          <p className="text-xs text-gray-400 mt-1">
            Response time: {status.latency} ms
          </p>
        )}
      </div>
    </div>
  );
};

export default BackendDiagnostic;