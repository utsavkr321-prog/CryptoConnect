import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus, Shield, User, X, Trash2, LoaderCircle, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError, contactService, friendService, presenceService } from '../services';
import { SecurityBadge } from '../components/SecurityBadge';
import { EmptyState } from '../components/EmptyState';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useToast } from '../context/AppContext';
import type { Contact, DirectoryUser, FriendRequest } from '../types';


function ContactCard({ contact, onRemove, onMessage, onVerify }: { contact: Contact; onRemove: (contact: Contact) => void; onMessage: (contact: Contact) => void; onVerify: (contact: Contact) => void }) {
  return (
    <article className="card p-4 transition-colors hover:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0" aria-hidden="true">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-200 truncate">{contact.name}</p>
            <SecurityBadge type={contact.verified ? 'verified' : 'unverified'} size="sm" />
          </div>
          {contact.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
          <p className="text-xs text-slate-600 mt-2"><span className={contact.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}>{contact.status === 'online' ? 'Online' : contact.status === 'offline' ? 'Offline' : 'Presence unavailable'}</span> · {contact.verified ? 'identity verified' : 'identity not verified'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => onVerify(contact)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Verify contact identity with ${contact.name}`}>
          <Fingerprint size={13} />Verify Contact
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onMessage(contact)} className="btn-primary rounded-lg px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Message</button>
          <button onClick={() => onRemove(contact)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-red-500/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={`Remove ${contact.name}`}>
          <span className="inline-flex items-center gap-1.5"><Trash2 size={12} />Remove</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ContactVerificationDialog({ contact, onClose, onVerified }: { contact: Contact; onClose: () => void; onVerified: (contact: Contact) => Promise<void> }) {
  const panelRef = useRef<HTMLElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keyAvailable = contact.publicKeyFingerprint !== 'Not provided';

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const closeButton = panelRef.current?.querySelector<HTMLElement>('#contact-verification-close');
    closeButton?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const verify = async () => {
    setBusy(true); setError('');
    try { await onVerified(contact); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record verification.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close contact verification information" />
      <section ref={panelRef} className="relative card w-full max-w-lg max-h-[85dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="contact-verification-title" aria-describedby="contact-verification-description">
        <button id="contact-verification-close" type="button" onClick={onClose} className="absolute top-4 right-4 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="Close">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 pr-10">
          <div className="rounded-lg bg-amber-500/10 p-2"><Fingerprint size={17} className="text-amber-300" /></div>
          <div>
            <h2 id="contact-verification-title" className="font-semibold text-slate-100">Verify {contact.name}</h2>
            <p className={`text-xs ${contact.verified ? 'text-emerald-300' : 'text-amber-300'}`}>{contact.verified ? 'Verified fingerprint' : keyAvailable ? 'Compare fingerprint out of band' : 'No enrolled identity key'}</p>
          </div>
        </div>

        <div id="contact-verification-description" className="mt-5 space-y-3 text-sm text-slate-400 [&>p:nth-of-type(2)]:hidden">
          <p>A genuine identity check needs a stable cryptographic public key and its complete fingerprint. You and {contact.name} would each compare the same fingerprint through a trusted channel, such as in person or on a call.</p>
          <p>CryptoConnect does not currently enroll or rotate identity keys, or persist verification for your account and this contact. The fingerprint demo and placeholder values cannot establish identity. A real workflow must clear verification if either key changes. This action will not mark {contact.name} as verified.</p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs">Contact verification would only help confirm identity-key continuity. It does not encrypt messages. API chat remains readable by the service and is not end-to-end encrypted.</p>
          <p className="break-all rounded-lg border border-slate-700 bg-slate-900/60 p-3 font-mono text-xs text-slate-300">Current fingerprint: {contact.publicKeyFingerprint}</p>
          <p>Key enrollment proves possession of the private key. Recording this check means you compared this exact fingerprint with {contact.name} through a trusted channel; it does not establish real-world identity and is invalidated if their enrolled key changes.</p>
          {!contact.verified && keyAvailable && <label className="flex items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />I compared this exact fingerprint with {contact.name} through a trusted channel.</label>}
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end">
          {!contact.verified && <button type="button" disabled={!confirmed || !keyAvailable || busy} onClick={() => void verify()} className="btn-primary mr-2 rounded-lg px-4 py-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">{busy ? 'Recording…' : 'Record verification'}</button>}
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary rounded-lg px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Close</button>
        </div>
      </section>
    </div>
  );
}

function AddContactDialog({ contacts, requests, onClose, onRequestSent }: { contacts: Contact[]; requests: FriendRequest[]; onClose: () => void; onRequestSent: (user: DirectoryUser) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  const existingIds = useMemo(() => new Set(contacts.map((contact) => contact.id)), [contacts]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); setError(''); setSearching(false); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError('');
      void contactService.searchUsers(value)
        .then((response) => { if (active) setResults(response.users); })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'User search failed.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const handleAdd = async (user: DirectoryUser) => {
    setAddingId(user.id);
    setError('');
    try {
      await onRequestSent(user);
      addToast('success', `Friend request sent to ${user.name}.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not send friend request.';
      setError(message);
      if (reason instanceof ApiError && reason.status === 409) addToast('info', 'A friend request already exists with this user.');
      else addToast('error', message);
    } finally { setAddingId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close add contact dialog" />
      <div className="relative card p-5 sm:p-6 w-full max-w-lg shadow-2xl max-h-[85dvh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded" aria-label="Close"><X size={16} /></button>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-emerald-500/10"><UserPlus size={16} className="text-emerald-400" /></div>
          <div><h2 id="add-contact-title" className="font-semibold text-slate-100">Find Friends</h2><p className="text-xs text-slate-500">Search registered CryptoConnect users by name</p></div>
        </div>
        <label htmlFor="contact-user-search" className="sr-only">Search registered users</label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input id="contact-user-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" className="input-field pl-9" autoFocus />
        </div>
        <p className="text-xs text-slate-500 mt-2">Friends can start new conversations. This does not verify identity.</p>
        {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
        {searching && <p className="mt-4 text-sm text-slate-400" role="status">Searching users…</p>}
        {!searching && query.trim().length >= 2 && !error && results.length === 0 && <p className="mt-4 text-sm text-slate-400">No matching registered users.</p>}
        <div className="mt-3 divide-y divide-slate-800/70">
          {results.map((user) => {
            const alreadyAdded = existingIds.has(user.id);
            const request = requests.find((item) => item.userId === user.id);
            const isFriend = alreadyAdded || request?.status === 'ACCEPTED';
            const isPending = request?.status === 'PENDING';
            return <div key={user.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="text-sm text-slate-200 truncate">{user.name}</p></div>
              <button disabled={isFriend || isPending || addingId !== null} onClick={() => void handleAdd(user)} className="btn-secondary rounded-lg px-3 py-2 text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                {alreadyAdded ? 'Added' : addingId === user.id ? 'Adding…' : 'Add'}
              </button>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [verificationContact, setVerificationContact] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const { addToast } = useToast();
  const closeVerification = useCallback(() => setVerificationContact(null), []);

  const refreshContacts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [savedContacts, incoming, outgoing] = await Promise.all([
        contactService.getContacts(), friendService.incoming(), friendService.outgoing(),
      ]);
      setContacts(savedContacts);
      setRequests([...incoming, ...outgoing]);
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load contacts.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refreshContacts(); }, [refreshContacts]);

  useEffect(() => {
    const refreshPresence = () => {
      const acceptedIds = requests.filter((request) => request.status === 'ACCEPTED').map((request) => request.userId);
      if (!acceptedIds.length) return;
      void Promise.allSettled(acceptedIds.map((id) => presenceService.status([id]))).then((results) => {
        const states = new Map<string, boolean>();
        results.forEach((result) => { if (result.status === 'fulfilled') result.value.forEach((entry) => states.set(entry.userId, entry.online)); });
        if (states.size) setContacts((current) => current.map((contact) => states.has(contact.id) ? { ...contact, status: states.get(contact.id) ? 'online' : 'offline' } : contact));
      });
    };
    refreshPresence();
    const timer = window.setInterval(refreshPresence, 30_000);
    return () => window.clearInterval(timer);
  }, [requests]);

  const sendFriendRequest = async (user: DirectoryUser) => {
    const request = await friendService.send(user.id);
    setRequests((current) => [request, ...current.filter((item) => item.userId !== user.id)]);
  };
  const decideRequest = async (request: FriendRequest, accept: boolean) => {
    setRequestBusy(request.id);
    try {
      const decided = accept ? await friendService.accept(request.id) : await friendService.reject(request.id);
      setRequests((current) => current.map((item) => item.id === decided.id ? decided : item));
      addToast('success', accept ? `${request.name} is now a friend.` : `Friend request from ${request.name} rejected.`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Could not update friend request.');
    } finally { setRequestBusy(null); }
  };
  const handleRemove = async () => {
    if (!removing) return;
    setRemovingBusy(true);
    try {
      await contactService.removeContact(removing.id);
      setContacts((current) => current.filter((item) => item.id !== removing.id));
      addToast('success', `${removing.name} removed from contacts.`);
      setRemoving(null);
    } catch (error) { addToast('error', error instanceof Error ? error.message : 'Could not remove contact.'); }
    finally { setRemovingBusy(false); }
  };
  const handleVerified = async (contact: Contact) => {
    const verified = await contactService.verifyContact(contact.id);
    setContacts((current) => current.map((item) => item.id === verified.id ? verified : item));
    addToast('success', `${contact.name}'s fingerprint has been marked verified.`);
  };

  const filtered = contacts.filter((contact) => `${contact.name} ${contact.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><label htmlFor="contact-filter" className="sr-only">Filter contacts</label><input id="contact-filter" type="search" placeholder="Filter your contacts…" value={search} onChange={(event) => setSearch(event.target.value)} className="input-field pl-9 text-sm" /></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><UserPlus size={14} />Add Contact</button>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15"><Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-slate-400"><span className="text-blue-400 font-medium">Identity notice:</span> Saved contacts are not verified. Fingerprints alone do not establish identity.</p></div>
      {requests.filter((request) => !request.outgoing && request.status === 'PENDING').length > 0 && <section className="card p-4" aria-label="Incoming friend requests"><h2 className="text-sm font-semibold text-slate-200 mb-3">Incoming Friend Requests</h2><div className="space-y-2">{requests.filter((request) => !request.outgoing && request.status === 'PENDING').map((request) => <div key={request.id} className="flex items-center gap-3"><span className="flex-1 text-sm text-slate-300">{request.name}</span><button disabled={requestBusy !== null} onClick={() => void decideRequest(request, true)} className="btn-primary px-3 py-2 rounded-lg text-xs disabled:opacity-50">{requestBusy === request.id ? 'Updating…' : 'Accept'}</button><button disabled={requestBusy !== null} onClick={() => void decideRequest(request, false)} className="btn-secondary px-3 py-2 rounded-lg text-xs disabled:opacity-50">Reject</button></div>)}</div></section>}
      {loading ? <div className="flex justify-center py-12" role="status" aria-label="Loading contacts"><LoaderCircle className="w-6 h-6 text-emerald-400 animate-spin" /></div>
        : loadError ? <div className="card p-6 text-center" role="alert"><p className="text-sm text-red-300">{loadError}</p><button onClick={() => void refreshContacts()} className="mt-3 text-sm text-emerald-300 underline">Retry</button></div>
        : filtered.length === 0 ? <EmptyState icon={User} title={contacts.length === 0 ? 'No contacts yet' : 'No matching contacts'} description={contacts.length === 0 ? 'Search registered users to add your first contact.' : 'Try a different name or email.'} action={contacts.length === 0 ? <button onClick={() => setShowAdd(true)} className="btn-primary px-4 py-2 rounded-lg text-sm">Find people</button> : undefined} />
        : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((contact) => <ContactCard key={contact.id} contact={contact} onRemove={setRemoving} onVerify={setVerificationContact} onMessage={(item) => navigate('/chat', { state: { contactId: item.id } })} />)}</div>}
      {showAdd && <AddContactDialog contacts={contacts} requests={requests} onClose={() => setShowAdd(false)} onRequestSent={sendFriendRequest} />}
      {verificationContact && <ContactVerificationDialog contact={verificationContact} onClose={closeVerification} onVerified={handleVerified} />}
      <ConfirmationDialog isOpen={removing !== null} title="Remove contact?" message={removing ? `${removing.name} will be removed from your contact list. Existing conversations are not deleted.` : ''} confirmLabel={removingBusy ? 'Removing…' : 'Remove'} isBusy={removingBusy} onConfirm={() => void handleRemove()} onCancel={() => { if (!removingBusy) setRemoving(null); }} danger />
    </div>
  );
}
