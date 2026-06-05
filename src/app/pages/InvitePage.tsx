import { Check, ChevronDown, Layers, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { createT, getStoredLanguage } from '../i18n';

// ─── Types ────────────────────────────────────────────────────────────────────
interface InviteData {
  groupId: string;
  groupName: string;
  inviterName: string;
  role: string;
  expiryDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadInvite(code: string): InviteData | null {
  try {
    const raw = localStorage.getItem(`invite:${code}`);
    if (!raw) return null;
    return JSON.parse(raw) as InviteData;
  } catch {
    return null;
  }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function EducationIcon() {
  return (
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
      <Layers className="w-5 h-5 text-white" />
    </div>
  );
}

function Header({ userEmail, t }: { userEmail?: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
      <div className="px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <EducationIcon />
          <span className="text-base font-bold text-gray-900 tracking-wide">{t('app_name')}</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#" className="text-sm text-gray-600 hover:text-blue-600">{t('invite_client_download')}</a>
          <span className="text-gray-300 select-none">|</span>
          <a href="#" className="text-sm text-gray-600 hover:text-blue-600">{t('invite_tced_website')}</a>
          {!userEmail && (
            <>
              <span className="text-gray-300 select-none">|</span>
              <a href="#" className="text-sm text-gray-600 hover:text-blue-600">{t('invite_registration')}</a>
            </>
          )}
          {userEmail ? (
            <div className="flex items-center gap-1.5 ml-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">{userEmail}</span>
            </div>
          ) : (
            <button className="ml-2 px-5 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
              {t('invite_login')}
            </button>
          )}
          <button className="ml-1 px-2 py-1 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50">
            A<sup>+</sup>
          </button>
        </nav>
      </div>
    </header>
  );
}

const gridBg: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  backgroundImage:
    'repeating-linear-gradient(135deg, #cbd5e1 0, #cbd5e1 1px, transparent 0, transparent 50%)',
  backgroundSize: '20px 20px',
};

// ─── Persona options (same as CollectionSubmitPage) ───────────────────────────
const PERSONA_OPTIONS = [
  { value: 'guest',   labelKey: 'persona_guest' },
  { value: 'teacher', labelKey: 'persona_teacher' },
  { value: 'student', labelKey: 'persona_student' },
];

// ─── Login modal ──────────────────────────────────────────────────────────────
function LoginModal({
  onVerify,
  onClose,
  t,
}: {
  onVerify: (email: string, persona: string) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [persona, setPersona] = useState('student');
  const [codeSent, setCodeSent] = useState(false);

  const canVerify = email.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[420px] px-10 py-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-2 mb-5">
            <EducationIcon />
            <span className="text-lg font-bold text-gray-900">{t('app_name')}</span>
          </div>
          <h2 className="text-base font-semibold text-gray-800">{t('invite_verify_email')}</h2>
        </div>
        {/* Email */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('invite_email_placeholder')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {/* Code row */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={t('invite_code_placeholder')}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => setCodeSent(true)}
            disabled={!email.trim()}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              !email.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : codeSent
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {codeSent ? t('invite_sent') : t('invite_send')}
          </button>
        </div>
        {/* Persona picker */}
        <div className="relative mb-4">
          <select
            value={persona}
            onChange={e => setPersona(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            {PERSONA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {/* Checkboxes */}
        <div className="space-y-2.5 mb-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={e => setKeepLoggedIn(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-600">{t('invite_keep_logged_in')}</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={e => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-600">
              Agree to{' '}
              <a href="#" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                {t('invite_privacy_policy')}
              </a>{' '}
              <a href="#" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                {t('invite_terms_of_service')}
              </a>
            </span>
          </label>
        </div>
        {/* Verify button */}
        <button
          onClick={() => canVerify && onVerify(email.trim(), persona)}
          disabled={!canVerify}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
            canVerify ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-300 text-white cursor-not-allowed'
          }`}
        >
          {t('invite_verify')}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type View = 'login' | 'join' | 'success';

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const t = createT(getStoredLanguage());

  const invite = code ? loadInvite(code) : null;

  const [view, setView] = useState<View>('login');
  const [userEmail, setUserEmail] = useState('');
  const [persona, setPersona] = useState('student');

  function handleVerify(email: string, p: string) {
    setUserEmail(email);
    setPersona(p);
    setView('join');
  }

  function handleJoin() {
    setView('success');
  }

  function handleOpenTced() {
    if (persona === 'teacher') {
      navigate('/teacher/group');
    } else if (persona === 'student') {
      navigate('/student/group');
    } else {
      navigate('/student/group');
    }
  }

  // ── Login view ──────────────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div className="min-h-screen flex flex-col" style={gridBg}>
        <Header t={t} />
        {/* Blurred background card */}
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          {invite ? (
            <div className="bg-white/60 rounded-2xl shadow-xl px-10 py-10 w-full max-w-md flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-5">
                <span className="text-xl font-bold text-blue-600 select-none">
                  {invite.inviterName.slice(0, 2).toLowerCase()}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-1">{invite.inviterName} {t('invite_to_join')}</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{invite.groupName}</h2>
              <p className="text-sm text-gray-400">{invite.expiryDate} {t('invite_expired')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl px-10 py-12 w-full max-w-sm flex flex-col items-center text-center">
              <div className="text-4xl mb-4">🔗</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('invite_not_found')}</h2>
              <p className="text-sm text-gray-500">{t('invite_not_found_msg')}</p>
            </div>
          )}
        </div>
        {invite && (
          <LoginModal
            t={t}
            onVerify={handleVerify}
            onClose={() => {/* keep open for demo */}}
          />
        )}
      </div>
    );
  }

  // ── Join view ───────────────────────────────────────────────────────────────
  if (view === 'join') {
    return (
      <div className="min-h-screen flex flex-col" style={gridBg}>
        <Header userEmail={userEmail} t={t} />
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="bg-white rounded-2xl shadow-xl px-10 py-10 w-full max-w-md flex flex-col items-center text-center">
            {/* Inviter avatar */}
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-5">
              <span className="text-xl font-bold text-blue-600 select-none">
                {(invite?.inviterName ?? 'u').slice(0, 2).toLowerCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              {invite?.inviterName ?? ''} {t('invite_to_join')}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{invite?.groupName ?? ''}</h2>
            <p className="text-sm text-gray-400 mb-8">{invite?.expiryDate ?? ''} {t('invite_expired')}</p>
            <button
              onClick={handleJoin}
              className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {t('invite_join_now')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success view ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={gridBg}>
      <Header userEmail={userEmail} t={t} />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="bg-white rounded-2xl shadow-xl px-10 py-12 w-full max-w-md flex flex-col items-center text-center">
          {/* Tick icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-500 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{invite?.groupName ?? ''}</h2>
          <p className="text-blue-600 text-sm mb-8">{t('invite_already_joined')}</p>
          <button
            onClick={handleOpenTced}
            className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('invite_open_tced')}
          </button>
        </div>
      </div>
    </div>
  );
}
