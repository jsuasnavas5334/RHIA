import { rolePermissions, type HumanRole, type PermissionKey } from '@rhia/policy';

export const appDestinations = [
  { key: 'dashboard', label: 'Dashboard', href: '/', permission: 'records.read' },
  { key: 'agents', label: 'Agents', href: '/agents', permission: 'jobs.execute' },
  { key: 'companies', label: 'Companies', href: '/companies', permission: 'records.read' },
  { key: 'contacts', label: 'Contacts', href: '/contacts', permission: 'records.read' },
  { key: 'opportunities', label: 'Opportunities', href: '/opportunities', permission: 'records.read' },
  { key: 'meetings', label: 'Meetings', href: '/meetings', permission: 'meetings.manage' },
  { key: 'jobs', label: 'Jobs', href: '/jobs', permission: 'jobs.execute' },
  { key: 'approvals', label: 'Approvals', href: '/approvals', permission: 'approvals.read' },
  { key: 'settings', label: 'Settings', href: '/settings', permission: 'settings.manage' },
] as const satisfies readonly Readonly<{ key: string; label: string; href: string; permission: PermissionKey }>[];

export type AppDestination = (typeof appDestinations)[number];
export type PageState = 'LOADING' | 'EMPTY' | 'ERROR' | 'READY';

export const visibleDestinations = (roles: readonly HumanRole[]): readonly AppDestination[] => {
  const permissions = new Set<PermissionKey>(roles.flatMap((role) => rolePermissions[role]));
  return appDestinations.filter((destination) => permissions.has(destination.permission));
};

export const navigationMode = (viewportWidth: number): 'DRAWER' | 'SIDEBAR' => viewportWidth < 768 ? 'DRAWER' : 'SIDEBAR';

export const pageStateCopy: Readonly<Record<Exclude<PageState, 'READY'>, Readonly<{ message: string; action?: string }>>> = {
  LOADING: { message: 'Cargando información…' },
  EMPTY: { message: 'Todavía no hay información para mostrar.', action: 'Crear o importar el primer registro' },
  ERROR: { message: 'No pudimos cargar esta sección.', action: 'Reintentar' },
};
