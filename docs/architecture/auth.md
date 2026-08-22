# Autenticación y sesiones v1

## Decisión de librería

Se selecciona **Better Auth 1.7.1** como librería madura para `PH04-T002`, sujeta a validar el mapeo de tablas RHIA antes de ejecutar una migration. La elección se apoya en capacidades mantenidas por la librería y no en criptografía propia:

- email/password con `scrypt` por defecto;
- sesiones opacas persistidas en PostgreSQL y revocables;
- expiración configurable y opción de desactivar refresh deslizante;
- rate limiting integrado con almacenamiento en base de datos;
- cookies `HttpOnly`, `Secure` en producción y protección de orígenes/CSRF;
- hooks de base de datos para auditar el ciclo de sesión.

Fuentes primarias consultadas:

- [Better Auth: seguridad](https://better-auth.com/docs/reference/security)
- [Better Auth: sesiones](https://better-auth.com/docs/concepts/session-management)
- [Better Auth: opciones](https://better-auth.com/docs/reference/options)
- [OWASP: almacenamiento de passwords](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP: gestión de sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## Perfil RHIA propuesto

- Registro público deshabilitado; usuarios creados únicamente mediante bootstrap administrativo explícito y auditable.
- Passwords con el `scrypt` mantenido por Better Auth; nunca SHA-256, cifrado reversible ni implementación propia.
- Sesión opaca en PostgreSQL con expiración absoluta de 8 horas y refresh deshabilitado inicialmente.
- Cookie host-only, `HttpOnly`, `SameSite=Strict` y `Secure` fuera de desarrollo local; sin tokens en `localStorage`.
- Rate limit persistente específico para `/sign-in/email`: 5 intentos por 15 minutos, además del límite general.
- Errores de login indistinguibles para email inexistente, password incorrecto o usuario inactivo.
- El `organizationId` y los roles se consultan desde Core por cada sesión válida; no se aceptan desde cookies ni payloads.
- Logout revoca la sesión en servidor. Cambio de password o privilegio revoca las demás sesiones.
- `BETTER_AUTH_SECRET` solo se referencia por entorno/secret store y nunca se escribe en el repositorio.
- Base URL y orígenes permitidos son estáticos; headers de proxy no se confían por defecto.
- En Node, el adaptador sobrescribe `x-rhia-peer-ip` con `request.socket.remoteAddress`; el cliente no puede elegir la clave de rate limit. Detrás de proxy agrupará por peer hasta configurar la red confiable del deployment.

## Modelo de datos validado

Better Auth no controla el dominio comercial. Reutilizar directamente `rhia.app_user` fue descartado porque Better Auth exige email globalmente único y RHIA permite unicidad por tenant. La migration aditiva `0006_auth_v1` crea:

- `auth_user`, enlazada 1:1 mediante FK a `app_user`;
- `auth_session`, con token opaco, expiración y FK al auth user;
- `auth_account`, donde Better Auth almacena el hash `scrypt` del provider email/password;
- `auth_verification`, con identificadores configurados como hash;
- `auth_rate_limit`, persistente y compartible entre instancias.

Los IDs permanecen UUID. El search path temporal `rhia,public` permitió al generador oficial inspeccionar el schema y confirmó cero tablas/columnas faltantes y cero cambios inseguros.

La migration `0007_auth_audit` mantiene el schema de tablas intacto y agrega auditoría transaccional: INSERT de sesión emite `AUTH_LOGIN_SUCCEEDED`; DELETE emite `AUTH_SESSION_EXPIRED` o `AUTH_SESSION_REVOKED`. Los fallos y límites HTTP se registran sin identidad ni credenciales en `system_health_event`.

## Threat checklist inicial

- [x] No construir hashing, tokens o sesiones desde cero.
- [x] No guardar tokens en Web Storage.
- [x] Separar autenticación de autorización RBAC.
- [x] Deshabilitar signup público en el diseño.
- [x] Definir expiración y revocación del lado servidor.
- [x] Definir mitigación de brute force persistente.
- [x] Evitar enumeración de usuarios en respuestas.
- [x] Fijar tenant y roles desde datos internos, nunca desde cliente.
- [x] Auditar éxito, fallo, rate limit, logout, expiración y cambio de privilegio sin registrar passwords/tokens.
- [x] Serializar el bootstrap por organización y bloquear una segunda identidad ADMIN.
- [x] Exigir hash scrypt Better Auth; no aceptar texto plano ni incluir contraseña predeterminada.
- [x] Cargar estado, tenant y roles desde PostgreSQL después de validar la sesión.
- [x] Derivar la clave de rate limit de la IP directa y sobrescribir cualquier header homónimo del cliente.
- [x] Validar atributos reales de cookie mediante integración HTTP.
- [x] Probar expiración, fijación/replay y revocación.
- [x] Probar escalamiento de rol y cruce de tenant.
- [x] Mantener proxy headers deshabilitados y usar peer IP directa; la topología del deployment se revisará en PH11.
- [x] Revisar dependencias: producción sin alertas; cuatro moderadas limitadas al tooling Drizzle/esbuild y documentadas sin fix breaking.

## Próximo paso

Handoff a RHIA App: integrar el handler y el autenticador sin exponer roles o tenant desde datos controlados por el cliente.
