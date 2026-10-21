import { Shield, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { EventSeverity, TestStatus } from '../types';

interface SecurityBadgeProps {
  type: 'verified' | 'unverified' | 'severity' | 'test-status' | 'demo';
  severity?: EventSeverity;
  testStatus?: TestStatus;
  label?: string;
  size?: 'sm' | 'md';
}

export function SecurityBadge({ type, severity, testStatus, label, size = 'md' }: SecurityBadgeProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs';
  const iconSize = size === 'sm' ? 10 : 12;
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  if (type === 'verified') {
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded-full text-xs font-medium badge-verified`}>
        <CheckCircle size={iconSize} />
        <span>Verified</span>
      </span>
    );
  }

  if (type === 'unverified') {
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded-full text-xs font-medium badge-unverified`}>
        <AlertTriangle size={iconSize} />
        <span>Unverified</span>
      </span>
    );
  }

  if (type === 'demo') {
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded-full ${textSize} font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400`}>
        <Shield size={iconSize} />
        <span>{label ?? 'Demo'}</span>
      </span>
    );
  }

  if (type === 'severity' && severity) {
    const config = {
      success: { cls: 'badge-verified', Icon: CheckCircle, label: 'Success' },
      info: { cls: 'bg-blue-500/10 border border-blue-500/30 text-blue-400', Icon: Shield, label: 'Info' },
      warning: { cls: 'badge-unverified', Icon: AlertTriangle, label: 'Warning' },
      critical: { cls: 'badge-danger', Icon: XCircle, label: 'Critical' },
    }[severity];
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded-full ${textSize} font-medium ${config.cls}`}>
        <config.Icon size={iconSize} />
        <span>{config.label}</span>
      </span>
    );
  }

  if (type === 'test-status' && testStatus) {
    const config = {
      not_run: { cls: 'bg-slate-700/50 border border-slate-600/50 text-slate-400', Icon: Clock, label: 'Not Run' },
      running: { cls: 'bg-blue-500/10 border border-blue-500/30 text-blue-400', Icon: Shield, label: 'Running' },
      passed: { cls: 'badge-verified', Icon: CheckCircle, label: 'Passed' },
      failed: { cls: 'badge-danger', Icon: XCircle, label: 'Failed' },
    }[testStatus];
    return (
      <span className={`inline-flex items-center gap-1 ${padding} rounded-full ${textSize} font-medium ${config.cls}`}>
        <config.Icon size={iconSize} className={testStatus === 'running' ? 'animate-spin' : ''} />
        <span>{config.label}</span>
      </span>
    );
  }

  return null;
}
