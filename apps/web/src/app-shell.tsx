import type { ReactNode } from 'react';
import type { HumanRole } from '@rhia/policy';
import { pageStateCopy, visibleDestinations, type PageState } from './navigation.ts';

export type AppShellProps = Readonly<{
  roles: readonly HumanRole[];
  pathname?: string | undefined;
  children: ReactNode;
}>;

const Navigation = ({ roles, pathname = '/' }: Pick<AppShellProps, 'roles' | 'pathname'>) => (
  <nav aria-label="Navegación principal" className="navigation-list">
    {visibleDestinations(roles).map((destination) => {
      const active = destination.href === pathname;
      return (
        <a aria-current={active ? 'page' : undefined} className={active ? 'navigation-link navigation-link-active' : 'navigation-link'} href={destination.href} key={destination.key}>
          <span aria-hidden="true" className="navigation-marker" />{destination.label}
        </a>
      );
    })}
  </nav>
);

export const AppShell = ({ roles, pathname, children }: AppShellProps) => (
  <div className="app-shell">
    <aside className="sidebar">
      <a aria-label="RHIA, ir al dashboard" className="brand" href="/">
        <span className="brand-mark">R</span>
        <span><strong>RHIA</strong><small>Revenue Intelligence</small></span>
      </a>
      <Navigation pathname={pathname} roles={roles} />
      <div className="sidebar-status"><span /> Sistema local</div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <details className="mobile-menu">
          <summary aria-label="Abrir menú">Menú</summary>
          <div className="mobile-menu-panel"><Navigation pathname={pathname} roles={roles} /></div>
        </details>
        <div className="topbar-context"><span>Workspace</span><strong>RHIA Operaciones</strong></div>
        <div className="profile" aria-label="Sesión actual">
          <span className="profile-avatar">JS</span>
          <span><strong>Vista local</strong><small>{roles.length > 0 ? roles.join(' · ') : 'Sin sesión'}</small></span>
        </div>
      </header>
      <main className="content" id="contenido-principal">{children}</main>
    </div>
  </div>
);

export const PageStatePanel = ({ state }: Readonly<{ state: Exclude<PageState, 'READY'> }>) => {
  const copy = pageStateCopy[state];
  return (
    <section aria-live="polite" className={`state-panel state-${state.toLowerCase()}`}>
      <span aria-hidden="true" className="state-symbol">{state === 'ERROR' ? '!' : state === 'EMPTY' ? '+' : '…'}</span>
      <div><strong>{copy.message}</strong>{copy.action ? <button type="button">{copy.action}</button> : null}</div>
    </section>
  );
};
