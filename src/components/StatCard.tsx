import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  accent?: 'emerald' | 'blue' | 'amber' | 'red';
  subtitle?: string;
}

const accentStyles = {
  emerald: {
    icon: 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20',
    border: 'border-emerald-500/20',
    value: 'text-emerald-300',
    badge: 'text-emerald-300 bg-emerald-500/10',
  },
  blue: {
    icon: 'text-indigo-200 bg-indigo-500/10 border border-indigo-500/20',
    border: 'border-indigo-500/20',
    value: 'text-indigo-200',
    badge: 'text-indigo-200 bg-indigo-500/10',
  },
  amber: {
    icon: 'text-amber-200 bg-amber-500/10 border border-amber-500/20',
    border: 'border-amber-500/20',
    value: 'text-amber-200',
    badge: 'text-amber-200 bg-amber-500/10',
  },
  red: {
    icon: 'text-red-200 bg-red-500/10 border border-red-500/20',
    border: 'border-red-500/20',
    value: 'text-red-200',
    badge: 'text-red-200 bg-red-500/10',
  },
};

export function StatCard({ label, value, icon: Icon, trend, trendUp, accent = 'emerald', subtitle }: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className={`card p-5 transition-all duration-200 hover:border-indigo-500/30 border ${styles.border}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
            trendUp ? styles.badge : 'text-red-200 bg-red-500/10'
          }`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className={`mb-1 text-2xl font-semibold tracking-tight ${styles.value}`}>{value}</div>
      <div className="text-sm font-medium text-slate-300">{label}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}
