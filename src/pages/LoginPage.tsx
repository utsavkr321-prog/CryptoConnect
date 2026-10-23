import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Zap, CheckCircle, AlertCircle, ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth, useToast } from '../context/AppContext';
import { API_MODE, authService } from '../services';
import { DEMO_USER } from '../data/mockData';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Symbol', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'];

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Password strength</span>
        <span className={['text-red-300', 'text-amber-300', 'text-blue-300', 'text-emerald-300'][score] ?? 'text-slate-400'}>{labels[score]}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-slate-700/90'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <span className={`inline-flex h-2.5 w-2.5 items-center justify-center rounded-full ${c.pass ? 'bg-emerald-400/20 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>
              <CheckCircle size={8} />
            </span>
            {c.label}
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
    <div className="viewport-page relative flex items-center justify-center overflow-hidden bg-[#090b12] px-4 py-8 sm:px-6 lg:px-8">
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-500/10" />
      </div>

      <div className="cyber-panel relative z-10 w-full max-w-5xl rounded-[1.75rem] p-3 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(91,97,246,0.12),transparent_30%)]" aria-hidden="true" />
        <div className="relative flex min-h-[640px] items-center justify-center rounded-[1.35rem] border border-white/5 bg-[#0d1219]/90 p-4 sm:p-6 lg:p-10">
          <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="relative hidden min-h-[560px] overflow-hidden rounded-[1.4rem] border border-indigo-500/10 bg-[radial-gradient(circle_at_top,_rgba(91,97,246,0.16),_transparent_36%),linear-gradient(180deg,#141b24_0%,#0d131b_100%)] p-8 lg:flex lg:flex-col lg:justify-between">
              <div className="absolute inset-0 opacity-70" aria-hidden="true">
                <svg viewBox="0 0 540 620" className="h-full w-full" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M35 116H220V200H334V116H510" stroke="rgba(146,150,255,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M36 458H236V368H358V458H504" stroke="rgba(39,214,206,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M160 90V52H270V90M180 530V575H300V530M366 60V122H470V232M492 330V420H392V505" stroke="rgba(146,150,255,0.16)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="35" cy="116" r="4" fill="#9296FF" fillOpacity="0.85"/>
                  <circle cx="220" cy="200" r="4" fill="#9296FF" fillOpacity="0.8"/>
                  <circle cx="334" cy="116" r="4" fill="#27D6CE" fillOpacity="0.8"/>
                  <circle cx="510" cy="116" r="4" fill="#27D6CE" fillOpacity="0.8"/>
                  <circle cx="36" cy="458" r="4" fill="#9296FF" fillOpacity="0.8"/>
                  <circle cx="236" cy="368" r="4" fill="#27D6CE" fillOpacity="0.8"/>
                  <circle cx="504" cy="458" r="4" fill="#9296FF" fillOpacity="0.8"/>
                  <circle cx="470" cy="232" r="4" fill="#27D6CE" fillOpacity="0.8"/>
                  <circle cx="392" cy="505" r="4" fill="#9296FF" fillOpacity="0.8"/>
                  <path d="M160 90H200M180 530H220M366 60H420M492 330H454" stroke="rgba(146,150,255,0.2)" strokeWidth="1" strokeDasharray="6 8"/>
                </svg>
              </div>

              <div className="relative z-10">
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-indigo-400/20 bg-indigo-500/5 px-3 py-2 text-xs font-medium text-indigo-200 shadow-[0_0_35px_rgba(91,97,246,0.18)]">
                  <Shield className="h-4 w-4 text-indigo-300" />
                  Secure Platform Access
                </div>
                <div className="max-w-sm">
                  <p className="mb-3 text-sm uppercase tracking-[0.28em] text-slate-400">Cybersecurity suite</p>
                  <h1 className="text-4xl font-semibold tracking-tight text-white">Protecting your digital reach.</h1>
                  <p className="mt-4 max-w-xs text-sm leading-6 text-slate-300">
                    Coordinate trusted communications, verify identity keys, and safeguard every connection with full visibility.
                  </p>
                </div>
              </div>

              <div className="relative z-10 rounded-2xl border border-indigo-500/10 bg-[#111a23]/80 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">System status</p>
                    <p className="mt-2 text-xl font-semibold text-white">Threat matrix stable</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(39,214,206,0.7)]" />
                  99.98% secure session integrity
                </div>
              </div>
            </div>

            <div className="relative flex w-full items-center justify-center">
              <div className="w-full max-w-md rounded-[1.5rem] border border-indigo-500/10 bg-[#171f29]/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_38px_80px_rgba(3,7,18,0.7)] backdrop-blur-sm sm:p-7">
                <div className="mb-7 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-200 shadow-[0_0_22px_rgba(91,97,246,0.2)]">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">CryptoConnect</div>
                      <div className="text-[10px] text-slate-500">secure workspace</div>
                    </div>
                  </div>
                  <div className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200">
                    {API_MODE ? 'API' : 'Demo'}
                  </div>
                </div>

                {sessionRestoreError && (
                  <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200" role="alert">
                    Your previous session could not be restored: {sessionRestoreError} Please sign in again.
                  </p>
                )}

                <div className="mb-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-[#f4f5fa]">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                  <p className="mt-2 text-sm text-slate-400">{mode === 'login' ? 'Please log in to your account' : 'Set up your secure workspace'}</p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-[#111a22] p-1">
                  {(['login', 'register'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(''); }}
                      className={`min-h-11 rounded-lg text-sm font-medium transition-all duration-200 ${
                        mode === m ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_12px_25px_rgba(91,97,246,0.22)]' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m === 'login' ? 'Sign In' : 'Register'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-name" className="mb-1.5 block text-sm font-medium text-slate-300">Full Name</label>
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
                    <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
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

                  <div>
                    <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'register' ? 'Create a strong password' : '••••••••'}
                        className="input-field pr-11"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-200"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mode === 'register' && <PasswordStrength password={password} />}
                  </div>

                  {error && (
                    <div id="auth-error" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert" aria-live="assertive">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
                    {!loading && <ArrowRight size={15} />}
                  </button>
                </form>

                {!API_MODE && (
                  <>
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/8" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-[#171f29] px-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">or</span>
                      </div>
                    </div>

                    <button
                      onClick={handleDemo}
                      disabled={loading}
                      className="btn-secondary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                    >
                      <Zap size={15} />
                      Continue with Demo Account
                    </button>
                  </>
                )}

                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
                  <span>{mode === 'login' ? 'New here?' : 'Already registered?'}</span>
                  <button
                    type="button"
                    onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                    className="font-medium text-indigo-200 transition hover:text-indigo-100"
                  >
                    {mode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </div>

                <div className="mt-5 rounded-xl border border-white/5 bg-[#111a22] p-3 text-center text-xs text-slate-400">
                  <div className="inline-flex items-center gap-2 text-slate-300">
                    <Sparkles size={12} className="text-violet-300" />
                    <span>{API_MODE ? 'API Mode' : 'Frontend Demo'}</span>
                  </div>
                  <p className="mt-2 leading-5 text-slate-500">
                    {API_MODE ? 'Authentication is handled by the local Spring Boot backend.' : 'Authentication is available by setting VITE_APP_MODE=api.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
