import { z } from 'zod';

const UuidSchema = z.string().uuid();
const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);

const MarketPrioritySchema = z
  .object({
    countryCode: CountryCodeSchema,
    priorityScore: z.number().int().min(1).max(100),
  })
  .strict();

const ChannelCadenceSchema = z
  .object({
    channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP']),
    enabled: z.boolean(),
    minimumHoursBetweenTouches: z.number().int().min(12).max(720),
  })
  .strict();

const ProviderSchema = z
  .object({
    providerId: z.enum(['OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'QWEN', 'OLLAMA']),
    enabled: z.boolean(),
    mode: z.enum(['LOCAL', 'REMOTE']),
    modelAlias: z.string().min(1).max(120),
    credentialRef: UuidSchema.optional(),
    priority: z.number().int().min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === 'REMOTE' && value.enabled && !value.credentialRef) {
      context.addIssue({ code: 'custom', path: ['credentialRef'], message: 'Un provider remoto activo requiere referencia segura.' });
    }
    if (value.mode === 'LOCAL' && value.credentialRef) {
      context.addIssue({ code: 'custom', path: ['credentialRef'], message: 'Un provider local no admite referencia de credencial.' });
    }
  });

export const RhiaSettingsSchema = z
  .object({
    version: z.literal('1.0'),
    markets: z
      .object({
        restOfLatinAmericaEnabled: z.literal(true),
        defaultRegionalPriorityScore: z.number().int().min(1).max(89),
        priorities: z.array(MarketPrioritySchema).min(2).max(30),
      })
      .strict(),
    cadence: z
      .object({
        maxProactiveTouches: z.number().int().min(1).max(3),
        responseFollowupHours: z.number().int().min(12).max(720),
        channels: z.array(ChannelCadenceSchema).min(1),
      })
      .strict(),
    scoring: z
      .object({
        weights: z
          .object({
            marketFit: z.number().int().min(0).max(100),
            evidenceStrength: z.number().int().min(0).max(100),
            contactability: z.number().int().min(0).max(100),
            commercialTiming: z.number().int().min(0).max(100),
          })
          .strict(),
        minimumOpportunityScore: z.number().int().min(0).max(100),
      })
      .strict(),
    budgets: z
      .object({
        searchRequestsPerJob: z.number().int().min(1).max(200),
        llmTokensPerJob: z.number().int().min(0).max(2_000_000),
        browserActionsPerJob: z.number().int().min(0).max(500),
        externalSpendUsdDailyCap: z.number().min(0).max(10_000),
      })
      .strict(),
    providers: z
      .object({
        models: z.array(ProviderSchema).min(1),
        searchOrder: z.array(z.enum(['API', 'PLAYWRIGHT', 'COMPUTER_USE', 'HUMAN'])).length(4),
        searxngEnabled: z.boolean(),
        browserFallbackEnabled: z.boolean(),
        computerUseFallbackEnabled: z.boolean(),
      })
      .strict(),
    runtime: z
      .object({
        workerConcurrency: z.number().int().min(1).max(20),
        schedulerTimezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/),
        logLevel: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']),
      })
      .strict(),
  })
  .strict()
  .superRefine((settings, context) => {
    const countryCodes = settings.markets.priorities.map((item) => item.countryCode);
    if (new Set(countryCodes).size !== countryCodes.length) {
      context.addIssue({ code: 'custom', path: ['markets', 'priorities'], message: 'Los países no pueden repetirse.' });
    }
    const ecuador = settings.markets.priorities.find((item) => item.countryCode === 'EC');
    const peru = settings.markets.priorities.find((item) => item.countryCode === 'PE');
    const otherScores = settings.markets.priorities.filter((item) => !['EC', 'PE'].includes(item.countryCode)).map((item) => item.priorityScore);
    const highestOther = Math.max(settings.markets.defaultRegionalPriorityScore, ...otherScores);
    if (!ecuador || !peru || ecuador.priorityScore <= peru.priorityScore || peru.priorityScore <= highestOther) {
      context.addIssue({ code: 'custom', path: ['markets', 'priorities'], message: 'Ecuador debe ser prioridad 1 y Perú prioridad 2 sobre el resto de Latinoamérica.' });
    }

    const channels = settings.cadence.channels.map((item) => item.channel);
    if (new Set(channels).size !== channels.length) {
      context.addIssue({ code: 'custom', path: ['cadence', 'channels'], message: 'Los canales no pueden repetirse.' });
    }

    const weights = Object.values(settings.scoring.weights);
    if (weights.reduce((total, weight) => total + weight, 0) !== 100) {
      context.addIssue({ code: 'custom', path: ['scoring', 'weights'], message: 'Los pesos de scoring deben sumar 100.' });
    }

    const providerIds = settings.providers.models.map((provider) => provider.providerId);
    const priorities = settings.providers.models.map((provider) => provider.priority);
    if (new Set(providerIds).size !== providerIds.length) {
      context.addIssue({ code: 'custom', path: ['providers', 'models'], message: 'Los providers no pueden repetirse.' });
    }
    if (new Set(priorities).size !== priorities.length) {
      context.addIssue({ code: 'custom', path: ['providers', 'models'], message: 'Las prioridades de providers no pueden repetirse.' });
    }
    const remoteEnabled = settings.providers.models.some((provider) => provider.enabled && provider.mode === 'REMOTE');
    if (remoteEnabled && settings.budgets.externalSpendUsdDailyCap <= 0) {
      context.addIssue({ code: 'custom', path: ['budgets', 'externalSpendUsdDailyCap'], message: 'Providers remotos activos requieren un límite diario positivo.' });
    }
    const expectedSearchOrder = ['API', 'PLAYWRIGHT', 'COMPUTER_USE', 'HUMAN'];
    if (settings.providers.searchOrder.some((item, index) => item !== expectedSearchOrder[index])) {
      context.addIssue({ code: 'custom', path: ['providers', 'searchOrder'], message: 'El orden seguro API → Playwright → Computer Use → humano no puede alterarse.' });
    }
  });

export type RhiaSettings = z.infer<typeof RhiaSettingsSchema>;
