import { useState, useCallback } from 'react';
import {
  FlaskConical, Play, RefreshCw,
  Shield, Info, Fingerprint, Eye,
} from 'lucide-react';
import {
  generateAESKey,
  encryptAESGCM,
  decryptAESGCM,
  tamperCiphertext,
  computeFingerprint,
  randomHex,
} from '../utils/crypto';
import { SecurityBadge } from '../components/SecurityBadge';
import { useToast } from '../context/AppContext';
import type { SecurityTest, TestStatus } from '../types';
import { INITIAL_SECURITY_TESTS } from '../data/mockData';

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runTest(test: SecurityTest): Promise<{ status: TestStatus; result: string; duration: number }> {
  const start = Date.now();

  try {
    switch (test.id) {
      case 'test-001': {
        const key = await generateAESKey();
        const enc = await encryptAESGCM('CryptoConnect security test', key);
        const dec = await decryptAESGCM(enc.fullOutputHex, enc.ivHex, key);
        if (!dec.success) throw new Error('Decryption failed');
        if (dec.plaintext !== 'CryptoConnect security test') throw new Error('Plaintext mismatch');
        return { status: 'passed', result: `Round-trip OK. Ciphertext: ${enc.ciphertextHex.slice(0, 16)}…`, duration: Date.now() - start };
      }

      case 'test-002': {
        const key = await generateAESKey();
        const enc = await encryptAESGCM('tamper test payload', key);
        const tampered = tamperCiphertext(enc.fullOutputHex);
        const dec = await decryptAESGCM(tampered, enc.ivHex, key);
        if (dec.success) throw new Error('Tampered data was accepted — AES-GCM failed!');
        return { status: 'passed', result: 'Auth tag mismatch correctly detected. Tampered payload rejected.', duration: Date.now() - start };
      }

      case 'test-003': {
        const key1 = await generateAESKey();
        const key2 = await generateAESKey(); // different key
        const enc = await encryptAESGCM('wrong key test', key1);
        const dec = await decryptAESGCM(enc.fullOutputHex, enc.ivHex, key2);
        if (dec.success) throw new Error('Wrong key was accepted!');
        return { status: 'passed', result: 'Decryption with wrong key correctly rejected by AES-GCM.', duration: Date.now() - start };
      }

      case 'test-004': {
        const fp = await computeFingerprint('CryptoConnect Demo Public Key v1.0');
        const isValidFormat = /^[0-9A-F]{8}(?::[0-9A-F]{8}){7}$/.test(fp);
        if (!isValidFormat) throw new Error('Fingerprint format invalid');
        return { status: 'passed', result: `Sample-input SHA-256: ${fp.slice(0, 23)}…`, duration: Date.now() - start };
      }

      case 'test-005': {
        const ivs = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ivs.add(randomHex(12));
        }
        if (ivs.size < 100) throw new Error(`Collision detected! Only ${ivs.size} unique IVs from 100`);
        return { status: 'passed', result: `100 IVs generated, 100 unique — no collisions.`, duration: Date.now() - start };
      }

      default:
        return { status: 'failed', result: 'Unknown test ID.', duration: Date.now() - start };
    }
  } catch (e: unknown) {
    return {
      status: 'failed',
      result: e instanceof Error ? e.message : String(e),
      duration: Date.now() - start,
    };
  }
}

// ─── Plaintext vs Ciphertext Demo ────────────────────────────────────────────

function PlaintextCiphertextDemo() {
  const [text, setText] = useState('Hello, this is a secret message!');
  const [cipher, setCipher] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const encrypt = async () => {
    setLoading(true);
    setError('');
    try {
      const key = await generateAESKey();
      const enc = await encryptAESGCM(text, key);
      setCipher(enc.ciphertextHex);
    } catch {
      setError('Encryption failed. Check that this browser supports the Web Crypto API.');
    } finally { setLoading(false); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={16} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200">Plaintext vs. Ciphertext</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Plaintext (readable)</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="input-field resize-none text-sm text-slate-200"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Ciphertext (after AES-GCM)</p>
          <div className="font-mono text-xs text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 h-[7.5rem] overflow-y-auto break-all leading-relaxed">
            {cipher || <span className="text-slate-600">Click "Encrypt" to generate ciphertext…</span>}
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
      <button
        onClick={encrypt}
        disabled={loading || !text.trim()}
        className="btn-primary px-5 py-2 rounded-lg text-sm mt-4 flex items-center gap-2 disabled:opacity-60"
      >
        {loading ? <RefreshCw size={13} className="animate-spin" /> : <Shield size={13} />}
        Encrypt with AES-GCM
      </button>
    </div>
  );
}

// ─── Fingerprint Demo ─────────────────────────────────────────────────────────

function FingerprintDemo() {
  const [input, setInput] = useState('CryptoConnect sample text');
  const [fingerprint, setFingerprint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      setFingerprint(await computeFingerprint(input));
    } catch {
      setError('Fingerprint generation failed. Check that this browser supports the Web Crypto API.');
    } finally { setLoading(false); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint size={16} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">SHA-256 Data Fingerprint</h3>
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="input-field text-sm mb-3"
        placeholder="Enter data to fingerprint..."
      />
      {error && <p className="mb-3 text-sm text-red-300" role="alert">{error}</p>}
      {fingerprint && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5">SHA-256 Fingerprint</p>
          <p className="font-mono text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 break-all">
            {fingerprint}
          </p>
        </div>
      )}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mb-3">
        <Info size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-300/80">
          This hashes the UTF-8 bytes in the input field. It is a data-hash demo, not a public-key fingerprint or proof of identity; compare identity-key fingerprints out of band.
        </p>
      </div>
      <button
        onClick={generate}
        disabled={loading || !input.trim()}
        className="btn-secondary px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
      >
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Fingerprint size={12} />}
        Generate Fingerprint
      </button>
    </div>
  );
}

// ─── Security Lab Page ────────────────────────────────────────────────────────

export function SecurityLabPage() {
  const [tests, setTests] = useState<SecurityTest[]>(INITIAL_SECURITY_TESTS);
  const [runningAll, setRunningAll] = useState(false);
  const { addToast } = useToast();

  const runSingleTest = useCallback(async (id: string) => {
    setTests((prev) => prev.map((t) => t.id === id ? { ...t, status: 'running', result: undefined } : t));
    const test = tests.find((t) => t.id === id)!;
    const result = await runTest(test);
    setTests((prev) =>
      prev.map((t) => t.id === id ? { ...t, ...result } : t),
    );
    addToast(result.status === 'passed' ? 'success' : 'error', `${test.name}: ${result.status}`);
  }, [tests, addToast]);

  const runAllTests = useCallback(async () => {
    setRunningAll(true);
    for (const test of tests) {
      await runSingleTest(test.id);
    }
    setRunningAll(false);
  }, [tests, runSingleTest]);

  const resetAll = () => {
    setTests(INITIAL_SECURITY_TESTS.map((t) => ({ ...t, status: 'not_run', result: undefined })));
  };

  const passed = tests.filter((t) => t.status === 'passed').length;
  const verifiedPassed = tests.filter((t) => t.isReal && t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const total = tests.length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="card p-5 border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <FlaskConical size={22} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-100 mb-1">Security Lab</h2>
            <p className="text-sm text-slate-400">
              Run genuine browser-local Web Crypto checks. These operations validate the named primitive behavior only; they are not a complete messaging protocol or a system-wide security audit.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Demos */}
      <div className="grid md:grid-cols-1 gap-4">
        <PlaintextCiphertextDemo />
        <FingerprintDemo />
      </div>

      {/* Test Runner */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">Security Test Suite</h3>
            {total > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {verifiedPassed} local checks passed · {failed} failed
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg hover:border-slate-600 transition-all"
            >
              Reset
            </button>
            <button
              onClick={runAllTests}
              disabled={runningAll}
              className="btn-primary px-4 py-1.5 text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              {runningAll ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
              Run All
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="h-1.5 rounded-full bg-slate-800 mb-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(passed / total) * 100}%` }}
            />
          </div>
        )}

        <div className="space-y-2">
          {tests.map((test) => (
            <div
              key={test.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                test.status === 'passed'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : test.status === 'failed'
                  ? 'border-red-500/20 bg-red-500/5'
                  : test.status === 'running'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-slate-800 bg-slate-800/20'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-medium text-slate-200">{test.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${test.isReal ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                    {test.isReal ? '✓ Real' : '~ Simulated'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-1.5 leading-relaxed">{test.description}</p>
                {test.result && (
                  <p className={`text-xs font-mono ${test.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {test.result}
                  </p>
                )}
                {test.duration !== undefined && (
                  <p className="text-xs text-slate-600 mt-1">{test.duration}ms</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SecurityBadge type="test-status" testStatus={test.status} />
                <button
                  onClick={() => runSingleTest(test.id)}
                  disabled={test.status === 'running' || runningAll}
                  className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all disabled:opacity-50"
                  aria-label={`Run ${test.name}`}
                >
                  <Play size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
