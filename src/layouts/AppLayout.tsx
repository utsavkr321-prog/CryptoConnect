import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview & security status' },
  '/chat': { title: 'Messaging', subtitle: 'Conversations and message history' },
  '/cryptography-lab': { title: 'Cryptography Lab', subtitle: 'Local encryption, decryption, and key tools' },
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
    <div className="app-shell cyber-shell flex overflow-hidden">
      <div className="hidden flex-shrink-0 lg:flex">
        <AppSidebar />
      </div>

      {sidebarOpen && (
        <div ref={navigationDialogRef} className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Main navigation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} />
          <div className="relative z-50 h-full min-h-0 flex-shrink-0">
            <AppSidebar onClose={closeSidebar} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-white/8 bg-[#0a1018]/85 px-4 py-3.5 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/6 bg-white/3 text-slate-300 transition hover:border-indigo-500/20 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div>
              <h2 className="text-sm font-semibold tracking-[0.08em] text-white md:text-base">{page.title}</h2>
              {page.subtitle && <p className="hidden text-xs text-slate-400 sm:block">{page.subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 sm:flex">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(39,214,206,0.7)]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                {import.meta.env.VITE_APP_MODE === 'api' ? 'API Session' : 'Demo Session'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-[radial-gradient(circle_at_top,_rgba(91,97,246,0.07),_transparent_30%)]">
          {children}
        </main>
      </div>
    </div>
  );
}
