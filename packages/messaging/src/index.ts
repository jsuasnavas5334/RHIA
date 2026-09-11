export type { Inference } from './schema.js';

export type { ContextPack, BuildContextPackInput, BuildContextPackResult } from './context-pack.js';
export { buildContextPack } from './context-pack.js';

export type { MessageTemplate, TemplateFactClause } from './templates.js';
export { MESSAGE_TEMPLATES, findTemplate } from './templates.js';

export type { GeneratedMessage, GenerateMessageInput } from './generate.js';
export { generateMessage, renderFactMention } from './generate.js';

export type { PolicyLintIssue, PolicyLintIssueCode, PolicyLintResult } from './policy-lint.js';
export { lintMessage, lintGeneratedMessage } from './policy-lint.js';
