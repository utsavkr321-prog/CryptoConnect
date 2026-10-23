import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { EncryptionVisualizerPage } from './EncryptionVisualizerPage';
import { SecurityLabPage } from './SecurityLabPage';
import { bufferToHex, computePublicKeyFingerprint, decryptPayload, isValidFingerprint, normalizeFingerprint } from '../utils/crypto';

type LabTab = 'visualizer' | 'operations' | 'decryption' | 'keys';

const tabs: Array<{ id: LabTab; label: string; description: string }> = [
  { id: 'visualizer', label: 'Encryption Visualizer', description: 'AES-GCM walk through' },
  { id: 'operations', label: 'Cryptographic Operations', description: 'Proofs and validation checks' },
  { id: 'decryption', label: 'Secure Decryption', description: 'Browser-side local decryption' },
  { id: 'keys', label: 'Key and Fingerprint Tools', description: 'Fingerprint comparison and key hygiene' },
];

function LabHeader() {
  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">Crypto lab</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Cryptography Lab</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">A single secure workspace for encryption demos, verification workflows, secure decryption, and key identity checking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            <ShieldCheck size={12} /> Browser local only
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-medium text-blue-300">
            <Lock size={12} /> AES-GCM + AES-CBC
          </span>
        </div>
      </div>
    </div>
  );
}

function TabNavigator({ activeTab, onChange }: { activeTab: LabTab; onChange: (tab: LabTab) => void }) {
  return (
    <div className="card p-2">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(tab.id)}
              className={`rounded-xl border px-3 py-3 text-left transition-all ${active ? 'border-indigo-500/45 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80'}`}
            >
              <p className="text-sm font-medium text-slate-100">{tab.label}</p>
              <p className="mt-1 text-[11px] text-slate-400">{tab.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SecureDecryptionWorkspace() {
  const [ciphertext, setCiphertext] = useState('');
  const [algorithm, setAlgorithm] = useState<'AES-256-GCM' | 'AES-256-CBC'>('AES-256-GCM');
  const [keyHex, setKeyHex] = useState('');
  const [ivHex, setIvHex] = useState('');
  const [tagHex, setTagHex] = useState('');
  const [encoding, setEncoding] = useState<'hex' | 'base64' | 'text'>('hex');
  const [outputEncoding, setOutputEncoding] = useState<'utf8' | 'hex' | 'base64'>('utf8');
  const [result, setResult] = useState<{ plaintext: string; success: boolean; error?: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const decrypt = async () => {
    setIsBusy(true);
    setResult(null);
    try {
      const decrypted = await decryptPayload({ algorithm, ciphertext, keyHex, ivHex, encoding, tagHex });
      const outputString = outputEncoding === 'utf8'
        ? decodeUtf8(decrypted)
        : outputEncoding === 'hex' ? bufferToHex(decrypted) : encodeBase64(decrypted);
      setResult({ plaintext: outputString, success: true });
    } catch (error) {
      setResult({ plaintext: '', success: false, error: error instanceof Error ? error.message : 'Decryption failed. Verify the key, IV, algorithm, and tag.' });
    } finally {
      setIsBusy(false);
    }
  };

  const copyResult = async () => {
    if (!result || !result.success) return;
    try {
      await navigator.clipboard.writeText(result.plaintext);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lock size={16} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">Secure Decryption Workspace</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <fieldset>
            <legend className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Algorithm</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
            {(['AES-256-GCM', 'AES-256-CBC'] as const).map((option) => (
              <button key={option} type="button" aria-pressed={algorithm === option} onClick={() => setAlgorithm(option)} className={`rounded-xl border px-3 py-2 text-sm ${algorithm === option ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
                {option}
              </button>
            ))}
            </div>
          </fieldset>
          <label htmlFor="decrypt-ciphertext" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Ciphertext input</label>
          <textarea id="decrypt-ciphertext" value={ciphertext} onChange={(event) => setCiphertext(event.target.value)} rows={5} className="input-field resize-none text-sm" placeholder="Paste ciphertext here" />
          <p className="text-xs leading-relaxed text-slate-500">CryptoConnect hex output is ciphertext followed by its 16-byte GCM tag. You may also paste ciphertext and tag separately. All decryption runs locally in this browser; key material is not sent to the backend.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="decrypt-input-encoding" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Input encoding</label>
              <select id="decrypt-input-encoding" value={encoding} onChange={(event) => setEncoding(event.target.value as 'hex' | 'base64' | 'text')} className="input-field text-sm">
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
                <option value="text">UTF-8 text</option>
              </select>
            </div>
            <div>
              <label htmlFor="decrypt-output-encoding" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Output encoding</label>
              <select id="decrypt-output-encoding" value={outputEncoding} onChange={(event) => setOutputEncoding(event.target.value as 'utf8' | 'hex' | 'base64')} className="input-field text-sm">
                <option value="utf8">UTF-8 text</option>
                <option value="hex">Hex</option>
                <option value="base64">Base64</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="decrypt-key" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Key (hex)</label>
              <input id="decrypt-key" type="password" autoComplete="off" value={keyHex} onChange={(event) => setKeyHex(event.target.value)} className="input-field font-mono text-xs" placeholder="64 hex chars" />
            </div>
            <div>
              <label htmlFor="decrypt-iv" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">IV / nonce (hex)</label>
              <input id="decrypt-iv" value={ivHex} onChange={(event) => setIvHex(event.target.value)} className="input-field font-mono text-xs" placeholder={algorithm === 'AES-256-GCM' ? '24 hex chars' : '32 hex chars'} />
            </div>
          </div>
          {algorithm === 'AES-256-GCM' && (
            <div>
              <label htmlFor="decrypt-tag" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Authentication tag (hex, optional if already included)</label>
              <input id="decrypt-tag" value={tagHex} onChange={(event) => setTagHex(event.target.value)} className="input-field font-mono text-xs" placeholder="16 bytes / 32 hex chars" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={decrypt} disabled={isBusy} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">{isBusy ? 'Decrypting…' : 'Decrypt'}</button>
            <button type="button" onClick={() => { setCiphertext(''); setKeyHex(''); setIvHex(''); setTagHex(''); setResult(null); }} className="btn-secondary rounded-lg px-4 py-2 text-sm">Clear</button>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle size={12} /> Warning</p>
            <p className="mt-1">AES-GCM authenticates ciphertext and tag before plaintext is returned. AES-CBC uses PKCS#7 padding but does not authenticate data; valid padding does not prove integrity.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Result</p>
              {result?.success && (
                <button type="button" onClick={() => void copyResult()} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300">
                  {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {result ? (
              result.success ? (
                <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-emerald-300">{result.plaintext}</pre>
              ) : (
                <p className="text-sm text-red-300" role="alert">{result.error}</p>
              )
            ) : (
              <p className="text-sm text-slate-500">No decryption has been attempted yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyAndFingerprintTools() {
  const [value, setValue] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateFingerprint = async () => {
    try {
      setError('');
      setFingerprint(await computePublicKeyFingerprint(value.trim()));
    } catch (reason) {
      setFingerprint('');
      setError(reason instanceof Error ? reason.message : 'Fingerprint generation failed.');
    }
  };

  const normalizedValue = normalizeFingerprint(fingerprint);
  const valid = isValidFingerprint(fingerprint);
  const copyFingerprint = async () => {
    if (!fingerprint) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound size={16} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200">Key and Fingerprint Tools</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label htmlFor="spki-public-key" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Public key (standard base64 SPKI DER)</label>
          <textarea id="spki-public-key" value={value} onChange={(event) => setValue(event.target.value)} rows={4} className="input-field resize-none text-sm" placeholder="Paste the enrolled P-256 public key in base64" />
          <button type="button" onClick={() => void generateFingerprint()} disabled={!value.trim()} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50">Generate fingerprint</button>
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2"><label className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Fingerprint</label>{fingerprint && <button type="button" onClick={() => void copyFingerprint()} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300">{copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}</button>}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 font-mono text-xs text-emerald-300 break-all">{fingerprint || 'No fingerprint generated yet.'}</div>
          {fingerprint && (
            <>
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
                <p className="text-slate-400">Normalized hex:</p>
                <p className="mt-1 break-all font-mono text-emerald-300">{normalizedValue}</p>
              </div>
              <p className={`text-xs ${valid ? 'text-emerald-300' : 'text-red-300'}`}>
                {valid ? 'SHA-256 of the decoded SPKI DER bytes, formatted in 4-byte groups to match server enrollment.' : 'Fingerprint is malformed or incomplete.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Decryption succeeded, but the plaintext is not valid UTF-8. Choose Hex or Base64 output instead.');
  }
}

export function CryptographyLabPage() {
  const [activeTab, setActiveTab] = useState<LabTab>('visualizer');

  return (
    <div className="space-y-5 p-4 md:p-6">
      <LabHeader />
      <TabNavigator activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'visualizer' && <EncryptionVisualizerPage />}
      {activeTab === 'operations' && <SecurityLabPage />}
      {activeTab === 'decryption' && <SecureDecryptionWorkspace />}
      {activeTab === 'keys' && <KeyAndFingerprintTools />}
    </div>
  );
}
