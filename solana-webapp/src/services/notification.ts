import toast from 'react-hot-toast';

export const notify = {
  success: (message: string) => {
    toast.success(message, {
      style: {
        background: '#22C55E',
        color: '#fff',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#22C55E',
      },
    });
  },

  error: (message: string) => {
    toast.error(message, {
      style: {
        background: '#EF4444',
        color: '#fff',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#EF4444',
      },
    });
  },

  warning: (message: string) => {
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
      },
    });
  },

  info: (message: string) => {
    toast(message, {
      style: {
        background: '#3B82F6',
        color: '#fff',
      },
    });
  },
}; 