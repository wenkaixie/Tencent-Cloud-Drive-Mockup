import { Navigate, Outlet, useParams } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TopSearchBar } from './TopSearchBar';
import { RoleContext, type Role } from '../context/RoleContext';

export function Layout() {
  const { role } = useParams<{ role: string }>();

  if (role !== 'teacher' && role !== 'student') {
    return <Navigate to="/teacher" replace />;
  }

  const validRole = role as Role;
  const basePath = `/${validRole}`;
  const storageKey = (key: string) => `${validRole}:${key}`;
  const sharedKey = (key: string) => `shared:${key}`;

  return (
    <RoleContext.Provider value={{ role: validRole, basePath, storageKey, sharedKey }}>
      <div className="size-full flex flex-col bg-white">
        <TopBar />
        <TopSearchBar />
        <div key={validRole} className="flex-1 flex overflow-hidden">
          <Sidebar />
          <Outlet />
        </div>
      </div>
    </RoleContext.Provider>
  );
}
