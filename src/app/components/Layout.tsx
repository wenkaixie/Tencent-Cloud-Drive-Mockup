import { useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TopSearchBar } from './TopSearchBar';
import { RoleContext, type Role } from '../context/RoleContext';
import { getStoredLanguage, setStoredLanguage, createT, type Language } from '../i18n';

export function Layout() {
  const { role } = useParams<{ role: string }>();
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  function setLanguage(lang: Language) {
    setStoredLanguage(lang);
    setLanguageState(lang);
  }

  if (role !== 'teacher' && role !== 'student') {
    return <Navigate to="/teacher" replace />;
  }

  const validRole = role as Role;
  const basePath = `/${validRole}`;
  const storageKey = (key: string) => `${validRole}:${key}`;
  const sharedKey = (key: string) => `shared:${key}`;
  const t = createT(language);

  return (
    <RoleContext.Provider value={{ role: validRole, basePath, storageKey, sharedKey, language, setLanguage, t }}>
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
