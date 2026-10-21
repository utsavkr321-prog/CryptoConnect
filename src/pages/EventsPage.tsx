import { useState, useEffect } from 'react';
import {
  Search, Filter, Shield, AlertTriangle, CheckCircle, XCircle,
  Info, Clock, RefreshCw, AlertOctagon,
} from 'lucide-react';
import { API_MODE, securityEventService } from '../services';
import { SecurityBadge } from '../components/SecurityBadge';
import { EmptyState } from '../components/EmptyState';
import type { SecurityEvent, EventSeverity, EventType } from '../types';
import { formatRelativeTime, formatDate } from '../utils/format';

const severityOptions: { value: EventSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'success', label: 'Success' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const eventTypeLabels: Record<EventType, string> = {
  encryption_success: 'Encryption Success', decryption_failure: 'Decryption Failure', tamper_detected: 'Tamper Detected',
  verification_change: 'Verification Change', login_success: 'Login Success', login_failure: 'Login Failure',
  account_created: 'Account Created', message_sent: 'Message Sent', key_generated: 'Key Generated', contact_added: 'Contact Added',
};

const eventIcons: Record<EventType, typeof Shield> = {
  encryption_success: CheckCircle,
  decryption_failure: XCircle,
  tamper_detected: AlertTriangle,
  verification_change: Shield,
  login_success: CheckCircle,
  login_failure: XCircle,
  key_generated: Shield,
  contact_added: Info,
  account_created: CheckCircle,
  message_sent: Info,
};

export function EventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEvents(await securityEventService.getEvents());
    } catch (error) {
      setEvents([]);
      setLoadError(error instanceof Error ? error.message : 'Security events could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const filtered = events.filter((ev) => {
    if (severityFilter !== 'all' && ev.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
    if (search && !ev.title.toLowerCase().includes(search.toLowerCase()) && !ev.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const typeOptions = [{ value: 'all' as const, label: 'All Types' }, ...Array.from(new Set(events.map((event) => event.type)))
    .map((value) => ({ value, label: eventTypeLabels[value] }))];

  const counts = {
    success: events.filter((e) => e.severity === 'success').length,
    warning: events.filter((e) => e.severity === 'warning').length,
    critical: events.filter((e) => e.severity === 'critical').length,
    info: events.filter((e) => e.severity === 'info').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Success', count: counts.success, color: 'emerald' },
          { label: 'Info', count: counts.info, color: 'blue' },
          { label: 'Warning', count: counts.warning, color: 'amber' },
          { label: 'Critical', count: counts.critical, color: 'red' },
        ].map(({ label, count, color }) => (
          <button
            type="button"
            key={label}
            className={`card p-4 text-center border-${color}-500/20 cursor-pointer hover:border-${color}-500/40 transition-all`}
            aria-pressed={severityFilter === label.toLowerCase()}
            onClick={() => setSeverityFilter(label.toLowerCase() as EventSeverity)}
          >
            <p className={`text-2xl font-bold text-${color}-400`}>{count}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <label htmlFor="event-search" className="sr-only">Search security events</label>
          <input
            id="event-search"
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
        <label htmlFor="event-severity" className="sr-only">Filter by severity</label>
        <select
          id="event-severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as EventSeverity | 'all')}
          className="input-field text-sm w-auto"
        >
          {severityOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label htmlFor="event-type" className="sr-only">Filter by event type</label>
        <select
          id="event-type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EventType | 'all')}
          className="input-field text-sm w-auto"
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={loadEvents}
          className="px-3 py-2 border border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        {(search || severityFilter !== 'all' || typeFilter !== 'all') && <button onClick={() => { setSearch(''); setSeverityFilter('all'); setTypeFilter('all'); }} className="px-3 py-2 border border-slate-700 rounded-xl text-xs text-slate-300 hover:border-slate-600">Clear filters</button>}
      </div>

      {/* Event Source Notice */}
      {!API_MODE && <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <Info size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Events marked <span className="text-emerald-400 font-medium">Real</span> were recorded from local operations during this demo session. Events marked <span className="text-blue-400 font-medium">Simulated</span> are pre-populated sample events or concept simulations.
        </p>
      </div>}

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading security events" />
        </div>
      ) : loadError ? (
        <EmptyState icon={AlertOctagon} title="Events unavailable" description={loadError} action={<button onClick={() => void loadEvents()} className="btn-secondary px-4 py-2 rounded-lg text-sm">Retry</button>} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          title="No events found"
          description="No security events match your current filters."
          action={
            <button onClick={() => { setSeverityFilter('all'); setTypeFilter('all'); setSearch(''); }}
              className="btn-secondary px-4 py-2 rounded-lg text-sm">
              Clear Filters
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => {
            const Icon = eventIcons[ev.type] ?? Shield;
            const isExpanded = expanded === ev.id;
            return (
              <button
                type="button"
                key={ev.id}
                className={`card w-full p-4 text-left cursor-pointer transition-all duration-150 hover:border-slate-700 ${
                  isExpanded ? 'border-slate-700' : ''
                }`}
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : ev.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                    ev.severity === 'success' ? 'bg-emerald-500/10' :
                    ev.severity === 'critical' ? 'bg-red-500/10' :
                    ev.severity === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                  }`}>
                    <Icon size={14} className={
                      ev.severity === 'success' ? 'text-emerald-400' :
                      ev.severity === 'critical' ? 'text-red-400' :
                      ev.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">{ev.title}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <SecurityBadge type="severity" severity={ev.severity} size="sm" />
                        {ev.isSimulated ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Simulated</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Real</span>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{ev.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={10} className="text-slate-600" />
                      <span className="text-xs text-slate-600">{formatRelativeTime(ev.timestamp)}</span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-600">{formatDate(ev.timestamp)}</span>
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && isExpanded && (
                        <span className="text-xs text-slate-600">
                          · {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
