import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Eye,
  FileInput,
  FileText,
  Folder,
  Grid,
  Monitor,
  MoreHorizontal,
  Plus,
  Share2,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useRole } from '../context/RoleContext';

interface PersonalFile {
  id: string;
  name: string;
  createdAt: string;
  sizeLabel: string;
  mimeType: string;
  starred: boolean;
}

type ShareTarget = { name: string; createdAt: string; mimeType: string };
type RenameTarget = { fileId: string; name: string };
type DeleteTarget = { fileId: string; name: string };

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6);
}

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sevenDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return formatTimestamp(d);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getFileIconTint(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'text-red-500';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return 'text-emerald-500';
  if (['doc', 'docx'].includes(ext || '')) return 'text-blue-500';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return 'text-purple-500';
  return 'text-slate-500';
}

function normalizeFiles(raw: unknown): PersonalFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Partial<PersonalFile> => typeof e === 'object' && e !== null)
    .map((e, i) => ({
      id: e.id || `pfile-${i}`,
      name: e.name || 'Untitled File',
      createdAt: e.createdAt || formatTimestamp(),
      sizeLabel: e.sizeLabel || '0 B',
      mimeType: e.mimeType || 'application/octet-stream',
      starred: Boolean(e.starred),
    }));
}

const STORAGE_KEY = 'personal-files';

export function PersonalPage() {
  const { role, storageKey } = useRole();
  const PERSONAL_STORAGE_KEY = storageKey(STORAGE_KEY);

  const [files, setFiles] = useState<PersonalFile[]>(() => {
    try {
      const saved = localStorage.getItem(PERSONAL_STORAGE_KEY);
      return normalizeFiles(saved ? JSON.parse(saved) : []);
    } catch {
      return [];
    }
  });

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [moreMenuFileId, setMoreMenuFileId] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [topMoreOpen, setTopMoreOpen] = useState(false);
  const topMoreRef = useRef<HTMLDivElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [sharePreview, setSharePreview] = useState(true);
  const [shareDownload, setShareDownload] = useState(false);
  const [shareSave, setShareSave] = useState(false);
  const [shareEdit, setShareEdit] = useState(false);
  const [shareExpiry, setShareExpiry] = useState<'expired' | 'permanent'>('expired');
  const [shareExpiryDate] = useState(sevenDaysFromNow());
  const [shareUseCode, setShareUseCode] = useState(true);
  const [shareCode] = useState(randomCode());

  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(files));
  }, [files, PERSONAL_STORAGE_KEY]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (uploadRef.current && !uploadRef.current.contains(event.target as Node)) setUploadOpen(false);
      if (newRef.current && !newRef.current.contains(event.target as Node)) setNewOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) setMoreMenuFileId(null);
      if (topMoreRef.current && !topMoreRef.current.contains(event.target as Node)) setTopMoreOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function triggerFileUpload() {
    setUploadOpen(false);
    fileInputRef.current?.click();
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) { event.target.value = ''; return; }
    const uploaded: PersonalFile[] = selected.map((f) => ({
      id: makeId('pfile'),
      name: f.name,
      createdAt: formatTimestamp(),
      sizeLabel: formatBytes(f.size),
      mimeType: f.type || 'application/octet-stream',
      starred: false,
    }));
    setFiles((prev) => [...prev, ...uploaded]);
    event.target.value = '';
  }

  function toggleStar(fileId: string) {
    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, starred: !f.starred } : f));
  }

  function openShare(file: PersonalFile, event?: ReactMouseEvent<HTMLElement>) {
    event?.stopPropagation();
    setShareTarget({ name: file.name, createdAt: file.createdAt, mimeType: file.mimeType });
    setMoreMenuFileId(null);
    setTopMoreOpen(false);
  }

  function openRename(file: PersonalFile) {
    setRenameTarget({ fileId: file.id, name: file.name });
    setRenameInput(file.name);
    setMoreMenuFileId(null);
    setTopMoreOpen(false);
  }

  function confirmRename() {
    const next = renameInput.trim();
    if (!renameTarget || !next) return;
    setFiles((prev) => prev.map((f) => f.id === renameTarget.fileId ? { ...f, name: next } : f));
    setRenameTarget(null);
  }

  function openDelete(file: PersonalFile) {
    setDeleteTarget({ fileId: file.id, name: file.name });
    setMoreMenuFileId(null);
    setTopMoreOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.fileId));
    if (selectedFileId === deleteTarget.fileId) setSelectedFileId(null);
    setDeleteTarget(null);
  }

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;
  const nameHint = `Name doesn't support characters "\\/:*?"<>|", word count no more than 255 characters`;

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelection} />

      <div className="border-b border-gray-200 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">Personal</h1>
          <p className="text-sm text-gray-400 mt-0.5">51.85 MB used | 999.44 TB (Shared education space remaining) available</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={uploadRef}>
            <button
              onClick={() => { setUploadOpen((p) => !p); setNewOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
            {uploadOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button onClick={triggerFileUpload} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <FileText className="w-5 h-5 text-blue-500" /> Upload File
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Folder className="w-5 h-5 text-blue-600" /> Upload Folder
                </button>
              </div>
            )}
          </div>

          <div className="relative" ref={newRef}>
            <button
              onClick={() => { setNewOpen((p) => !p); setUploadOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
            {newOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <FileText className="w-5 h-5 text-blue-500" /> New Document
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Grid className="w-5 h-5 text-green-500" /> New Form
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Monitor className="w-5 h-5 text-orange-400" /> New Presentation
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <FileInput className="w-5 h-5 text-yellow-500" /> Import Template
                </button>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium">
                <Download className="w-4 h-4" /> Download
              </button>
              <button
                onClick={() => { if (selectedFile) openShare(selectedFile); }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Share
              </button>
              <div className="relative" ref={topMoreRef}>
                <button
                  onClick={() => setTopMoreOpen((p) => !p)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  More <ChevronDown className="w-4 h-4" />
                </button>
                {topMoreOpen && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                    <button onClick={() => setTopMoreOpen(false)} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Preview</button>
                    <button
                      onClick={() => { if (selectedFile) toggleStar(selectedFile.id); setTopMoreOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      <span>Starred</span><span className="text-xs text-gray-400">⌘+B</span>
                    </button>
                    <button onClick={() => setTopMoreOpen(false)} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Edit</button>
                    <button
                      onClick={() => { if (selectedFile) openRename(selectedFile); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      <span>Rename</span><span className="text-xs text-gray-400">⌘+G</span>
                    </button>
                    <button
                      onClick={() => { if (selectedFile) openDelete(selectedFile); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                    >
                      <span>Delete</span><span className="text-xs text-gray-400">Del</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => setTopMoreOpen(false)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                      <span>Move to</span><span className="text-xs text-gray-400">⌘+X</span>
                    </button>
                    <button onClick={() => setTopMoreOpen(false)} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                      <span>Copy to</span><span className="text-xs text-gray-400">⌘+C</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => setTopMoreOpen(false)} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Tag Management</button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="ml-auto">
            <button className="p-2 hover:bg-gray-100 rounded-md">
              <Eye className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {files.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
                  <path d="M60 30 L100 30 L130 60 L130 110 L60 110 Z" fill="white" stroke="#e5e7eb" strokeWidth="2" />
                  <line x1="75" y1="50" x2="110" y2="50" stroke="#d1d5db" strokeWidth="2" />
                  <line x1="75" y1="65" x2="110" y2="65" stroke="#d1d5db" strokeWidth="2" />
                  <line x1="75" y1="80" x2="100" y2="80" stroke="#d1d5db" strokeWidth="2" />
                  <path d="M50 80 L30 95 L35 110 L50 105 L55 90 Z" fill="#4ade80" stroke="#22c55e" strokeWidth="2" />
                  <path d="M35 95 L50 85" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-gray-900 font-medium mb-2">No files found</div>
              <div className="text-gray-500 text-sm mb-6">Drag and drop file to upload</div>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={triggerFileUpload}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Upload File
                </button>
                <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                  Upload Folder
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" checked={Boolean(selectedFileId)} readOnly />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        Name <ChevronsUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-56">
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        Last modified <ChevronsUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        Size <ChevronsUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${selectedFileId === file.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => { setSelectedFileId((prev) => (prev === file.id ? null : file.id)); setMoreMenuFileId(null); }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFileId === file.id}
                          readOnly
                          className="rounded border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-5 h-5 ${getFileIconTint(file.name)}`} />
                          <span className="text-gray-800">{file.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStar(file.id); }}
                            className="ml-1 p-0.5 hover:scale-110 transition-transform"
                          >
                            <Star className={`w-4 h-4 ${file.starred ? 'fill-blue-500 text-blue-500' : 'text-blue-400'}`} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{file.createdAt}</td>
                      <td className="px-4 py-3 text-gray-500">{file.sizeLabel}</td>
                      <td className="px-4 py-3">
                        {selectedFileId === file.id && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => openShare(file, e)}
                              className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <div className="relative" ref={moreMenuFileId === file.id ? moreMenuRef : undefined}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setMoreMenuFileId((prev) => (prev === file.id ? null : file.id)); }}
                                className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {moreMenuFileId === file.id && (
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                  <button onClick={(e) => { e.stopPropagation(); setMoreMenuFileId(null); }} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Preview</button>
                                  <button onClick={(e) => { e.stopPropagation(); setMoreMenuFileId(null); }} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Edit</button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openRename(file); }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Rename</span><span className="text-xs text-gray-400">⌘+G</span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleStar(file.id); setMoreMenuFileId(null); }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Starred</span><span className="text-xs text-gray-400">⌘+B</span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openDelete(file); }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                                  >
                                    <span>Delete</span><span className="text-xs text-gray-400">Del</span>
                                  </button>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                                    <span>Move to</span><span className="text-xs text-gray-400">⌘+X</span>
                                  </button>
                                  <button onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                                    <span>Copy to</span><span className="text-xs text-gray-400">⌘+C</span>
                                  </button>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button onClick={(e) => e.stopPropagation()} className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">Tag Management</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 px-6 pb-4 flex items-center justify-between text-sm text-gray-500">
              <span>{files.length} items</span>
              <div className="flex items-center gap-3">
                <select className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-600">
                  <option>20 / page</option>
                </select>
                <button className="text-gray-300">‹</button>
                <button className="w-8 h-8 rounded bg-blue-600 text-white text-sm">1</button>
                <button className="text-gray-300">›</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rename modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Rename</h2>
              <button onClick={() => setRenameTarget(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value.slice(0, 255))}
                onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                autoFocus
                className="flex-1 border border-blue-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">{renameInput.length}/255</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">{nameHint}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={confirmRename} className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[440px] p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Prompt</h2>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-900 font-semibold mb-1 ml-12">{`Sure you want to delete "${deleteTarget.name}"?`}</p>
            <p className="text-gray-500 text-sm mb-6 ml-12">The file will be moved to Mnemonic Recovery. You can retrieve it from Deletion Restore.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareTarget && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Share file/folder</h2>
              <button onClick={() => setShareTarget(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-600">Important or private files with care when sharing. Sharing on the internet must comply with relevant laws and regulations, and may incur legal responsibilities.</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 mb-5">
              <FileText className={`w-8 h-8 flex-shrink-0 ${getFileIconTint(shareTarget.name)}`} />
              <div>
                <div className="text-sm font-medium text-gray-900">{shareTarget.name}</div>
                <div className="text-xs text-gray-400">{shareTarget.createdAt} created by {role === 'teacher' ? 'xiewenkai' : 'wangyifei'}</div>
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Access permission</p>
            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sharePreview} onChange={(e) => setSharePreview(e.target.checked)} className="rounded" />
                <span className="w-20">Preview</span>
                <span className="text-gray-400 text-xs">Number of previews</span>
                <input type="text" placeholder="please enter" className="ml-auto border border-gray-300 rounded px-2 py-1 text-xs w-28" />
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareDownload} onChange={(e) => setShareDownload(e.target.checked)} className="rounded" />
                <span className="w-20">Download</span>
                <span className="text-gray-400 text-xs">Number of downloads</span>
                <input type="text" placeholder="please enter" className="ml-auto border border-gray-300 rounded px-2 py-1 text-xs w-28" />
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareSave} onChange={(e) => setShareSave(e.target.checked)} className="rounded" />
                <span>Save to Education Drive</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareEdit} onChange={(e) => setShareEdit(e.target.checked)} className="rounded" />
                <span>Edit (Login required)</span>
              </label>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expiration date</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" checked={shareExpiry === 'expired'} onChange={() => setShareExpiry('expired')} /> Expired on
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" checked={shareExpiry === 'permanent'} onChange={() => setShareExpiry('permanent')} /> Permanent validity
              </label>
            </div>
            {shareExpiry === 'expired' && (
              <div className="flex items-center gap-2 mb-5">
                <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700">
                  <span>{shareExpiryDate}</span>
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-xs text-gray-400">Expired in 7 days</span>
              </div>
            )}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Security</p>
            <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer mb-5">
              <input type="checkbox" checked={shareUseCode} onChange={(e) => setShareUseCode(e.target.checked)} className="rounded" />
              <span>Set extraction code</span>
              {shareUseCode && (
                <input type="text" defaultValue={shareCode} className="border border-gray-300 rounded px-3 py-1 text-sm w-24 font-mono" />
              )}
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShareTarget(null)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
              <button className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">Create link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
