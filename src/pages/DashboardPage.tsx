import { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare, Send, ShieldCheck, Users, Lock,
  Activity, Clock, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { SecurityBadge } from '../components/SecurityBadge';
import { API_MODE, conversationService, dashboardService, securityEventService } from '../services';
import type { DashboardStats, ChartDataPoint, SecurityEvent, Conversation } from '../types';
import { MOCK_CONVERSATIONS } from '../data/mockData';
import { formatRelativeTime } from '../utils/format';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const results = await Promise.allSettled([
      dashboardService.getStats(),
      dashboardService.getChartData(),
      securityEventService.getEvents(),
      conversationService.getConversations(),
    ]);
    const [statsResult, chartResult, eventsResult, conversationResult] = results;
    setStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
    setChartData(chartResult.status === 'fulfilled' ? chartResult.value : []);
    setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.slice(0, 5) : []);
    setConversations(conversationResult.status === 'fulfilled' ? conversationResult.value.slice(0, 3) : []);
    if (results.some((result) => result.status === 'rejected')) setLoadError('Some dashboard data could not be loaded. Retry to try again.');
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 text-sm" role="status" aria-live="polite">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const recentConversations = API_MODE ? conversations : MOCK_CONVERSATIONS.slice(0, 3);

  return (
    <div className="page-shell mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="cyber-panel relative overflow-hidden rounded-[1.5rem] border border-indigo-500/10 p-5 md:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(91,97,246,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(39,214,206,0.12),_transparent_28%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-indigo-200">Operations overview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Threat surface is stable</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(39,214,206,0.8)]" />
            Secure session active
          </div>
        </div>
      </div>

      {!API_MODE && <div className="notice-panel notice-panel-violet flex items-center gap-3 rounded-2xl p-3" role="note">
        <ShieldCheck size={16} className="text-indigo-200 flex-shrink-0" />
        <p className="text-xs text-slate-300">
          <span className="font-medium text-indigo-200">Demo Mode:</span> Dashboard metrics, chart, security events, and recent conversations are illustrative sample data.
        </p>
      </div>}
      {loadError && <div className="notice-panel notice-panel-warning flex items-center justify-between gap-3 rounded-2xl p-3" role="alert" aria-live="polite">
        <p className="text-sm text-amber-200">{loadError}</p>
        <button onClick={() => void loadDashboard()} className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-sm text-amber-200 transition hover:bg-amber-500/10">Retry</button>
      </div>}

      {/* Stats Grid */}
      {!API_MODE && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Conversations"
          value={stats?.totalConversations ?? 0}
          icon={MessageSquare}
          accent="emerald"
          trend="12%"
          trendUp
          subtitle="Demo contacts"
        />
        <StatCard
          label="Messages Sent"
          value={stats?.messagesSent ?? 0}
          icon={Send}
          accent="blue"
          trend="8%"
          trendUp
          subtitle="This session"
        />
        <StatCard
          label="Encrypted"
          value={`${stats?.encryptedPercentage ?? 0}%`}
          icon={Lock}
          accent="emerald"
          subtitle="AES-GCM demo"
        />
        <StatCard
          label="Contact Fingerprint Demo"
          value={`${stats?.verifiedContacts ?? 0} / 5`}
          icon={Users}
          accent="amber"
          subtitle="Mock fingerprint data; not identity verified"
        />
      </div>}
      {API_MODE && stats && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conversations" value={stats.totalConversations} icon={MessageSquare} accent="emerald" subtitle="Your persisted conversations" />
        <StatCard label="Messages Sent" value={stats.messagesSent} icon={Send} accent="blue" subtitle="Messages you sent" />
        <StatCard label="Unread Messages" value={stats.unreadMessages ?? 'Unavailable'} icon={MessageSquare} accent="blue" subtitle="Messages awaiting your read receipt" />
        <StatCard label="Messages Stored" value={stats.messagesStored ?? 'Unavailable'} icon={MessageSquare} accent="emerald" subtitle="Includes legacy encrypted messages that cannot be recovered" />
      </div>}
      {API_MODE && !stats && <div className="card p-5 text-sm text-slate-400" role="status">Dashboard statistics are currently unavailable.</div>}

      {/* Chart + Security Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Encryption Activity Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">{API_MODE ? 'Message Activity' : 'Encryption Activity'}</h3>
              <p className="text-xs text-slate-500">{API_MODE ? 'Persisted server-readable conversation activity over 7 days.' : 'Messages sent vs. encrypted activity over 7 days (demo).'}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{API_MODE ? 'Messages sent' : 'Encrypted (demo)'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />{API_MODE ? 'All messages' : 'Total (demo)'}</span>
            </div>
          </div>
          {chartData.length > 0 ? <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="encGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#475569" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                itemStyle={{ color: '#e2e8f0', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total" name={API_MODE ? 'All messages' : 'Total (demo)'} stroke="#475569" fill="url(#totalGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey={API_MODE ? 'sent' : 'encrypted'} name={API_MODE ? 'Messages sent' : 'Encrypted (demo)'} stroke="#10b981" fill="url(#encGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer> : <p className="py-12 text-center text-sm text-slate-500">Activity data is unavailable.</p>}
        </div>

        {/* Security Status */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 text-sm mb-4">Security Status</h3>
          {API_MODE ? <p className="text-xs text-slate-400 leading-relaxed">API chat stores server-readable message text and protects access with JWT authentication and conversation membership checks. This is not end-to-end encryption; production deployments must use HTTPS/WSS and encrypted database storage.</p> : <div className="space-y-3">
            {[
              { label: 'Encryption Algorithm', value: 'AES-256-GCM', ok: true },
              { label: 'Key Exchange', value: 'Simulated (Demo)', ok: false },
              { label: 'Forward Secrecy', value: 'Concept Demo', ok: false },
              { label: 'Auth Tag Checks', value: 'Active (Local)', ok: true },
              { label: 'IV Uniqueness', value: 'Enforced', ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className={`text-xs font-medium ${item.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>}
        </div>
      </div>

      {/* Recent Conversations + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Conversations */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 text-sm">Recent Conversations</h3>
            <button
              onClick={() => navigate('/chat')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {API_MODE && recentConversations.length === 0 && <p className="text-sm text-slate-500">No conversations available from the backend.</p>}
            {recentConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate('/chat')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                    {conv.contact.name.charAt(0)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111827] ${
                    conv.contact.status === 'online' ? 'bg-emerald-400' : conv.contact.status === 'away' ? 'bg-amber-400' : 'bg-slate-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200 truncate">{conv.contact.name}</p>
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 ml-2 min-w-[18px] h-4.5 px-1.5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conv.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 text-sm">Security Events</h3>
            <button
              onClick={() => navigate('/events')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {API_MODE && events.length === 0 && <p className="text-sm text-slate-500">No security events recorded yet.</p>}
            {events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/30 transition-colors">
                <div className="mt-0.5">
                  <SecurityBadge type="severity" severity={ev.severity} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{ev.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-slate-600" />
                    <span className="text-xs text-slate-600">{formatRelativeTime(ev.timestamp)}</span>
                    {ev.isSimulated && (
                      <span className="text-xs text-blue-400/60">• simulated</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Start Chat', icon: MessageSquare, to: '/chat', color: 'emerald' },
          { label: 'Encrypt Message', icon: Lock, to: '/visualizer', color: 'blue' },
          { label: 'Run Security Tests', icon: Activity, to: '/security-lab', color: 'amber' },
          { label: 'Verify Contact', icon: Users, to: '/contacts', color: 'emerald' },
        ].map(({ label, icon: Icon, to, color }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`quick-action quick-action-${color} flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150`}
          >
            <Icon size={20} />
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
