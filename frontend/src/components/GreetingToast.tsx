import React, { useEffect } from 'react';
import { CheckCircle, LogOut, UserCheck } from 'lucide-react';

interface GreetingToastProps {
  name: string;
  action: string;
  onClose: () => void;
}

const GreetingToast: React.FC<GreetingToastProps> = ({ name, action, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onClose]);

  const isCheckIn = action === 'checkin';
  const Icon = isCheckIn ? CheckCircle : LogOut;
  const bgColor = isCheckIn ? 'bg-success' : 'bg-primary';
  const message = isCheckIn ? `Welcome ${name}!` : `Goodbye ${name}!`;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 min-w-[250px]`}>
        <Icon className="h-6 w-6" />
        <div>
          <p className="font-semibold text-lg">{message}</p>
          <p className="text-sm opacity-90">
            {isCheckIn ? 'Attendance marked' : 'Have a great day!'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GreetingToast;