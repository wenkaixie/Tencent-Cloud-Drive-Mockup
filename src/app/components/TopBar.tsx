import { Briefcase, MonitorDown, ArrowUpDown, Mail, ChevronLeft, PenLine, FolderOpen, Columns2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRole } from '../context/RoleContext';
import { UpgradeModal } from './UpgradeModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function TopBar() {
  const { role, basePath } = useRole();
  const navigate = useNavigate();
  const [showESignUpgrade, setShowESignUpgrade] = useState(false);

  function goToSplitView() {
    // Break out of iframe if embedded, otherwise navigate normally
    if (window.self !== window.top) {
      window.top!.location.href = '/split';
    } else {
      navigate('/split');
    }
  }

  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 gap-3">
      {showESignUpgrade && <UpgradeModal reason="esign" onClose={() => setShowESignUpgrade(false)} />}
      {/* Left: role badge + split view button */}
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            role === 'teacher'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {role === 'teacher' ? '🎓 Teacher View' : '📚 Student View'}
        </span>
        <button
          onClick={goToSplitView}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors"
          title="View Teacher and Student side by side"
        >
          <Columns2 className="w-3.5 h-3.5" />
          Side by Side
        </button>
      </div>

      {/* Right: existing buttons */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
              <Briefcase className="w-4 h-4 text-gray-600" />
              <span>Tool</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="flex items-center gap-3 py-2.5 cursor-pointer" onClick={() => setShowESignUpgrade(true)}>
              <span className="w-7 h-7 rounded flex items-center justify-center bg-green-500">
                <PenLine className="w-4 h-4 text-white" />
              </span>
              <span className="text-sm">E-Sign</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-3 py-2.5 cursor-pointer"
              onClick={() => navigate(`${basePath}/file-collection`)}
            >
              <span className="w-7 h-7 rounded flex items-center justify-center bg-blue-500">
                <FolderOpen className="w-4 h-4 text-white" />
              </span>
              <span className="text-sm">File Collection</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button className="p-2 hover:bg-gray-100 rounded-md">
          <MonitorDown className="w-5 h-5 text-gray-600" />
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-md">
          <ArrowUpDown className="w-5 h-5 text-gray-600" />
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-md">
          <Mail className="w-5 h-5 text-gray-600" />
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-md">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
