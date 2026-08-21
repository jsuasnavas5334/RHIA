export { defaultRhiaSettings } from './defaults.js';
export { previewSettingsChange, type ChangeEffect, type SettingsChange, type SettingsPreview } from './preview.js';
export { RhiaSettingsSchema, type RhiaSettings } from './schema.js';

export const humanApprovalActions = [
  'CHANGE_PRICE',
  'GRANT_DISCOUNT',
  'CHANGE_COMMERCIAL_TERMS',
  'BINDING_COMMITMENT',
] as const;
