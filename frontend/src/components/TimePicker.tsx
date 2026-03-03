import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimePickerProps {
    id: string;
    label: string;
    value: string; // Format: "HH:MM"
    onChange: (value: string) => void;
    description?: string;
    className?: string;
}

export function TimePicker({ id, label, value, onChange, description, className = '' }: TimePickerProps) {
    // Parse the time value
    const [hours, minutes] = value.split(':').map(Number);

    // Generate hours (00-23)
    const hourOptions = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        const period = i < 12 ? 'AM' : 'PM';
        const displayHour = i === 0 ? 12 : i > 12 ? i - 12 : i;
        return {
            value: hour,
            label: `${displayHour.toString().padStart(2, '0')} ${period}`
        };
    });

    // Generate minutes (00, 05, 10, ..., 55)
    const minuteOptions = Array.from({ length: 12 }, (_, i) => {
        const minute = (i * 5).toString().padStart(2, '0');
        return { value: minute, label: minute };
    });

    const handleHourChange = (newHour: string) => {
        const currentMinutes = minutes.toString().padStart(2, '0');
        onChange(`${newHour}:${currentMinutes}`);
    };

    const handleMinuteChange = (newMinute: string) => {
        const currentHours = hours.toString().padStart(2, '0');
        onChange(`${currentHours}:${newMinute}`);
    };

    return (
        <div className={className}>
            <Label htmlFor={id} className="text-foreground font-medium">
                {label}
            </Label>
            <div className="flex gap-2 mt-1">
                <Select value={hours.toString().padStart(2, '0')} onValueChange={handleHourChange}>
                    <SelectTrigger className="flex-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {hourOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="flex items-center text-2xl font-bold text-muted-foreground">:</span>
                <Select value={minutes.toString().padStart(2, '0')} onValueChange={handleMinuteChange}>
                    <SelectTrigger className="flex-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {minuteOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
        </div>
    );
}
