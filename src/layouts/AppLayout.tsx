import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview & security status' },
  '/chat': { title: 'Secure Chat', subtitle: 'Conversations and message history' },
  '/visualizer': { title: 'Encryption Visualizer', subtitle: 'Interactive AES-GCM demonstration' },
  '/security-lab': { title: 'Security Lab', subtitle: 'Run cryptographic tests locally' },
  '/contacts': { title: 'Contacts', subtitle: 'Manage contacts & key verification' },
  '/events': { title: 'Security Events', subtitle: 'Activity log & audit trail' },
  '/settings': { title: 'Settings', subtitle: 'Application preferences' },
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationDialogRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const page = pageTitles[location.pathname] ?? { title: 'CryptoConnect', subtitle: '' };
  const closeSidebar = () => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const controls = navigationDialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [];
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    navigationDialogRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  return (
    <div className="app-shell flex overflow-hidden bg-[#0a0f1e]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <AppSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div ref={navigationDialogRef} className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Main navigation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          <div className="relative z-50 h-full min-h-0 flex-shrink-0">
            <AppSidebar onClose={closeSidebar} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-slate-800/60 bg-[#080d1a]/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              className="lg:hidden min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors rounded-lg"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm md:text-base">{page.title}</h2>
              {page.subtitle && (
                <p className="text-xs text-slate-500 hidden sm:block">{page.subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Encryption status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">{import.meta.env.VITE_APP_MODE === 'api' ? 'API Session' : 'Demo Session'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
