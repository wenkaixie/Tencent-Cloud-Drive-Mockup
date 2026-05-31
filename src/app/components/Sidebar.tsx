import {
  Layers,
  HardDrive,
  Building2,
  Users,
  User,
  Share2,
  Link,
  Trash2,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { NavLink } from 'react-router';
import { useRole } from '../context/RoleContext';

export function Sidebar() {
  const { role, basePath } = useRole();

  return (
    <div className="w-[210px] h-full bg-[#f5f6f7] border-r border-gray-200 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-gray-900">Education Drive</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-4">
          <NavLink
            to={`${basePath}/workbench`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Layers className="w-4 h-4" />
            <span>Workbench</span>
          </NavLink>
        </div>

        <div className="px-3 mb-1">
          <div className="text-xs text-gray-500 px-3 mb-2">Storage Space</div>
        </div>

        <div className="px-3 mb-4">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Education</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="ml-9 mt-1">
            <div className="text-sm text-gray-600 px-3 py-1">我的学校 Tencent</div>
          </div>
        </div>

        <div className="px-3 mb-4">
          <NavLink
            to={`${basePath}/group`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Users className="w-4 h-4" />
            <span>Class</span>
          </NavLink>
        </div>

        <div className="px-3 mb-4">
          <NavLink
            to={`${basePath}/personal`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <User className="w-4 h-4" />
            <span>Personal</span>
          </NavLink>
        </div>

        <div className="px-3 mb-1">
          <div className="text-xs text-gray-500 px-3 mb-2">File Management</div>
        </div>

        <div className="px-3 space-y-1">
          <NavLink
            to={`${basePath}/shared-with-me`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Share2 className="w-4 h-4" />
            <span>Shared With Me</span>
          </NavLink>

          <NavLink
            to={`${basePath}/shared-links`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Link className="w-4 h-4" />
            <span>Shared Links</span>
          </NavLink>

          <NavLink
            to={`${basePath}/deletion-restore`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <Trash2 className="w-4 h-4" />
            <span>Deletion Restore</span>
          </NavLink>

          <NavLink
            to={`${basePath}/suspicious-file`}
            className={({ isActive }) =>
              `w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Suspicious File</span>
          </NavLink>
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${role === 'teacher' ? 'bg-blue-500' : 'bg-orange-400'} flex items-center justify-center text-white text-sm font-medium`}>
            {role === 'teacher' ? 'X' : 'W'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{role === 'teacher' ? 'xiewenkai' : 'wangyifei'}</div>
            <div className="text-xs text-gray-500 truncate">{role === 'teacher' ? 'xiewenkai@tencentschool.com' : 'wangyifei@tencentschool.com'}</div>
            <div className="text-xs text-gray-400">Used 49.5M</div>
          </div>
        </div>
      </div>
    </div>
  );
}
