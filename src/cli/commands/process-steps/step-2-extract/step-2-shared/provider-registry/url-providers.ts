import type { CliFlagDefinition, HtmlArticleBackend, Step2FixedProviderRegistryEntry, Step2ShortcutFlag } from '~/types'

const URL_PROVIDER_CONFIG_PATH = ['defaults', 'extract', 'url', 'provider'] as const

const urlProviderFlag = {
  description: 'Article/HTML extraction backend: defuddle|firecrawl|glm-reader|spider|supadata|zyte (default: defuddle; local .html/.htm always use defuddle)',
  type: String,
  default: 'defuddle'
} as const satisfies CliFlagDefinition

const urlProviderEntry = (
  backend: HtmlArticleBackend,
  allShortcut: Step2ShortcutFlag
): Step2FixedProviderRegistryEntry => ({
  step: 'url',
  modality: 'article',
  flagName: 'url-provider',
  targetService: backend,
  providerSpecProvider: backend,
  bootstrapProviderId: backend,
  configPath: URL_PROVIDER_CONFIG_PATH,
  resumeSelectable: true,
  allShortcut,
  selection: {
    type: 'fixed',
    model: backend
  },
  flag: urlProviderFlag
})

export const STEP2_URL_PROVIDER_REGISTRY = [
  urlProviderEntry('defuddle', 'all-local-url'),
  urlProviderEntry('firecrawl', 'all-url'),
  urlProviderEntry('glm-reader', 'all-url'),
  urlProviderEntry('spider', 'all-url'),
  urlProviderEntry('supadata', 'all-url'),
  urlProviderEntry('zyte', 'all-url')
] as const satisfies readonly Step2FixedProviderRegistryEntry[]

export const URL_ARTICLE_BACKENDS = STEP2_URL_PROVIDER_REGISTRY.map(
  (entry) => entry.targetService
) as HtmlArticleBackend[]

export const HOSTED_URL_ARTICLE_BACKENDS = STEP2_URL_PROVIDER_REGISTRY
  .filter((entry) => entry.allShortcut === 'all-url')
  .map((entry) => entry.targetService) as Exclude<HtmlArticleBackend, 'defuddle'>[]

export const LOCAL_URL_ARTICLE_BACKENDS = STEP2_URL_PROVIDER_REGISTRY
  .filter((entry) => entry.allShortcut === 'all-local-url')
  .map((entry) => entry.targetService) as Extract<HtmlArticleBackend, 'defuddle'>[]
