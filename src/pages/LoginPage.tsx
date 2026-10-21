import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth, useToast } from '../context/AppContext';
import { API_MODE, authService } from '../services';
import { DEMO_USER } from '../data/mockData';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs font-medium ${['', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400'][score]}`}>
          {labels[score]}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${c.pass ? 'text-emerald-400' : 'text-slate-600'}`}>
              <CheckCircle size={10} />
            </div>
            <span className={`text-xs ${c.pass ? 'text-slate-400' : 'text-slate-600'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, sessionRestoreError } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const validate = () => {
    if (!email.includes('@')) return 'Please enter a valid email address.';
    if (password.length < (API_MODE ? 12 : 6)) return `Password must be at least ${API_MODE ? 12 : 6} characters.`;
    if (mode === 'register' && name.trim().length < 2) return 'Please enter your name.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    const result = mode === 'register'
      ? await authService.register(name, email, password)
      : await authService.login(email, password);
    setLoading(false);
    if (result.success) {
      login(result.user ? { ...DEMO_USER, ...result.user, status: API_MODE ? 'unknown' : 'online', joinedAt: new Date().toISOString() } : { ...DEMO_USER, name: mode === 'register' ? name : DEMO_USER.name, email });
      addToast('success', API_MODE ? 'Authenticated successfully.' : 'Logged in successfully. Welcome to the demo!');
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Login failed.');
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    await authService.loginDemo();
    setLoading(false);
    login(DEMO_USER);
    addToast('info', 'Signed in with demo credentials. All data is local.');
    navigate('/dashboard');
  };

  return (
    <div className="viewport-page flex items-center justify-center bg-[#0a0f1e] px-4 py-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        {sessionRestoreError && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200" role="alert">Your previous session could not be restored: {sessionRestoreError} Please sign in again.</p>}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Shield size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">CryptoConnect</h1>
          <p className="text-slate-500 text-sm mt-1">Secure Communication Platform</p>
        </div>

        {/* Card */}
        <div className="card p-5 sm:p-8">
          {/* Mode toggle */}
          <div className="flex p-1 bg-slate-800/60 rounded-lg mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 min-h-11 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                  mode === m
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="text-sm font-medium text-slate-300 mb-1.5 block">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Reeves"
                  className="input-field"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="text-sm font-medium text-slate-300 mb-1.5 block">Email Address</label>
              <div className="relative">
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="text-sm font-medium text-slate-300 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create a strong password' : '••••••••'}
                  className="input-field pr-10"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-slate-300 rounded-lg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mode === 'register' && <PasswordStrength password={password} />}
            </div>

            {error && (
              <div id="auth-error" className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30" role="alert" aria-live="assertive">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full min-h-11 py-2.5 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {!API_MODE && <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="text-xs text-slate-500 bg-[#111827] px-3">or</span>
            </div>
          </div>}

          <button
            hidden={API_MODE}
            onClick={handleDemo}
            disabled={loading}
            className="btn-secondary w-full min-h-11 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
          >
            <Zap size={14} />
            Continue with Demo Account
          </button>

          {/* Backend notice */}
          <div className="mt-5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <p className="text-xs text-slate-500 leading-relaxed text-center">
              <span className="text-slate-400 font-medium">{API_MODE ? 'API Mode' : 'Frontend Demo'}</span> — {API_MODE ? 'Authentication is provided by the local Spring Boot backend.' : 'Real authentication is available by setting VITE_APP_MODE=api.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
