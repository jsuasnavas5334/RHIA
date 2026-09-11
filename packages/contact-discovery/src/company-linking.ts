// PH07-T002, accion 4 ("Vincular company/entity") y el criterio de
// aceptacion "No crea contacto sin company linkage".
//
// Este paquete NO resuelve identidad de compania -- eso ya lo hace
// @rhia/entity-resolver (PH06-T004), wireado en `CompanyGroupService.create`
// (PH07-T001, ver docs/progress/PH07-T001.md). Contact Discovery recibe la
// compania YA resuelta por el llamador (mismo patron que este mismo paquete
// recibe los resultados de busqueda ya resueltos, en vez de ejecutar la
// busqueda real) y su unica responsabilidad aqui es GARANTIZAR que ningun
// candidato se construya sin ese vinculo -- la garantia de tipo ya vive en
// `ContactCandidateSchema.companyGroupId` (obligatorio, no opcional); esta
// funcion es la puerta de entrada explicita que hace ese requisito visible
// en el flujo (falla ruidosamente, no con un campo undefined silencioso).

export class MissingCompanyLinkageError extends Error {
  constructor() {
    super('No se puede descubrir contactos sin una company ya resuelta (companyGroupId). Ver PH07-T001 (Entity Resolver wiring) para resolver la compania antes de llamar a Contact Discovery.');
    this.name = 'MissingCompanyLinkageError';
  }
}

export type ResolvedCompanyLink = Readonly<{
  companyGroupId: string;
  companyEntityId: string | null;
}>;

/**
 * Valida que exista un `companyGroupId` no vacio antes de continuar.
 * `companyEntityId` es opcional a proposito -- PH07-T001 documento
 * explicitamente que no todo `company_group` resuelto tiene todavia una
 * `company_entity` especifica creada bajo el (ver "Fuera de alcance" #2 de
 * ese packet) -- exigirlo aqui bloquearia el caso normal, no solo el caso
 * invalido.
 */
export const assertCompanyLinkage = (input: {
  companyGroupId: string | null | undefined;
  companyEntityId?: string | null;
}): ResolvedCompanyLink => {
  if (!input.companyGroupId || input.companyGroupId.trim().length === 0) {
    throw new MissingCompanyLinkageError();
  }
  return { companyGroupId: input.companyGroupId, companyEntityId: input.companyEntityId ?? null };
};
