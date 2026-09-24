import json

base = "/root/mnt/Software RHIA" if False else None
import os
repo = os.path.expanduser("~/mnt/Software RHIA")

# ---- session-log.json ----
p = os.path.join(repo, "data/session-log.json")
d = json.load(open(p, encoding="utf-8"))
entry = {
    "id": "SES-20260924-230",
    "startedAt": "2026-09-24T04:12:00Z",
    "taskId": "PH12-T001",
    "status": "BLOCKED",
    "title": "Re-chequeo (35to ciclo consecutivo) - actividad nueva detectada pero NO responde las 4 preguntas; notificacion push reenviada",
    "changes": [
        "docs/progress/PH12-T001.md: nueva seccion SES-20260924-230 con el re-chequeo y el hallazgo de actividad nueva no relacionada.",
        "data/project-status.json: contador de ciclos actualizado (35), timestamp actualizado; mismo estado BLOCKED."
    ],
    "tests": [
        "No se ejecuto la suite de tests de apps/core-api: el bloqueo sigue siendo de negocio (decision de George), no de codigo; los cambios nuevos detectados son de frontend/build, ajenos al packet PH12-T001."
    ],
    "evidence": [
        "git log --oneline -5 -> HEAD avanzo de 8a06773 (visto en SES-229, ~03:12 UTC) a 61c6fbf, con 3 commits nuevos del propio George (autor jsuasnavas5334@users.noreply.github.com) a las 03:52:09, 03:52:45 y 03:53:30 UTC: 'Build system fixes and test infrastructure setup', 'Update: Development cycle status - Build successful and ready', 'Documentation: Comprehensive development cycle summary'.",
        "git diff --stat 8a06773..HEAD -> 244 archivos, +40347/-91 lineas; contenido revisado: build de frontend (vite/vitest/tsconfig), scripts de infraestructura n8n/Docker/Task Scheduler, y DEVELOPMENT_SUMMARY_2026-09-24.txt (reporte de build). Ninguno de estos archivos responde las 4 preguntas del pilot (opcion de muestra A/B/C, lista/criterios de empresas reales, canal y KPIs, confirmacion de revision de mensajes).",
        "Cambio adicional sin commitear: frontend/src/utils/csv.ts (mtime 04:01:17 UTC), agrega funciones genericas de export CSV; tampoco relacionado con el pilot.",
        "git status --porcelain encontro '.git/index.lock' activo en el momento del chequeo (04:14 UTC) -> senal de que George (u otra herramienta bajo su cuenta) esta usando git en este mismo repositorio en este momento. Por precaucion, esta sesion NO ejecuto ningun git add/commit/push ni toco el lock.",
        "ejemplo-leads.csv -> sigue siendo el placeholder de ejemplo (3 filas ficticias, sin datos reales para el pilot).",
        "PLAN_MAESTRO.md (seccion PH12-T001) revisada de nuevo -> sin cambios; Accion 1 sigue siendo 'Seleccionar muestra', que depende de la decision de George.",
        "ReadNotifications -> sin notificaciones en cola."
    ],
    "risks": [
        "El bloqueo de negocio (4 preguntas pendientes a George) lleva ya 35 ciclos programados (~35h) sin resolverse.",
        "La actividad nueva confirma que George esta activo en la maquina, pero trabajando en frontend/build, no en las 4 preguntas del pilot; riesgo de que el pilot siga sin avanzar aunque haya actividad."
    ],
    "decisions": [
        "Se reenvio notificacion push a George (la anterior fue SES-229, ~03:12 UTC, ~1h antes -- por debajo del espaciado de ~2h sugerido, pero se hizo una excepcion porque se detecto actividad nueva real y reciente de George en el repo, aumentando la probabilidad de que la vea ahora).",
        "No se toco el .git/index.lock activo ni se ejecuto ningun comando git de escritura (add/commit/push), para no interferir con el trabajo en curso de George.",
        "No se modifico frontend/src/utils/csv.ts ni ningun otro archivo tocado por el trabajo en curso de George.",
        "No se toco infraestructura, credenciales, ni esquema de PostgreSQL.",
        "No se selecciono ninguna empresa real ni se genero/envio ningun mensaje de outreach."
    ],
    "next": "Repetir el chequeo de archivos nuevos en el proximo ciclo, prestando atencion especial a si el proximo commit de George incluye respuestas a las 4 preguntas del pilot (opcion de muestra, lista de empresas, canal/KPIs, confirmacion de revision); proxima notificacion push no antes de ~06:14 UTC salvo nueva actividad relevante."
}
d["sessions"].append(entry)
d["updatedAt"] = "2026-09-24T04:14:00Z"
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump  # noop
open(p, "a", encoding="utf-8").write("\n")

print("session-log.json updated, total sessions:", len(d["sessions"]))
