/**
 * Flags "future" de React Router v6 que activan por adelantado el
 * comportamiento de v7. Usar en TODO <BrowserRouter>/<MemoryRouter>
 * (app y tests) para que el comportamiento sea idéntico en ambos y no
 * aparezcan los "React Router Future Flag Warning" en consola.
 */
export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const
