import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/AppContext';
import type { Toast } from '../context/AppContext';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'border-emerald-500/40 text-emerald-300',
  error: 'border-red-500/40 text-red-300',
  warning: 'border-amber-500/40 text-amber-300',
  info: 'border-blue-500/40 text-blue-300',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const Icon = icons[toast.type];

  return (
    <div
      className={`toast-surface flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl w-full max-w-[380px]
        ${colors[toast.type]} animate-in slide-in-from-right-full duration-300`}
      data-toast-type={toast.type}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <p className="text-sm flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="-m-1 min-h-11 min-w-11 flex items-center justify-center opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0 rounded"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(380px,calc(100vw-3rem))]" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
