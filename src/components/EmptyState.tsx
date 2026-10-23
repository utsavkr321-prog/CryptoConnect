import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = AlertCircle, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state flex flex-col items-center justify-center rounded-2xl border border-white/5 px-8 py-16 text-center shadow-[0_18px_45px_rgba(3,7,18,0.28)]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-200">
        <Icon size={28} />
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-100">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
