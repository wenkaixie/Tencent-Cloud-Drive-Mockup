import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Download,
  Eye,
  FileInput,
  FileText,
  Folder,
  Grid,
  Megaphone,
  Monitor,
  MoreHorizontal,
  Plus,
  Share2,
  Star,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useRole } from '../context/RoleContext';
import { ROLE_PERMISSIONS, type GroupMember, type MemberRole } from './GroupListView';

interface FileItem {
  id: string;
  name: string;
  createdAt: string;
  sizeLabel: string;
  mimeType: string;
  starred: boolean;
  caption?: string;
  uploader?: string;
}

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  starred: boolean;
  files: FileItem[];
  folders: FolderItem[];
  isGroup?: boolean;
}

type RawFolderItem = Partial<FolderItem> & {
  name?: string;
  createdAt?: string;
  starred?: boolean;
  files?: Partial<FileItem>[];
};

type ShareTarget =
  | { kind: 'folder'; name: string; createdAt: string }
  | { kind: 'file'; name: string; createdAt: string; mimeType: string };

type RenameTarget =
  | { kind: 'folder'; folderId: string; name: string }
  | { kind: 'file'; fileId: string; name: string };

type DeleteTarget =
  | { kind: 'folder'; folderId: string; name: string }
  | { kind: 'file'; fileId: string; name: string };

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

// Stores blob URLs for in-session file preview (cleared on page refresh)
const fileBlobUrls = new Map<string, string>();

function sevenDaysFromNow() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatTimestamp(date);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function normalizeFolders(raw: unknown): FolderItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is RawFolderItem => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      id: entry.id || `folder-${index}-${entry.name || 'untitled'}`,
      name: entry.name || 'Untitled Folder',
      createdAt: entry.createdAt || formatTimestamp(),
      starred: Boolean(entry.starred),
      isGroup: Boolean((entry as { isGroup?: boolean }).isGroup),
      files: Array.isArray(entry.files)
        ? entry.files.map((file, fileIndex) => ({
            id: file.id || `file-${index}-${fileIndex}-${file.name || 'untitled'}`,
            name: file.name || 'Untitled File',
            createdAt: file.createdAt || entry.createdAt || formatTimestamp(),
            sizeLabel: file.sizeLabel || '0 B',
            mimeType: file.mimeType || 'application/octet-stream',
            starred: Boolean(file.starred),
            caption: file.caption,
            uploader: file.uploader,
          }))
        : [],
      folders: normalizeFolders(entry.folders),
    }));
}

function getFileIconTint(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') {
    return 'text-red-500';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension || '')) {
    return 'text-emerald-500';
  }
  if (['doc', 'docx'].includes(extension || '')) {
    return 'text-blue-500';
  }
  return 'text-slate-500';
}

function getFolderAtPath(root: FolderItem[], path: string[]): FolderItem | null {
  if (path.length === 0) return null;
  const folder = root.find((f) => f.id === path[0]);
  if (!folder) return null;
  if (path.length === 1) return folder;
  return getFolderAtPath(folder.folders, path.slice(1));
}

function updateFolderAtPath(
  root: FolderItem[],
  path: string[],
  updater: (f: FolderItem) => FolderItem,
): FolderItem[] {
  if (path.length === 0) return root;
  return root.map((f) => {
    if (f.id !== path[0]) return f;
    if (path.length === 1) return updater(f);
    return { ...f, folders: updateFolderAtPath(f.folders, path.slice(1), updater) };
  });
}

function getBreadcrumbFolders(
  root: FolderItem[],
  pathIds: string[],
): { name: string; pathUpTo: string }[] {
  const result: { name: string; pathUpTo: string }[] = [];
  let current = root;
  for (let i = 0; i < pathIds.length; i++) {
    const folder = current.find((f) => f.id === pathIds[i]);
    if (!folder) break;
    result.push({ name: folder.name, pathUpTo: pathIds.slice(0, i + 1).join('/') });
    current = folder.folders;
  }
  return result;
}

export function GroupDetailView() {
  const navigate = useNavigate();
  const { role, storageKey, sharedKey, basePath } = useRole();
  const { groupId, '*': splatPath } = useParams();
  const pathSegments = (splatPath ?? '').split('/').filter(Boolean);
  const location = useLocation();
  const groupName: string =
    (location.state as { groupName?: string } | null)?.groupName ??
    (groupId
      ? groupId.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Group');

  // ── Authorization: determine current user's effective permissions ─────────
  const currentUsername = role === 'teacher' ? 'xiewenkai' : 'wangyifei';
  const effectivePerms = (() => {
    try {
      const saved = localStorage.getItem(sharedKey('groups'));
      const groups = saved ? JSON.parse(saved) : [];
      if (Array.isArray(groups)) {
        const group = groups.find((g: { id?: string }) => g.id === groupId);
        const members: GroupMember[] = Array.isArray(group?.members) ? group.members : [];
        const member = members.find((m: GroupMember) => m.username === currentUsername);
        if (member?.isOwner) return { ...ROLE_PERMISSIONS['Editor'], isOwner: true };
        if (member) return { ...ROLE_PERMISSIONS[member.role as MemberRole], isOwner: false };
      }
    } catch {}
    // Teacher defaults to owner; student defaults to Viewer
    return role === 'teacher'
      ? { ...ROLE_PERMISSIONS['Editor'], isOwner: true }
      : { ...ROLE_PERMISSIONS['Viewer'], isOwner: false };
  })();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);

  const [uploadFileModalOpen, setUploadFileModalOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');

  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const saved = localStorage.getItem(sharedKey(`folders-${groupId}`));
      return normalizeFolders(saved ? JSON.parse(saved) : []);
    } catch {
      return [];
    }
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [folderInput, setFolderInput] = useState('New Folder');

  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [groupInput, setGroupInput] = useState('New Group');

  const [moreMenuItemKey, setMoreMenuItemKey] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [topMoreOpen, setTopMoreOpen] = useState(false);
  const topMoreRef = useRef<HTMLDivElement>(null);

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
  const [detailsFolder, setDetailsFolder] = useState<FolderItem | null>(null);

  // ── Announcements ────────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<{id:string; text:string; author:string; createdAt:string}[]>(() => {
    try { const s = localStorage.getItem(sharedKey(`announcements-${groupId}`)); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [newAnnouncementOpen, setNewAnnouncementOpen] = useState(false);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [pastAnnouncementsOpen, setPastAnnouncementsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = pathSegments.length > 0 ? getFolderAtPath(folders, pathSegments) : null;

  useEffect(() => {
    localStorage.setItem(sharedKey(`folders-${groupId}`), JSON.stringify(folders));
  }, [folders, groupId, sharedKey]);

  useEffect(() => {
    localStorage.setItem(sharedKey(`announcements-${groupId}`), JSON.stringify(announcements));
  }, [announcements, groupId, sharedKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (uploadRef.current && !uploadRef.current.contains(event.target as Node)) {
        setUploadOpen(false);
      }
      if (newRef.current && !newRef.current.contains(event.target as Node)) {
        setNewOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuItemKey(null);
      }
      if (topMoreRef.current && !topMoreRef.current.contains(event.target as Node)) {
        setTopMoreOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openNewFolderModal() {
    setNewOpen(false);
    setFolderInput('New Folder');
    setNewFolderModalOpen(true);
  }

  function openNewGroupModal() {
    setNewOpen(false);
    setGroupInput('New Group');
    setNewGroupModalOpen(true);
  }

  function confirmNewGroup() {
    const nextName = groupInput.trim();
    if (!nextName) {
      return;
    }

    const newGroup: FolderItem = {
      id: makeId('group'),
      name: nextName,
      createdAt: formatTimestamp(),
      starred: false,
      isGroup: true,
      files: [],
      folders: [],
    };
    setFolders((previous) => {
      if (pathSegments.length === 0) {
        return [...previous, newGroup];
      }
      return updateFolderAtPath(previous, pathSegments, (f) => ({
        ...f,
        folders: [...f.folders, newGroup],
      }));
    });
    setNewGroupModalOpen(false);
  }

  function confirmNewFolder() {
    const nextName = folderInput.trim();
    if (!nextName) {
      return;
    }

    const newFolder: FolderItem = {
      id: makeId('folder'),
      name: nextName,
      createdAt: formatTimestamp(),
      starred: false,
      files: [],
      folders: [],
    };
    setFolders((previous) => {
      if (pathSegments.length === 0) {
        return [...previous, newFolder];
      }
      return updateFolderAtPath(previous, pathSegments, (f) => ({
        ...f,
        folders: [...f.folders, newFolder],
      }));
    });
    setNewFolderModalOpen(false);
  }

  function toggleStar(folderId: string) {
    setFolders((previous) => {
      if (pathSegments.length === 0) {
        return previous.map((folder) =>
          folder.id === folderId ? { ...folder, starred: !folder.starred } : folder,
        );
      }
      return updateFolderAtPath(previous, pathSegments, (f) => ({
        ...f,
        folders: f.folders.map((sub) =>
          sub.id === folderId ? { ...sub, starred: !sub.starred } : sub,
        ),
      }));
    });
  }

  function openFolder(folder: FolderItem, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const newPath = [...pathSegments, folder.id].join('/');
    navigate(`${basePath}/group/${groupId}/${newPath}`, { state: { groupName } });
  }

  function openShareFolder(folder: FolderItem, event?: ReactMouseEvent<HTMLElement>) {
    event?.stopPropagation();
    setShareTarget({ kind: 'folder', name: folder.name, createdAt: folder.createdAt });
    setMoreMenuItemKey(null);
  }

  function openShareFile(file: FileItem, event?: ReactMouseEvent<HTMLElement>) {
    event?.stopPropagation();
    setShareTarget({ kind: 'file', name: file.name, createdAt: file.createdAt, mimeType: file.mimeType });
    setMoreMenuItemKey(null);
  }

  function openMore(itemKey: string, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setMoreMenuItemKey((previous) => (previous === itemKey ? null : itemKey));
  }

  function openRenameFolder(folder: FolderItem) {
    setRenameTarget({ kind: 'folder', folderId: folder.id, name: folder.name });
    setRenameInput(folder.name);
    setMoreMenuItemKey(null);
  }

  function openRenameFile(file: FileItem) {
    setRenameTarget({ kind: 'file', fileId: file.id, name: file.name });
    setRenameInput(file.name);
    setMoreMenuItemKey(null);
  }

  function confirmRename() {
    const nextName = renameInput.trim();
    if (!renameTarget || !nextName) {
      return;
    }

    if (renameTarget.kind === 'folder') {
      setFolders((previous) => {
        if (pathSegments.length === 0) {
          return previous.map((f) =>
            f.id === renameTarget.folderId ? { ...f, name: nextName } : f,
          );
        }
        return updateFolderAtPath(previous, pathSegments, (f) => ({
          ...f,
          folders: f.folders.map((sub) =>
            sub.id === renameTarget.folderId ? { ...sub, name: nextName } : sub,
          ),
        }));
      });
    } else {
      setFolders((previous) => {
        if (pathSegments.length === 0) return previous;
        return updateFolderAtPath(previous, pathSegments, (f) => ({
          ...f,
          files: f.files.map((file) =>
            file.id === renameTarget.fileId ? { ...file, name: nextName } : file,
          ),
        }));
      });
    }
    setRenameTarget(null);
  }

  function openDeleteFolder(folder: FolderItem) {
    setDeleteTarget({ kind: 'folder', folderId: folder.id, name: folder.name });
    setMoreMenuItemKey(null);
  }

  function openDeleteFile(file: FileItem) {
    setDeleteTarget({ kind: 'file', fileId: file.id, name: file.name });
    setMoreMenuItemKey(null);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.kind === 'folder') {
      setFolders((previous) => {
        if (pathSegments.length === 0) {
          return previous.filter((f) => f.id !== deleteTarget.folderId);
        }
        return updateFolderAtPath(previous, pathSegments, (f) => ({
          ...f,
          folders: f.folders.filter((sub) => sub.id !== deleteTarget.folderId),
        }));
      });
      if (selectedFolderId === deleteTarget.folderId) {
        setSelectedFolderId(null);
      }
      if (pathSegments[pathSegments.length - 1] === deleteTarget.folderId) {
        const parentPath = pathSegments.slice(0, -1).join('/');
        if (parentPath) {
          navigate(`${basePath}/group/${groupId}/${parentPath}`, { state: { groupName } });
        } else {
          navigate(`${basePath}/group/${groupId}`, { state: { groupName } });
        }
      }
    } else {
      setFolders((previous) => {
        if (pathSegments.length === 0) return previous;
        return updateFolderAtPath(previous, pathSegments, (f) => ({
          ...f,
          files: f.files.filter((file) => file.id !== deleteTarget.fileId),
        }));
      });
      if (selectedFileId === deleteTarget.fileId) {
        setSelectedFileId(null);
      }
    }
    setDeleteTarget(null);
  }

  function openDetails(folder: FolderItem) {
    setDetailsFolder(folder);
    setMoreMenuItemKey(null);
  }

  function triggerFileUpload() {
    setUploadOpen(false);
    setUploadCaption('');
    setPendingUploadFiles([]);
    setUploadFileModalOpen(true);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setPendingUploadFiles(selectedFiles);
    }
    event.target.value = '';
  }

  function confirmUpload() {
    if (pendingUploadFiles.length === 0) return;

    const caption = uploadCaption.trim() || undefined;

    const uploadedFiles: FileItem[] = pendingUploadFiles.map((file) => {
      const id = makeId('file');
      fileBlobUrls.set(id, URL.createObjectURL(file));
      return {
        id,
        name: file.name,
        createdAt: formatTimestamp(),
        sizeLabel: formatBytes(file.size),
        mimeType: file.type || 'application/octet-stream',
        starred: false,
        caption,
        uploader: currentUsername,
      };
    });

    if (pathSegments.length > 0) {
      setFolders((previous) =>
        updateFolderAtPath(previous, pathSegments, (f) => ({
          ...f,
          files: [...f.files, ...uploadedFiles],
        })),
      );
    } else if (selectedFolderId) {
      setFolders((previous) =>
        previous.map((folder) =>
          folder.id === selectedFolderId
            ? { ...folder, files: [...folder.files, ...uploadedFiles] }
            : folder,
        ),
      );
    } else {
      setFolders((previous) => {
        const existing = previous.find((f) => f.id === 'uploads');
        if (existing) {
          return previous.map((f) =>
            f.id === 'uploads' ? { ...f, files: [...f.files, ...uploadedFiles] } : f,
          );
        }
        const uploadsFolder: FolderItem = {
          id: 'uploads',
          name: 'Uploads',
          createdAt: formatTimestamp(),
          starred: false,
          files: uploadedFiles,
          folders: [],
        };
        return [...previous, uploadsFolder];
      });
    }

    setUploadFileModalOpen(false);
    setUploadCaption('');
    setPendingUploadFiles([]);
  }

  function previewFile(file: FileItem) {
    const url = fileBlobUrls.get(file.id);
    if (!url) return;

    const mimeType = file.mimeType;
    const isPdf   = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const isText  = mimeType.startsWith('text/');

    const safeName = file.name
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Split closing script tag so the template literal doesn't confuse parsers
    const scriptClose = '</' + 'script>';

    let bodyContent: string;
    if (isPdf) {
      // PDF.js renders PDFs via <canvas> — works in VS Code Simple Browser and all real browsers
      bodyContent = `
        <div id="pdf-wrap" style="flex:1;overflow-y:auto;padding:20px 0;display:flex;flex-direction:column;align-items:center;gap:16px;"></div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js">${scriptClose}
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          pdfjsLib.getDocument('${url}').promise.then(function(pdf){
            var wrap=document.getElementById('pdf-wrap');
            for(var i=1;i<=pdf.numPages;i++){(function(n){
              pdf.getPage(n).then(function(page){
                var scale=Math.min(1.5,(window.innerWidth-60)/page.getViewport({scale:1}).width);
                var vp=page.getViewport({scale:scale});
                var div=document.createElement('div');
                div.style.cssText='background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.5);';
                var canvas=document.createElement('canvas');
                canvas.width=vp.width; canvas.height=vp.height;
                div.appendChild(canvas); wrap.appendChild(div);
                page.render({canvasContext:canvas.getContext('2d'),viewport:vp});
              });
            })(i);}
          }).catch(function(e){
            document.getElementById('pdf-wrap').innerHTML='<p style="color:#ccc;padding:40px;font-family:sans-serif;">Could not render PDF: '+e.message+'</p>';
          });
        ${scriptClose}`;
    } else if (isImage) {
      bodyContent = `<div style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:20px;">
        <img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 2px 12px rgba(0,0,0,0.4);">
      </div>`;
    } else if (isVideo) {
      bodyContent = `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;background:#000;">
        <video src="${url}" controls style="max-width:100%;max-height:100%;"></video>
      </div>`;
    } else if (isAudio) {
      bodyContent = `<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#1a1a1a;">
        <audio src="${url}" controls style="width:80%;max-width:500px;"></audio>
      </div>`;
    } else if (isText) {
      bodyContent = `<iframe src="${url}" style="flex:1;width:100%;height:calc(100vh - 40px);border:none;background:#fff;"></iframe>`;
    } else {
      bodyContent = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ccc;gap:12px;font-family:sans-serif;">
        <p style="font-size:14px;">This file type cannot be previewed in the browser.</p>
        <a href="${url}" download="${safeName}" style="color:#60a5fa;text-decoration:none;font-size:14px;">&#11015; Download file</a>
      </div>`;
    }

    const htmlContent = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"><title>${safeName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#525659;font-family:-apple-system,BlinkMacSystemFont,sans-serif;height:100vh;display:flex;flex-direction:column;}
    .bar{background:#323639;color:#fff;padding:10px 16px;font-size:13px;display:flex;align-items:center;gap:12px;flex-shrink:0;min-height:40px;}
    .name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .badge{background:rgba(255,255,255,0.15);border-radius:4px;padding:2px 8px;font-size:11px;flex-shrink:0;}
    .dl{color:#60a5fa;font-size:12px;text-decoration:none;flex-shrink:0;}
  </style>
</head><body>
  <div class="bar">
    <span class="name">${safeName}</span>
    <span class="badge">${mimeType}</span>
    <a class="dl" href="${url}" download="${safeName}">&#11015; Download</a>
  </div>
  ${bodyContent}
</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
  }

  function handleBack() {
    if (pathSegments.length > 0) {
      const parentPath = pathSegments.slice(0, -1).join('/');
      if (parentPath) {
        navigate(`${basePath}/group/${groupId}/${parentPath}`, { state: { groupName } });
      } else {
        navigate(`${basePath}/group/${groupId}`, { state: { groupName } });
      }
      return;
    }
    navigate(`${basePath}/group`);
  }

  function toggleFileStar(fileId: string) {
    if (pathSegments.length === 0) return;
    setFolders((previous) =>
      updateFolderAtPath(previous, pathSegments, (f) => ({
        ...f,
        files: f.files.map((file) =>
          file.id === fileId ? { ...file, starred: !file.starred } : file,
        ),
      })),
    );
  }

  const nameHint = `Name doesn't support characters "\\/:*?"<>|", word count no more than 255 characters`;

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelection}
      />

      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 overflow-hidden">
          <button onClick={handleBack} className="hover:bg-gray-100 rounded p-1">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(`${basePath}/group`)} className="text-gray-400 hover:text-gray-600">
            Group
          </button>
          <span className="text-gray-400">›</span>
          <button
            onClick={() => navigate(`${basePath}/group/${groupId}`, { state: { groupName } })}
            className={pathSegments.length > 0 ? 'text-gray-400 hover:text-gray-600' : 'text-gray-900 font-semibold cursor-default'}
          >
            {groupName}
          </button>
          {getBreadcrumbFolders(folders, pathSegments).map(({ name, pathUpTo }, i) => (
            <Fragment key={pathUpTo}>
              <span className="text-gray-400">›</span>
              {i < pathSegments.length - 1 ? (
                <button
                  onClick={() => navigate(`${basePath}/group/${groupId}/${pathUpTo}`, { state: { groupName } })}
                  className="text-gray-400 hover:text-gray-600 truncate max-w-[180px]"
                >
                  {name}
                </button>
              ) : (
                <span className="text-gray-900 font-semibold truncate max-w-[180px]">{name}</span>
              )}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {effectivePerms.canUpload && (
          <div className="relative" ref={uploadRef}>
            <button
              onClick={() => {
                setUploadOpen((previous) => !previous);
                setNewOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
            {uploadOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={triggerFileUpload}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <FileText className="w-5 h-5 text-blue-500" />
                  Upload File
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Folder className="w-5 h-5 text-blue-600" />
                  Upload Folder
                </button>
              </div>
            )}
          </div>
          )}

          {effectivePerms.canEdit && (
          <div className="relative" ref={newRef}>
            <button
              onClick={() => {
                setNewOpen((previous) => !previous);
                setUploadOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
            {newOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={openNewFolderModal}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Folder className="w-5 h-5 text-blue-600" />
                  New Folder
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <FileText className="w-5 h-5 text-blue-500" />
                  New Document
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Grid className="w-5 h-5 text-green-500" />
                  New Form
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <Monitor className="w-5 h-5 text-orange-400" />
                  New Presentation
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700">
                  <FileInput className="w-5 h-5 text-yellow-500" />
                  Import Template
                </button>
              </div>
            )}
          </div>
          )}

          {currentFolder && (() => {
            const selectedFile = currentFolder.files.find((f) => f.id === selectedFileId) || null;
            return (
              <>
                {effectivePerms.canDownload && (
                <button
                  onClick={(event) => event.stopPropagation()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                )}
                {effectivePerms.canShare && (
                <button
                  onClick={() => {
                    if (!selectedFile) return;
                    openShareFile(selectedFile);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Share
                </button>
                )}
                {(effectivePerms.canEdit || effectivePerms.canDelete) && (
                <div className="relative" ref={topMoreRef}>
                  <button
                    onClick={() => setTopMoreOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                  >
                    More <ChevronDown className="w-4 h-4" />
                  </button>
                  {topMoreOpen && (
                    <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                      {effectivePerms.canEdit && (
                      <button
                        onClick={() => {
                          if (selectedFile) previewFile(selectedFile);
                          setTopMoreOpen(false);
                        }}
                        className={`w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm ${selectedFile && fileBlobUrls.has(selectedFile.id) ? 'text-gray-700' : 'text-gray-400'}`}
                      >
                        Preview{selectedFile && !fileBlobUrls.has(selectedFile.id) && <span className="ml-auto text-xs text-gray-400">(upload again)</span>}
                      </button>
                      )}
                      {effectivePerms.canEdit && (
                      <button
                        onClick={() => {
                          if (selectedFile) {
                            toggleFileStar(selectedFile.id);
                          }
                          setTopMoreOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        <span>Starred</span>
                        <span className="text-xs text-gray-400">⌘+B</span>
                      </button>
                      )}
                      {effectivePerms.canEdit && (
                      <button
                        onClick={() => {
                          setTopMoreOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        Edit
                      </button>
                      )}
                      {effectivePerms.canEdit && (
                      <button
                        onClick={() => {
                          if (selectedFile) {
                            openRenameFile(selectedFile);
                          }
                          setTopMoreOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        <span>Rename</span>
                        <span className="text-xs text-gray-400">⌘+G</span>
                      </button>
                      )}
                      {effectivePerms.canDelete && (
                      <button
                        onClick={() => {
                          if (selectedFile) {
                            openDeleteFile(selectedFile);
                          }
                          setTopMoreOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                      >
                        <span>Delete</span>
                        <span className="text-xs text-gray-400">Del</span>
                      </button>
                      )}
                      {effectivePerms.canEdit && (
                      <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => setTopMoreOpen(false)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        <span>Move to</span>
                        <span className="text-xs text-gray-400">⌘+X</span>
                      </button>
                      <button
                        onClick={() => setTopMoreOpen(false)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        <span>Copy to</span>
                        <span className="text-xs text-gray-400">⌘+C</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => setTopMoreOpen(false)}
                        className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                      >
                        Tag Management
                      </button>
                      </>
                      )}
                    </div>
                  )}
                </div>
                )}
              </>
            );
          })()}

          <div className="ml-auto">
            <button className="p-2 hover:bg-gray-100 rounded-md">
              <Eye className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Announcement Banner ────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Megaphone className="w-4 h-4 text-blue-500" />
            <span>Announcement</span>
          </div>
          {effectivePerms.isOwner && (
            <button
              onClick={() => { setAnnouncementInput(''); setNewAnnouncementOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Announcement
            </button>
          )}
        </div>
        {announcements.length > 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-2">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{announcements[0].text}</p>
            <p className="text-xs text-gray-400 mt-2">— {announcements[0].author}, {announcements[0].createdAt}</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-2">
            <p className="text-sm text-gray-400 italic">No announcements yet</p>
          </div>
        )}
        {announcements.length > 1 && (
          <button
            onClick={() => setPastAnnouncementsOpen(true)}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            View Past Announcements ({announcements.length - 1} more)
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {!currentFolder ? (
          folders.length === 0 ? (
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
                {effectivePerms.canUpload ? (
                  <>
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
                  </>
                ) : (
                  <div className="text-gray-400 text-sm">You have view-only access to this class.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" />
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
                    <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">
                      <button className="flex items-center gap-1 hover:text-gray-700">
                        Size <ChevronsUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => (
                    <tr
                      key={folder.id}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${
                        selectedFolderId === folder.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedFolderId((previous) => (previous === folder.id ? null : folder.id))}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFolderId === folder.id}
                          readOnly
                          className="rounded border-gray-300"
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(event) => openFolder(folder, event)}
                            className="flex items-center gap-2 text-left hover:text-blue-600"
                          >
                            {folder.isGroup
                              ? <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                              : <Folder className="w-5 h-5 text-blue-600 fill-blue-600 flex-shrink-0" />}
                            <span className="text-gray-800">{folder.name}</span>
                            {folder.isGroup && (
                              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 leading-none">Group</span>
                            )}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleStar(folder.id);
                            }}
                            className="ml-1 p-0.5 hover:scale-110 transition-transform"
                          >
                            <Star className={`w-4 h-4 ${folder.starred ? 'fill-blue-500 text-blue-500' : 'text-blue-400'}`} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{folder.createdAt}</td>
                      <td className="px-4 py-3 text-gray-500">–</td>
                      <td className="px-4 py-3">
                        {selectedFolderId === folder.id && (
                          <div className="flex items-center gap-1 justify-end">
                            {effectivePerms.canDownload && (
                            <button
                              onClick={(event) => event.stopPropagation()}
                              className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            )}
                            {effectivePerms.canShare && (
                            <button
                              onClick={(event) => openShareFolder(folder, event)}
                              className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            )}
                            {(effectivePerms.canEdit || effectivePerms.canDelete) && (
                            <div className="relative" ref={moreMenuItemKey === `folder:${folder.id}` ? moreMenuRef : undefined}>
                              <button
                                onClick={(event) => openMore(`folder:${folder.id}`, event)}
                                className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {moreMenuItemKey === `folder:${folder.id}` && (
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                  {effectivePerms.canEdit && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openRenameFolder(folder);
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Rename</span>
                                    <span className="text-xs text-gray-400">⌘+G</span>
                                  </button>
                                  )}
                                  {effectivePerms.canEdit && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleStar(folder.id);
                                      setMoreMenuItemKey(null);
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Starred</span>
                                    <span className="text-xs text-gray-400">⌘+B</span>
                                  </button>
                                  )}
                                  {effectivePerms.canDelete && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDeleteFolder(folder);
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                                  >
                                    <span>Delete</span>
                                    <span className="text-xs text-gray-400">Del</span>
                                  </button>
                                  )}
                                  {effectivePerms.canEdit && (
                                  <>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button
                                    onClick={(event) => event.stopPropagation()}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Move to</span>
                                    <span className="text-xs text-gray-400">⌘+X</span>
                                  </button>
                                  <button
                                    onClick={(event) => event.stopPropagation()}
                                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    <span>Copy to</span>
                                    <span className="text-xs text-gray-400">⌘+C</span>
                                  </button>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button
                                    onClick={(event) => event.stopPropagation()}
                                    className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    Tag Management
                                  </button>
                                  </>
                                  )}
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDetails(folder);
                                    }}
                                    className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                  >
                                    View details
                                  </button>
                                </div>
                              )}
                            </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="pt-4 px-6 flex items-center justify-between text-sm text-gray-500">
                <span>{folders.length} items</span>
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
          )
        ) : (currentFolder.folders.length === 0 && currentFolder.files.length === 0) ? (
          <div className="h-full flex items-center justify-center min-h-[520px]">
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
              {effectivePerms.canUpload ? (
                <>
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
                </>
              ) : (
                <div className="text-gray-400 text-sm">You have view-only access to this class.</div>
              )}
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-64">
                    <button className="flex items-center gap-1 hover:text-gray-700">
                      Last modified <ChevronsUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-40">
                    <button className="flex items-center gap-1 hover:text-gray-700">
                      Size <ChevronsUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {currentFolder.folders.map((subfolder) => (
                  <tr
                    key={subfolder.id}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selectedFolderId === subfolder.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedFolderId((prev) => (prev === subfolder.id ? null : subfolder.id))}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedFolderId === subfolder.id} readOnly className="rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={(event) => openFolder(subfolder, event)} className="flex items-center gap-2 text-left hover:text-blue-600">
                          {subfolder.isGroup
                            ? <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                            : <Folder className="w-5 h-5 text-blue-600 fill-blue-600 flex-shrink-0" />}
                          <span className="text-gray-800">{subfolder.name}</span>
                          {subfolder.isGroup && (
                            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 leading-none">Group</span>
                          )}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleStar(subfolder.id); }} className="ml-1 p-0.5 hover:scale-110 transition-transform">
                          <Star className={`w-4 h-4 ${subfolder.starred ? 'fill-blue-500 text-blue-500' : 'text-blue-400'}`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{subfolder.createdAt}</td>
                    <td className="px-4 py-3 text-gray-500">–</td>
                    <td className="px-4 py-3">
                      {selectedFolderId === subfolder.id && (
                        <div className="flex items-center gap-1 justify-end">
                          {effectivePerms.canDownload && (
                          <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"><Download className="w-4 h-4" /></button>
                          )}
                          {effectivePerms.canShare && (
                          <button onClick={(e) => openShareFolder(subfolder, e)} className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"><Share2 className="w-4 h-4" /></button>
                          )}
                          {(effectivePerms.canEdit || effectivePerms.canDelete) && (
                          <div className="relative" ref={moreMenuItemKey === `folder:${subfolder.id}` ? moreMenuRef : undefined}>
                            <button onClick={(e) => openMore(`folder:${subfolder.id}`, e)} className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"><MoreHorizontal className="w-4 h-4" /></button>
                            {moreMenuItemKey === `folder:${subfolder.id}` && (
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                {effectivePerms.canEdit && (<button onClick={(e) => { e.stopPropagation(); openRenameFolder(subfolder); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"><span>Rename</span><span className="text-xs text-gray-400">⌘+G</span></button>)}
                                {effectivePerms.canEdit && (<button onClick={(e) => { e.stopPropagation(); toggleStar(subfolder.id); setMoreMenuItemKey(null); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"><span>Starred</span><span className="text-xs text-gray-400">⌘+B</span></button>)}
                                {effectivePerms.canDelete && (<button onClick={(e) => { e.stopPropagation(); openDeleteFolder(subfolder); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"><span>Delete</span><span className="text-xs text-gray-400">Del</span></button>)}
                              </div>
                            )}
                          </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {currentFolder.files.map((file) => (
                  <tr
                    key={file.id}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selectedFileId === file.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedFileId((previous) => (previous === file.id ? null : file.id));
                      setMoreMenuItemKey(null);
                    }}
                  >
                    <td className="px-4 py-5">
                      <input
                        type="checkbox"
                        checked={selectedFileId === file.id}
                        readOnly
                        className="rounded border-gray-300"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-start gap-2">
                        <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getFileIconTint(file.name)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-800">{file.name}</span>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleFileStar(file.id);
                              }}
                              className="ml-1 p-0.5 hover:scale-110 transition-transform flex-shrink-0"
                            >
                              <Star className={`w-4 h-4 ${file.starred ? 'fill-blue-500 text-blue-500' : 'text-blue-400'}`} />
                            </button>
                          </div>
                          {file.caption && (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-gray-900 break-words whitespace-pre-wrap">{file.caption}</p>
                              <p className="text-xs text-gray-400">— {file.uploader ?? 'unknown'} · {file.createdAt}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-gray-500">{selectedFileId === file.id ? file.createdAt : ''}</td>
                    <td className="px-4 py-5 text-gray-500">{selectedFileId === file.id ? file.sizeLabel : ''}</td>
                    <td className="px-4 py-5">
                      {selectedFileId === file.id && (
                        <div className="flex items-center gap-1 justify-end">
                          {effectivePerms.canDownload && (
                          <button
                            onClick={(event) => event.stopPropagation()}
                            className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          )}
                          {effectivePerms.canShare && (
                          <button
                            onClick={(event) => openShareFile(file, event)}
                            className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          )}
                          {(effectivePerms.canEdit || effectivePerms.canDelete) && (
                          <div className="relative" ref={moreMenuItemKey === `file:${file.id}` ? moreMenuRef : undefined}>
                            <button
                              onClick={(event) => openMore(`file:${file.id}`, event)}
                              className="p-1.5 hover:bg-white rounded border border-gray-200 text-gray-500 hover:text-gray-700"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {moreMenuItemKey === `file:${file.id}` && (
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                {effectivePerms.canEdit && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    previewFile(file);
                                    setMoreMenuItemKey(null);
                                  }}
                                  className={`w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm ${fileBlobUrls.has(file.id) ? 'text-gray-700' : 'text-gray-400 cursor-not-allowed'}`}
                                >
                                  Preview{!fileBlobUrls.has(file.id) && <span className="ml-auto text-xs text-gray-400">(upload again)</span>}
                                </button>
                                )}
                                {effectivePerms.canEdit && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setMoreMenuItemKey(null);
                                  }}
                                  className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  Edit
                                </button>
                                )}
                                {effectivePerms.canEdit && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openRenameFile(file);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  <span>Rename</span>
                                  <span className="text-xs text-gray-400">⌘+G</span>
                                </button>
                                )}
                                {effectivePerms.canEdit && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleFileStar(file.id);
                                    setMoreMenuItemKey(null);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  <span>Starred</span>
                                  <span className="text-xs text-gray-400">⌘+B</span>
                                </button>
                                )}
                                {effectivePerms.canDelete && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openDeleteFile(file);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                                >
                                  <span>Delete</span>
                                  <span className="text-xs text-gray-400">Del</span>
                                </button>
                                )}
                                {effectivePerms.canEdit && (
                                <>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  <span>Move to</span>
                                  <span className="text-xs text-gray-400">⌘+X</span>
                                </button>
                                <button
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  <span>Copy to</span>
                                  <span className="text-xs text-gray-400">⌘+C</span>
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-full flex items-center px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                                >
                                  Tag Management
                                </button>
                                </>
                                )}
                              </div>
                            )}
                          </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="pt-4 px-6 flex items-center justify-between text-sm text-gray-500">
              <span>{currentFolder.folders.length + currentFolder.files.length} items</span>
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

      {uploadFileModalOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Upload File</h2>
              </div>
              <button
                onClick={() => { setUploadFileModalOpen(false); setPendingUploadFiles([]); setUploadCaption(''); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* File selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                File <span className="text-red-500">*</span>
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors text-left"
              >
                <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {pendingUploadFiles.length > 0 ? (
                    <div>
                      {pendingUploadFiles.map((f) => (
                        <p key={f.name} className="text-sm text-gray-800 font-medium truncate">{f.name}</p>
                      ))}
                      <p className="text-xs text-gray-400 mt-0.5">{pendingUploadFiles.length} file{pendingUploadFiles.length > 1 ? 's' : ''} selected · click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Click to select file(s)</p>
                      <p className="text-xs text-gray-400 mt-0.5">Any file type supported</p>
                    </div>
                  )}
                </div>
                <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            </div>

            {/* Caption field */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Caption <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value.slice(0, 100))}
                placeholder="Add a short description for this file..."
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${uploadCaption.length >= 90 ? 'text-orange-500' : 'text-gray-400'}`}>{uploadCaption.length}/100</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setUploadFileModalOpen(false); setPendingUploadFiles([]); setUploadCaption(''); }}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                disabled={pendingUploadFiles.length === 0}
                className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {newGroupModalOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">New Group</h2>
              </div>
              <button onClick={() => setNewGroupModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={groupInput}
                onChange={(event) => setGroupInput(event.target.value.slice(0, 255))}
                onKeyDown={(event) => event.key === 'Enter' && confirmNewGroup()}
                autoFocus
                className="flex-1 border border-blue-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">{groupInput.length}/255</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">{nameHint}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewGroupModalOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmNewGroup}
                className="px-5 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {newFolderModalOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Folder</h2>
              <button onClick={() => setNewFolderModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={folderInput}
                onChange={(event) => setFolderInput(event.target.value.slice(0, 255))}
                onKeyDown={(event) => event.key === 'Enter' && confirmNewFolder()}
                onFocus={(event) => event.target.select()}
                autoFocus
                className="flex-1 border border-blue-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">{folderInput.length}/255</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">{nameHint}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewFolderModalOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmNewFolder}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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
                onChange={(event) => setRenameInput(event.target.value.slice(0, 255))}
                onKeyDown={(event) => event.key === 'Enter' && confirmRename()}
                autoFocus
                className="flex-1 border border-blue-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">{renameInput.length}/255</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">{nameHint}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-gray-900 font-semibold mb-1 ml-12">
              {`Sure you want to delete "${deleteTarget.name}"?`}
            </p>
            <p className="text-gray-500 text-sm mb-6 ml-12">
              {deleteTarget.kind === 'file'
                ? 'The file will be moved to Mnemonic Recovery. You can retrieve it from Deletion Restore.'
                : 'The folder and its files will be moved to Mnemonic Recovery. You can retrieve it from Deletion Restore.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsFolder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Folder Detail</h2>
              <button onClick={() => setDetailsFolder(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Folder className="w-8 h-8 text-blue-600 fill-blue-600" />
              <span className="text-lg font-semibold text-gray-900">{detailsFolder.name}</span>
            </div>
            <div className="border-t border-gray-100 mb-4" />
            <div className="space-y-3 text-sm mb-6">
              {[
                ['Creator', role === 'teacher' ? 'xiewenkai' : 'wangyifei'],
                ['Location', 'Class/English 3A'],
                ['Path', 'All/'],
                ['Folder Size', '0B'],
                ['Number of Files', String(detailsFolder.files.length || 0)],
                ['Creation time', detailsFolder.createdAt],
                ['Last modified', detailsFolder.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-gray-400 w-32 flex-shrink-0">{label}:</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setDetailsFolder(null)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
              {shareTarget.kind === 'folder' ? (
                <Folder className="w-8 h-8 text-blue-600 fill-blue-600 flex-shrink-0" />
              ) : (
                <FileText className={`w-8 h-8 flex-shrink-0 ${getFileIconTint(shareTarget.name)}`} />
              )}
              <div>
                <div className="text-sm font-medium text-gray-900">{shareTarget.name}</div>
                <div className="text-xs text-gray-400">{shareTarget.createdAt} created by {role === 'teacher' ? 'xiewenkai' : 'wangyifei'}</div>
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Access permission</p>
            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sharePreview} onChange={(event) => setSharePreview(event.target.checked)} className="rounded" />
                <span className="w-20">Preview</span>
                <span className="text-gray-400 text-xs">Number of previews</span>
                <input type="text" placeholder="please enter" className="ml-auto border border-gray-300 rounded px-2 py-1 text-xs w-28" />
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareDownload} onChange={(event) => setShareDownload(event.target.checked)} className="rounded" />
                <span className="w-20">Download</span>
                <span className="text-gray-400 text-xs">Number of downloads</span>
                <input type="text" placeholder="please enter" className="ml-auto border border-gray-300 rounded px-2 py-1 text-xs w-28" />
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareSave} onChange={(event) => setShareSave(event.target.checked)} className="rounded" />
                <span>Save to Education Drive</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={shareEdit} onChange={(event) => setShareEdit(event.target.checked)} className="rounded" />
                <span>Edit (Login required)</span>
              </label>
            </div>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expiration date</p>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" checked={shareExpiry === 'expired'} onChange={() => setShareExpiry('expired')} />
                Expired on
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" checked={shareExpiry === 'permanent'} onChange={() => setShareExpiry('permanent')} />
                Permanent validity
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
              <input type="checkbox" checked={shareUseCode} onChange={(event) => setShareUseCode(event.target.checked)} className="rounded" />
              <span>Set extraction code</span>
              {shareUseCode && (
                <input type="text" defaultValue={shareCode} className="border border-gray-300 rounded px-3 py-1 text-sm w-24 font-mono" />
              )}
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShareTarget(null)} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                Create link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Announcement Modal ─────────────────────────────────────────────── */}
      {newAnnouncementOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
              </div>
              <button onClick={() => setNewAnnouncementOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-2">
              <textarea
                value={announcementInput}
                onChange={(e) => setAnnouncementInput(e.target.value.slice(0, 500))}
                onFocus={(e) => e.target.select()}
                autoFocus
                placeholder="Write your announcement here..."
                rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-400">{announcementInput.length}/500</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewAnnouncementOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const text = announcementInput.trim();
                  if (!text) return;
                  const now = new Date();
                  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                  setAnnouncements(prev => [{ id: `ann-${Date.now()}`, text, author: currentUsername, createdAt: ts }, ...prev]);
                  setNewAnnouncementOpen(false);
                  setAnnouncementInput('');
                }}
                disabled={!announcementInput.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Past Announcements Modal ───────────────────────────────────────────── */}
      {pastAnnouncementsOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Past Announcements</h2>
              </div>
              <button onClick={() => setPastAnnouncementsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {announcements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No announcements yet</p>
              ) : (
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
                  <div className="space-y-5">
                    {announcements.map((ann, index) => (
                      <div key={ann.id} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${index === 0 ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`} />
                        <div className={`border rounded-lg px-4 py-3 ${index === 0 ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-700">{ann.author}</span>
                            <span className="text-xs text-gray-400">{ann.createdAt}</span>
                          </div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{ann.text}</p>
                          {index === 0 && (
                            <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">Latest</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setPastAnnouncementsOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
