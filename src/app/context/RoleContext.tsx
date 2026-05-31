import { createContext, useContext } from 'react';

export type Role = 'teacher' | 'student';

interface RoleContextValue {
  role: Role;
  basePath: string;
  /** Role-scoped key: `"<role>:<key>"` — for personal/role-specific data */
  storageKey: (key: string) => string;
  /** Shared key: `"shared:<key>"` — for group/folder data visible to all roles.
   * Future access control: check `role` before allowing writes. */
  sharedKey: (key: string) => string;
}

export const RoleContext = createContext<RoleContextValue>({
  role: 'teacher',
  basePath: '/teacher',
  storageKey: (key) => `teacher:${key}`,
  sharedKey: (key) => `shared:${key}`,
});

export function useRole() {
  return useContext(RoleContext);
}
