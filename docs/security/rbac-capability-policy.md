# RBAC y capability policy RHIA

**Task ID:** `PH03-T002`  
**Estado:** `DONE`  
**Fuente ejecutable:** `packages/policy/src/index.ts`

## Separación de identidades

- Los humanos usan roles `ADMIN`, `MANAGER`, `OPERATOR` y `VIEWER`.
- Los procesos usan identidades `AGENT_SERVICE`, `N8N_SERVICE` y `WORKER_SERVICE`.
- Los roles conceden permisos humanos; las capabilities conceden facultades técnicas limitadas a un servicio.
- Una capability recibida en un payload nunca amplía el techo fijo de la identidad de servicio.

## Matriz humana

| Área | ADMIN | MANAGER | OPERATOR | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Lectura operativa | sí | sí | sí | sí |
| Escritura CRM | sí | sí | sí | no |
| Ejecutar jobs/outreach | sí | sí | sí | no |
| Decidir approvals | sí | sí | no | no |
| Modificar price books | sí, con approval separado | no | no | no |
| Aprobar condición/compromiso | sí | sí | no | no |
| Usuarios/permisos/secrets | sí | no | no | no |

## Identidades de servicio

| Identidad | Techo de capabilities | Prohibiciones invariantes |
|---|---|---|
| AGENT_SERVICE | investigar, leer/escribir operación, jobs, solicitar approval, outreach, reuniones | permisos, secrets, ejecución de cambios comerciales |
| N8N_SERVICE | operación, jobs, outreach, reuniones | permisos, secrets, cambios comerciales |
| WORKER_SERVICE | operación, jobs y ejecución de acciones ya aprobadas | crear su propia aprobación, permisos, secrets |

## Acciones sensibles

`CHANGE_PRICE`, `OFFER_DISCOUNT`, `CHANGE_COMMERCIAL_TERMS`, `COMMERCIAL_COMMITMENT` y `DEPLOY_BREAKING` no devuelven `ALLOW` sin una aprobación humana vigente para exactamente la misma acción. Una persona no puede usar su propia aprobación. `MANAGE_PERMISSIONS` y `ROTATE_SECRET` están prohibidas para cualquier servicio, aunque un input falsifique capabilities.

La ejecución técnica de un cambio comercial aprobado corresponde exclusivamente a `WORKER_SERVICE` con `approved-actions.execute`; el agente comercial solo puede solicitar la aprobación. Core deberá validar además el registro persistido, organización, recurso, expiración y auditoría antes de construir `ApprovalProof`.

## Integración posterior

- Conectar la evaluación a Core/worker cuando exista `PH04-T001`/`PH05-T001`.
- Aplicar migrations a la base activa únicamente mediante el procedimiento controlado de deployment.
