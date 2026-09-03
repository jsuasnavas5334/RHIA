import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell, PageStatePanel } from './app-shell.tsx';

test('un viewer sees record destinations but no privileged controls', () => {
  const html = renderToStaticMarkup(<AppShell roles={['VIEWER']}><p>Contenido</p></AppShell>);
  assert.match(html, />Dashboard</);
  assert.match(html, />Companies</);
  assert.doesNotMatch(html, />Settings</);
  assert.doesNotMatch(html, />Approvals</);
});

test('an admin sees the complete policy-filtered navigation', () => {
  const html = renderToStaticMarkup(<AppShell pathname="/settings" roles={['ADMIN']}><p>Contenido</p></AppShell>);
  assert.match(html, /aria-label="Navegación principal"/);
  assert.match(html, /aria-current="page"[^>]*href="\/settings"/);
  assert.match(html, />Settings</);
  assert.match(html, />Approvals</);
});

test('an anonymous visitor sees no protected destination', () => {
  const html = renderToStaticMarkup(<AppShell roles={[]}><p>Contenido</p></AppShell>);
  assert.doesNotMatch(html, /navigation-link/);
  assert.match(html, /Sin sesión/);
});

test('states expose useful copy and an action only when available', () => {
  assert.match(renderToStaticMarkup(<PageStatePanel state="LOADING" />), /Cargando información/);
  assert.match(renderToStaticMarkup(<PageStatePanel state="EMPTY" />), /Crear o importar/);
  assert.match(renderToStaticMarkup(<PageStatePanel state="ERROR" />), /Reintentar/);
});
