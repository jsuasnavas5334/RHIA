import type { ErrorCode } from '@rhia/domain';

export const humanRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] as const;
export type HumanRole = (typeof humanRoles)[number];

export const permissionKeys = [
  'records.read',
  'records.write',
  'jobs.execute',
  'approvals.read',
  'approvals.decide',
  'outreach.read',
  'outreach.send',
  'meetings.manage',
  'pricebooks.read',
  'pricebooks.write',
  'commercial.approve',
  'audit.read',
  'settings.manage',
  'users.manage',
  'permissions.manage',
  'secrets.rotate',
  'deployments.approve',
] as const;
export type PermissionKey = (typeof permissionKeys)[number];

export const rolePermissions: Readonly<Record<HumanRole, readonly PermissionKey[]>> = {
  ADMIN: permissionKeys,
  MANAGER: [
    'records.read', 'records.write', 'jobs.execute', 'approvals.read', 'approvals.decide',
    'outreach.read', 'outreach.send', 'meetings.manage', 'pricebooks.read',
    'commercial.approve', 'audit.read',
  ],
  OPERATOR: [
    'records.read', 'records.write', 'jobs.execute', 'approvals.read',
    'outreach.read', 'outreach.send', 'meetings.manage', 'pricebooks.read',
  ],
  VIEWER: ['records.read', 'outreach.read', 'pricebooks.read', 'audit.read'],
};

export const serviceIdentities = ['AGENT_SERVICE', 'N8N_SERVICE', 'WORKER_SERVICE'] as const;
export type ServiceIdentity = (typeof serviceIdentities)[number];

export const capabilityKeys = [
  'records.read',
  'records.write',
  'jobs.execute',
  'approvals.request',
  'approved-actions.execute',
  'outreach.draft',
  'outreach.send',
  'meetings.schedule',
] as const;
export type CapabilityKey = (typeof capabilityKeys)[number];

export const serviceCapabilityCeilings: Readonly<Record<ServiceIdentity, readonly CapabilityKey[]>> = {
  AGENT_SERVICE: ['records.read', 'records.write', 'jobs.execute', 'approvals.request', 'outreach.draft', 'outreach.send', 'meetings.schedule'],
  N8N_SERVICE: ['records.read', 'records.write', 'jobs.execute', 'outreach.send', 'meetings.schedule'],
  WORKER_SERVICE: ['records.read', 'records.write', 'jobs.execute', 'approved-actions.execute', 'outreach.send', 'meetings.schedule'],
};

export const actionKeys = [
  'READ_OPERATIONS',
  'WRITE_OPERATIONS',
  'START_JOB',
  'SEND_OUTREACH',
  'CHANGE_PRICE',
  'OFFER_DISCOUNT',
  'CHANGE_COMMERCIAL_TERMS',
  'COMMERCIAL_COMMITMENT',
  'MANAGE_PERMISSIONS',
  'ROTATE_SECRET',
  'DEPLOY_BREAKING',
] as const;
export type ActionKey = (typeof actionKeys)[number];

type ActionPolicy = Readonly<{
  humanPermission: PermissionKey;
  serviceCapability?: CapabilityKey;
  approval: 'NONE' | 'HUMAN_REQUIRED';
  servicesForbidden?: boolean;
}>;

export const actionPolicies: Readonly<Record<ActionKey, ActionPolicy>> = {
  READ_OPERATIONS: { humanPermission: 'records.read', serviceCapability: 'records.read', approval: 'NONE' },
  WRITE_OPERATIONS: { humanPermission: 'records.write', serviceCapability: 'records.write', approval: 'NONE' },
  START_JOB: { humanPermission: 'jobs.execute', serviceCapability: 'jobs.execute', approval: 'NONE' },
  SEND_OUTREACH: { humanPermission: 'outreach.send', serviceCapability: 'outreach.send', approval: 'NONE' },
  CHANGE_PRICE: { humanPermission: 'pricebooks.write', serviceCapability: 'approved-actions.execute', approval: 'HUMAN_REQUIRED' },
  OFFER_DISCOUNT: { humanPermission: 'commercial.approve', serviceCapability: 'approved-actions.execute', approval: 'HUMAN_REQUIRED' },
  CHANGE_COMMERCIAL_TERMS: { humanPermission: 'commercial.approve', serviceCapability: 'approved-actions.execute', approval: 'HUMAN_REQUIRED' },
  COMMERCIAL_COMMITMENT: { humanPermission: 'commercial.approve', serviceCapability: 'approved-actions.execute', approval: 'HUMAN_REQUIRED' },
  MANAGE_PERMISSIONS: { humanPermission: 'permissions.manage', approval: 'NONE', servicesForbidden: true },
  ROTATE_SECRET: { humanPermission: 'secrets.rotate', approval: 'NONE', servicesForbidden: true },
  DEPLOY_BREAKING: { humanPermission: 'deployments.approve', approval: 'HUMAN_REQUIRED', servicesForbidden: true },
};

export type Principal =
  | Readonly<{ kind: 'HUMAN'; id: string; organizationId: string; roles: readonly HumanRole[] }>
  | Readonly<{ kind: 'SERVICE'; id: string; organizationId: string; service: ServiceIdentity; capabilities: readonly CapabilityKey[] }>;

export type ApprovalProof = Readonly<{
  action: ActionKey;
  status: 'APPROVED';
  organizationId: string;
  approvedByHumanId: string;
  expiresAt?: string;
}>;

export type AuthorizationDecision = Readonly<{
  outcome: 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED';
  code?: ErrorCode;
  reason: string;
}>;

const validApproval = (principal: Principal, action: ActionKey, approval: ApprovalProof | undefined, now: Date): boolean => {
  if (!approval || approval.action !== action || approval.status !== 'APPROVED') return false;
  if (approval.organizationId !== principal.organizationId) return false;
  if (principal.kind === 'HUMAN' && approval.approvedByHumanId === principal.id) return false;
  return !approval.expiresAt || new Date(approval.expiresAt).getTime() > now.getTime();
};

export const authorize = (
  principal: Principal,
  action: ActionKey,
  approval?: ApprovalProof,
  now = new Date(),
): AuthorizationDecision => {
  const policy = actionPolicies[action];
  if (principal.kind === 'HUMAN') {
    const permissions = new Set(principal.roles.flatMap((role) => rolePermissions[role]));
    if (!permissions.has(policy.humanPermission)) {
      return { outcome: 'DENY', code: 'RHIA_POLICY_DENIED', reason: 'El rol no tiene el permiso requerido.' };
    }
  } else {
    if (policy.servicesForbidden || !policy.serviceCapability) {
      return { outcome: 'DENY', code: 'RHIA_POLICY_DENIED', reason: 'La acción está prohibida para identidades de servicio.' };
    }
    const ceiling = serviceCapabilityCeilings[principal.service];
    if (!principal.capabilities.includes(policy.serviceCapability) || !ceiling.includes(policy.serviceCapability)) {
      return { outcome: 'DENY', code: 'RHIA_TOOL_FORBIDDEN', reason: 'La capability no fue otorgada o excede el techo del servicio.' };
    }
  }

  if (policy.approval === 'HUMAN_REQUIRED' && !validApproval(principal, action, approval, now)) {
    return { outcome: 'APPROVAL_REQUIRED', code: 'RHIA_APPROVAL_REQUIRED', reason: 'Se requiere una aprobación humana vigente y separada.' };
  }
  return { outcome: 'ALLOW', reason: 'Permiso y política satisfechos.' };
};
