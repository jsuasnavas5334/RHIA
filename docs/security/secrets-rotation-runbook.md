# Runbook -- Rotación de secretos (PH10-T001)

**Alcance:** procedimiento humano para rotar cualquier secreto referenciado por
`SecretReference` (`@rhia/secrets`) o por `ToolManifest.credentialRef`
(`@rhia/tool-registry`, PH09-T001) — ej. la API key de un proveedor de
outreach, un token de un proveedor de búsqueda, una credencial de un canal.

**No negociable (CLAUDE.md / restricciones del proyecto):** ningún paso de
este runbook involucra que un agente escriba, genere o mueva el VALOR real
de un secreto. `@rhia/secrets` nunca ve, guarda ni transporta un secreto
real — solo referencias (`ref`) y metadatos de rotación
(`rotationIntervalDays`, `lastRotatedAt`). Rotar un secreto real es siempre
una acción humana en el vault/proveedor real, fuera de este repositorio.

## Cuándo un secreto necesita rotación

Una referencia está vencida cuando `isRotationDue(reference, now)` (de
`@rhia/secrets`) devuelve `true`:

- Nunca se ha rotado (`lastRotatedAt: null`) — vencida desde el día 1.
- Pasaron `rotationIntervalDays` días o más desde `lastRotatedAt`.

Esto es una función pura y determinista, sin acceso a red ni al secreto
real — puede correr en cualquier ciclo (incluyendo uno automatizado) sin
riesgo, porque solo lee metadatos, nunca el valor.

## Procedimiento (ejecutado por un humano con el permiso `secrets.rotate`)

`secrets.rotate` (permiso real de `@rhia/policy`, `ROTATE_SECRET` en
`actionPolicies`) ya está `servicesForbidden: true` — ninguna identidad de
servicio (agente, n8n, worker) puede rotar un secreto por sí sola. Esto es
intencional y ya estaba en el modelo de policy real antes de esta tarea;
`PH10-T001` no lo cambia, solo documenta el procedimiento que se apoya en él.

1. **Detectar vencidos.** Sobre la lista real de `SecretReference` del
   proyecto (hoy solo `credentialRef` de `ToolManifest`, PH09-T001 — no
   existe todavía un registro persistente central de secretos, ver "Fuera
   de alcance" abajo), evaluar `isRotationDue` para cada una.
2. **Generar el nuevo valor en el proveedor/vault real** (fuera de este
   repositorio, fuera del alcance de cualquier agente).
3. **Actualizar la referencia**, nunca el valor: si el `ref` (nombre/id en
   el vault) cambia, actualizar `ToolManifest.credentialRef` /
   `SecretReference.ref` al nuevo nombre. Si el vault soporta versionado
   bajo el mismo nombre, `ref` puede no cambiar.
4. **Confirmar que el nuevo valor funciona** con una prueba real y acotada
   (ej. una llamada de health-check del proveedor) ANTES de revocar el
   valor anterior — nunca revocar primero.
5. **Revocar el valor anterior** en el proveedor/vault real, solo después
   del paso 4.
6. **Registrar `lastRotatedAt = now()`** en la `SecretReference` — esto es
   lo único que un ciclo automatizado puede escribir con seguridad (es
   metadato, nunca el secreto), y es lo que hace que `isRotationDue` vuelva
   a `false` hasta el próximo vencimiento.
7. **Dejar evidencia** en `docs/progress/<TASK-ID>.md` / `data/session-log.json`
   de que la rotación ocurrió (referencia, fecha, quién/qué la ejecutó) —
   nunca el valor.

## Errores que este runbook evita (packet PH10-T001)

- "Guardar cookies/tokens en DB plana": ninguna tabla/archivo de este
  proyecto guarda un secreto real en claro; `credentialRef`/`ref` siempre
  se validan con `looksLikeRawSecret` (heurístico real, ver
  `@rhia/tool-registry`) antes de aceptarse.
- Revocar antes de confirmar: paso 4 antes que 5, siempre.

## Fuera de alcance de este ciclo (honesto, no oculto)

- **No existe todavía un registro persistente central de `SecretReference`**
  (tabla o archivo real donde vivan todas las referencias del proyecto con
  sus fechas de rotación) — `@rhia/secrets` es un paquete puro que modela
  el contrato y la función `isRotationDue`; conectarlo a una fuente real de
  datos (ej. una tabla nueva, o reusar `capability`/`agent_capability` si
  aplicara) es una decisión de un ciclo futuro con evidencia real de qué
  secretos existen hoy en producción.
- **Ningún proveedor/vault real está conectado** — el mismo estado que el
  resto del proyecto (PH05, PH08, PH09): ningún ciclo autónomo debe generar,
  rotar ni tocar un secreto real sin autorización humana explícita y
  puntual (`CLAUDE.md`, "Restricciones no negociables").
