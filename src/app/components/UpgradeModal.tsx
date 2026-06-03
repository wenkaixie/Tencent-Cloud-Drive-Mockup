import { X } from 'lucide-react';

export type UpgradeReason = 'groups' | 'storage' | 'esign';

interface UpgradeModalProps {
  reason: UpgradeReason;
  onClose: () => void;
}

const CONTENT: Record<UpgradeReason, { title: string; message: string }> = {
  groups: {
    title: 'Group Limit Reached',
    message:
      'You have reached the maximum of 6 groups on your current plan. Upgrade to the Enterprise tier to create unlimited groups and unlock more collaboration features.',
  },
  storage: {
    title: 'Storage Limit Reached',
    message:
      'You have reached the 10 GB storage limit on your current plan. Upgrade to the Enterprise tier for expanded storage and advanced file management.',
  },
  esign: {
    title: 'E-Sign — Enterprise Feature',
    message:
      'E-Sign is available on the Enterprise tier. Upgrade to access digital signatures, advanced document workflows, and more.',
  },
};

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const { title, message } = CONTENT[reason];
  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[460px] p-8 flex flex-col items-center text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
          <span className="text-2xl">🚀</span>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-2 leading-relaxed">{message}</p>

        {/* Plan comparison hint */}
        <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-4 mb-6 text-left">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Enterprise tier includes</p>
          <ul className="space-y-1">
            {['Unlimited groups', 'Expanded storage quota', 'E-Sign & document workflows', 'Priority support'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Upgrade to Enterprise
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sum the raw byte sizes of all files across every group stored in localStorage */
export function computeGroupStorageBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('shared:folders-')) continue;
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      total += sumFoldersBytes(data);
    } catch {
      // ignore malformed entries
    }
  }
  return total;
}

function sumFoldersBytes(folders: unknown): number {
  if (!Array.isArray(folders)) return 0;
  return folders.reduce((acc: number, f: unknown) => {
    if (typeof f !== 'object' || f === null) return acc;
    const folder = f as { files?: unknown[]; folders?: unknown[] };
    const fileBytes = (folder.files ?? []).reduce((a: number, file: unknown) => {
      if (typeof file !== 'object' || file === null) return a;
      return a + (((file as { size?: number }).size) ?? 0);
    }, 0);
    return acc + fileBytes + sumFoldersBytes(folder.folders);
  }, 0);
}

export const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export function formatStorageUsed(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb < 0.01) return '0.00 GB';
  return `${gb.toFixed(2)} GB`;
}
