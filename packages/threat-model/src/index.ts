// Threat Model & Abuse Tests (PH10-T003). Este paquete NO expone una API de
// runtime real -- a diferencia de todos sus hermanos de PH09/PH10/PH11, su
// "entregable" (packet) es `docs/security/threat-model.md` mas un conjunto
// de pruebas adversariales reales contra los paquetes puros YA construidos
// (`@rhia/policy`, `@rhia/tool-registry`, `@rhia/playwright-worker`,
// `@rhia/computer-use`, `@rhia/secrets`). Los `*.test.ts` de este paquete SON
// el entregable de pruebas del packet ("Adversarial evidence", "Malicious
// URL", "Role escalation") -- ver docs/progress/PH10-T003.md.
//
// Se mantiene un `index.ts` minimo solo por consistencia estructural con el
// resto del monorepo (mismo patron de `package.json`/`tsconfig.json`/`src/`
// que todos los paquetes puros), no porque otro paquete real vaya a
// importarlo.
export const THREAT_MODEL_PACKAGE_MARKER = '@rhia/threat-model:PH10-T003' as const;
