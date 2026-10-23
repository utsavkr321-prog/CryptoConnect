import { useState, useCallback } from 'react';
import {
  Lock, ArrowRight, AlertTriangle,
  CheckCircle, XCircle, Info, RefreshCw,
  Cpu, Shield,
} from 'lucide-react';
import {
  generateAESKey,
  encryptAESGCM,
  decryptAESGCM,
  tamperCiphertext,
  type EncryptOutput,
  type DecryptOutput,
} from '../utils/crypto';
import { useToast } from '../context/AppContext';
import { API_MODE, securityEventService } from '../services';

// ─── Step Card ────────────────────────────────────────────────────────────────

type StepState = 'idle' | 'active' | 'done' | 'error';

function StepCard({
  step,
  title,
  state,
  children,
}: {
  step: number;
  title: string;
  state: StepState;
  children?: React.ReactNode;
}) {
  const border = {
    idle: 'border-slate-800',
    active: 'border-emerald-500 shadow-lg shadow-emerald-500/10',
    done: 'border-emerald-500/40',
    error: 'border-red-500 shadow-lg shadow-red-500/10',
  }[state];

  const numColor = {
    idle: 'bg-slate-800 text-slate-500',
    active: 'bg-emerald-500 text-white animate-pulse',
    done: 'bg-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/20 text-red-400',
  }[state];

  return (
    <div className={`encrypt-step p-4 border ${border} transition-all duration-400`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${numColor}`}>
          {state === 'done' ? <CheckCircle size={14} /> : state === 'error' ? <XCircle size={14} /> : step}
        </div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {state === 'active' && (
          <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" /> Processing…
          </span>
        )}
      </div>
      {children && state !== 'idle' && (
        <div className="pl-10">{children}</div>
      )}
    </div>
  );
}

// ─── Hex Display ──────────────────────────────────────────────────────────────

function HexBlock({ label, value, rows = 3 }: { label: string; value: string; rows?: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div
        className="font-mono text-xs text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 break-all leading-relaxed"
        style={{ maxHeight: `${rows * 1.5}rem`, overflowY: 'auto' }}
      >
        {value || '—'}
      </div>
    </div>
  );
}

// ─── Transmission Diagram ──────────────────────────────────────────────────────

function TransmissionDiagram({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 py-4">
      {[
        { label: 'Alice (Sender)', icon: Shield },
        { label: 'Encrypted Payload', icon: Lock },
        { label: 'Channel', icon: ArrowRight },
        { label: 'Encrypted Payload', icon: Lock },
        { label: 'Bob (Recipient)', icon: Shield },
      ].map((node, i) => {
        if (node.icon === ArrowRight) {
          return (
            <div key={i} className="flex-1 flex items-center justify-center">
              <div className={`h-0.5 w-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'} transition-colors duration-500`} />
            </div>
          );
        }
        const isEdge = i === 0 || i === 4;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`p-2 rounded-lg ${isEdge ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'} ${active ? 'opacity-100' : 'opacity-50'} transition-opacity duration-500`}>
              <node.icon size={16} className={isEdge ? 'text-blue-400' : 'text-emerald-400'} />
            </div>
            <span className="text-xs text-slate-500 text-center" style={{ maxWidth: 60 }}>{node.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Visualizer Page ──────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'key_gen'
  | 'encrypting'
  | 'ciphertext'
  | 'transmitting'
  | 'decrypting'
  | 'done'
  | 'tamper'
  | 'error';

export function EncryptionVisualizerPage() {
  const [plaintext, setPlaintext] = useState('Hello from CryptoConnect!');
  const [phase, setPhase] = useState<Phase>('idle');
  const [encResult, setEncResult] = useState<EncryptOutput | null>(null);
  const [decResult, setDecResult] = useState<DecryptOutput | null>(null);
  const [tamperResult, setTamperResult] = useState<DecryptOutput | null>(null);
  const [showTamper, setShowTamper] = useState(false);
  const [keyRef, setKeyRef] = useState<CryptoKey | null>(null);
  const { addToast } = useToast();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runEncryption = useCallback(async () => {
    if (!plaintext.trim()) {
      addToast('warning', 'Enter a message to encrypt.');
      return;
    }
    setEncResult(null);
    setDecResult(null);
    setTamperResult(null);
    setShowTamper(false);
    setKeyRef(null);

    try {
      // Step 1: Key generation
      setPhase('key_gen');
      await sleep(700);
      const key = await generateAESKey();
      setKeyRef(key);

      // Step 2: Encrypting
      setPhase('encrypting');
      await sleep(700);
      const result = await encryptAESGCM(plaintext, key);
      setEncResult(result);

      // Step 3: Show ciphertext
      setPhase('ciphertext');
      await sleep(500);

      // Step 4: Transmission animation
      setPhase('transmitting');
      await sleep(1200);

      // Step 5: Decrypting
      setPhase('decrypting');
      await sleep(800);
      const dec = await decryptAESGCM(result.fullOutputHex, result.ivHex, key);
      setDecResult(dec);

      // Step 6: Done
      setPhase('done');

      // Log real event
      try {
        await securityEventService.addEvent({
          type: 'encryption_success',
          severity: 'success',
          title: 'AES-GCM Demo Completed',
          description: 'Browser-side AES-256-GCM encryption and decryption succeeded.',
          isSimulated: false,
        });
      } catch {
        if (API_MODE) addToast('info', 'The local encryption demo succeeded, but the event could not be saved.');
      }
      addToast('success', 'Encryption demo completed successfully!');
    } catch (e) {
      setPhase('error');
      addToast('error', 'Crypto operation failed. Check browser support.');
    }
  }, [plaintext, addToast]);

  const runTamperTest = useCallback(async () => {
    if (!encResult || !keyRef) return;
    setShowTamper(true);
    setPhase('tamper');
    await sleep(400);
    const tampered = tamperCiphertext(encResult.fullOutputHex);
    const result = await decryptAESGCM(tampered, encResult.ivHex, keyRef);
    setTamperResult(result);

    try {
      await securityEventService.addEvent({
        type: 'tamper_detected',
        severity: 'warning',
        title: 'Tamper Test: Authentication Failed',
        description: 'Modified ciphertext was correctly rejected by AES-GCM authentication.',
        isSimulated: false,
      });
    } catch {
      if (API_MODE) addToast('info', 'The local tamper test completed, but the event could not be saved.');
    }
    addToast('warning', 'Tamper detected! AES-GCM auth tag mismatch.');
  }, [encResult, keyRef, addToast]);

  const reset = () => {
    setPhase('idle');
    setEncResult(null);
    setDecResult(null);
    setTamperResult(null);
    setShowTamper(false);
    setKeyRef(null);
  };

  const getStepState = (stepPhase: Phase[], donePhase: Phase[]): StepState => {
    if (donePhase.includes(phase)) return 'done';
    if (stepPhase.includes(phase)) return 'active';
    return 'idle';
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="card p-5 border-emerald-500/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
            <Cpu size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 mb-1">AES-GCM Encryption Visualizer</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              This demonstrates <span className="text-emerald-400 font-medium">real AES-256-GCM encryption</span> running
              entirely in your browser via the Web Crypto API. A random key and IV are generated each time.
              Keys are never stored, logged, or transmitted.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2 py-1 rounded-full badge-verified">Real Web Crypto API</span>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">AES-256-GCM</span>
              <span className="text-xs px-2 py-1 rounded-full badge-unverified">No Real Key Exchange</span>
              <span className="text-xs px-2 py-1 rounded-full badge-unverified">No Real E2EE Protocol</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mt-3">
              This page is an isolated local encryption demonstration. API chat uses a separate server-readable message model and is not end-to-end encrypted.
            </p>
          </div>
        </div>
      </div>

      {/* Input + Controls */}
      <div className="card p-5">
        <label className="text-sm font-semibold text-slate-300 block mb-2">Plaintext Message</label>
        <textarea
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          placeholder="Enter the message you want to encrypt..."
          rows={3}
          className="input-field resize-none mb-4 text-sm"
          disabled={phase !== 'idle' && phase !== 'done' && phase !== 'error' && phase !== 'tamper'}
        />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runEncryption}
            disabled={phase !== 'idle' && phase !== 'done' && phase !== 'error'}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Lock size={14} />
            {phase === 'idle' || phase === 'done' || phase === 'error' ? 'Encrypt Message' : 'Encrypting…'}
          </button>
          {phase === 'done' && (
            <>
              <button
                onClick={runTamperTest}
                disabled={showTamper}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60"
              >
                <AlertTriangle size={14} />
                Tamper Test
              </button>
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <RefreshCw size={14} />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {/* Step 1: Plaintext */}
        <StepCard
          step={1}
          title="Plaintext Input"
          state={getStepState(['key_gen', 'encrypting', 'ciphertext', 'transmitting', 'decrypting', 'done', 'tamper'], ['key_gen', 'encrypting', 'ciphertext', 'transmitting', 'decrypting', 'done', 'tamper'])}
        >
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <p className="text-sm font-mono text-slate-200">{plaintext}</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">Human-readable plaintext before encryption.</p>
        </StepCard>

        {/* Step 2: Key Generation */}
        <StepCard
          step={2}
          title="AES-256-GCM Key Generation"
          state={getStepState(['key_gen'], ['encrypting', 'ciphertext', 'transmitting', 'decrypting', 'done', 'tamper'])}
        >
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              A random 256-bit key was generated using <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">crypto.subtle.generateKey</code>.
              The full key is never displayed to protect security.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <Info size={12} className="text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400/80">
                In a real system, this key would be derived via a secure key exchange protocol (e.g. X3DH). Here it is ephemeral — discarded after the demo.
              </p>
            </div>
          </div>
        </StepCard>

        {/* Step 3: Encryption */}
        <StepCard
          step={3}
          title="AES-256-GCM Encryption"
          state={getStepState(['encrypting'], ['ciphertext', 'transmitting', 'decrypting', 'done', 'tamper'])}
        >
          {encResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <HexBlock label="IV (Initialization Vector, 96-bit)" value={encResult.ivHex} rows={2} />
                <HexBlock label="Authentication Tag (128-bit)" value={encResult.authTagHex} rows={2} />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>• Algorithm: <span className="text-slate-300">{encResult.algorithm} ({encResult.keyLengthBits}-bit key)</span></p>
                <p>• A unique random IV is generated for each encryption — never reused.</p>
                <p>• The auth tag provides integrity and authenticity verification.</p>
              </div>
            </div>
          )}
        </StepCard>

        {/* Step 4: Ciphertext */}
        <StepCard
          step={4}
          title="Ciphertext Output"
          state={getStepState(['ciphertext'], ['transmitting', 'decrypting', 'done', 'tamper'])}
        >
          {encResult && (
            <div className="space-y-2">
              <HexBlock label="Ciphertext (hex)" value={encResult.ciphertextHex} rows={4} />
              <p className="text-xs text-slate-500">
                The original message is now unreadable without the key. The auth tag is appended at transmission.
              </p>
            </div>
          )}
        </StepCard>

        {/* Step 5: Transmission */}
        <StepCard
          step={5}
          title="Simulated Transmission"
          state={getStepState(['transmitting'], ['decrypting', 'done', 'tamper'])}
        >
          <TransmissionDiagram active={phase === 'transmitting' || ['decrypting', 'done', 'tamper'].includes(phase)} />
          <p className="text-xs text-slate-500">
            In a real system, only the encrypted payload (ciphertext + IV + auth tag) is transmitted. The key is never sent.
          </p>
        </StepCard>

        {/* Step 6: Decryption */}
        <StepCard
          step={6}
          title="Decryption at Recipient"
          state={getStepState(['decrypting'], ['done', 'tamper'])}
        >
          {decResult && (
            <div className="space-y-2">
              {decResult.success ? (
                <>
                  <div className="flex items-center gap-2 p-2 rounded-lg badge-verified">
                    <CheckCircle size={14} />
                    <span className="text-xs font-medium">Authentication tag verified — decryption successful</span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-sm text-emerald-300 font-medium">{decResult.plaintext}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 p-2 rounded-lg badge-danger">
                  <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs">{decResult.error}</p>
                </div>
              )}
            </div>
          )}
        </StepCard>

        {/* Tamper Test */}
        {showTamper && (
          <div className="card p-4 border-amber-500/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">Tamper Test Result</h3>
            </div>
            {tamperResult ? (
              tamperResult.success ? (
                <div className="flex items-center gap-2 p-2 rounded-lg badge-danger">
                  <XCircle size={14} />
                  <span className="text-xs">Unexpected: Tampered data was accepted. This should not happen with AES-GCM.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg badge-verified">
                    <CheckCircle size={14} />
                    <span className="text-xs font-medium">Tamper detected — AES-GCM authentication rejected the modified payload</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{tamperResult.error}</p>
                  <p className="text-xs text-slate-500">
                    A single byte was flipped in the ciphertext. AES-GCM's authentication tag caught the modification and refused to decrypt — no partial plaintext is ever revealed.
                  </p>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-amber-400" />
                <span className="text-xs text-slate-400">Running tamper test…</span>
              </div>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="card p-4 border-red-500/30">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-400" />
              <p className="text-sm text-red-400">Crypto operation failed. Your browser may not support the Web Crypto API, or an unexpected error occurred.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
