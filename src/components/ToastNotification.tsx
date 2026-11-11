import React from 'react';

interface ToastNotificationProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ isVisible, onDismiss }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-5 right-5 z-[200] max-w-md w-full transition-all transform duration-300">
      <div className="glass-card p-4 border-l-4 border-l-emerald-400 glow-emerald flex items-start gap-3 bg-navy-900/95 text-white shadow-2xl">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl shrink-0 mt-0.5">
          <i className="fa-solid fa-paper-plane"></i>
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              Document Dispatched!
            </strong>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
              Web3Forms 200 OK
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-snug">
            Strategy documentation has been successfully submitted and routed via Web3Forms API to{' '}
            <span className="text-emerald-300 font-bold underline">atlasbridge.contact@gmail.com</span>.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white text-sm p-1 cursor-pointer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
};
