import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevRight,
  Copy, Folder, FolderOpen, FolderPlus, LayoutGrid, LogOut, Plus,
  Search, Settings, Trash2, Users, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRole } from '../context/RoleContext';
import type { TFunction } from '../i18n';

type Participant = 'anyone' | 'designated';
type ExpirationType = 'date' | 'permanent';
type TabType = 'initiated' | 'received';

interface Group { id: string; name: string; }
interface FolderNode { id: string; name: string; folders?: FolderNode[]; }

export interface CollectionItem {
  id: string;
  title: string;
  saveFolder: string;
  participant: Participant;
  members: string[];
  expirationType: ExpirationType;
  expiryDate: string;
  namingSelected: string[];
  fileFormats: string[];
  createdAt: string;
  submitted: number;
  total: number;
  creator: string;
}

function sevenDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
function daysLeft(dateStr: string, t: TFunction) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return t('expiry_expired');
  return days === 1 ? t('days_left_one', { n: days }) : t('days_left_plural', { n: days });
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function isExpired(item: CollectionItem) {
  if (item.expirationType === 'permanent') return false;
  return new Date(item.expiryDate).getTime() < Date.now();
}

const MOCK_MEMBERS: Record<string, string[]> = {
  'english-3a': ['Alice Wang', 'Bob Chen', 'Cathy Liu'],
  'math-3a': ['David Zhang', 'Emma Li', 'Frank Wu'],
  'science-3a': ['Grace Zhao', 'Henry Xu', 'Iris Sun'],
  'chinese-3a': ['Jack Ma', 'Kate Zhou', 'Liam He'],
};

// ─── Tooltip action button ───────────────────────────────────────────────────
function ActionButton({ label, icon, onClick, danger = false }: {
  label: string; icon: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  return (
    <div className="relative group/tip">
      <button onClick={onClick}
        className={`p-1.5 rounded transition-colors ${danger ? 'text-gray-500 hover:bg-red-50 hover:text-red-500' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 text-[11px] text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-10">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}

// ─── Calendar picker ─────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose, t }: { value: string; onChange: (v: string) => void; onClose: () => void; t: TFunction; }) {
  const MONTH_NAMES = [t('month_jan'),t('month_feb'),t('month_mar'),t('month_apr'),t('month_may'),t('month_jun'),t('month_jul'),t('month_aug'),t('month_sep'),t('month_oct'),t('month_nov'),t('month_dec')];
  const DAY_NAMES = [t('day_mon'),t('day_tue'),t('day_wed'),t('day_thu'),t('day_fri'),t('day_sat'),t('day_sun')];
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const today = new Date();
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  function prevMonth() { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); }
  function nextMonth() { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); }
  function fdi(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d===0?6:d-1; }
  function dim(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
  const cells: (number|null)[] = [];
  for (let i=0; i<fdi(viewYear,viewMonth); i++) cells.push(null);
  for (let d=1; d<=dim(viewYear,viewMonth); d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);
  const isToday = (d:number) => today.getFullYear()===viewYear && today.getMonth()===viewMonth && today.getDate()===d;
  const isSel = (d:number) => !!(selectedDate && selectedDate.getFullYear()===viewYear && selectedDate.getMonth()===viewMonth && selectedDate.getDate()===d);
  const yearOpts: number[] = [];
  for (let y=today.getFullYear(); y<=today.getFullYear()+50; y++) yearOpts.push(y);
  return (
    <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64" style={{top:'100%',left:0}}>
      <div className="text-xs bg-gray-800 text-white rounded px-2 py-1 mb-2 text-center">{t('calendar_tooltip')}</div>
      <div className="flex items-center gap-1 mb-2">
        <select value={viewMonth} onChange={e=>setViewMonth(Number(e.target.value))} className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-sm">
          {MONTH_NAMES.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select value={viewYear} onChange={e=>setViewYear(Number(e.target.value))} className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-sm">
          {yearOpts.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-3.5 h-3.5 text-gray-500"/></button>
        <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-gray-400"/></div>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-3.5 h-3.5 text-gray-500"/></button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAY_NAMES.map(d=><div key={d} className="text-center text-[11px] font-medium text-gray-400 py-0.5">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((day,i)=>(
          <button key={i} disabled={!day} onClick={()=>day&&(onChange(`${viewYear}-${pad(viewMonth+1)}-${pad(day)}`),onClose())}
            className={['h-7 w-full flex items-center justify-center rounded text-sm',
              day?'hover:bg-blue-50':'',
              day&&isSel(day)?'bg-blue-600 text-white':'',
              day&&isToday(day)&&!isSel(day)?'text-blue-600 font-bold':'',
              day&&!isSel(day)&&!isToday(day)?'text-gray-700':'',
            ].filter(Boolean).join(' ')}>{day}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Naming convention dropdown (with chips) ─────────────────────────────────
function NamingConventionDropdown({ selected, onChange, t }: { selected: string[]; onChange: (v: string[]) => void; t: TFunction; }) {
  const NAMING_OPTIONS = [t('naming_option_name'),t('naming_option_phone'),t('naming_option_school'),t('naming_option_work'),t('naming_option_email'),t('naming_option_id')];
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter(s=>s!==opt));
    else if (selected.length<2) onChange([...selected, opt]);
  }
  function addCustom() {
    const val = customInput.trim();
    if (!val) return;
    if (!NAMING_OPTIONS.includes(val) && !customItems.includes(val)) setCustomItems(p=>[...p,val]);
    if (selected.length<2 && !selected.includes(val)) onChange([...selected, val]);
    setCustomInput(''); setShowCustomInput(false);
  }
  return (
    <div ref={ref} className="relative">
      <div onClick={()=>setOpen(o=>!o)}
        className={`w-full border rounded px-3 py-2 text-sm flex items-center gap-2 cursor-pointer min-h-[38px] ${open?'border-blue-500':'border-gray-300'}`}>
        <div className="flex flex-wrap gap-1 flex-1">
          {selected.length>0 ? selected.map(s=>(
            <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs">
              {s}
              <button type="button" onClick={e=>{e.stopPropagation();onChange(selected.filter(x=>x!==s));}} className="text-gray-400 hover:text-gray-700">
                <X className="w-2.5 h-2.5"/>
              </button>
            </span>
          )) : <span className="text-gray-400">{t('placeholder_naming')}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open?'rotate-180':''}`}/>
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-xs text-gray-400">{t('hint_naming_max')}</div>
          {[...NAMING_OPTIONS,...customItems].map(opt=>{
            const checked=selected.includes(opt);
            const disabled=!checked&&selected.length>=2;
            return (
              <label key={opt} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${disabled?'opacity-40 cursor-not-allowed':'hover:bg-gray-50'}`}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={()=>toggle(opt)} className="accent-blue-600 w-3.5 h-3.5"/>
                <span className="text-gray-700">{opt}</span>
              </label>
            );
          })}
          <div className="border-t border-gray-100 px-3 py-2">
            {showCustomInput && (
              <div className="flex items-center gap-2 mb-2">
                <input autoFocus type="text" value={customInput} onChange={e=>setCustomInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addCustom()}
                  placeholder={t('placeholder_custom_naming')} className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                <button onClick={addCustom} className="text-xs text-blue-600 hover:underline">{t('btn_add')}</button>
              </div>
            )}
            <button onClick={()=>setShowCustomInput(true)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Plus className="w-3.5 h-3.5"/> {t('btn_add_custom')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File format dropdown ─────────────────────────────────────────────────────
function FileFormatDropdown({ selected, onChange, t }: { selected: string[]; onChange: (v: string[]) => void; t: TFunction; }) {
  const FORMAT_OPTIONS = [t('format_word'),t('format_ppt'),t('format_excel'),t('format_pdf')];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter(s=>s!==opt));
    else onChange([...selected, opt]);
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className={`w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none ${open?'border-blue-500':'border-gray-300'}`}>
        <span className="text-gray-700">{selected.length>0?selected.join(', '):t('format_no_restriction')}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {FORMAT_OPTIONS.map(opt=>(
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={selected.includes(opt)} onChange={()=>toggle(opt)} className="accent-blue-600 w-3.5 h-3.5"/>
              <span className="text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Update member modal ──────────────────────────────────────────────────────
function UpdateMemberModal({ sharedKey, initial, onConfirm, onClose, t }: {
  sharedKey: (key: string) => string; initial: string[];
  onConfirm: (members: string[]) => void; onClose: () => void; t: TFunction;
}) {
  const [groups] = useState<Group[]>(() => {
    try { const s=localStorage.getItem(sharedKey('groups')); const p=s?JSON.parse(s):[]; return Array.isArray(p)?p:[]; } catch { return []; }
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>(initial);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  function toggleExpand(id: string) { setExpanded(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;}); }
  function addMember(name: string) { if (!selected.includes(name)) setSelected(p=>[...p,name]); }
  function removeMember(name: string) { setSelected(p=>p.filter(m=>m!==name)); }
  const filteredGroups = groups.filter(g=>!leftSearch||g.name.toLowerCase().includes(leftSearch.toLowerCase()));
  const filteredSelected = selected.filter(m=>!rightSearch||m.toLowerCase().includes(rightSearch.toLowerCase()));
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[680px] flex flex-col" style={{maxHeight:'75vh'}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{t('update_member_title')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[320px] border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="px-4 py-2.5 border-b border-gray-100"><span className="text-sm font-medium text-gray-700">{t('update_member_select')}</span></div>
            <div className="px-3 py-2 flex-shrink-0">
              <div className="relative">
                <input value={leftSearch} onChange={e=>setLeftSearch(e.target.value)} placeholder={t('placeholder_search_team')}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {filteredGroups.map(group=>{
                const members=(MOCK_MEMBERS[group.id]??[`${group.name} Member 1`,`${group.name} Member 2`]).filter(m=>!leftSearch||m.toLowerCase().includes(leftSearch.toLowerCase())||group.name.toLowerCase().includes(leftSearch.toLowerCase()));
                const isOpen=expanded.has(group.id);
                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-1 px-1 py-1.5 hover:bg-gray-50 rounded group/row">
                      <button onClick={()=>toggleExpand(group.id)} className="p-0.5">
                        <ChevRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen?'rotate-90':''}`}/>
                      </button>
                      <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3 h-3 text-blue-600"/>
                      </div>
                      <span className="flex-1 text-sm text-gray-700 truncate">{group.name}</span>
                      <button onClick={()=>members.forEach(m=>addMember(m))}
                        className="opacity-0 group-hover/row:opacity-100 w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-opacity">
                        <Plus className="w-3 h-3"/>
                      </button>
                    </div>
                    {isOpen && members.map(member=>(
                      <div key={member} className="flex items-center gap-1 pl-7 pr-1 py-1.5 hover:bg-gray-50 rounded group/member">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] text-gray-600 font-medium">{member[0]}</span>
                        </div>
                        <span className="flex-1 text-sm text-gray-700 truncate">{member}</span>
                        <button onClick={()=>addMember(member)}
                          className="opacity-0 group-hover/member:opacity-100 w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-opacity">
                          <Plus className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">{t('label_all_members')} {selected.length}</span>
              {selected.length>0 && <button onClick={()=>setSelected([])} className="text-sm text-red-500 hover:underline">{t('btn_delete_all')}</button>}
            </div>
            <div className="px-3 py-2 flex-shrink-0">
              <div className="relative">
                <input value={rightSearch} onChange={e=>setRightSearch(e.target.value)} placeholder={t('placeholder_search_members')}
                  className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              {filteredSelected.length===0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-gray-400">{t('empty_data')}</div>
              ) : filteredSelected.map(member=>(
                <div key={member} className="flex items-center gap-2 py-2 border-b border-gray-50 group/item">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-blue-600 font-medium">{member[0]}</span>
                  </div>
                  <span className="flex-1 text-sm text-gray-700">{member}</span>
                  <button onClick={()=>removeMember(member)} className="opacity-0 group-hover/item:opacity-100 p-1 transition-opacity">
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('btn_cancel')}</button>
          <button onClick={()=>onConfirm(selected)} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">{t('btn_confirm')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Select folder modal ──────────────────────────────────────────────────────
function SelectFolderModal({ sharedKey, storageKey, onSelect, onClose, t }: { sharedKey: (key: string) => string; storageKey: (key: string) => string; onSelect: (path: string) => void; onClose: () => void; t: TFunction; }) {
  const [groups] = useState<Group[]>(() => {
    try {
      const sharedSaved = localStorage.getItem(sharedKey('groups'));
      const sharedParsed = sharedSaved ? JSON.parse(sharedSaved) : [];
      const privateSaved = localStorage.getItem(storageKey('groups'));
      const privateParsed = privateSaved ? JSON.parse(privateSaved) : [];
      return [...(Array.isArray(sharedParsed) ? sharedParsed : []), ...(Array.isArray(privateParsed) ? privateParsed : [])];
    } catch { return []; }
  });
  type LeftNode = {type:'class';id:string;name:string}|{type:'personal'};
  const [selectedLeft, setSelectedLeft] = useState<LeftNode|null>(null);
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
  const [folderPath, setFolderPath] = useState<{id:string;name:string}[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  function selectLeft(node: LeftNode) {
    setSelectedLeft(node); setSelectedFolderId(null); setSearch(''); setNewFolderMode(false); setFolderPath([]);
    if (node.type==='class') {
      try { const saved=localStorage.getItem(sharedKey(`folders-${node.id}`)); const parsed=saved?JSON.parse(saved):[]; setRootFolders(Array.isArray(parsed)?parsed:[]); } catch { setRootFolders([]); }
    } else setRootFolders([]);
  }

  // Navigate into nested folders based on folderPath
  function getFoldersAtCurrentPath(): FolderNode[] {
    let current = rootFolders;
    for (const segment of folderPath) {
      const found = current.find(f => f.id === segment.id);
      if (found && Array.isArray(found.folders)) {
        current = found.folders;
      } else {
        return [];
      }
    }
    return current;
  }

  function navigateIntoFolder(folder: FolderNode) {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFolderId(null);
    setSearch('');
  }

  function navigateToBreadcrumb(index: number) {
    // index -1 means root
    setFolderPath(prev => prev.slice(0, index + 1));
    setSelectedFolderId(null);
    setSearch('');
  }

  const currentFolders = getFoldersAtCurrentPath();
  const filteredFolders = currentFolders.filter(f=>!search||(f.name??'').toLowerCase().includes(search.toLowerCase()));
  const leftName = selectedLeft?(selectedLeft.type==='class'?selectedLeft.name:t('select_folder_personal')):null;

  // Build full path string for selection
  function getSelectedPath(): string {
    if (!leftName) return '';
    const pathParts = [leftName, ...folderPath.map(p => p.name)];
    if (selectedFolderId) {
      const selectedFolder = currentFolders.find(f => f.id === selectedFolderId);
      if (selectedFolder) pathParts.push(selectedFolder.name);
    }
    return pathParts.join(' / ');
  }

  function confirmNewFolder() {
    const name=newFolderName.trim(); if (!name) return;
    const newFolder: FolderNode = { id: `f-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name };
    if (selectedLeft?.type==='class') {
      try {
        const key = sharedKey(`folders-${selectedLeft.id}`);
        const existing: FolderNode[] = JSON.parse(localStorage.getItem(key)||'[]');
        // Insert at the correct depth
        function insertAtPath(folders: FolderNode[], path: {id:string;name:string}[]): FolderNode[] {
          if (path.length === 0) return [...folders, newFolder];
          return folders.map(f => f.id === path[0].id ? { ...f, folders: insertAtPath(f.folders || [], path.slice(1)) } : f);
        }
        localStorage.setItem(key, JSON.stringify(insertAtPath(existing, folderPath)));
      } catch {}
    }
    setRootFolders(prev => {
      function insertAtPath(folders: FolderNode[], path: {id:string;name:string}[]): FolderNode[] {
        if (path.length === 0) return [...folders, newFolder];
        return folders.map(f => f.id === path[0].id ? { ...f, folders: insertAtPath(f.folders || [], path.slice(1)) } : f);
      }
      return insertAtPath(prev, folderPath);
    });
    setSelectedFolderId(newFolder.id); setNewFolderMode(false); setNewFolderName('');
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[720px] flex flex-col" style={{maxHeight:'75vh'}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{t('select_folder_heading')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-52 border-r border-gray-200 overflow-y-auto flex-shrink-0 py-2">
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700"><Users className="w-3.5 h-3.5 text-gray-500"/><span>{t('select_folder_class')}</span></div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400"/>
            </div>
            {groups.map(group=>(
              <button key={group.id} onClick={()=>selectLeft({type:'class',id:group.id,name:group.name})}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${selectedLeft?.type==='class'&&(selectedLeft as {type:'class';id:string;name:string}).id===group.id?'text-blue-600 font-medium bg-blue-50':'text-gray-700 hover:bg-gray-50'}`}>
                <Folder className="w-3.5 h-3.5 flex-shrink-0"/><span className="truncate">{group.name}</span>
              </button>
            ))}
            <button onClick={()=>selectLeft({type:'personal'})}
              className={`w-full text-left px-3 py-2 mt-1 text-sm flex items-center gap-2 transition-colors ${selectedLeft?.type==='personal'?'text-blue-600 font-medium bg-blue-50':'text-gray-700 hover:bg-gray-50'}`}>
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><span className="text-[10px] text-gray-600 font-semibold">P</span></div>
              <span>{t('select_folder_personal')}</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedLeft ? (
              <>
                {/* Breadcrumb navigation */}
                <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
                  <button onClick={() => navigateToBreadcrumb(-1)} className={`font-semibold ${folderPath.length > 0 ? 'text-blue-600 hover:underline' : 'text-gray-900'}`}>
                    {leftName}
                  </button>
                  {folderPath.map((segment, index) => (
                    <span key={segment.id} className="flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400"/>
                      <button onClick={() => navigateToBreadcrumb(index)} className={`${index < folderPath.length - 1 ? 'text-blue-600 hover:underline' : 'text-gray-900 font-semibold'}`}>
                        {segment.name}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative mb-3">
                  <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('placeholder_search_folders')}
                    className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                </div>
                {filteredFolders.length>0 ? (
                  <div className="space-y-1">
                    {filteredFolders.map(folder=>(
                      <div key={folder.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${selectedFolderId===folder.id?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-50'}`}
                        onClick={()=>setSelectedFolderId(folder.id)}
                        onDoubleClick={()=>navigateIntoFolder(folder)}
                      >
                        <Folder className="w-5 h-5 text-blue-500 fill-blue-500 flex-shrink-0"/>
                        <span className="truncate flex-1">{folder.name}</span>
                        <button onClick={(e)=>{e.stopPropagation(); navigateIntoFolder(folder);}} className="p-0.5 hover:bg-blue-100 rounded">
                          <ChevronRight className="w-4 h-4 text-gray-400"/>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-sm text-gray-400 text-center py-6">{t('empty_no_folders')}</div>}
                {newFolderMode && (
                  <div className="mt-3 flex items-center gap-2">
                    <input autoFocus type="text" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')confirmNewFolder();if(e.key==='Escape')setNewFolderMode(false);}}
                      placeholder={t('placeholder_new_folder_name')} className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    <button onClick={confirmNewFolder} className="text-sm text-blue-600 hover:underline">{t('btn_ok')}</button>
                    <button onClick={()=>setNewFolderMode(false)} className="text-sm text-gray-400 hover:underline">{t('btn_cancel')}</button>
                  </div>
                )}
              </>
            ) : <div className="flex items-center justify-center h-full text-sm text-gray-400">{t('empty_select_from_left')}</div>}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <button onClick={()=>{setNewFolderMode(true);setNewFolderName('');}} disabled={!selectedLeft}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed">
            <FolderPlus className="w-4 h-4"/> {t('btn_new_folder')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('btn_cancel')}</button>
            <button onClick={()=>{const path=getSelectedPath(); if(path) onSelect(path);}} disabled={!selectedLeft}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {t('btn_select_current_folder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared collection form body ──────────────────────────────────────────────
interface CollectionFormData {
  title: string; request: string; saveFolder: string; participant: Participant;
  members: string[]; expirationType: ExpirationType; expiryDate: string;
  namingSelected: string[]; fileFormats: string[];
}
interface CollectionFormBodyProps {
  form: CollectionFormData;
  setForm: React.Dispatch<React.SetStateAction<CollectionFormData>>;
  sharedKey: (key: string) => string;
  folderModalOpen: boolean; setFolderModalOpen: (v: boolean) => void;
  memberModalOpen: boolean; setMemberModalOpen: (v: boolean) => void;
  calendarRef: React.RefObject<HTMLDivElement | null>;
  calendarOpen: boolean; setCalendarOpen: (v: boolean) => void;
  t: TFunction;
}
function CollectionFormBody({ form, setForm, sharedKey: _sharedKey, folderModalOpen, setFolderModalOpen, memberModalOpen, setMemberModalOpen, calendarRef, calendarOpen, setCalendarOpen, t }: CollectionFormBodyProps) {
  return (
    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
      <div>
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5">
          <span className="text-red-500">*</span> {t('form_collection_title')}
        </label>
        <input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Please enter content"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t('form_document_request')} <span className="text-gray-400 font-normal">{t('form_optional')}</span></label>
        <div className="relative">
          <textarea value={form.request} onChange={e=>setForm(f=>({...f,request:e.target.value.slice(0,200)}))} placeholder="Please enter content" rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
          <span className="absolute bottom-2 right-2 text-xs text-gray-400">{form.request.length}/200</span>
        </div>
      </div>
      <div>
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5"><span className="text-red-500">*</span> {t('form_save_folder')}</label>
        <div className="flex gap-2">
          <input type="text" value={form.saveFolder} readOnly placeholder="Please select folder"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none cursor-pointer"
            onClick={()=>setFolderModalOpen(true)}/>
          <button onClick={()=>setFolderModalOpen(true)} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('btn_select_folder')}</button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">{t('form_participant')}</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="participant" checked={form.participant==='anyone'} onChange={()=>setForm(f=>({...f,participant:'anyone'}))} className="accent-blue-600"/>
            <span className="text-sm font-medium text-gray-800">{t('form_anyone')}</span>
            <span className="text-sm text-gray-400">{t('form_anyone_desc')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="participant" checked={form.participant==='designated'} onChange={()=>setForm(f=>({...f,participant:'designated'}))} className="accent-blue-600"/>
            <span className="text-sm font-medium text-gray-800">{t('form_designated')}</span>
            <span className="text-sm text-gray-400">{t('form_designated_desc')}</span>
          </label>
          {form.participant==='designated' && (
            <div className="mt-1 ml-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">{form.members.length>0?t('form_members_selected', { n: form.members.length }):t('btn_add_members')}</span>
              <button onClick={()=>setMemberModalOpen(true)} className="text-sm text-blue-600 hover:underline flex items-center gap-0.5">
                {t('btn_add')} <ChevRight className="w-3.5 h-3.5"/>
              </button>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">{t('form_expiration')}</label>
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="expiry" checked={form.expirationType==='date'} onChange={()=>setForm(f=>({...f,expirationType:'date'}))} className="accent-blue-600"/>
              <span className="text-sm font-medium text-gray-800">{t('form_expired_on')}</span>
            </label>
            <div ref={calendarRef} className="relative flex items-center gap-2">
              <div className="flex items-center border border-gray-300 rounded px-2 py-1 gap-2 bg-white">
                <span className="text-sm text-gray-700">{form.expiryDate}</span>
                <button onClick={()=>{setForm(f=>({...f,expirationType:'date'}));setCalendarOpen(!calendarOpen);}} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
                    <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
                    <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
                    <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
              {form.expirationType==='date'&&form.expiryDate&&<span className="text-sm text-gray-500">{daysLeft(form.expiryDate, t)}</span>}
              {calendarOpen && <CalendarPicker value={form.expiryDate} onChange={v=>setForm(f=>({...f,expiryDate:v,expirationType:'date'}))} onClose={()=>setCalendarOpen(false)} t={t}/>}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="expiry" checked={form.expirationType==='permanent'} onChange={()=>setForm(f=>({...f,expirationType:'permanent'}))} className="accent-blue-600"/>
            <span className="text-sm font-medium text-gray-800">{t('form_permanent_validity')}</span>
          </label>
        </div>
      </div>
      <div>
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1.5"><span className="text-red-500">*</span> {t('form_naming_convention')}</label>
        <NamingConventionDropdown selected={form.namingSelected} onChange={v=>setForm(f=>({...f,namingSelected:v}))} t={t}/>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t('form_file_format')}</label>
        <FileFormatDropdown selected={form.fileFormats} onChange={v=>setForm(f=>({...f,fileFormats:v}))} t={t}/>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t('form_example_file')} <span className="text-gray-400 font-normal">{t('form_optional')}</span></label>
        <div className="border border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center bg-gray-50 min-h-[80px]">
          <button className="text-sm text-blue-600 hover:underline">{t('btn_select_tced_file')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Initiate collection modal ────────────────────────────────────────────────
function InitiateCollectionModal({ sharedKey, storageKey, onSubmit, onClose, t }: {
  sharedKey: (key: string) => string;
  storageKey: (key: string) => string;
  onSubmit: (data: CollectionFormData) => void;
  onClose: () => void;
  t: TFunction;
}) {
  const [form, setForm] = useState<CollectionFormData>({
    title:'',request:'',saveFolder:'',participant:'anyone',members:[],
    expirationType:'date',expiryDate:sevenDaysFromNow(),namingSelected:[],fileFormats:[],
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setCalendarOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">{t('modal_initiate_heading')}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500"/></button>
          </div>
          <CollectionFormBody form={form} setForm={setForm} sharedKey={sharedKey}
            folderModalOpen={folderModalOpen} setFolderModalOpen={setFolderModalOpen}
            memberModalOpen={memberModalOpen} setMemberModalOpen={setMemberModalOpen}
            calendarRef={calendarRef} calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen} t={t}/>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('btn_cancel')}</button>
            <button onClick={()=>{if(form.title.trim()&&form.saveFolder.trim()&&form.namingSelected.length>0)onSubmit(form);}}
              className="px-5 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">{t('btn_initiate_submit')}</button>
          </div>
        </div>
      </div>
      {folderModalOpen&&<SelectFolderModal sharedKey={sharedKey} storageKey={storageKey} onSelect={path=>{setForm(f=>({...f,saveFolder:path}));setFolderModalOpen(false);}} onClose={()=>setFolderModalOpen(false)} t={t}/>}
      {memberModalOpen&&<UpdateMemberModal sharedKey={sharedKey} initial={form.members} onConfirm={members=>{setForm(f=>({...f,members}));setMemberModalOpen(false);}} onClose={()=>setMemberModalOpen(false)} t={t}/>}
    </>
  );
}

// ─── Settings modal ───────────────────────────────────────────────────────────
function SettingsModal({ item, sharedKey, storageKey, onSave, onDelete, onClose, t }: {
  item: CollectionItem; sharedKey: (key: string) => string; storageKey: (key: string) => string;
  onSave: (updated: CollectionItem) => void;
  onDelete: () => void;
  onClose: () => void;
  t: TFunction;
}) {
  const [form, setForm] = useState<CollectionFormData>({
    title: item.title, request: '', saveFolder: item.saveFolder,
    participant: item.participant, members: item.members,
    expirationType: item.expirationType, expiryDate: item.expiryDate,
    namingSelected: item.namingSelected, fileFormats: item.fileFormats,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setCalendarOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  function handleSave() {
    if (!form.title.trim() || !form.saveFolder.trim() || form.namingSelected.length===0) return;
    onSave({...item, ...form, total: form.participant==='designated'?Math.max(form.members.length,1):item.total});
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">{t('modal_settings_heading')}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500"/></button>
          </div>
          <CollectionFormBody form={form} setForm={setForm} sharedKey={sharedKey}
            folderModalOpen={folderModalOpen} setFolderModalOpen={setFolderModalOpen}
            memberModalOpen={memberModalOpen} setMemberModalOpen={setMemberModalOpen}
            calendarRef={calendarRef} calendarOpen={calendarOpen} setCalendarOpen={setCalendarOpen} t={t}/>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">{t('btn_cancel')}</button>
            <button onClick={onDelete} className="px-5 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600">{t('btn_settings_delete')}</button>
            <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">{t('btn_settings_save')}</button>
          </div>
        </div>
      </div>
      {folderModalOpen&&<SelectFolderModal sharedKey={sharedKey} storageKey={storageKey} onSelect={path=>{setForm(f=>({...f,saveFolder:path}));setFolderModalOpen(false);}} onClose={()=>setFolderModalOpen(false)} t={t}/>}
      {memberModalOpen&&<UpdateMemberModal sharedKey={sharedKey} initial={form.members} onConfirm={members=>{setForm(f=>({...f,members}));setMemberModalOpen(false);}} onClose={()=>setMemberModalOpen(false)} t={t}/>}
    </>
  );
}

// ─── View details modal ("My file collection") ────────────────────────────────
function ViewDetailsModal({ item, onOpenSettings, onClose, t }: {
  item: CollectionItem; onOpenSettings: () => void; onClose: () => void; t: TFunction;
}) {
  const link = `${window.location.origin}/collect/${item.id}`;
  const [copied, setCopied] = useState(false);
  function copyLink() {
    navigator.clipboard.writeText(link).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }
  const namingRules = item.namingSelected.join('+') || 'None';
  const formatReq = item.fileFormats.length>0 ? item.fileFormats.join(', ') : 'None';
  const validityText = item.expirationType==='permanent' ? t('collection_permanent_validity') : t('collection_until_valid', { date: item.expiryDate });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[460px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{t('view_details_heading')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Status card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className={`text-sm font-medium mb-1 ${isExpired(item)?'text-gray-400':'text-green-600'}`}>{validityText}</div>
                <div className="text-sm text-gray-500">{t('view_details_submitted', { n: item.submitted })}</div>
              </div>
              <button className="px-3 py-1.5 border border-red-400 rounded text-sm text-red-500 hover:bg-red-50 flex-shrink-0 ml-4">{t('btn_stop_collection')}</button>
            </div>
          </div>
          {/* Link card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">
              {t('view_details_invite_text')}
            </p>
            <p className="text-sm font-semibold text-gray-800 break-all mb-3">{t('view_details_link_label', { url: link })}</p>
            <div className="flex justify-end">
              <button onClick={copyLink} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">
                <Copy className="w-3.5 h-3.5"/> {copied ? t('view_details_copied') : t('btn_copy_link')}
              </button>
            </div>
          </div>
          {/* Info card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-800">{item.title}</div>
                <div className="text-sm text-gray-500">{t('view_details_format_req', { value: formatReq })}</div>
                <div className="text-sm text-gray-500">{t('view_details_naming_rules', { value: namingRules })}</div>
              </div>
              <button onClick={()=>{onClose();onOpenSettings();}} className="text-sm text-blue-600 hover:underline flex-shrink-0 ml-4">{t('link_settings')}</button>
            </div>
          </div>
          {/* Submit members */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-medium text-gray-700">{t('view_details_submit_members', { n: item.submitted })}</span>
            <button className="text-sm text-blue-600 hover:underline">{t('btn_view_folder')}</button>
          </div>
          {item.submitted===0 ? (
            <div className="text-sm text-gray-400 text-center py-6">{t('view_details_no_submissions')}</div>
          ) : (
            <div className="space-y-3">
              {Array.from({length:item.submitted}).map((_,i)=>(
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-blue-600 font-medium">U</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">Member {i+1}</div>
                    <div className="text-xs text-gray-400">134****7752</div>
                  </div>
                  <div className="text-xs text-gray-500">1 items  |  {formatDateTime(item.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Illustrations ────────────────────────────────────────────────────────────
function HeroIllustration() {
  return (
    <svg viewBox="0 0 420 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="160" x2="420" y2="160" stroke="#e2e8f0" strokeWidth="1"/>
      <ellipse cx="290" cy="165" rx="100" ry="18" fill="#c7d2fe" fillOpacity="0.5"/>
      <rect x="230" y="80" width="120" height="80" rx="4" fill="#3b82f6"/>
      <rect x="230" y="72" width="50" height="16" rx="3" fill="#3b82f6"/>
      <rect x="232" y="82" width="116" height="76" rx="3" fill="#60a5fa"/>
      <line x1="248" y1="105" x2="328" y2="105" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <line x1="248" y1="115" x2="328" y2="115" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <line x1="248" y1="125" x2="300" y2="125" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <circle cx="320" cy="90" r="22" fill="#22c55e"/>
      <path d="M320 80 L320 96 M314 90 L320 98 L326 90" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="230" cy="75" r="28" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <path d="M230 75 L230 48 A27 27 0 0 1 254 88 Z" fill="#3b82f6"/>
      <path d="M230 75 L254 88 A27 27 0 0 1 206 88 Z" fill="#22c55e"/>
      <path d="M230 75 L206 88 A27 27 0 0 1 230 48 Z" fill="#e2e8f0"/>
      <circle cx="195" cy="115" r="8" fill="#fbbf24"/>
      <rect x="187" y="124" width="16" height="22" rx="3" fill="#60a5fa"/>
      <circle cx="385" cy="118" r="8" fill="#f87171"/>
      <rect x="377" y="127" width="16" height="22" rx="3" fill="#34d399"/>
    </svg>
  );
}
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 160 140" className="w-40 h-36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="118" rx="55" ry="10" fill="#e2e8f0"/>
      <path d="M25 105 L80 120 L135 105 L80 90 Z" fill="#cbd5e1"/>
      <path d="M25 105 L25 112 L80 127 L80 120 Z" fill="#94a3b8"/>
      <path d="M135 105 L135 112 L80 127 L80 120 Z" fill="#b0bec5"/>
      <rect x="61" y="50" width="50" height="45" rx="2" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <line x1="70" y1="62" x2="100" y2="62" stroke="#e2e8f0" strokeWidth="1.5"/>
      <line x1="70" y1="70" x2="100" y2="70" stroke="#e2e8f0" strokeWidth="1.5"/>
      <line x1="70" y1="78" x2="88" y2="78" stroke="#e2e8f0" strokeWidth="1.5"/>
    </svg>
  );
}
function SortIcon() {
  return (
    <svg className="w-3 h-3 text-gray-400 inline ml-0.5" viewBox="0 0 8 12" fill="currentColor">
      <path d="M4 0L7 4H1L4 0Z"/>
      <path d="M4 12L1 8H7L4 12Z"/>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function FileCollectionPage() {
  const navigate = useNavigate();
  const { role, basePath, storageKey, sharedKey, t } = useRole();

  const [activeTab, setActiveTab] = useState<TabType>('initiated');
  const [modalOpen, setModalOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionItem[]>(() => {
    try { const s=localStorage.getItem(storageKey('collections')); return s?JSON.parse(s):[]; } catch { return []; }
  });
  const [hoveredId, setHoveredId] = useState<string|null>(null);
  const [viewDetailsItem, setViewDetailsItem] = useState<CollectionItem|null>(null);
  const [settingsItem, setSettingsItem] = useState<CollectionItem|null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey('collections'), JSON.stringify(collections));
  }, [collections, storageKey]);

  // Navigate to the source directory (group folder) for a collection item
  function navigateToSourceDirectory(item: CollectionItem) {
    const parts = item.saveFolder.split(' / ').map(s => s.trim());
    const groupName = parts[0];
    const folderPathNames = parts.slice(1);
    if (!groupName || groupName === 'Personal') return;

    // Find the group ID
    let group: { id: string; name: string } | undefined;
    for (const key of ['shared:groups', `${role}:groups`]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr: { id: string; name: string }[] = JSON.parse(raw);
        if (Array.isArray(arr)) { group = arr.find(g => g.name === groupName); if (group) break; }
      } catch { /* ignore */ }
    }
    if (!group) return;

    // If no subfolder path, just navigate to the group root
    if (folderPathNames.length === 0) {
      navigate(`${basePath}/group/${group.id}`, { state: { groupName: group.name } });
      return;
    }

    // Resolve folder IDs by traversing the folder tree by name
    try {
      const foldersKey = `shared:folders-${group.id}`;
      const rootFolders: { id: string; name: string; folders?: { id: string; name: string; folders?: unknown[] }[] }[] =
        JSON.parse(localStorage.getItem(foldersKey) || '[]');

      const folderIds: string[] = [];
      let currentLevel = rootFolders;
      for (const name of folderPathNames) {
        const found = currentLevel.find(f => f.name === name);
        if (!found) break;
        folderIds.push(found.id);
        currentLevel = (found.folders as typeof currentLevel) ?? [];
      }

      const pathSuffix = folderIds.length > 0 ? '/' + folderIds.join('/') : '';
      navigate(`${basePath}/group/${group.id}${pathSuffix}`, { state: { groupName: group.name } });
    } catch {
      navigate(`${basePath}/group/${group.id}`, { state: { groupName: group.name } });
    }
  }
  function handleSubmit(data: CollectionFormData) {
    const item: CollectionItem = {
      id: crypto.randomUUID(), ...data,
      creator: role,
      createdAt: new Date().toISOString(), submitted: 0,
      total: data.participant==='designated'?Math.max(data.members.length,1):1,
    };
    setCollections(prev=>[item,...prev]);
    setModalOpen(false);
  }
  function handleSaveSettings(updated: CollectionItem) {
    setCollections(prev=>prev.map(c=>c.id===updated.id?updated:c));
    setSettingsItem(null);
  }
  function handleDelete(id: string) {
    setCollections(prev=>prev.filter(c=>c.id!==id));
    setSettingsItem(null); setViewDetailsItem(null);
  }

  const displayed = activeTab==='initiated'?collections:[];

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-600"/>
          <h1 className="text-base font-semibold text-gray-900">{t('page_file_collection')}</h1>
        </div>
        <button onClick={()=>navigate(`${basePath}/workbench`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200">
          {t('btn_exit')} <LogOut className="w-4 h-4"/>
        </button>
      </div>
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100 relative overflow-hidden" style={{height:180}}>
        <div onClick={()=>setModalOpen(true)}
          className="absolute left-6 top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-md p-5 w-52 cursor-pointer hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-blue-600 font-semibold text-sm mb-1">{t('hero_initiate_title')}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{t('hero_line1')}<br/>{t('hero_line2')}</div>
            </div>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-5 h-5 text-white"/>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-90"><HeroIllustration/></div>
      </div>
      <div className="flex-shrink-0 border-b border-gray-200 px-6">
        <div className="flex">
          {(['initiated','received'] as TabType[]).map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab===tab?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab==='initiated'?t('tab_i_initiated'):t('tab_i_received')}
            </button>
          ))}
        </div>
      </div>
      {displayed.length===0 ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <div className="text-center">
            <EmptyIllustration/>
            <p className="text-sm text-gray-400 mt-4 mb-5">{t('empty_no_data')}</p>
            <button onClick={()=>setModalOpen(true)} className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              {t('btn_initiate_collection')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-white sticky top-0">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 w-2/5">{t('table_header_name')} <SortIcon/></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/4">{t('table_header_creation_time')} <SortIcon/></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/6">{t('table_header_progress')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('table_header_status')}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(item=>{
                  const expired=isExpired(item);
                  const hovered=hoveredId===item.id;
                  return (
                    <tr key={item.id} onMouseEnter={()=>setHoveredId(item.id)} onMouseLeave={()=>setHoveredId(null)}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Folder className="w-6 h-6 text-blue-600 fill-blue-600 flex-shrink-0"/>
                          <span className="text-gray-800 font-medium truncate">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3.5 text-gray-600">{item.submitted} / {item.total}</td>
                      <td className="px-4 py-3.5">
                        {hovered ? (
                          <div className="flex items-center gap-0.5">
                            <ActionButton label="Source Directory" icon={<Folder className="w-4 h-4"/>} onClick={()=>navigateToSourceDirectory(item)}/>
                            <ActionButton label="View Details" icon={<LayoutGrid className="w-4 h-4"/>} onClick={()=>setViewDetailsItem(item)}/>
                            <ActionButton label="Open Settings" icon={<Settings className="w-4 h-4"/>} onClick={()=>setSettingsItem(item)}/>
                            <ActionButton label="Delete" icon={<Trash2 className="w-4 h-4"/>} onClick={()=>handleDelete(item.id)} danger/>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${expired?'bg-gray-100 text-gray-500':'bg-green-100 text-green-700'}`}>
                            {expired?t('status_expired'):t('status_collecting')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex-shrink-0 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">{displayed.length} item{displayed.length!==1?'s':''}</span>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><ChevronLeft className="w-3.5 h-3.5"/></button>
              <button className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-medium">1</button>
              <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"><ChevronRight className="w-3.5 h-3.5"/></button>
            </div>
          </div>
        </div>
      )}
      {modalOpen && <InitiateCollectionModal sharedKey={sharedKey} storageKey={storageKey} onSubmit={handleSubmit} onClose={()=>setModalOpen(false)} t={t}/>}
      {viewDetailsItem && (
        <ViewDetailsModal item={viewDetailsItem}
          onOpenSettings={()=>{ setSettingsItem(viewDetailsItem); setViewDetailsItem(null); }}
          onClose={()=>setViewDetailsItem(null)} t={t}/>
      )}
      {settingsItem && (
        <SettingsModal item={settingsItem} sharedKey={sharedKey} storageKey={storageKey}
          onSave={handleSaveSettings}
          onDelete={()=>handleDelete(settingsItem.id)}
          onClose={()=>setSettingsItem(null)} t={t}/>
      )}
    </div>
  );
}
