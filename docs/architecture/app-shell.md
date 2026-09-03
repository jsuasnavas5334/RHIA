# RHIA App shell v1

## Navegación

La navegación se deriva exclusivamente de los roles del `Principal` resuelto por Auth. Cada destino exige un permiso existente de `@rhia/policy`; ocultar un control mejora la UX, pero Core API vuelve a autorizar cada operación.

| Destino | Permiso visual |
|---|---|
| Dashboard, Companies, Contacts, Opportunities | `records.read` |
| Agents, Jobs | `jobs.execute` |
| Meetings | `meetings.manage` |
| Approvals | `approvals.read` |
| Settings | `settings.manage` |

Desktop usa sidebar persistente; anchos menores a 768 px usan drawer. Cada página debe ofrecer estados `loading`, `empty`, `error` y `ready`, con una acción siguiente explícita en empty/error.

## Implementación

- Next.js 16 App Router con dashboard y ocho rutas estáticas de módulo.
- Componentes server-side sin estado de autorización en navegador.
- Navegación filtrada mediante `visibleDestinations(roles)` y permisos canónicos de `@rhia/policy`.
- Component tests con render HTML estático y recorrido E2E en navegador local.

En desarrollo, el layout usa un ADMIN de demostración creado del lado servidor para revisión visual. En un build productivo usa cero roles y no muestra destinos protegidos hasta que el adaptador de sesión Better Auth entregue un `Principal` válido.

## Límite de seguridad

La App nunca acepta roles, tenant ni permisos desde query params, headers de UI o almacenamiento local. Solo consume el `Principal` de servidor y no almacena tokens de sesión en Web Storage.
