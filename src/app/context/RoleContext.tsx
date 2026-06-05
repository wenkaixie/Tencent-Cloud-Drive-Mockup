import { createContext, useContext } from 'react';
import { en } from '../i18n/en';
import type { Language, TFunction } from '../i18n';

export type Role = 'teacher' | 'student';

interface RoleContextValue {
  role: Role;
  basePath: string;
  /** Role-scoped key: `"<role>:<key>"` — for personal/role-specific data */
  storageKey: (key: string) => string;
  /** Shared key: `"shared:<key>"` — for group/folder data visible to all roles.
   * Future access control: check `role` before allowing writes. */
  sharedKey: (key: string) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TFunction;
}

const enDict = en as Record<string, string>;
const defaultT: TFunction = (key, params) => {
  let result = enDict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
};

export const RoleContext = createContext<RoleContextValue>({
  role: 'teacher',
  basePath: '/teacher',
  storageKey: (key) => `teacher:${key}`,
  sharedKey: (key) => `shared:${key}`,
  language: 'en',
  setLanguage: () => {},
  t: defaultT,
});

export function useRole() {
  return useContext(RoleContext);
}
