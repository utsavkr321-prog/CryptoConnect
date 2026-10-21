import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { API_MODE, authService } from '../services';

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  isAuthenticated: boolean;
  isRestoring: boolean;
  sessionRestoreError: string | null;
  user: User | null;
  login: (user: User) => void;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(API_MODE);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!API_MODE) return;
    let active = true;
    void authService.restoreSession().then((restored) => {
      if (!active) return;
      setUser(restored);
      setIsAuthenticated(Boolean(restored));
    }).catch((error: unknown) => {
      if (!active) return;
      setSessionRestoreError(error instanceof Error ? error.message : 'Could not restore your session. Please sign in again.');
    }).finally(() => { if (active) setIsRestoring(false); });
    const handleInvalid = () => { setUser(null); setIsAuthenticated(false); };
    window.addEventListener('cc:auth-invalid', handleInvalid);
    return () => { active = false; window.removeEventListener('cc:auth-invalid', handleInvalid); };
  }, []);

  const login = useCallback((u: User) => {
    setIsAuthenticated(true);
    setUser(u);
    setSessionRestoreError(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  const logout = useCallback(async () => {
    void authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isRestoring, sessionRestoreError, user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Settings Context ─────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('cc_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem('cc_settings', JSON.stringify(next)); } catch { /* Preferences remain active for this page session. */ }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    try { localStorage.removeItem('cc_settings'); } catch { /* In-memory defaults still apply. */ }
    setSettings(DEFAULT_SETTINGS);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = settings.fontSize === 'sm' ? '14px' : settings.fontSize === 'lg' ? '18px' : '16px';
    root.dataset.compact = String(settings.compactMode);
    return () => { root.style.fontSize = previousFontSize; delete root.dataset.compact; };
  }, [settings.fontSize, settings.compactMode]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let timer = 0;
    const lockAfterInactivity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(logout, settings.autoLockMinutes * 60_000);
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, lockAfterInactivity, { passive: true }));
    document.addEventListener('visibilitychange', lockAfterInactivity);
    lockAfterInactivity();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, lockAfterInactivity));
      document.removeEventListener('visibilitychange', lockAfterInactivity);
    };
  }, [isAuthenticated, logout, settings.autoLockMinutes]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsCtx() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsCtx must be used within SettingsProvider');
  return ctx;
}

// ─── Toast Context ────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { settings } = useSettingsCtx();
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;

  const addToast = useCallback((type: ToastType, message: string) => {
    if (!settingsRef.current.notifications) return;
    const id = `toast-${crypto.randomUUID()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (settingsRef.current.soundEnabled && typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        oscillator.frequency.value = type === 'error' ? 330 : 660;
        volume.gain.value = 0.035;
        oscillator.connect(volume);
        volume.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.08);
        oscillator.onended = () => { void audio.close(); };
      } catch { /* Some browsers block audio until the user interacts with the page. */ }
    }
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Root Provider ────────────────────────────────────────────────────────────

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
