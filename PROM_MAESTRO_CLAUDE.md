# Prompt maestro para continuar RHIA con Claude

Copia y pega el bloque siguiente al iniciar el trabajo con Claude:

```text
Asume la construcción autónoma del proyecto RHIA ubicado en:
C:\Users\jesfu\Desktop\Software RHIA

Antes de actuar, lee COMPLETO el archivo raíz CLAUDE.md. Después lee:
1. data/project-status.json;
2. docs/progress/PH05-T002.md;
3. únicamente el Task Packet PH05-T002, Quality Gate aplicable, Run Order y protocolos de handoff/cambios de PLAN_MAESTRO.md;
4. git status --short para preservar todos los avances locales sin commit.

Fuente de verdad: PLAN_MAESTRO.md, su DAG, dependencias, criterios de aceptación, pruebas requeridas, Run Order y Quality Gates. No reproceses el plan completo en cada ciclo y no repitas inventarios ni pruebas ya documentadas salvo evidencia de drift.

Checkpoint actual verificable:
- PH01, PH02, PH03 y PH04: DONE.
- PH05-T001 Agent Runtime: DONE.
- PH05-T002 AI Gateway provider-agnostic: READY y es la siguiente tarea.
- 17/51 tareas terminadas; 2/8 gates terminados.
- El último gate cifrado aprobó Core PostgreSQL, Operations E2E, Better Auth, Agent Runtime con kill real y restore limpio.
- El worktree contiene muchos cambios legítimos sin commit: no descartarlos ni sobrescribirlos.
- Frontend visible: STARSOFTWARE.BAT -> http://localhost:3000/.
- Bitácora visible: STAR.BAT -> http://localhost:4173/.

Continúa PH05-T002. Primero define contratos neutrales para requests, messages, responses, structured JSON, tool calls, usage/cost, capabilities y errores. Luego implementa adapters de OpenAI, Anthropic/Claude, DeepSeek, Qwen y Ollama usando transportes inyectables, fakes o sandboxes. No uses secretos reales ni consumas servicios pagos. Normaliza timeout, cancelación, provider outage y fallback sin introducir lógica de negocio en adapters ni fingir features no soportadas. Ejecuta pruebas dirigidas y cierra la tarea solo si cumple su packet.

Después sigue estrictamente el Run Order:
PH05-T003 -> PH05-T004 -> GATE-03 -> PH06 -> PH07 -> GATE-04 -> PH08 -> GATE-05 -> PH09 -> PH10/PH11 según DAG -> GATE-06 -> PH11 restante -> PH12 -> GATE-07 -> GATE-08.

Cadencia si trabajas programadamente:
- Un ciclo cada 60 minutos.
- Máximo 50 minutos por ciclo.
- Al minuto 45 no inicies tareas nuevas; crea checkpoint seguro.
- Antes del minuto 50 actualiza bitácora/estado, valida, publica informe final visible y termina el proceso.
- Reanuda en el siguiente ciclo desde el checkpoint.
- Si pasan 15 minutos sin cambio, prueba, comando largo activo o decisión verificable, cambia de enfoque.
- Máximo dos intentos equivalentes; después registra la causa y cambia de tarea válida.

En cada ciclo:
- verifica dependencias y elige lo que más desbloquee el DAG;
- agrupa comandos y reutiliza scripts/cache/lockfile/evidencia;
- ejecuta pruebas dirigidas antes del gate;
- actualiza docs/progress/<TASK-ID>.md, data/project-status.json y data/session-log.json;
- ejecuta parseo JSON, git diff --check y baseline proporcional;
- informa cambios, pruebas, resultados, riesgos, decisiones y siguiente paso.

No hagas commits ni push automáticos. No borres datos, no uses secretos/permisos nuevos, no gastes dinero significativo, no despliegues producción, no contactes prospectos, no cambies precios/condiciones, no asumas compromisos legales/comerciales y no realices acciones sensibles de seguridad sin autorización humana específica. El backup cifrado existente sí está autorizado conforme al procedimiento de CLAUDE.md. No reinicies WSL: actualmente aloja PostgreSQL, n8n, SearXNG y Ollama; si /mnt/c falla, sigue el workaround no disruptivo documentado.

No declares DONE sin evidencia real. Trabaja ahora de forma autónoma hasta el checkpoint seguro de este ciclo y entrega el informe final.
```
