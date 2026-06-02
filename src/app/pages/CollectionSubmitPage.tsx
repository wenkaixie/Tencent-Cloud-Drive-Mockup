import { CheckCircle, ChevronDown, Layers, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { fileBlobUrls } from '../context/fileBlobStore';
import type { CollectionItem } from './FileCollectionPage';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoredFile {
  id: string; name: string; createdAt: string;
  sizeLabel: string; mimeType: string; starred: boolean;
}
interface StoredFolder {
  id: string; name: string; createdAt: string; starred: boolean;
  files: StoredFile[]; folders: StoredFolder[];
}
interface SubmittedFileMeta {
  name: string; sizeLabel: string; mimeType: string; timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findCollection(id: string): CollectionItem | null {
  for (const prefix of ['student', 'teacher']) {
    try {
      const saved = localStorage.getItem(`${prefix}:collections`);
      const items: CollectionItem[] = saved ? JSON.parse(saved) : [];
      const found = items.find((c) => c.id === id);
      if (found) return found;
    } catch { /* ignore */ }
  }
  return null;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtTs(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatBytes(bytes: number) {
  if (bytes >= 1024*1024) return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${bytes} B`;
}
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/msword',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.ms-powerpoint',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.ms-excel',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}
function fileIconColor(mimeType: string) {
  if (mimeType === 'application/pdf') return 'text-red-500';
  if (mimeType.startsWith('image/')) return 'text-emerald-500';
  if (mimeType.includes('word') || mimeType.includes('doc')) return 'text-blue-500';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'text-green-600';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'text-orange-500';
  return 'text-slate-500';
}

function daysLeft(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Expired';
  return `${days} day${days !== 1 ? 's' : ''} left`;
}
function expiryDisplay(item: CollectionItem) {
  if (item.expirationType === 'permanent') return 'Permanent validity';
  return `${item.expiryDate}  Expired(${daysLeft(item.expiryDate)})`;
}
function namingRulesText(item: CollectionItem) {
  const parts = item.namingSelected.length > 0
    ? [...item.namingSelected, 'Original name of the file']
    : ['Original name of the file'];
  return parts.join('+');
}
function formatReqText(item: CollectionItem) {
  return item.fileFormats.length > 0 ? item.fileFormats.join(', ') : 'None';
}

// ─── Create submission folder in localStorage ─────────────────────────────────
function createSubmissionFolder(item: CollectionItem, folderName: string, files: File[], timestamp: string): StoredFile[] {
  const parts = item.saveFolder.split(' / ').map(s => s.trim());
  const groupName = parts[0];
  const folderPathParts = parts.slice(1); // e.g. ['Students', '26 May Homework Submission']
  if (!groupName || groupName === 'Personal') return [];
  try {
    // Search shared, teacher-private, and student-private group lists
    let group: { id: string; name: string } | undefined;
    for (const key of ['shared:groups', 'teacher:groups', 'student:groups']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr: { id: string; name: string }[] = JSON.parse(raw);
      if (Array.isArray(arr)) { group = arr.find(g => g.name === groupName); if (group) break; }
    }
    if (!group) return [];
    const foldersKey = `shared:folders-${group.id}`;
    const rootFolders: StoredFolder[] = JSON.parse(localStorage.getItem(foldersKey) || '[]');
    const now = timestamp;
    const createdFiles: StoredFile[] = files.map((f, i) => ({
      id: `file-${Date.now()}-${i}`, name: f.name, createdAt: now,
      sizeLabel: formatBytes(f.size), mimeType: getMimeType(f.name), starred: false,
    }));
    const newSubfolder: StoredFolder = {
      id: `submit-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name: folderName, createdAt: now, starred: false,
      files: createdFiles,
      folders: [],
    };

    // Navigate to the correct nested folder and insert the submission there
    function insertAtPath(folders: StoredFolder[], pathParts: string[]): StoredFolder[] {
      if (pathParts.length === 0) {
        // We've reached the destination — insert the submission folder here
        return [...folders, newSubfolder];
      }
      const [current, ...rest] = pathParts;
      let found = false;
      const updated = folders.map(f => {
        if (f.name === current) {
          found = true;
          return { ...f, folders: insertAtPath(f.folders ?? [], rest) };
        }
        return f;
      });
      // If the target folder wasn't found at this level, insert at root as fallback
      if (!found) return [...folders, newSubfolder];
      return updated;
    }

    const updated = insertAtPath(rootFolders, folderPathParts);
    localStorage.setItem(foldersKey, JSON.stringify(updated));
    return createdFiles;
  } catch { /* ignore */ }
  return [];
}

// ─── Education Drive logo icon ───────────────────────────────────────────────
function EducationIcon() {
  return (
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
      <Layers className="w-5 h-5 text-white" />
    </div>
  );
}

// ─── File icon ────────────────────────────────────────────────────────────────
function FileIcon({ mimeType }: { mimeType: string }) {
  return (
    <svg className={`w-5 h-5 flex-shrink-0 ${fileIconColor(mimeType)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  );
}

// ─── Shared header ────────────────────────────────────────────────────────────
function Header({ userEmail }: { userEmail?: string }) {
  return (
    <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
      <div className="px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <EducationIcon />
          <span className="text-base font-bold text-gray-900 tracking-wide">Education Drive</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#" className="text-sm text-gray-600 hover:text-blue-600">Client Download</a>
          <span className="text-gray-300 select-none">|</span>
          <a href="#" className="text-sm text-gray-600 hover:text-blue-600">TCED Website</a>
          {!userEmail && (
            <>
              <span className="text-gray-300 select-none">|</span>
              <a href="#" className="text-sm text-gray-600 hover:text-blue-600">Registration</a>
            </>
          )}
          {userEmail ? (
            <div className="flex items-center gap-1.5 ml-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span className="font-medium">{userEmail}</span>
            </div>
          ) : (
            <button className="ml-2 px-5 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
              Login
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

// ─── Grid background ──────────────────────────────────────────────────────────
const gridBg: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  backgroundImage: 'repeating-linear-gradient(135deg, #cbd5e1 0, #cbd5e1 1px, transparent 0, transparent 50%)',
  backgroundSize: '20px 20px',
};

// ─── Persona options ──────────────────────────────────────────────────────────
const PERSONA_OPTIONS = [
  { value: 'guest', label: 'Guest' },
  { value: 'teacher', label: 'Teacher — xiewenkai' },
  { value: 'student', label: 'Student — wangyifei' },
];

// ─── Verify modal ─────────────────────────────────────────────────────────────
function VerifyModal({ onVerify, onClose }: {
  onVerify: (email: string, persona: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [persona, setPersona] = useState('guest');
  const [codeSent, setCodeSent] = useState(false);

  const canVerify = email.trim().length > 0;

  function handleVerify() {
    if (!canVerify) return;
    onVerify(email.trim(), persona);
  }

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
            <span className="text-lg font-bold text-gray-900">Education Drive</span>
          </div>
          <h2 className="text-base font-semibold text-gray-800">Please verify your email address</h2>
        </div>
        {/* Email */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter email address"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {/* Email code */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Email code"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => setCodeSent(true)}
            disabled={!email.trim()}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              !email.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : codeSent ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {codeSent ? 'Sent ✓' : 'Send'}
          </button>
        </div>
        {/* Persona */}
        <div className="relative mb-4">
          <select
            value={persona}
            onChange={e => setPersona(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            {PERSONA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {/* Checkboxes */}
        <div className="space-y-2.5 mb-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={keepLoggedIn} onChange={e => setKeepLoggedIn(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-600">Keep logged in for 1 day</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-600">
              Agree to 
              <a href="#" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>《Privacy Policy》</a>
               
              <a href="#" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>《Terms of Service》</a>
            </span>
          </label>
        </div>
        {/* Verify */}
        <button
          onClick={handleVerify}
          disabled={!canVerify}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
            canVerify ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-300 text-white cursor-not-allowed'
          }`}
        >
          Verify
        </button>
      </div>
    </div>
  );
}

// ─── Landing view ─────────────────────────────────────────────────────────────
function LandingView({ item, onLoginClick }: { item: CollectionItem | null; onLoginClick: () => void }) {
  return (
    <div className="min-h-screen flex flex-col" style={gridBg}>
      <Header loggedIn={false} />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        {item ? (
          <div className="bg-white rounded-2xl shadow-xl px-10 py-10 w-full max-w-md flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-5">
              <span className="text-2xl font-bold text-blue-600 select-none">
                {(item.title[0] ?? 'u').toLowerCase()}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h2>
            <p className="text-sm text-gray-500 mb-6">
              {item.creator ?? 'user'} created &nbsp;|&nbsp; {expiryDisplay(item)}
            </p>
            <div className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 mb-7 bg-gray-50">
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Naming rules: {namingRulesText(item)}</li>
              </ul>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={onLoginClick} className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                Member Login
              </button>
              <button onClick={onLoginClick} className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                Guest Login
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl px-10 py-12 w-full max-w-sm flex flex-col items-center text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Collection not found</h2>
            <p className="text-sm text-gray-500">This collection link may have expired or been removed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workspace view ───────────────────────────────────────────────────────────
function WorkspaceView({ item, userEmail }: { item: CollectionItem | null; userEmail: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submittedMeta, setSubmittedMeta] = useState<SubmittedFileMeta[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'submitted'>('pending');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const MAX_FILES = 30;
  const remaining = Math.max(0, MAX_FILES - submittedMeta.length);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    setPendingFiles(prev => [...prev, ...arr].slice(0, remaining));
  }
  function removeFile(idx: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!item || pendingFiles.length === 0) return;
    const fieldValues = item.namingSelected
      .map(f => (formFields[f] ?? '').trim())
      .filter(v => v.length > 0);
    const folderName = fieldValues.length > 0 ? fieldValues.join('-') : `Submission-${Date.now()}`;
    const ts = fmtTs();
    const createdFiles = createSubmissionFolder(item, folderName, pendingFiles, ts);
    // Register blob URLs so the teacher can preview these files in GroupDetailView
    createdFiles.forEach((storedFile, i) => {
      const original = pendingFiles[i];
      if (original) fileBlobUrls.set(storedFile.id, URL.createObjectURL(original));
    });
    setSubmittedMeta(prev => [...prev, ...pendingFiles.map(f => ({
      name: f.name, sizeLabel: formatBytes(f.size), mimeType: getMimeType(f.name), timestamp: ts,
    }))]);
    setPendingFiles([]);
    setSubmitted(true);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
  }

  function continueUploading() {
    setSubmitted(false);
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col" style={gridBg}>
        <Header userEmail={userEmail} />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
            <p className="text-gray-500">Collection not found.</p>
          </div>
        </div>
      </div>
    );
  }

  const namingFields = item.namingSelected;

  return (
    <div className="min-h-screen flex flex-col" style={gridBg}>
      <Header userEmail={userEmail} />

      {/* Upload success toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-white border border-green-200 shadow-lg rounded-full px-5 py-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800">File upload successful!</span>
          <button onClick={() => setShowToast(false)} className="ml-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collection info bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-blue-600 select-none">
              {(item.title[0] ?? 'u').toLowerCase()}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{item.title}</h1>
            <p className="text-xs text-gray-500">
              {item.creator ?? 'user'} created &nbsp;|&nbsp; {expiryDisplay(item)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={submitted}
            onClick={() => !submitted && fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${submitted ? 'bg-green-200 text-green-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7 7 7M12 3v14"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 20h14"/>
            </svg>
            Add
          </button>
          <button
            disabled={pendingFiles.length === 0 || submitted}
            onClick={handleSubmit}
            className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${pendingFiles.length === 0 || submitted ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-auto">
        {/* Left panel */}
        <div className="w-[320px] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto px-6 py-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Collection requirements</h3>
          <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 mb-6">
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex gap-2">
                <span className="text-gray-400 flex-shrink-0">•</span>
                <span>Naming rules: {namingRulesText(item)}</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400 flex-shrink-0">•</span>
                <span>Format requirements: {formatReqText(item)}</span>
              </li>
            </ul>
          </div>
          {namingFields.map(field => (
            <div key={field} className="mb-5">
              <label className="block text-sm font-medium text-gray-800 mb-1.5">{field}</label>
              <input
                type="text"
                value={formFields[field] ?? ''}
                onChange={e => setFormFields(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder="Required field"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-transparent min-w-0">
          {/* Tabs */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6">
            <div className="flex">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-1 py-3 text-sm font-medium border-b-2 mr-8 transition-colors whitespace-nowrap ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                To be submitted ({pendingFiles.length} / {remaining})
              </button>
              <button
                onClick={() => setActiveTab('submitted')}
                className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'submitted' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                My submission ({submittedMeta.length})
              </button>
            </div>
          </div>

          {/* File area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {activeTab === 'pending' && (
              <>
                {pendingFiles.length > 0 && !submitted && (
                  <div className="mb-4 space-y-2">
                    {pendingFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-200 px-4 py-2.5">
                        <FileIcon mimeType={getMimeType(file.name)} />
                        <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(file.size)}</span>
                        <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0 p-0.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {submitted ? (
                  /* Success state */
                  <div
                    className="min-h-64 rounded-lg border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-4"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); continueUploading(); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
                  >
                    <svg className="w-16 h-16 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <p className="text-sm text-gray-500">Submission successful</p>
                    <p className="text-sm">
                      <button onClick={continueUploading} className="text-blue-600 hover:underline font-medium">
                        Continue uploading
                      </button>
                      <span className="text-gray-400"> &nbsp;/&nbsp; Drop to this area</span>
                    </p>
                  </div>
                ) : (
                  /* Upload zone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
                    className={`min-h-64 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'}`}
                  >
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="text-blue-600 font-medium">Click to add</span>
                      <span className="text-gray-400"> &nbsp;/&nbsp; Drop to this area</span>
                    </p>
                    <p className="text-xs text-gray-400">Limit {remaining} files, folder upload is not supported</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'submitted' && (
              submittedMeta.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-64 text-gray-400 gap-3">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span className="text-sm">No submitted files yet</span>
                </div>
              ) : (
                <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                  {submittedMeta.map((f, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < submittedMeta.length-1 ? 'border-b border-gray-100' : ''}`}>
                      <FileIcon mimeType={f.mimeType} />
                      <span className="flex-1 text-sm text-gray-800 truncate">{f.name}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{f.sizeLabel} | {f.timestamp}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={item.fileFormats.length > 0
          ? item.fileFormats.map(f => {
              const map: Record<string, string> = { Word: '.doc,.docx', PPT: '.ppt,.pptx', Excel: '.xls,.xlsx', PDF: '.pdf' };
              return map[f] ?? '';
            }).join(',')
          : '*'
        }
        className="hidden"
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
      />
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export function CollectionSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const item = id ? findCollection(id) : null;
  const [pageState, setPageState] = useState<'landing' | 'verify' | 'workspace'>('landing');
  const [userEmail, setUserEmail] = useState('');

  function handleVerify(email: string, _persona: string) {
    setUserEmail(email);
    setPageState('workspace');
  }

  if (pageState === 'workspace') {
    return <WorkspaceView item={item} userEmail={userEmail} />;
  }
  return (
    <>
      <LandingView item={item} onLoginClick={() => setPageState('verify')} />
      {pageState === 'verify' && (
        <VerifyModal onVerify={handleVerify} onClose={() => setPageState('landing')} />
      )}
    </>
  );
}
