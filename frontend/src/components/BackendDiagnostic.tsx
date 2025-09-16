import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Server, Cpu, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  service: string;
  status: 'online' | 'offline' | 'degraded' | 'loading';
  message?: string;
  latency?: number;
}

const initialStatus: ServiceStatus = { service: '', status: 'loading' };

const BackendDiagnostic: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({
    backend: { ...initialStatus, service: 'Backend API' },
    faceService: { ...initialStatus, service: 'Face Recognition' },
    database: { ...initialStatus, service: 'Database' },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkBackendHealth = useCallback(async () => {
    setStatuses({
      backend: { service: 'Backend API', status: 'loading' },
      faceService: { service: 'Face Recognition', status: 'loading' },
      database: { service: 'Database', status: 'loading' },
    });

    try {
      const startTime = performance.now();
      const response = await fetch(`${import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1'}/health`, {
        signal: AbortSignal.timeout(10000), // 10-second timeout
        headers: {
          'Content-Type': 'application/json',
          'X-ADMIN-TOKEN': localStorage.getItem('admin_token') || ''
        },
      });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const data = await response.json();

      if (response.ok) {
        setStatuses({
          backend: { service: 'Backend API', status: 'online', message: data.message, latency },
          faceService: {
            service: 'Face Recognition',
            status: data.services?.face_service?.status === 'ok' ? 'online' : 'degraded',
            message: data.services?.face_service?.message,
            latency: data.services?.face_service?.latency,
          },
          database: {
            service: 'Database',
            status: data.services?.database?.status === 'ok' ? 'online' : 'degraded',
            message: data.services?.database?.message,
            latency: data.services?.database?.latency,
          },
        });
      } else {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      const isTimeout = error.name === 'TimeoutError';
      const errorMessage = isTimeout ? 'Request timed out.' : (error.message || 'Unknown connection error.');
      
      setStatuses({
        backend: { service: 'Backend API', status: 'offline', message: errorMessage },
        faceService: { service: 'Face Recognition', status: 'offline', message: 'Cannot connect via backend' },
        database: { service: 'Database', status: 'offline', message: 'Cannot connect via backend' },
      });
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    await checkBackendHealth();
    // A small delay to make the refresh feel more substantial
    setTimeout(() => setIsRefreshing(false), 500);
  }, [checkBackendHealth]);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>System Status</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshStatus}
          disabled={isRefreshing}
          className="gap-1.5 transition-transform active:scale-95"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ServiceStatusDisplay serviceKey="backend" status={statuses.backend} />
          <ServiceStatusDisplay serviceKey="faceService" status={statuses.faceService} />
          <ServiceStatusDisplay serviceKey="database" status={statuses.database} />
        </div>
      </CardContent>
    </Card>
  );
};

interface ServiceStatusDisplayProps {
  status: ServiceStatus;
  serviceKey: 'backend' | 'faceService' | 'database';
}

const ServiceStatusDisplay: React.FC<ServiceStatusDisplayProps> = ({ status, serviceKey }) => {
  const statusConfig = {
    online: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10', text: 'Online' },
    degraded: { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500/10', text: 'Degraded' },
    offline: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', text: 'Offline' },
    loading: { icon: RefreshCw, color: 'text-blue-500', bgColor: 'bg-blue-500/10', text: 'Checking...' },
  };

  const serviceIcons = {
    backend: <Server className="h-6 w-6 text-muted-foreground" />,
    faceService: <Cpu className="h-6 w-6 text-muted-foreground" />,
    database: <Database className="h-6 w-6 text-muted-foreground" />,
  };
  
  const currentStatus = statusConfig[status.status];
  const IconComponent = currentStatus.icon;
  
  return (
    <div className={cn("p-4 rounded-lg border flex flex-col justify-between", currentStatus.bgColor)}>
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">{status.service}</h3>
          {serviceIcons[serviceKey]}
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <IconComponent className={cn("h-5 w-5", currentStatus.color, status.status === 'loading' && 'animate-spin')} />
          <span className={cn("font-bold", currentStatus.color)}>
            {currentStatus.text}
          </span>
        </div>
        
        <p className="text-sm text-muted-foreground min-h-[40px]">
          {status.message || 'Awaiting status from server...'}
        </p>
      </div>

      {status.latency !== undefined && status.latency !== null && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
          Response time: <span className="font-semibold">{status.latency} ms</span>
        </p>
      )}
    </div>
  );
};

export default BackendDiagnostic;