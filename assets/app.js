const statusLabels = {
  READY: "Lista",
  IN_PROGRESS: "En curso",
  DONE: "Completada",
  PARTIAL: "Parcial",
  FAILED: "Fallida",
  BLOCKED: "Bloqueada",
  LOCKED: "Bloqueada por dependencias"
};

const changeLabels = {
  A: "Archivo nuevo",
  M: "Modificado",
  D: "Eliminado",
  R: "Renombrado",
  "??": "Sin seguimiento"
};

const byId = (id) => document.getElementById(id);

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function renderChanges(changes = []) {
  const body = byId("changes-body");
  body.replaceChildren();
  if (!changes.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty";
    cell.textContent = "No hay cambios locales pendientes.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  changes.forEach((change) => {
    const row = document.createElement("tr");
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status-code";
    badge.textContent = change.code.trim() || change.code;
    statusCell.appendChild(badge);

    const pathCell = document.createElement("td");
    pathCell.className = "file-path";
    pathCell.textContent = change.path;

    const meaningCell = document.createElement("td");
    const normalized = change.code.trim() || change.code;
    meaningCell.textContent = changeLabels[normalized] || "Cambio pendiente";
    row.append(statusCell, pathCell, meaningCell);
    body.appendChild(row);
  });
}

function renderPhases(phases = []) {
  const list = byId("phase-list");
  list.replaceChildren();
  phases.forEach((phase) => {
    const row = document.createElement("div");
    row.className = "phase-row";
    row.dataset.status = phase.status;

    const code = document.createElement("span");
    code.className = "phase-code";
    code.textContent = phase.id;
    const title = document.createElement("span");
    title.className = "phase-title";
    title.textContent = phase.name;
    const status = document.createElement("span");
    status.className = "phase-status";
    status.textContent = statusLabels[phase.status] || phase.status;
    row.append(code, title, status);
    list.appendChild(row);
  });
}

function appendList(container, title, items = []) {
  if (!items.length) return;
  const group = document.createElement("div");
  group.className = "session-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.appendChild(entry);
  });
  group.append(heading, list);
  container.appendChild(group);
}

function renderSessions(sessions = []) {
  const list = byId("session-list");
  list.replaceChildren();
  setText("session-count", `${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"}`);
  if (!sessions.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Todavía no existen sesiones registradas.";
    list.appendChild(empty);
    return;
  }

  [...sessions].reverse().forEach((session) => {
    const article = document.createElement("article");
    article.className = "session-entry";
    const header = document.createElement("div");
    header.className = "session-header";
    const identity = document.createElement("div");
    const meta = document.createElement("p");
    meta.className = "session-meta";
    meta.textContent = `${new Date(session.startedAt).toLocaleString("es-EC")} · ${session.id}`;
    const title = document.createElement("h3");
    title.textContent = session.title;
    identity.append(meta, title);
    const status = document.createElement("span");
    status.className = "session-status";
    status.dataset.status = session.status;
    status.textContent = `${session.taskId} · ${statusLabels[session.status] || session.status}`;
    header.append(identity, status);

    const summary = document.createElement("p");
    summary.className = "session-summary";
    summary.textContent = session.summary;
    const details = document.createElement("div");
    details.className = "session-details";
    appendList(details, "Cambios", session.changes);
    appendList(details, "Pruebas", session.tests);
    appendList(details, "Evidencia", session.evidence);
    appendList(details, "Riesgos", session.risks);
    appendList(details, "Decisiones", session.decisions);
    const next = document.createElement("p");
    next.className = "session-next";
    const nextLabel = document.createElement("strong");
    nextLabel.textContent = "Siguiente: ";
    next.append(nextLabel, document.createTextNode(session.next));
    article.append(header, summary, details, next);
    list.appendChild(article);
  });
}

function render(data, isLive) {
  const project = data.project || data;
  const git = data.git || { branch: "main", commit: null, changes: [], available: false };
  const counts = project.counts;
  const progress = Math.round((counts.done / counts.totalTasks) * 100);

  setText("environment-label", isLive ? "Localhost · Git en vivo" : "Vista estática · Git no disponible");
  setText("version", project.version);
  setText("current-phase", project.currentPhase.id);
  setText("phase-name", project.currentPhase.name);
  setText("change-count", git.changes.length);
  setText("git-summary", git.available ? "Cambios locales detectados" : "Disponible al iniciar STAR.BAT");
  setText("gate-count", `${counts.gatesDone} / ${counts.totalGates}`);
  setText("task-count", `${counts.done} / ${counts.totalTasks}`);
  setText("task-summary", `${counts.inProgress || 0} ${counts.inProgress === 1 ? "tarea en curso" : "tareas en curso"}`);
  setText("progress-label", `${progress}%`);
  byId("progress-bar").style.width = `${progress}%`;
  byId("progress-bar").parentElement.setAttribute("aria-valuenow", String(progress));
  setText("current-task-id", project.currentTask.id);
  setText("current-task-name", project.currentTask.name);
  setText("current-task-objective", project.currentTask.objective);
  setText("current-task-status", statusLabels[project.currentTask.status] || project.currentTask.status);
  setText("git-branch", git.branch || "main");
  setText("git-commit", git.commit || "Sin commits");
  setText("file-count", data.files?.count ?? "—");
  setText("updated-at", `Actualizado ${new Date(data.generatedAt || project.updatedAt).toLocaleString("es-EC")}`);

  const guardrails = byId("guardrail-list");
  guardrails.replaceChildren();
  project.guardrails.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    guardrails.appendChild(li);
  });

  renderChanges(git.changes);
  renderPhases(project.phases);
}

async function loadStatus() {
  let statusData;
  let isLive = true;
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("API local no disponible");
    statusData = await response.json();
  } catch {
    const response = await fetch("/data/project-status.json", { cache: "no-store" });
    statusData = await response.json();
    isLive = false;
  }
  const logResponse = await fetch("/data/session-log.json", { cache: "no-store" });
  const logData = logResponse.ok ? await logResponse.json() : { sessions: [] };
  render(statusData, isLive);
  renderSessions(logData.sessions);
}

byId("refresh-button").addEventListener("click", loadStatus);
loadStatus();
setInterval(loadStatus, 10000);
