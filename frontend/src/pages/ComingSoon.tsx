import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';

interface ComingSoonProps {
    title: string;
    description: string;
    icon: LucideIcon;
    /** Bullet list of what the page will eventually offer. */
    features?: string[];
}

/**
 * Placeholder for pages that are planned but not yet backed by an API.
 * Deliberately shows NO fabricated data — just a clear "coming soon" state.
 */
export default function ComingSoon({ title, description, icon: Icon, features }: ComingSoonProps) {
    return (
        <div className="space-y-6">
            <PageHeader title={title} description={description} icon={Icon} />

            <Card className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
                    <Icon className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <Badge variant="accent" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            Coming soon
                        </Badge>
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                        This view is in development and will appear here once the backend endpoints are live.
                    </p>
                </div>

                {features && features.length > 0 && (
                    <ul className="mt-2 space-y-2 text-left text-sm text-muted-foreground">
                        {features.map((feature) => (
                            <li key={feature} className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                {feature}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
