import { Cctv } from 'lucide-react';
import ComingSoon from './ComingSoon';

export default function CameraEvents() {
    return (
        <ComingSoon
            title="Camera Events"
            description="Live feed of detection events from connected cameras"
            icon={Cctv}
            features={[
                'Chronological stream of face-detection events',
                'Per-camera filtering and status',
                'Snapshot thumbnails linked to recognition results',
            ]}
        />
    );
}
