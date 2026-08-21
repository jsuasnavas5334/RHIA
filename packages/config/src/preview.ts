import { RhiaSettingsSchema, type RhiaSettings } from './schema.js';

export type ChangeEffect = 'HOT_RELOAD' | 'WORKER_RESTART';

export type SettingsChange = {
  path: string;
  effect: ChangeEffect;
  before: unknown;
  after: unknown;
};

export type SettingsPreview =
  | { valid: true; settings: RhiaSettings; changes: SettingsChange[]; highestEffect: ChangeEffect }
  | { valid: false; issues: Array<{ path: string; code: string; message: string }> };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safePreviewValue = (value: unknown, path: string): unknown => {
  if (path.toLowerCase().includes('credentialref')) return value ? '[SECURE_REFERENCE_SET]' : null;
  if (Array.isArray(value)) return value.map((item, index) => safePreviewValue(item, `${path}.${index}`));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safePreviewValue(item, `${path}.${key}`)]));
  }
  return value;
};

const effectForPath = (path: string): ChangeEffect =>
  path === 'runtime.workerConcurrency' || path === 'runtime.schedulerTimezone' ? 'WORKER_RESTART' : 'HOT_RELOAD';

const collectChanges = (before: unknown, after: unknown, path: string, changes: SettingsChange[]): void => {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      collectChanges(before[key], after[key], path ? `${path}.${key}` : key, changes);
    }
    return;
  }
  changes.push({
    path,
    effect: effectForPath(path),
    before: safePreviewValue(before, path),
    after: safePreviewValue(after, path),
  });
};

export const previewSettingsChange = (currentInput: unknown, candidateInput: unknown): SettingsPreview => {
  const current = RhiaSettingsSchema.safeParse(currentInput);
  const candidate = RhiaSettingsSchema.safeParse(candidateInput);
  if (!candidate.success) {
    return {
      valid: false,
      issues: candidate.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code, message: issue.message })),
    };
  }
  if (!current.success) {
    return {
      valid: false,
      issues: current.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code, message: issue.message })),
    };
  }
  const changes: SettingsChange[] = [];
  collectChanges(current.data, candidate.data, '', changes);
  return {
    valid: true,
    settings: candidate.data,
    changes,
    highestEffect: changes.some((change) => change.effect === 'WORKER_RESTART') ? 'WORKER_RESTART' : 'HOT_RELOAD',
  };
};
