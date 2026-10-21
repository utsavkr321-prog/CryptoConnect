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
    icon: 'text-emerald-400 bg-emerald-400/10',
    border: 'border-emerald-500/20',
    value: 'text-emerald-400',
  },
  blue: {
    icon: 'text-blue-400 bg-blue-400/10',
    border: 'border-blue-500/20',
    value: 'text-blue-400',
  },
  amber: {
    icon: 'text-amber-400 bg-amber-400/10',
    border: 'border-amber-500/20',
    value: 'text-amber-400',
  },
  red: {
    icon: 'text-red-400 bg-red-400/10',
    border: 'border-red-500/20',
    value: 'text-red-400',
  },
};

export function StatCard({ label, value, icon: Icon, trend, trendUp, accent = 'emerald', subtitle }: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className={`card p-5 hover:border-opacity-60 transition-all duration-200 border ${styles.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${styles.icon}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trendUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
          }`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold mb-1 ${styles.value}`}>{value}</div>
      <div className="text-sm text-slate-400 font-medium">{label}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}
