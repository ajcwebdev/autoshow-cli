import type { CliCommandHelpDefinition, CliHelpTopic, CliRootDefinition, ModelRegistry } from '~/types'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'

const CONCURRENCY_SCOPES: Record<string, string> = {
  'batch-concurrency': 'Items processed in parallel; each item can start its own targets.',
  'provider-concurrency': 'Hosted provider/model targets per item; request or chunk fan-out has separate limits.',
  'local-concurrency': 'Local provider/model targets per item.',
  'tts-chunk-concurrency': 'Hosted chunk starts per provider across the run, including multiple items.',
  'stt-segment-concurrency': 'Split segments in flight per provider; local providers clamp to one.',
  'stt-preflight-concurrency': 'Duration probes during preflight.',
  'ocr-concurrency': 'Page requests; explicit hosted values are hard caps, while local and hosted defaults differ.',
  'url-provider-concurrency': 'Hosted article providers per item.',
  'sfx-concurrency': 'Sound-effect requests.',
  concurrency: 'Comic image or prompt tasks; the command row specifies the task type.',
  'concurrency-mode': 'Hosted startup policy (ramp or immediate), not a parallelism limit.',
}

const MODEL_TOPICS: Record<string, { domain: keyof ModelRegistry, providers: Record<string, string> }> = {
  write: { domain: 'llm', providers: WRITE_LLM_PROVIDER_TARGETS },
  image: { domain: 'image', providers: STANDALONE_IMAGE_PROVIDER_TARGETS },
  video: { domain: 'video', providers: STANDALONE_VIDEO_PROVIDER_TARGETS },
  tts: { domain: 'tts', providers: STANDALONE_TTS_PROVIDER_TARGETS },
  music: { domain: 'music', providers: STANDALONE_MUSIC_PROVIDER_TARGETS },
}

export const getHelpTopics = (root: CliRootDefinition, command: CliCommandHelpDefinition): Record<string, CliHelpTopic> => {
  const topics: Record<string, CliHelpTopic> = {
    overview: { description: 'Usage, constraints, and common examples', flags: [] },
    globals: { description: 'Shared output and diagnostic controls', flags: [] },
  }
  const flags = Object.entries(command.flags ?? {}).filter(([, definition]) => !definition.help?.hidden)
  for (const [group, description] of root.flagGroups) {
    if (flags.some(([, definition]) => definition.help?.['group'] === group)) topics[group] = { description, groups: [group] }
  }
  const concurrency = flags.filter(([name]) => name.includes('concurrency')).map(([name]) => name)
  if (concurrency.length) topics['concurrency'] = { description: 'Parallel work by item, target, and request scope', flags: concurrency, notes: ['Limits apply to different scopes; no single flag caps every request in a run. Each row retains its workflow-specific defaults.', ...concurrency.map(name => `--${name}: ${CONCURRENCY_SCOPES[name] ?? command.flags![name]!.description}`)] }
  const selectors = flags.filter(([name]) => ['provider', 'llm', 'stt', 'ocr', 'tts', 'image', 'video', 'music', 'all-providers', 'all-local'].includes(name)).map(([name]) => name)
  if (selectors.length) topics['providers'] = { description: command.name === 'config' ? 'Provider selection and persisted domain defaults' : 'Provider selection for this command', flags: selectors }
  const routes: Record<string, string[]> = {
    media: ['transcription', 'timing', 'captions'], documents: ['ocr-document', 'document-options', 'run-specific'],
    articles: ['article-extraction'], review: ['transcript-review', 'comic-review'],
    images: ['image-options', 'image-inputs', 'image-provider-options', 'run-specific'],
    video: ['video-options', 'video-inputs', 'replicate-video', 'run-specific'],
    audit: ['comic-qa'], revision: ['comic-image', 'comic-qa'],
  }
  for (const [name, groups] of Object.entries(routes)) {
    const present = groups.filter(group => flags.some(([, definition]) => definition.help?.['group'] === group))
    if (present.length) topics[name] = { description: `${name[0]!.toUpperCase()}${name.slice(1)} options`, groups: present }
  }
  const models = MODEL_TOPICS[command.name]
  if (models) {
    for (const provider of Object.keys(models.providers)) {
      const modelIds = Object.keys(getModelRegistry()[models.domain][provider]?.models ?? {})
      topics[`provider:${provider}`] = {
        description: `${provider} model inventory and generation options`,
        flags: flags.filter(([name, definition]) => !name.includes('concurrency') && !String(definition.help?.['group']).startsWith('batch') && !(command.name === 'music' && definition.help?.['group'] === 'lyric-video')).map(([name]) => name),
        notes: [`Select --provider ${provider}[=model]. Registered models: ${modelIds.join(', ')}.`, 'Shared option rows state provider/model restrictions; a listed flag is not a guarantee that every model supports every value.']
      }
    }
  }
  return { ...topics, ...command.help?.topics }
}
