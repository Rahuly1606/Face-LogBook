import { Gauge } from 'lucide-react';
import ComingSoon from './ComingSoon';

export default function RecognitionMetrics() {
    return (
        <ComingSoon
            title="Recognition Metrics"
            description="Accuracy, confidence, and throughput analytics"
            icon={Gauge}
            features={[
                'Confidence-score distribution over time',
                'Match rate and false-rejection trends',
                'Per-model and per-pose performance breakdown',
            ]}
        />
    );
}
