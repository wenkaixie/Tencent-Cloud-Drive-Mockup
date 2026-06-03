import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Folder, LogOut, Plus, Search, Filter, Trash2, X, ArrowLeftRight, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRole } from '../context/RoleContext';
import { UpgradeModal, type UpgradeReason } from './UpgradeModal';

const MAX_TEACHER_GROUPS = 6;

// ─── Role definitions ─────────────────────────────────────────────────────────
export type MemberRole = 'Viewer' | 'Previewer' | 'Downloader' | 'Uploader' | 'Editor' | 'Transmitter' | 'Teacher' | 'Student' | 'Parent';

export interface GroupMember {
  username: string;
  email?: string;
  role: MemberRole;
  isOwner?: boolean;
  avatarColor: string;
}

export const ROLE_OPTIONS: { value: MemberRole; label: string; sub: string; description: string }[] = [
  { value: 'Teacher',     label: 'Teacher',     sub: '老师',            description: 'Full access: edit, delete, share' },
  { value: 'Student',     label: 'Student',     sub: '学生',            description: 'List + preview + download + print' },
  { value: 'Parent',      label: 'Parent',      sub: '家长',            description: 'List + preview + download + print' },
  { value: 'Viewer',      label: 'Viewer',      sub: '查看者',          description: 'List file/folder names only' },
  { value: 'Previewer',   label: 'Previewer',   sub: '预览者',          description: 'List + online preview' },
  { value: 'Downloader',  label: 'Downloader',  sub: '下载者',          description: 'List + preview + download + print' },
  { value: 'Uploader',    label: 'Uploader',    sub: '上传者',          description: 'List + upload; preview/download/print own files' },
  { value: 'Transmitter', label: 'Transmitter', sub: '分享者 / 转发者', description: 'List + preview + download + print + upload + share' },
  { value: 'Editor',      label: 'Editor',      sub: '编辑者',          description: 'Full access: edit, delete, share' },
];

const DEMO_PRIMARY_ROLE_SET = new Set<MemberRole>(['Teacher', 'Student', 'Parent']);

// ─── Permission helpers ────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<MemberRole, { canList: boolean; canPreview: boolean; canDownload: boolean; canPrint: boolean; canUpload: boolean; canDelete: boolean; canEdit: boolean; canShare: boolean }> = {
  Viewer:      { canList: true,  canPreview: false, canDownload: false, canPrint: false, canUpload: false, canDelete: false, canEdit: false, canShare: false },
  Previewer:   { canList: true,  canPreview: true,  canDownload: false, canPrint: false, canUpload: false, canDelete: false, canEdit: false, canShare: false },
  Downloader:  { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: false, canDelete: false, canEdit: false, canShare: false },
  Uploader:    { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: true,  canDelete: false, canEdit: false, canShare: false },
  Transmitter: { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: true,  canDelete: false, canEdit: false, canShare: true  },
  Editor:      { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: true,  canDelete: true,  canEdit: true,  canShare: true  },
  Teacher:     { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: true,  canDelete: true,  canEdit: true,  canShare: true  },
  Student:     { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: false, canDelete: false, canEdit: false, canShare: false },
  Parent:      { canList: true,  canPreview: true,  canDownload: true,  canPrint: true,  canUpload: false, canDelete: false, canEdit: false, canShare: false },
};

function normalizeDemoMemberRoles(members: GroupMember[]) {
  return members.map((member) => {
    if (member.username === 'wangyifei' && member.role === 'Viewer') {
      return { ...member, role: 'Student' as MemberRole };
    }
    return member;
  });
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-orange-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500'];

interface OrgNode {
  id: string;
  name: string;
  type: 'org' | 'person';
  children?: OrgNode[];
}

const ORG_TREE: OrgNode[] = [
  {
    id: 'school',
    name: 'School',
    type: 'org',
    children: [
      { id: 'resources', name: 'Resources', type: 'org', children: [] },
      {
        id: 'class-3a', name: 'Class 3A', type: 'org',
        children: [
          { id: 'c3a-math', name: 'Math Group', type: 'org', children: [] },
          { id: 'c3a-english', name: 'English Group', type: 'org', children: [] },
        ],
      },
      { id: 'class-3b', name: 'Class 3B', type: 'org', children: [] },
      { id: 'teachers', name: 'Teachers', type: 'org', children: [] },
      { id: 'admin', name: 'Admin', type: 'org', children: [] },
    ],
  },
  { id: 'user-alice', name: 'alice.teacher', type: 'person' },
  { id: 'user-bob', name: 'bob.teacher', type: 'person' },
  { id: 'user-carol', name: 'carol.student', type: 'person' },
  { id: 'user-dave', name: 'dave.student', type: 'person' },
  { id: 'user-eve', name: 'eve.admin', type: 'person' },
];

function OrgTreeNode({
  node,
  expanded,
  onToggle,
  onAdd,
}: {
  node: OrgNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAdd: (node: OrgNode) => void;
}) {
  const hasChildren = node.type === 'org' && (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.id);
  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 rounded group">
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="p-0.5 text-gray-400 hover:text-gray-600">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
          node.type === 'org' ? 'text-blue-500' : 'text-gray-500'
        }`}>
          {node.type === 'org'
            ? <Users className="w-3.5 h-3.5" />
            : <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-semibold flex items-center justify-center">{node.name[0].toUpperCase()}</span>
          }
        </span>
        <span className="flex-1 text-sm text-gray-700 truncate">{node.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(node); }}
          className="ml-auto opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full border border-gray-400 text-gray-500 flex items-center justify-center hover:border-blue-500 hover:text-blue-500 transition-opacity"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4">
          {node.children!.map((child) => (
            <OrgTreeNode key={child.id} node={child} expanded={expanded} onToggle={onToggle} onAdd={onAdd} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Group {
  id: string;
  name: string;
  createdAt: string;
  tags: string[];
  members: GroupMember[];
}

interface Class {
  id: string;
  name: string;
  groupIds: string[];
  createdAt: string;
}

const TEMPLATES = [
  { id: 'sales', name: 'sales_daily.xlsx', type: 'xlsx' },
  { id: 'project', name: 'project_information_sheet.xlsx', type: 'xlsx' },
  { id: 'financial', name: 'financial_product_research.docx', type: 'docx' },
  { id: 'weekly', name: 'weekly_group_work_report.xlsx', type: 'xlsx' },
];

// Stable UUID for the one group shared between all roles
const ENGLISH_3A_ID = '3f7e4567-e89b-12d3-a456-426614174000';

// A group is "shared" (visible to both teacher & student) if:
// 1. It's the hardcoded English 3A group, OR
// 2. It has members from BOTH roles (teacher added a student, or vice versa)
const TEACHER_USERNAME = 'xiewenkai';
const STUDENT_USERNAME = 'wangyifei';
function isGroupShared(group: Group): boolean {
  if (group.id === ENGLISH_3A_ID) return true;
  const hasTeacher = group.members.some(m => m.username === TEACHER_USERNAME);
  const hasStudent = group.members.some(m => m.username === STUDENT_USERNAME);
  return hasTeacher && hasStudent;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-|-$/g, '') || `group-${Date.now()}`
  );
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function nowTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function GroupListView() {
  const navigate = useNavigate();
  const { role, storageKey, sharedKey, basePath } = useRole();

  // Invite modals
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [updateMembersOpen, setUpdateMembersOpen] = useState(false);
  const [orgExpanded, setOrgExpanded] = useState<Set<string>>(new Set(['school']));
  const [orgSearch, setOrgSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteView, setInviteView] = useState<'main' | 'link' | 'security'>('main');
  const [linkExpiryDate, setLinkExpiryDate] = useState<string | null>(null);
  const [linkDefaultRole, setLinkDefaultRole] = useState<MemberRole>('Editor');
  const [securityDropdownOpen, setSecurityDropdownOpen] = useState(false);
  const securityDropdownRef = useRef<HTMLDivElement>(null);

  // Upgrade modal
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

  // Editable member list inside Update Member modal
  const [editMembers, setEditMembers] = useState<GroupMember[]>([]);
  const [checkedMembers, setCheckedMembers] = useState<Set<string>>(new Set());
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [batchRoleOpen, setBatchRoleOpen] = useState(false);
  const batchRoleRef = useRef<HTMLDivElement>(null);

  function closeInvite() {
    setInviteGroupId(null);
    setUpdateMembersOpen(false);
    setOrgSearch('');
    setMemberSearch('');
    setEditMembers([]);
    setCheckedMembers(new Set());
    setInviteView('main');
    setSecurityDropdownOpen(false);
    setInviteLink(null);
  }

  function confirmUpdateMembers() {
    if (!inviteGroupId) return;
    setGroups(prev => prev.map(g => g.id === inviteGroupId ? { ...g, members: editMembers } : g));
    closeInvite();
  }

  function addMemberFromOrg(username: string) {
    setEditMembers(prev => {
      if (prev.some(m => m.username === username)) return prev;
      const color = AVATAR_COLORS[prev.length % AVATAR_COLORS.length];
      return [...prev, { username, role: 'Viewer', avatarColor: color }];
    });
  }

  function removeMembersByUsernames(usernames: Set<string>) {
    setEditMembers(prev => prev.filter(m => m.isOwner || !usernames.has(m.username)));
    setCheckedMembers(new Set());
  }

  function updateMemberRole(username: string, newRole: MemberRole) {
    setEditMembers(prev => prev.map(m => m.username === username ? { ...m, role: newRole } : m));
    setOpenRoleDropdown(null);
  }

  function applyBatchRole(newRole: MemberRole) {
    setEditMembers(prev => prev.map(m =>
      !m.isOwner && checkedMembers.has(m.username) ? { ...m, role: newRole } : m
    ));
    setBatchRoleOpen(false);
    setCheckedMembers(new Set());
  }

  function toggleOrgNode(id: string) {
    setOrgExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function generateLink() {
    if (!inviteGroupId) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const group = groups.find(g => g.id === inviteGroupId);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryStr = `${expiry.getFullYear()}-${pad2(expiry.getMonth() + 1)}-${pad2(expiry.getDate())} ${pad2(expiry.getHours())}:${pad2(expiry.getMinutes())}`;
    // Persist invite metadata so InvitePage can look it up by code
    localStorage.setItem(`invite:${code}`, JSON.stringify({
      groupId: inviteGroupId,
      groupName: group?.name ?? '',
      inviterName: currentUsername,
      role: linkDefaultRole,
      expiryDate: expiryStr,
    }));
    const link = `${window.location.origin}/invite/${code}`;
    setInviteLink(link);
    setLinkExpiryDate(expiryStr);
    setInviteView('link');
  }
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Rename modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Tag Management modal
  const [tagMgmtOpen, setTagMgmtOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);

  const [groups, setGroups] = useState<Group[]>(() => {
    const DEFAULT_MEMBERS: GroupMember[] = [
      { username: 'xiewenkai', email: 'xiewenkai@tencentschool.com', role: 'Editor', isOwner: true, avatarColor: 'bg-blue-500' },
      { username: 'wangyifei', email: 'wangyifei@tencentschool.com', role: 'Student', avatarColor: 'bg-orange-400' },
      { username: 'zhangwei', email: 'zhangwei@tencentschool.com', role: 'Student', avatarColor: 'bg-green-500' },
      { username: 'liuxiaoming', email: 'liuxiaoming@tencentschool.com', role: 'Student', avatarColor: 'bg-purple-500' },
      { username: 'chenjiahao', email: 'chenjiahao@tencentschool.com', role: 'Student', avatarColor: 'bg-pink-500' },
      { username: 'huangyuting', email: 'huangyuting@tencentschool.com', role: 'Student', avatarColor: 'bg-teal-500' },
      { username: 'zhaomeilin', email: 'zhaomeilin@tencentschool.com', role: 'Student', avatarColor: 'bg-blue-500' },
      { username: 'sunhaoyu', email: 'sunhaoyu@tencentschool.com', role: 'Student', avatarColor: 'bg-orange-400' },
      { username: 'wuziyan', email: 'wuziyan@tencentschool.com', role: 'Student', avatarColor: 'bg-green-500' },
      { username: 'zhouminghui', email: 'zhouminghui@tencentschool.com', role: 'Student', avatarColor: 'bg-purple-500' },
      { username: 'xujinyi', email: 'xujinyi@tencentschool.com', role: 'Student', avatarColor: 'bg-pink-500' },
      { username: 'linzixuan', email: 'linzixuan@tencentschool.com', role: 'Student', avatarColor: 'bg-teal-500' },
    ];

    // Load shared groups (visible to all roles — contains groups with cross-role members)
    let sharedGroups: Group[] = [];
    try {
      const saved = localStorage.getItem('shared:groups');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        sharedGroups = parsed.map((g: Group & { members?: GroupMember[] }) => ({
          ...g,
          // Always use DEFAULT_MEMBERS for the English 3A demo group to keep profiles fixed
          members: g.id === ENGLISH_3A_ID ? DEFAULT_MEMBERS : (
            Array.isArray(g.members) && g.members.length > 0
              ? normalizeDemoMemberRoles(g.members)
              : g.members || []
          ),
        }));
      }
    } catch {}
    if (!sharedGroups.some(g => g.id === ENGLISH_3A_ID)) {
      sharedGroups.push({ id: ENGLISH_3A_ID, name: 'English 3A (Student)', createdAt: '2024-01-01 00:00:00', tags: [], members: DEFAULT_MEMBERS });
    }

    // Load role-private groups (only for this role — groups without cross-role members)
    let privateGroups: Group[] = [];
    try {
      const saved = localStorage.getItem(storageKey('groups'));
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        privateGroups = parsed;
      }
    } catch {}

    return [...sharedGroups, ...privateGroups];
  });

  useEffect(() => {
    const sharedGroups = groups.filter(g => isGroupShared(g));
    const privateGroups = groups.filter(g => !isGroupShared(g));
    // Guard: never wipe shared:groups to empty — the English 3A seed must always persist
    if (sharedGroups.length > 0) {
      localStorage.setItem('shared:groups', JSON.stringify(sharedGroups));
    }
    localStorage.setItem(storageKey('groups'), JSON.stringify(privateGroups));
  }, [groups, storageKey]);

  // Determine the current user
  const currentUsername = role === 'teacher' ? 'xiewenkai' : 'wangyifei';

  // Check if current user can invite/manage members for a given group.
  // This is based on the user's role WITHIN that group, not the global /teacher or /student route.
  // Group owners can always invite. Users with Student/Parent role (downloader-level) cannot.
  function canUserInviteInGroup(groupId: string): boolean {
    const group = groups.find(g => g.id === groupId);
    if (!group) return false;
    const member = group.members.find(m => m.username === currentUsername);
    if (!member) return false;
    if (member.isOwner) return true;
    // Student and Parent map to downloader-level permissions — cannot invite
    const NON_INVITE_ROLES: Set<MemberRole> = new Set(['Student', 'Parent', 'Viewer', 'Previewer', 'Downloader']);
    return !NON_INVITE_ROLES.has(member.role);
  }

  // Check if current user is the owner of the group being edited
  const isCurrentUserGroupOwner = (() => {
    const group = inviteGroupId ? groups.find(g => g.id === inviteGroupId) : null;
    if (!group) return false;
    const member = group.members.find(m => m.username === currentUsername);
    return Boolean(member?.isOwner);
  })();

  function openInvite(groupId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    setInviteGroupId(groupId);
    setInviteLink(null);
    setInviteView('main');
    setSecurityDropdownOpen(false);
  }

  function openUpdateMembers() {
    const group = inviteGroupId ? groups.find(g => g.id === inviteGroupId) : null;
    setEditMembers(group?.members ? [...group.members] : []);
    setCheckedMembers(new Set());
    setOpenRoleDropdown(null);
    setBatchRoleOpen(false);
    setUpdateMembersOpen(true);
  }

  // ─── Classes (visual grouping — frontend only) ──────────────────────────────
  const [classes, setClasses] = useState<Class[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey('classes'));
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    // Seed a default class containing the English 3A group for ALL roles on first load
    return [{ id: 'default-class-english3a', name: 'English 3A', groupIds: [ENGLISH_3A_ID], createdAt: '2024-01-01 00:00:00' }];
  });

  useEffect(() => {
    localStorage.setItem(storageKey('classes'), JSON.stringify(classes));
  }, [classes, storageKey]);

  // ─── New dropdown ────────────────────────────────────────────────────────────
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setNewDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── New Class modal state ───────────────────────────────────────────────────
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedGroupIdsForClass, setSelectedGroupIdsForClass] = useState<string[]>([]);
  const [inlineNewGroupMode, setInlineNewGroupMode] = useState(false);
  const [inlineNewGroupName, setInlineNewGroupName] = useState('');

  // Add-groups-to-class modal (opened by clicking the empty class area)
  const [addGroupsClassId, setAddGroupsClassId] = useState<string | null>(null);
  const [addGroupsSelected, setAddGroupsSelected] = useState<string[]>([]);
  const [addGroupsInlineMode, setAddGroupsInlineMode] = useState(false);
  const [addGroupsInlineGroupName, setAddGroupsInlineGroupName] = useState('');

  // Drag-and-drop
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);
  const [dragOverStandalone, setDragOverStandalone] = useState(false);

  function openCreateGroup() {
    if (role === 'teacher') {
      const ownedCount = groups.filter(g => g.members.some(m => m.username === currentUsername && m.isOwner)).length;
      if (ownedCount >= MAX_TEACHER_GROUPS) {
        setUpgradeReason('groups');
        return;
      }
    }
    setNewGroupName('');
    setSelectedTemplates([]);
    setCreateOpen(true);
  }

  function confirmCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const ownerUsername = role === 'teacher' ? 'xiewenkai' : 'wangyifei';
    const ownerColor = role === 'teacher' ? 'bg-blue-500' : 'bg-orange-400';
    const owner: GroupMember = { username: ownerUsername, role: 'Editor', isOwner: true, avatarColor: ownerColor };
    const newGroup: Group = { id, name, createdAt: nowTimestamp(), tags: [], members: [owner] };
    setGroups((prev) => [...prev, newGroup]);
    setCreateOpen(false);
    navigate(`${basePath}/group/${id}`, { state: { groupName: name } });
  }

  function removeTagFromGroup(groupId: string, tag: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, tags: g.tags.filter((t) => t !== tag) } : g,
      ),
    );
  }

  function openRename() {
    if (!selectedGroupId) return;
    const g = groups.find((g) => g.id === selectedGroupId);
    if (!g) return;
    setRenameValue(g.name);
    setRenameOpen(true);
  }

  function confirmRename() {
    const name = renameValue.trim();
    if (!name || !selectedGroupId) return;
    setGroups((prev) => prev.map((g) => (g.id === selectedGroupId ? { ...g, name } : g)));
    setRenameOpen(false);
  }

  function openTagMgmt() {
    if (!selectedGroupId) return;
    const g = groups.find((g) => g.id === selectedGroupId);
    setPendingTags(g ? [...g.tags] : []);
    setTagInput('');
    setTagMgmtOpen(true);
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = tagInput.trim();
      if (val && !pendingTags.includes(val)) {
        setPendingTags((prev) => [...prev, val]);
      }
      setTagInput('');
    }
  }

  function removePendingTag(tag: string) {
    setPendingTags((prev) => prev.filter((t) => t !== tag));
  }

  function confirmTagMgmt() {
    if (!selectedGroupId) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === selectedGroupId ? { ...g, tags: pendingTags } : g)),
    );
    setTagMgmtOpen(false);
  }

  // ─── Class management ────────────────────────────────────────────────────────
  function openCreateClass() {
    setNewClassName('');
    setSelectedGroupIdsForClass([]);
    setInlineNewGroupMode(false);
    setInlineNewGroupName('');
    setCreateClassOpen(true);
  }

  function confirmInlineNewGroup() {
    const name = inlineNewGroupName.trim();
    if (!name) return;
    if (role === 'teacher') {
      const ownedCount = groups.filter(g => g.members.some(m => m.username === currentUsername && m.isOwner)).length;
      if (ownedCount >= MAX_TEACHER_GROUPS) {
        setCreateClassOpen(false);
        setUpgradeReason('groups');
        return;
      }
    }
    const id = crypto.randomUUID();
    const ownerUsername = role === 'teacher' ? 'xiewenkai' : 'wangyifei';
    const ownerColor = role === 'teacher' ? 'bg-blue-500' : 'bg-orange-400';
    const owner: GroupMember = { username: ownerUsername, role: 'Editor', isOwner: true, avatarColor: ownerColor };
    const newGroup: Group = { id, name, createdAt: nowTimestamp(), tags: [], members: [owner] };
    setGroups(prev => [...prev, newGroup]);
    setSelectedGroupIdsForClass(prev => [...prev, id]);
    setInlineNewGroupMode(false);
    setInlineNewGroupName('');
  }

  function confirmCreateClass() {
    const name = newClassName.trim();
    if (!name) return;
    let id = `class-${slugify(name)}`;
    if (classes.some(c => c.id === id)) id = `${id}-${Date.now()}`;
    const newClass: Class = { id, name, groupIds: selectedGroupIdsForClass, createdAt: nowTimestamp() };
    setClasses(prev => [...prev, newClass]);
    setCreateClassOpen(false);
  }

  function openAddGroupsToClass(classId: string) {
    const cls = classes.find(c => c.id === classId);
    setAddGroupsSelected(cls ? [...cls.groupIds] : []);
    setAddGroupsInlineMode(false);
    setAddGroupsInlineGroupName('');
    setAddGroupsClassId(classId);
  }

  function confirmAddGroupsToClass() {
    if (!addGroupsClassId) return;
    setClasses(prev => prev.map(c =>
      c.id === addGroupsClassId ? { ...c, groupIds: addGroupsSelected } : c
    ));
    setAddGroupsClassId(null);
  }

  function confirmAddGroupsInlineNewGroup() {
    const name = addGroupsInlineGroupName.trim();
    if (!name) return;
    if (role === 'teacher') {
      const ownedCount = groups.filter(g => g.members.some(m => m.username === currentUsername && m.isOwner)).length;
      if (ownedCount >= MAX_TEACHER_GROUPS) {
        setAddGroupsClassId(null);
        setUpgradeReason('groups');
        return;
      }
    }
    const id = crypto.randomUUID();
    const ownerUsername = role === 'teacher' ? 'xiewenkai' : 'wangyifei';
    const ownerColor = role === 'teacher' ? 'bg-blue-500' : 'bg-orange-400';
    const owner: GroupMember = { username: ownerUsername, role: 'Editor', isOwner: true, avatarColor: ownerColor };
    const newGroup: Group = { id, name, createdAt: nowTimestamp(), tags: [], members: [owner] };
    setGroups(prev => [...prev, newGroup]);
    setAddGroupsSelected(prev => [...prev, id]);
    setAddGroupsInlineMode(false);
    setAddGroupsInlineGroupName('');
  }

  function handleDropGroupToClass(classId: string, groupId: string) {
    setClasses(prev => prev.map(c => {
      if (c.id === classId) {
        if (!c.groupIds.includes(groupId)) {
          return { ...c, groupIds: [...c.groupIds, groupId] };
        }
        return c;
      }
      // Remove from other classes so a group belongs to at most one class
      return { ...c, groupIds: c.groupIds.filter(id => id !== groupId) };
    }));
    setDraggingGroupId(null);
    setDragOverClassId(null);
    setDragOverStandalone(false);
  }

  function handleDropOnStandalone(groupId: string) {
    // Only remove from class if the group was actually in one
    if (classes.some(c => c.groupIds.includes(groupId))) {
      setClasses(prev => prev.map(c => ({
        ...c,
        groupIds: c.groupIds.filter(id => id !== groupId),
      })));
    }
    setDraggingGroupId(null);
    setDragOverClassId(null);
    setDragOverStandalone(false);
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const inviteGroup = inviteGroupId ? groups.find((g) => g.id === inviteGroupId) ?? null : null;

  // ─── Full group card renderer (shared by class boxes and standalone list) ───
  function renderGroupCard(group: Group) {
    let groupFolderList: { id: string; name: string }[] = [];
    try {
      const saved = localStorage.getItem(sharedKey(`folders-${group.id}`));
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        groupFolderList = parsed.filter(
          (f: unknown) => typeof f === 'object' && f !== null && 'name' in (f as object),
        );
      }
    } catch {}

    return (
      <div
        key={group.id}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingGroupId(group.id); }}
        onDragEnd={() => { setDraggingGroupId(null); setDragOverClassId(null); setDragOverStandalone(false); }}
        className={`border rounded-lg cursor-pointer transition-all ${
          draggingGroupId === group.id ? 'opacity-50' : ''
        } ${
          selectedGroupId === group.id
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-200 bg-white hover:shadow-sm'
        }`}
        onClick={() => setSelectedGroupId((prev) => (prev === group.id ? null : group.id))}
        onDoubleClick={() =>
          navigate(`${basePath}/group/${group.id}`, { state: { groupName: group.name } })
        }
      >
        <div className="flex">
          {/* Left: group info */}
          <div
            className={`flex-shrink-0 w-60 p-5 border-r ${
              selectedGroupId === group.id ? 'border-blue-200' : 'border-gray-200'
            }`}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">{group.name}</h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-green-300 text-green-700 text-xs font-medium rounded">
                <LogOut className="w-3 h-3" />
                External Sharing
              </span>
            </div>
            <div className="text-sm text-gray-500 mb-4">Group owner – {group.members.find(m => m.isOwner)?.username ?? 'xiewenkai'} / 0 files</div>

            {/* Member avatars row */}
            <div className="flex items-center gap-1 mb-2 min-w-0">
              {canUserInviteInGroup(group.id) && (
              <button
                onClick={(e) => openInvite(group.id, e)}
                className="inline-flex items-center justify-center w-6 h-6 text-blue-600 hover:bg-blue-50 text-xs rounded-full border border-blue-300 flex-shrink-0"
                title="Invite members"
              >
                <Plus className="w-3 h-3" />
              </button>
              )}
              <div className="flex h-6 items-center min-w-0 overflow-hidden whitespace-nowrap">
                {group.members.map((member) => (
                  <span
                    key={member.username}
                    title={`${member.username}${member.isOwner ? ' (owner)' : ` — ${member.role}`}`}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold flex-shrink-0 -ml-1 first:ml-0 ring-2 ring-white ${member.avatarColor}`}
                  >
                    {member.username[0].toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {group.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200"
                >
                  {tag}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTagFromGroup(group.id, tag);
                    }}
                    className="hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>

            <button
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:bg-gray-100 text-xs rounded mt-2"
            >
              <Plus className="w-3 h-3" />
              <span>Add Tag</span>
            </button>
          </div>

          {/* Right: folder preview */}
          <div className="flex-1 flex items-center justify-center py-6 px-4">
            {groupFolderList.length > 0 ? (
              <div className="flex flex-wrap gap-6 justify-start w-full">
                {groupFolderList.map((folder) => (
                  <div key={folder.id} className="text-center w-24">
                    <Folder className="w-12 h-12 text-blue-600 fill-blue-600 mx-auto mb-2" />
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {folder.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <svg viewBox="0 0 120 120" className="w-24 h-24">
                    <rect x="30" y="25" width="60" height="70" rx="3" fill="none" stroke="#d1d5db" strokeWidth="2" />
                    <rect x="30" y="25" width="60" height="70" rx="3" fill="#f9fafb" />
                    <line x1="42" y1="50" x2="78" y2="50" stroke="#d1d5db" strokeWidth="2" />
                    <line x1="42" y1="60" x2="78" y2="60" stroke="#d1d5db" strokeWidth="2" />
                    <line x1="42" y1="70" x2="65" y2="70" stroke="#d1d5db" strokeWidth="2" />
                    <rect x="22" y="35" width="52" height="62" rx="3" fill="none" stroke="#e5e7eb" strokeWidth="1.5" />
                    <rect x="22" y="35" width="52" height="62" rx="3" fill="white" fillOpacity="0.7" />
                    <line x1="34" y1="58" x2="62" y2="58" stroke="#e5e7eb" strokeWidth="1.5" />
                    <line x1="34" y1="67" x2="62" y2="67" stroke="#e5e7eb" strokeWidth="1.5" />
                    <line x1="34" y1="76" x2="55" y2="76" stroke="#e5e7eb" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="text-gray-400 text-sm mb-3">No files found</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`${basePath}/group/${group.id}`, { state: { groupName: group.name } });
                  }}
                  className="px-5 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Go to upload
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 bg-white h-full">
      {upgradeReason && <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Class</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {role === 'teacher' ? (
            <div className="relative" ref={newDropdownRef}>
              <button
                onClick={() => setNewDropdownOpen(p => !p)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>New</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </button>
              {newDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-30 py-1">
                  <button
                    onClick={() => { setNewDropdownOpen(false); openCreateClass(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-blue-50 text-left text-sm text-gray-700"
                  >
                    <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    New Class
                  </button>
                  <button
                    onClick={() => { setNewDropdownOpen(false); openCreateGroup(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-blue-50 text-left text-sm text-gray-700"
                  >
                    <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    New Group
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative" ref={newDropdownRef}>
              <button
                onClick={() => setNewDropdownOpen(p => !p)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>New</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </button>
              {newDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-30 py-1">
                  <button
                    onClick={() => { setNewDropdownOpen(false); openCreateClass(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-blue-50 text-left text-sm text-gray-700"
                  >
                    <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    New Class
                  </button>
                  <button
                    onClick={() => { setNewDropdownOpen(false); openCreateGroup(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-blue-50 text-left text-sm text-gray-700"
                  >
                    <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    New Group
                  </button>
                </div>
              )}
            </div>
          )}
          {selectedGroup && (
            <>
              {canUserInviteInGroup(selectedGroup.id) && (
              <button
                onClick={() => openInvite(selectedGroup.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                Invite
              </button>
              )}
              <button
                onClick={() => {
                  const id = selectedGroupId!;
                  setGroups(prev => prev.filter(g => g.id !== id));
                  setClasses(prev => prev.map(c => ({ ...c, groupIds: c.groupIds.filter(gid => gid !== id) })));
                  setSelectedGroupId(null);
                }}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm font-medium"
              >
                Delete
              </button>
              <button
                onClick={openRename}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Rename
              </button>
              <button
                onClick={openTagMgmt}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Tag Management
              </button>
            </>
          )}
        </div>
        {!selectedGroup && (
          <div className="relative">
            <input
              type="text"
              placeholder="Please enter class name"
              className="w-80 px-4 py-2 pr-20 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button className="p-1 hover:bg-gray-100 rounded">
                <Search className="w-4 h-4 text-gray-500" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Filter className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Group Cards */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {/* ── Classes (visual groupings — each role sees their own) ── */}
        {classes.map((cls) => {
          const clsGroups = groups.filter(g => cls.groupIds.includes(g.id));
          return (
            <div key={cls.id} className="border-2 border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-200 group/cls rounded-t-xl sticky top-0 z-10">
                <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900 text-sm">{cls.name}</span>
                <span className="ml-1 text-xs text-gray-400 font-normal">{clsGroups.length} group{clsGroups.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setClasses(prev => prev.filter(c => c.id !== cls.id)); }}
                  className="ml-auto p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover/cls:opacity-100 transition-opacity"
                  title="Delete class (groups are kept)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div
                className={`bg-blue-50/20 p-3 space-y-2 min-h-[60px] transition-colors rounded-b-xl ${dragOverClassId === cls.id ? 'bg-blue-100/60 ring-2 ring-blue-400 ring-inset' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverClassId(cls.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverClassId(null); }}
                onDrop={(e) => { e.preventDefault(); if (draggingGroupId) handleDropGroupToClass(cls.id, draggingGroupId); }}
              >
                {clsGroups.length === 0 ? (
                  <div
                    className="text-center text-sm text-gray-400 py-4 cursor-pointer hover:bg-blue-100/50 rounded-lg transition-colors select-none"
                    onClick={() => openAddGroupsToClass(cls.id)}
                  >
                    No group in this class yet. Click to add group or drag to add group.
                  </div>
                ) : clsGroups.map(g => renderGroupCard(g))}
              </div>
            </div>
          );
        })}
        {/* ── Standalone groups (not assigned to any class) ── */}
        {(() => {
          const standaloneGroups = groups.filter(g => !classes.some(c => c.groupIds.includes(g.id)));
          const isDraggingFromClass = draggingGroupId !== null && classes.some(c => c.groupIds.includes(draggingGroupId));
          return (
            <div
              className={`space-y-3 rounded-xl transition-all ${
                isDraggingFromClass
                  ? dragOverStandalone
                    ? 'ring-2 ring-blue-400 bg-blue-50/40 p-2'
                    : 'ring-2 ring-dashed ring-gray-300 p-2'
                  : ''
              }`}
              onDragOver={(e) => { if (!isDraggingFromClass) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStandalone(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStandalone(false); }}
              onDrop={(e) => { e.preventDefault(); if (draggingGroupId) handleDropOnStandalone(draggingGroupId); }}
            >
              {isDraggingFromClass && (
                <div className={`text-center text-sm py-3 rounded-lg border-2 border-dashed transition-colors ${
                  dragOverStandalone ? 'border-blue-400 bg-blue-50 text-blue-600 font-medium' : 'border-gray-300 text-gray-400'
                }`}>
                  Drop here to remove from class
                </div>
              )}
              {standaloneGroups.map(group => renderGroupCard(group))}
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      {!selectedGroup && (
        <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500 border-t border-gray-100">
          <span>{groups.length} items</span>
          <div className="flex items-center gap-2">
            <select className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-600">
              <option>10 / page</option>
              <option>20 / page</option>
              <option>50 / page</option>
            </select>
            <button className="p-1 hover:bg-gray-100 rounded disabled:opacity-40" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded text-xs font-medium">
              1
            </button>
            <button className="p-1 hover:bg-gray-100 rounded disabled:opacity-40" disabled>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Groups to Class Modal */}
      {addGroupsClassId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Add Class
              </h2>
              <button onClick={() => setAddGroupsClassId(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Assign existing groups */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Add Groups to this Class</label>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No groups yet — create one below</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addGroupsSelected.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAddGroupsSelected(prev => [...prev, g.id]);
                          } else {
                            setAddGroupsSelected(prev => prev.filter(id => id !== g.id));
                          }
                        }}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-800">{g.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{g.members.length} member{g.members.length !== 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Inline new group creation */}
            <div className="mb-5">
              {addGroupsInlineMode ? (
                <div className="flex items-center gap-2 p-2 border border-blue-200 rounded-lg bg-blue-50">
                  <input
                    type="text"
                    value={addGroupsInlineGroupName}
                    onChange={(e) => setAddGroupsInlineGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmAddGroupsInlineNewGroup()}
                    autoFocus
                    placeholder="New group name"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={confirmAddGroupsInlineNewGroup}
                    disabled={!addGroupsInlineGroupName.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddGroupsInlineMode(false); setAddGroupsInlineGroupName(''); }}
                    className="p-1.5 hover:bg-blue-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddGroupsInlineMode(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Create & add a new group
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setAddGroupsClassId(null)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddGroupsToClass}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {createClassOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Create Class
              </h2>
              <button onClick={() => setCreateClassOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Class Name */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Class Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value.slice(0, 64))}
                  onKeyDown={(e) => e.key === 'Enter' && confirmCreateClass()}
                  autoFocus
                  placeholder="e.g. English 3A"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">{newClassName.length}/64</span>
              </div>
            </div>

            {/* Assign existing groups */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Add Groups to this Class</label>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No groups yet — create one below</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupIdsForClass.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupIdsForClass(prev => [...prev, g.id]);
                          } else {
                            setSelectedGroupIdsForClass(prev => prev.filter(id => id !== g.id));
                          }
                        }}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-800">{g.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{g.members.length} member{g.members.length !== 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Inline new group creation */}
            <div className="mb-5">
              {inlineNewGroupMode ? (
                <div className="flex items-center gap-2 p-2 border border-blue-200 rounded-lg bg-blue-50">
                  <input
                    type="text"
                    value={inlineNewGroupName}
                    onChange={(e) => setInlineNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmInlineNewGroup()}
                    autoFocus
                    placeholder="New group name"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={confirmInlineNewGroup}
                    disabled={!inlineNewGroupName.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setInlineNewGroupMode(false); setInlineNewGroupName(''); }}
                    className="p-1.5 hover:bg-blue-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setInlineNewGroupMode(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Create & add a new group
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setCreateClassOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreateClass}
                disabled={!newClassName.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Create group</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Group Name */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value.slice(0, 64))}
                  onKeyDown={(e) => e.key === 'Enter' && confirmCreateGroup()}
                  autoFocus
                  placeholder="Please enter group name"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">{newGroupName.length}/64</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Name doesn't support characters "/", word count no more than 64 characters
              </p>
            </div>

            {/* Invitation Range */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 whitespace-nowrap">
                Invitation range
                <span className="w-4 h-4 rounded-full border border-gray-400 text-gray-400 text-[10px] flex items-center justify-center cursor-help leading-none">
                  i
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2 border border-gray-300 rounded px-3 py-1.5 text-sm text-blue-600 cursor-pointer hover:bg-gray-50 select-none">
                <span>Enterprise only (Including te...</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </div>
            </div>

            {/* Select Template */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Select template</span>
                <button className="text-blue-600 text-sm hover:underline">More templates &rsaquo;</button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {TEMPLATES.map((tpl) => (
                  <label
                    key={tpl.id}
                    className={`relative flex flex-col items-center gap-1.5 p-2 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplates.includes(tpl.id)
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTemplates.includes(tpl.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTemplates((prev) => [...prev, tpl.id]);
                        } else {
                          setSelectedTemplates((prev) => prev.filter((id) => id !== tpl.id));
                        }
                      }}
                      className="absolute top-1.5 left-1.5 w-3.5 h-3.5"
                    />
                    <div
                      className={`w-10 h-12 rounded flex items-center justify-center ${
                        tpl.type === 'docx' ? 'bg-blue-100' : 'bg-green-100'
                      }`}
                    >
                      <span
                        className={`text-lg font-bold leading-none ${
                          tpl.type === 'docx' ? 'text-blue-600' : 'text-green-600'
                        }`}
                      >
                        {tpl.type === 'docx' ? 'W' : '⊞'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2 w-full">
                      {tpl.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <button className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <span className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 font-bold text-xs leading-none">
                  +
                </span>
                Import
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[460px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Modify group name</h2>
              <button onClick={() => setRenameOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value.slice(0, 64))}
                  onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                  autoFocus
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-400 whitespace-nowrap">{renameValue.length}/64</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Name doesn't support characters "/", word count no more than 64 characters
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setRenameOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {tagMgmtOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Tag Management</h2>
              <button onClick={() => setTagMgmtOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tag input */}
            <div className="flex items-center border border-blue-400 rounded-md px-3 py-2 gap-2 mb-1 focus-within:ring-2 focus-within:ring-blue-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded whitespace-nowrap flex-shrink-0">
                Private Tag ⇌
              </span>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value.slice(0, 80))}
                onKeyDown={handleTagInputKeyDown}
                autoFocus
                placeholder="Press Enter to add a new Tag"
                className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
              />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Name doesn't support characters "\/:*?"&lt;&gt;|", word count no more than 80 characters
            </p>

            {/* Selected tags */}
            {pendingTags.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">Selected</span>
                  <button className="text-xs text-gray-500 hover:underline">All Tags &rsaquo;</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded"
                    >
                      {tag}
                      <button
                        onClick={() => removePendingTag(tag)}
                        className="hover:bg-blue-100 rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lastly section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">Lastly</span>
                <button className="text-xs text-gray-500 hover:underline">All Tags &rsaquo;</button>
              </div>
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <svg viewBox="0 0 64 64" className="w-12 h-12 mb-2 opacity-40">
                  <circle cx="28" cy="28" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
                  <line x1="40" y1="40" x2="54" y2="54" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <line x1="22" y1="28" x2="34" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="28" y1="22" x2="28" y2="34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="text-sm">No records, please add tags</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setTagMgmtOpen(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmTagMgmt}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Invitation Modal */}
      {inviteGroup && !updateMembersOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setSecurityDropdownOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[460px]" onClick={e => e.stopPropagation()}>

            {/* ── View: main ── */}
            {inviteView === 'main' && (
              <>
                <div className="flex items-center justify-between px-6 pt-6 pb-0">
                  <h2 className="text-lg font-semibold text-gray-900">Member invitation</h2>
                  <button onClick={closeInvite} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 px-6 pt-3 pb-5">
                  Invite members to join &ldquo;{inviteGroup.name}&rdquo;
                </p>
                {/* Add members row */}
                <div
                  onClick={openUpdateMembers}
                  className="mx-4 mb-4 flex items-center justify-between px-4 py-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                >
                  <span className="text-sm font-semibold text-gray-800">Add members</span>
                  <div className="flex items-center gap-1">
                    {inviteGroup.members.slice(0, 5).map(m => (
                      <span key={m.username} title={m.username}
                        className={`w-7 h-7 rounded-full ${m.avatarColor} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-white -ml-1 first:ml-0`}>
                        {m.username[0].toUpperCase()}
                      </span>
                    ))}
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-2" />
                  </div>
                </div>
                {/* Generate invitation link row */}
                <div className="mx-4 mb-6 flex items-center justify-between px-4 py-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-800">Generate invitation link</span>
                  <button
                    onClick={generateLink}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                  >
                    Generate link
                  </button>
                </div>
                <div className="px-6 pb-5 text-xs text-gray-400">
                  Valid within 7 days;External members can be invited; {linkDefaultRole}
                </div>
              </>
            )}

            {/* ── View: link generated ── */}
            {inviteView === 'link' && (
              <>
                <div className="flex items-center justify-between px-6 pt-6 pb-0">
                  <h2 className="text-lg font-semibold text-gray-900">Member invitation</h2>
                  <button onClick={closeInvite} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 px-6 pt-3 pb-5">
                  Invite members to join &ldquo;{inviteGroup.name}&rdquo;
                </p>
                {/* Add members row */}
                <div
                  onClick={openUpdateMembers}
                  className="mx-4 mb-4 flex items-center justify-between px-4 py-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                >
                  <span className="text-sm font-semibold text-gray-800">Add members</span>
                  <div className="flex items-center gap-1">
                    {inviteGroup.members.slice(0, 5).map(m => (
                      <span key={m.username} title={m.username}
                        className={`w-7 h-7 rounded-full ${m.avatarColor} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-white -ml-1 first:ml-0`}>
                        {m.username[0].toUpperCase()}
                      </span>
                    ))}
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-2" />
                  </div>
                </div>
                {/* Link section */}
                <div className="mx-4 mb-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-800">Generate invitation link</span>
                    <button
                      onClick={() => { setInviteLink(null); setInviteView('main'); }}
                      className="px-3 py-1.5 border border-red-400 text-red-500 text-sm font-medium rounded-md hover:bg-red-50"
                    >
                      Stop sharing
                    </button>
                  </div>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-sm text-orange-500 font-medium">{linkExpiryDate} <span className="ml-1">Expired</span></p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="text-blue-600 font-medium">0</span> member joined successfully
                    </p>
                  </div>
                  <div className="mx-4 border-t border-gray-200 my-2" />
                  <div className="px-4 pb-3">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Click the link to join my &apos;{inviteGroup.name}&apos; group and start a new experience of file collaboration management together!{' '}
                      Link:{inviteLink}
                    </p>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => inviteLink && navigator.clipboard.writeText(`Click the link to join my '${inviteGroup.name}' group and start a new experience of file collaboration management together! Link:${inviteLink}`)}
                        className="px-5 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5 flex items-center justify-between text-xs text-gray-400">
                  <span>Valid within 7 days;External members can be invited; {linkDefaultRole}</span>
                  <button
                    onClick={() => setInviteView('security')}
                    className="text-blue-600 hover:underline text-xs font-medium flex-shrink-0 ml-2"
                  >
                    Security settings
                  </button>
                </div>
              </>
            )}

            {/* ── View: security settings ── */}
            {inviteView === 'security' && (
              <>
                <div className="flex items-center gap-2 px-6 pt-6 pb-5 border-b border-gray-100">
                  <button
                    onClick={() => { setInviteView(inviteLink ? 'link' : 'main'); setSecurityDropdownOpen(false); }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">Security settings</h2>
                  <button onClick={closeInvite} className="ml-auto p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {/* Invitation range */}
                <div className="mx-4 mt-4 flex items-center justify-between px-4 py-4 bg-gray-50 rounded-lg mb-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                    Invitation range
                    <span className="w-4 h-4 rounded-full border border-gray-400 text-gray-400 text-[10px] flex items-center justify-center cursor-help leading-none">!</span>
                  </div>
                  <span className="text-sm text-gray-600">All users</span>
                </div>
                {/* Default permissions */}
                <div className="mx-4 mb-6 px-4 py-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      Default permissions for Invite Links
                      <span className="w-4 h-4 rounded-full border border-gray-400 text-gray-400 text-[10px] flex items-center justify-center cursor-help leading-none">!</span>
                    </div>
                    <div className="relative" ref={securityDropdownRef}>
                      <button
                        onClick={() => setSecurityDropdownOpen(p => !p)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-blue-500 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 min-w-[110px] justify-between"
                      >
                        {linkDefaultRole}
                        {securityDropdownOpen
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4 -rotate-90" />}
                      </button>
                      {securityDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                          {(['Viewer','Previewer','Downloader','Uploader','Transmitter','Editor'] as MemberRole[]).map(r => (
                            <button
                              key={r}
                              onClick={() => { setLinkDefaultRole(r); setSecurityDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                                r === linkDefaultRole ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Update Member Modal */}
      {inviteGroup && updateMembersOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => { setOpenRoleDropdown(null); setBatchRoleOpen(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-[780px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Update member</h2>
              <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <span className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[10px]">?</span>
                Permission details
              </button>
              <button onClick={closeInvite} className="ml-auto p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0">
              {/* Left panel */}
              <div className="w-[360px] flex flex-col border-r border-gray-200 flex-shrink-0">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-4 flex-shrink-0">
                  <button className="px-4 py-2.5 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px">
                    Corporate members
                  </button>
                  <button className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
                    Temporary members
                  </button>
                </div>

                {/* Left search */}
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Please enter team/member name"
                      className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Org tree */}
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {ORG_TREE.filter((n) =>
                    orgSearch === '' || n.name.toLowerCase().includes(orgSearch.toLowerCase())
                  ).map((node) => (
                    <OrgTreeNode
                      key={node.id}
                      node={node}
                      expanded={orgExpanded}
                      onToggle={toggleOrgNode}
                      onAdd={(node) => addMemberFromOrg(node.name)}
                    />
                  ))}
                </div>
              </div>

              {/* Transfer arrows */}
              <div className="w-8 flex items-center justify-center flex-shrink-0">
                <ArrowLeftRight className="w-4 h-4 text-gray-300" />
              </div>

              {/* Right panel */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Right header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">All members {editMembers.length}</span>
                  {isCurrentUserGroupOwner && (
                  <div className="flex items-center gap-2">
                    {/* Batch permission dropdown */}
                    <div className="relative" ref={batchRoleRef}>
                      <button
                        onClick={() => setBatchRoleOpen(p => !p)}
                        disabled={checkedMembers.size === 0}
                        className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Permission setting...
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {batchRoleOpen && (
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                          {ROLE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                if (!DEMO_PRIMARY_ROLE_SET.has(opt.value)) return;
                                applyBatchRole(opt.value);
                              }}
                              className={`w-full flex items-start gap-2 px-4 py-2 text-left ${DEMO_PRIMARY_ROLE_SET.has(opt.value) ? 'hover:bg-blue-50' : 'opacity-50 cursor-not-allowed bg-gray-50'}`}
                              disabled={!DEMO_PRIMARY_ROLE_SET.has(opt.value)}
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-800">{opt.label} <span className="text-gray-500 font-normal">{opt.sub}</span></div>
                                <div className="text-xs text-gray-400">{opt.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeMembersByUsernames(checkedMembers)}
                      disabled={checkedMembers.size === 0}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                  )}
                </div>

                {/* Right search */}
                <div className="px-3 pt-2 pb-2 flex-shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Please enter members name"
                      className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Members list */}
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {editMembers.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-400">No members added yet</p>
                    </div>
                  ) : (
                    editMembers
                      .filter(m => memberSearch === '' || m.username.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((member) => (
                        <div key={member.username} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded group">
                          {/* Checkbox — owner can't be unchecked, non-group-owners don't see checkboxes */}
                          {isCurrentUserGroupOwner ? (
                            <input
                              type="checkbox"
                              disabled={member.isOwner}
                              checked={checkedMembers.has(member.username)}
                              onChange={e => {
                                setCheckedMembers(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(member.username);
                                  else next.delete(member.username);
                                  return next;
                                });
                              }}
                              className="rounded border-gray-300 disabled:opacity-0"
                            />
                          ) : (
                            <span className="w-4" />
                          )}
                          {/* Avatar */}
                          <span className={`w-7 h-7 rounded-full ${member.avatarColor} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
                            {member.username[0].toUpperCase()}
                          </span>
                          {/* Name */}
                          {/* Name + Email */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 truncate block">{member.username}</span>
                            {member.email && <span className="text-xs text-gray-400 truncate block">{member.email}</span>}
                          </div>
                          {/* Role */}
                          {member.isOwner ? (
                            <span className="text-sm text-gray-500">Group owner (Myself)</span>
                          ) : isCurrentUserGroupOwner ? (
                            <div className="relative">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenRoleDropdown(p => p === member.username ? null : member.username); }}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                {member.role}
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              {openRoleDropdown === member.username && (
                                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                                  {ROLE_OPTIONS.map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => {
                                        if (!DEMO_PRIMARY_ROLE_SET.has(opt.value)) return;
                                        updateMemberRole(member.username, opt.value);
                                      }}
                                      className={`w-full flex items-start gap-2 px-4 py-2.5 text-left ${opt.value === member.role ? 'bg-blue-50' : ''} ${DEMO_PRIMARY_ROLE_SET.has(opt.value) ? 'hover:bg-blue-50' : 'opacity-50 cursor-not-allowed bg-gray-50'}`}
                                      disabled={!DEMO_PRIMARY_ROLE_SET.has(opt.value)}
                                    >
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-800">
                                          {opt.label} <span className="text-gray-500 font-normal">{opt.sub}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">{opt.description}</div>
                                      </div>
                                      {opt.value === member.role && (
                                        <span className="text-blue-600 text-xs mt-0.5">✓</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">{member.role}</span>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={closeInvite}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpdateMembers}
                className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
