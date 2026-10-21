import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  isBusy?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  isBusy = false,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    cancelButtonRef.current?.focus();

    return () => {
      const opener = openerRef.current;
      const stillFocusable = opener
        && opener.isConnected
        && opener.tabIndex >= 0
        && !opener.matches(':disabled')
        && getComputedStyle(opener).visibility !== 'hidden'
        && getComputedStyle(opener).display !== 'none'
        && opener.getClientRects().length > 0;

      if (stillFocusable) opener.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!isBusy) onCancel();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) => element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== 'hidden');

    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && (current === first || !dialog.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  const handleCancel = () => {
    if (!isBusy) onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={handleCancel}
      />
      <div
        ref={dialogRef}
        className="relative card p-5 sm:p-6 w-full max-w-sm max-h-[85dvh] overflow-y-auto shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isBusy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          onClick={handleCancel}
          disabled={isBusy}
          className="absolute top-2 right-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          aria-label="Close confirmation dialog"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
            <AlertTriangle size={18} className={danger ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <h3 id={titleId} className="font-semibold text-slate-100">{title}</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleCancel}
            disabled={isBusy}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'btn-primary rounded-lg'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
