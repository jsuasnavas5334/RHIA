import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_CASES,
  classificationCases,
  draftingCases,
  entityResolutionCases,
  toolSelectionCases,
} from "./dataset/index.js";

test("dataset: incluye las 4 categorias requeridas por el packet PH05-T004", () => {
  assert.ok(entityResolutionCases.length > 0, "debe incluir entity_resolution");
  assert.ok(classificationCases.length > 0, "debe incluir classification");
  assert.ok(draftingCases.length > 0, "debe incluir drafting");
  assert.ok(toolSelectionCases.length > 0, "debe incluir tool_selection");

  const classes = new Set(ALL_CASES.map((c) => c.taskClassId));
  assert.deepEqual(
    [...classes].sort(),
    ["classification", "drafting", "entity_resolution", "tool_selection"],
  );
});

test("dataset: ids de caso son unicos", () => {
  const ids = ALL_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("dataset: no contiene secretos ni credenciales (criterio de aceptacion del packet)", () => {
  const secretPatterns: readonly RegExp[] = [
    /sk-[a-zA-Z0-9]{10,}/,
    /api[_-]?key\s*[:=]/i,
    /password\s*[:=]/i,
    /Bearer\s+[A-Za-z0-9._-]{10,}/,
  ];
  for (const c of ALL_CASES) {
    const haystack = `${c.prompt}\n${c.referenceAnswer}\n${c.gold}`;
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(haystack, pattern, `Caso ${c.id} podria contener un secreto (${pattern}).`);
    }
  }
});

test("dataset: entity_resolution hereda el baseline comercial ya revisado en PH01-T004", () => {
  for (const c of entityResolutionCases) {
    assert.match(c.goldProvenance, /PH01-T004/, `Caso ${c.id} deberia declarar procedencia PH01-T004.`);
  }
});

test("dataset: las categorias sinteticas nuevas declaran explicitamente que falta revision humana", () => {
  for (const c of [...classificationCases, ...draftingCases, ...toolSelectionCases]) {
    assert.match(
      c.goldProvenance,
      /PENDIENTE/i,
      `Caso ${c.id} debe declarar que su gold label sintetico esta pendiente de revision humana real.`,
    );
  }
});

test("dataset: cada caso tiene una respuesta de referencia que el propio scorer califica con 1 (o maxima puntuacion)", () => {
  for (const c of ALL_CASES) {
    const { score } = c.scorer(c.referenceAnswer);
    assert.equal(score, 1, `La referenceAnswer de ${c.id} deberia obtener la maxima puntuacion de su propio scorer.`);
  }
});
