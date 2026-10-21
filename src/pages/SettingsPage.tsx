import { useEffect, useState } from 'react';
import {
  User, Bell, Shield, Monitor, Trash2, Info, ChevronRight,
  Moon, Volume2, VolumeX, Eye, Lock, Clock,
} from 'lucide-react';
import { useAuth, useSettingsCtx } from '../context/AppContext';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useToast } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { API_MODE, authService, identityKeyService } from '../services';

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800/60">
        <Icon size={15} className="text-emerald-400" />
        <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
      </div>
      <div className="divide-y divide-slate-800/50">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-label={label}
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

function SelectRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const controlId = `setting-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <select
        id={controlId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSetting, resetSettings } = useSettingsCtx();
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState('');

  useEffect(() => { setName(user?.name ?? ''); }, [user?.name]);

  const saveProfile = async () => {
    const displayName = name.trim();
    if (displayName.length < 2 || displayName.length > 120) {
      setProfileError('Display name must be between 2 and 120 characters.');
      return;
    }
    setProfileBusy(true);
    setProfileError('');
    try {
      const updated = await authService.updateProfile(displayName);
      updateUser({ ...user!, ...updated });
      setName(updated.name);
      addToast('success', 'Display name updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
    } finally { setProfileBusy(false); }
  };

  const handleClearData = () => {
    resetSettings();
    addToast('success', 'Local preferences reset. Reloading...');
    setTimeout(() => window.location.reload(), 1000);
    setShowClearConfirm(false);
  };
  const enrollIdentityKey = async () => {
    if (!user) return;
    setKeyBusy(true); setKeyError('');
    try {
      const key = await identityKeyService.enroll(user.id);
      updateUser({ ...user, keyFingerprint: key.keyFingerprint });
      addToast('success', 'Identity key enrolled. Compare its fingerprint out of band before confirming contacts.');
    } catch (error) { setKeyError(error instanceof Error ? error.message : 'Could not enroll the identity key.'); }
    finally { setKeyBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Profile */}
      <Section title="Profile" icon={User}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
              {user?.name.charAt(0) ?? 'A'}
            </div>
            <div>
              <p className="font-semibold text-slate-200">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="settings-display-name" className="text-xs font-medium text-slate-400 block mb-1">Display Name</label>
              <input
                id="settings-display-name"
                type="text"
                value={name}
                disabled={!API_MODE || profileBusy}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            {profileError && <p className="text-xs text-red-300" role="alert">{profileError}</p>}
            {API_MODE ? <button onClick={() => void saveProfile()} disabled={profileBusy || name.trim() === user?.name} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">{profileBusy ? 'Saving…' : 'Save Display Name'}</button> : <button disabled className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">Profile editing unavailable in demo mode</button>}
            <p className="text-xs text-slate-500" role="note">Only your display name can be changed. Email and account identifiers are protected.</p>
          </div>
        </div>
      </Section>

      <Section title="Identity Key" icon={Lock}>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-400">Your browser keeps the P-256 private key locally; CryptoConnect sends only its public key and a signature over a one-time backend challenge.</p>
          {user?.keyFingerprint ? <p className="break-all rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 font-mono text-xs text-emerald-300">{user.keyFingerprint}</p> : <p className="text-sm text-amber-300">No identity key enrolled yet.</p>}
          {keyError && <p className="text-xs text-red-300" role="alert">{keyError}</p>}
          <button onClick={() => void enrollIdentityKey()} disabled={!API_MODE || !user || keyBusy || Boolean(user?.keyFingerprint)} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">{keyBusy ? 'Enrolling…' : user?.keyFingerprint ? 'Identity Key Enrolled' : 'Set Up Identity Key'}</button>
          <p className="text-xs text-slate-500">Enrollment proves key possession, not real-world identity. Do not clear browser data after enrolling unless you plan a deliberate key rotation.</p>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={Bell}>
        <ToggleRow
          label="Enable Notifications"
          description="Show or hide in-app toast notifications"
          value={settings.notifications}
          onChange={(v) => updateSetting('notifications', v)}
        />
        <ToggleRow
          label="Sound Effects"
          description="Play a brief tone when an in-app notification appears"
          value={settings.soundEnabled}
          onChange={(v) => updateSetting('soundEnabled', v)}
        />
      </Section>

      {/* Display */}
      <Section title="Display" icon={Monitor}>
        <SelectRow
          label="Font Size"
          description="Text size across the app"
          value={settings.fontSize}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
          onChange={(v) => updateSetting('fontSize', v)}
        />
        <ToggleRow
          label="Compact Mode"
          description="Reduce padding and spacing"
          value={settings.compactMode}
          onChange={(v) => updateSetting('compactMode', v)}
        />
        <ToggleRow
          label="Show Encryption Badges"
          description="Display lock icons on messages"
          value={settings.showEncryptionBadges}
          onChange={(v) => updateSetting('showEncryptionBadges', v)}
        />
      </Section>

      {/* Security */}
      <Section title="Security" icon={Shield}>
        <SelectRow
          label="Auto-lock"
          description="Lock session after inactivity"
          value={String(settings.autoLockMinutes) as any}
          options={[
            { value: '5', label: '5 minutes' },
            { value: '15', label: '15 minutes' },
            { value: '30', label: '30 minutes' },
            { value: '60', label: '1 hour' },
          ]}
          onChange={(v) => updateSetting('autoLockMinutes', Number(v))}
        />
        <div className="px-5 py-3.5">
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
            <div className="flex items-center gap-2 mb-1">
              <Info size={12} className="text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">{API_MODE ? 'Local Preferences' : 'Frontend Demo'}</span>
            </div>
            <p className="text-xs text-slate-500">
              Auto-lock signs out this browser after the selected idle period and asks the backend to revoke its current access token. Other signed-in devices remain active.
            </p>
          </div>
        </div>
      </Section>

      {/* Data */}
      <Section title="Data Management" icon={Trash2}>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-400 mb-3">
            Reset locally saved preferences to their defaults and reload the application.
          </p>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2"
          >
            <Trash2 size={13} />
            Reset Local Preferences
          </button>
        </div>
      </Section>

      {/* About */}
      <Section title="About CryptoConnect" icon={Info}>
        <div className="px-5 py-4 space-y-3">
          {[
            ['Project', 'CryptoConnect — Secure Communication System'],
            ['Type', 'Final-Year B.Tech CSE Project'],
            ['Version', '1.0.0-demo'],
            ['Stack', 'React + Vite + TypeScript + Tailwind CSS'],
            ['Encryption', 'AES-256-GCM (Web Crypto API)'],
            ['Backend', API_MODE ? 'Spring Boot APIs connected for authentication, conversations, dashboard, and security events' : 'Spring Boot available when API mode is enabled'],
            ['Status', API_MODE ? 'API mode — persisted backend data; E2EE is not implemented' : 'Frontend demo — sample data is local'],
          ].map(([key, val]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-slate-500">{key}</span>
              <span className="text-slate-300 text-right max-w-xs">{val}</span>
            </div>
          ))}
        </div>
      </Section>

      <ConfirmationDialog
        isOpen={showClearConfirm}
        title="Reset Local Preferences?"
        message="This will reset locally saved preferences and reload the page."
        confirmLabel="Reset Preferences"
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirm(false)}
        danger
      />
    </div>
  );
}
