import { Activity } from 'lucide-react';
import ComingSoon from './ComingSoon';

export default function SystemHealth() {
    return (
        <ComingSoon
            title="System Health"
            description="Service status, resource usage, and background jobs"
            icon={Activity}
            features={[
                'API, database, and worker uptime status',
                'CPU, memory, and GPU utilization',
                'Background import and processing queue depth',
            ]}
        />
    );
}
