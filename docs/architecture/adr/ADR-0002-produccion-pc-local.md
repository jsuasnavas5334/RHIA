# ADR-0002 — Infraestructura de producción v1: PC local de George, 24/7

- Estado: ACEPTADO
- Fecha: 2026-09-16
- Relacionado con: `PH11` (Observabilidad y deployment), `PH10-T004` (Backup, restore y disaster recovery)

## Contexto

El plan original no tenía definido dónde correría RHIA en producción. George confirmó
directamente (conversación con el usuario, 2026-09-16): por el momento, RHIA va a
correr en su propia PC (la misma conectada a esta sesión, dispositivo Windows
"jorge"), conectada a internet y encendida las 24 horas. No hay, por ahora,
proveedor cloud, VPS ni servidor dedicado.

## Decisión

RHIA v1 se despliega y corre en producción sobre la PC personal de George
(Windows), siempre encendida y conectada a internet, hasta que se decida lo
contrario con un ADR nuevo.

## Consecuencias técnicas (para PH11 y PH10-T004)

1. **Proceso persistente:** la app necesita un administrador de procesos que la
   reinicie sola si se cae (ej. `pm2` en modo Windows, o envolver el proceso
   como Servicio de Windows con NSSM) y arranque automático al encender la PC
   — no basta con dejar una terminal abierta.
2. **Sin suspensión — ya aplicado:** la configuración de energía de Windows
   debe impedir que la PC entre en suspensión/hibernación mientras esté en
   producción. George ya ejecutó `powercfg /change standby-timeout-ac 0` y
   `powercfg /change hibernate-timeout-ac 0` en su PC (2026-09-16), confirmado
   sin errores. Pendiente solo verificar periódicamente que siga así (un
   reset de Windows Update u otro cambio de configuración podría revertirlo).
3. **Alcance desde internet:** si algún componente necesita recibir webhooks
   externos (WhatsApp, n8n, proveedor de correo), hace falta abrir el puerto
   correspondiente en el router (port forwarding) y probablemente un dominio
   con IP dinámica (DDNS), más un reverse proxy con HTTPS (ej. Let's Encrypt).
   Esto es una decisión y ejecución exclusivamente humana (acceso al router).
4. **Seguridad de borde:** exponer una PC doméstica a internet tiene riesgo
   real — firewall de Windows configurado para exponer solo lo necesario,
   sistema operativo actualizado, sin puertos abiertos de más.
5. **Backup (impacto directo en PH10-T004):** como todo vive en una sola PC,
   la "segunda copia" que pide el Run Order (paso 2 de
   `docs/runbooks/disaster-recovery-runbook.md`) **no puede** ser otra carpeta
   del mismo disco — un fallo de la PC (disco, robo, incendio) destruiría
   backup y datos originales juntos. Debe ser una copia externa real.
   **Decisión confirmada por George (2026-09-16): disco externo USB**,
   conectado periódicamente para copiar el backup más reciente (no backup en
   la nube por ahora — se puede reconsiderar más adelante). El trabajo de
   `PH10-T004` debe documentar en el runbook la frecuencia recomendada de
   conexión del disco y, si es posible, un script que facilite copiar el
   backup más reciente a una ruta que el usuario indique cuando conecte el
   disco (no puede automatizarse por completo porque el disco no siempre
   está conectado).
6. **Deployment simplificado:** no hace falta orquestación de contenedores en
   la nube ni multi-servidor para v1 — el trabajo de `PH11` se enfoca en que
   el proceso local sea resiliente y observable (logs, alertas si se cae),
   no en infraestructura cloud.

## Rechazado por ahora

- Hosting en la nube (AWS/GCP/Azure/VPS dedicado): se puede reconsiderar más
  adelante si el volumen de uso o la necesidad de disponibilidad lo justifica
  — requeriría entonces un ADR nuevo, no un cambio informal.
