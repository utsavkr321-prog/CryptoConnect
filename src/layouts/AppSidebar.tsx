import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  MessageSquareLock,
  FlaskConical,
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
  { to: '/chat', icon: MessageSquareLock, label: 'Secure Chat' },
  { to: '/visualizer', icon: Cpu, label: 'Encryption Visualizer' },
  { to: '/security-lab', icon: FlaskConical, label: 'Security Lab' },
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
    <aside className="flex flex-col h-full min-h-0 w-[min(16rem,calc(100vw-2rem))] bg-[#080d1a] border-r border-slate-800/60">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base leading-tight">CryptoConnect</h1>
            <p className="text-xs text-slate-500">Secure Comms Demo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                  ${isActive ? 'sidebar-item-active' : 'sidebar-item'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={12} className="opacity-60" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Demo Notice */}
      <div className="px-3 py-3 mx-3 mb-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <div className="flex items-center gap-2 mb-1">
          <Fingerprint size={12} className="text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">{API_MODE ? 'API Mode' : 'Demo Mode'}</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {API_MODE ? 'Authenticated backend access. E2EE and contact verification are not implemented.' : 'Data is local mock data. No backend messages are sent.'}
        </p>
      </div>

      {/* User profile */}
      <div className="px-3 pb-4 border-t border-slate-800/60 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name.charAt(0) ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name ?? 'Demo User'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email ?? 'demo@cryptoconnect'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="min-h-11 min-w-11 -mr-2.5 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 transition-colors"
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
