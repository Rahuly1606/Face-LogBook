import React, { useEffect, useState } from 'react';
import { CheckCircle, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface GreetingToastProps {
  name: string;
  action: 'checkin' | 'checkout';
  onClose: () => void;
}

const DURATION_MS = 3000;

const GreetingToast: React.FC<GreetingToastProps> = ({ name, action, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Allow time for exit animation before calling onClose
      setTimeout(onClose, 300);
    }, DURATION_MS);

    return () => clearTimeout(timer);
  }, [onClose]);

  const isCheckIn = action === 'checkin';
  const config = {
    checkin: {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-200',
      message: `Welcome, ${name}!`,
      description: 'You have been checked in.',
    },
    checkout: {
      icon: LogOut,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-200',
      message: `Goodbye, ${name}.`,
      description: 'You have been checked out.',
    },
  };

  const currentConfig = config[action];
  const Icon = currentConfig.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 50, scale: 0.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
          className={`relative w-full max-w-sm rounded-xl border ${currentConfig.borderColor} bg-background shadow-2xl overflow-hidden`}
        >
          <div className="p-4 flex items-start gap-4">
            <div className={`p-2 rounded-full ${currentConfig.bgColor}`}>
              <Icon className={`h-6 w-6 ${currentConfig.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{currentConfig.message}</h3>
              <p className="text-sm text-muted-foreground">{currentConfig.description}</p>
            </div>
          </div>
          <motion.div
            className={`absolute bottom-0 left-0 h-1 ${isCheckIn ? 'bg-green-500' : 'bg-amber-500'}`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GreetingToast;