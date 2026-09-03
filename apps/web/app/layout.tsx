import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { HumanRole } from '@rhia/policy';
import { AppShell } from '../src/app-shell.tsx';
import { loadRhiaCoreSession } from './core-session.ts';
import './styles.css';

export const metadata: Metadata = {
  title: 'RHIA · Revenue Intelligence',
  description: 'Centro de operación comercial asistido por inteligencia artificial',
};

// La sesión y los permisos se resuelven por solicitud; nunca se hornean en HTML compartido.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  let roles: readonly HumanRole[] = [];
  const configuredOrigin = process.env['RHIA_CORE_API_URL'];
  if (configuredOrigin) {
    try {
      roles = (await loadRhiaCoreSession()).roles;
    } catch {
      // La navegación productiva falla cerrada ante sesión o Core inválidos.
    }
  } else if (process.env.NODE_ENV === 'development') {
    roles = ['ADMIN'];
  }
  return <html lang="es"><body><AppShell roles={roles}>{children}</AppShell></body></html>;
}
