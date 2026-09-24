import json, os
repo = os.path.expanduser("~/mnt/Software RHIA")
p = os.path.join(repo, "data/project-status.json")
d = json.load(open(p, encoding="utf-8"))

addition = (
    " [SES-230, ~04:14 UTC 2026-09-24]: HEAD avanzo de 8a06773 a 61c6fbf desde el ultimo chequeo (SES-229, "
    "~03:12 UTC): 3 commits nuevos de George (jsuasnavas5334) a las 03:52-03:53 UTC sobre build/tests de "
    "frontend (vite/vitest, tsconfig, DEVELOPMENT_SUMMARY_2026-09-24.txt) y scripts de infraestructura "
    "n8n/Docker/Task Scheduler; tambien un cambio sin commitear en frontend/src/utils/csv.ts (04:01 UTC) y un "
    ".git/index.lock activo al momento del chequeo (04:14 UTC), senal de que George esta trabajando ahora "
    "mismo en el repo. Ninguno de estos cambios responde las 4 preguntas pendientes del pilot (opcion de "
    "muestra A/B/C, lista/criterios de empresas reales 10-50, canal y KPIs, confirmacion de revision de "
    "mensajes antes de outreach); ejemplo-leads.csv sigue siendo el placeholder ficticio. Por precaucion no se "
    "toco git (add/commit/push) ni el archivo en edicion de George. Se reenvio notificacion push pese a estar "
    "por debajo del espaciado de ~2h sugerido (ultima fue SES-229, ~03:12 UTC, ~1h antes), porque la actividad "
    "nueva real aumenta la probabilidad de que George la vea ahora. Van 35 ciclos horarios consecutivos "
    "(SES-196 a SES-230) sin respuesta a las 4 preguntas. Proximo envio de notificacion no antes de ~06:14 UTC "
    "(2026-09-24) salvo actividad nueva relevante."
)
d["currentTask"]["note"] = d["currentTask"]["note"] + addition
d["version"] = "1.0.230-claude-ph12t001-blocked-pending-george-20260924-recheck35"
d["updatedAt"] = "2026-09-24T04:14:00Z"
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(p, "a", encoding="utf-8").write("\n")
print("project-status.json updated. new version:", d["version"])
