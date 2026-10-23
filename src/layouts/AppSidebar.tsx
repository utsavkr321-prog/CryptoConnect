import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  MessageSquareLock,
  Cpu,
  Users,
  AlertOctagon,
  Settings,
  LogOut,
  ChevronRight,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../context/AppContext';
import { API_MODE } from '../services';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquareLock, label: 'Messaging' },
  { to: '/cryptography-lab', icon: Cpu, label: 'Cryptography Lab' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/events', icon: AlertOctagon, label: 'Security Events' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose?.();
  };

  return (
    <aside className="app-sidebar relative flex h-full min-h-0 w-[min(17rem,calc(100vw-2rem))] flex-col border-r">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(91,97,246,0.12),_transparent_38%)]" aria-hidden="true" />

      <div className="relative px-5 pb-5 pt-5">
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/10 bg-white/2 px-3 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 text-indigo-200 shadow-[0_0_24px_rgba(91,97,246,0.25)]">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-[0.08em] text-white">CryptoConnect</h1>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">secure workspace</p>
          </div>
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">Navigation</p>
        <ul className="space-y-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive ? 'sidebar-item-active' : 'sidebar-item'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? 'text-violet-200' : 'text-slate-500 group-hover:text-slate-300'} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={12} className="text-violet-200 opacity-80" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative mx-3 mb-3 rounded-2xl border border-indigo-500/12 bg-indigo-500/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Fingerprint size={12} className="text-indigo-200" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-200">{API_MODE ? 'API Mode' : 'Demo Mode'}</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          {API_MODE ? 'Authenticated backend access. Fingerprint verification is available; messaging is not end-to-end encrypted.' : 'Data is local mock data. No backend messages are sent.'}
        </p>
      </div>

      <div className="relative border-t border-white/8 px-3 pb-4 pt-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-sm font-bold text-white">
            {user?.name.charAt(0) ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{user?.name ?? 'Demo User'}</p>
            <p className="truncate text-[11px] text-slate-500">{user?.email ?? 'demo@cryptoconnect'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
            aria-label="Logout"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
