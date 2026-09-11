import { describe, expect, spyOn, test } from 'bun:test'
import { COMMAND_DEFINITIONS } from '~/cli/create-cli'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseNativeCli, parseCommandInvocation } from '~/cli/native/native-parser'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { renderCommandHelp, renderRootHelp } from '~/cli/native/help-renderer'
import { getCommandHelpInventory, RETIRED_HELP_COMMANDS } from '~/cli/native/help-inventory'
import { getHelpTopics } from '~/cli/native/help-topics'
import { wrapHelpDescription, helpVisibleLength } from '~/cli/native/help-line-wrap'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { stripAnsi } from '~/utils/terminal-colors'
import { getModelRegistry, findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { knownProviders, parseLinksSelection, assertKnownSections } from '~/cli/commands/setup-and-utilities/links/links-selection'
import { normalizeWriteProviderAlias } from '~/cli/flags/write-provider-alias'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { composeFlags, strFlag } from '~/cli/flags/flag-utils'
import { coerceAndValidateReferenceSketch } from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import { referenceSketchCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { applyDefaultVideoSelection, resolveVideoInput } from '~/cli/commands/visuals/video/define-video-command'
import { selectCheapestDefaultTextVideoSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { validateVoiceDesignRequest } from '~/cli/commands/audio/voice/voice-design-request-validation'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { ModelRegistry } from '~/types'

const root = createNativeRootDefinition()
const inventory = getCommandHelpInventory(COMMAND_DEFINITIONS)
const command = (name: string) => inventory.find(row => row.command.name === name)!.command
const parse = (args: string[]) => parseNativeCli(args, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
const plain = (text: string) => stripAnsi(text).replace(/\|\n\s+/g, '|').replace(/\s+/g, ' ').trim()

describe('audited help behavior', () => {
  test('focused help bypasses handlers, config loading, and output directory creation', async () => {
    let calls = 0
    const leaf = { name: 'probe', description: 'Probe', parameters: [{ key: '<input>' }], flags: { detail: strFlag('Detail') }, handler: () => { calls++ } }
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      await dispatchNativeCli(['probe', '--help-topic', 'overview', '--output-dir', '/unwritable/help-probe', '--config-path', '/missing/config.json'], root, [leaf])
      expect(calls).toBe(0)
      expect(log).toHaveBeenCalledTimes(1)
      expect(plain(String(log.mock.calls[0]![0]))).toContain('probe <input>')
    } finally { log.mockRestore() }
  })

  test('topics route before required inputs, at root, through help, and through nested aliases', () => {
    for (const argv of [
      ['--help-topic', 'overview'], ['write', '--help-topic=providers'],
      ['help', 'write', '--help-topic', 'providers'],
      ['comic', 'generate-images', '--help-topic', 'audit'],
      ['comic', 'reference-voice', 'import', '--help-topic', 'overview'],
    ]) {
      const parsed = parse(argv)
      expect(parsed.mode).toBe('help')
      expect(parsed.flags['help-topic']).toBeString()
    }
    expect(parse(['download', '--', '--help-topic', 'overview']).mode).toBe('command')
    expect(() => parse(['write', '--help-topic'])).toThrow('requires a topic')
    expect(() => parse(['write', '--help-topic=a', '--help-topic=b'])).toThrow('only once')
    expect(() => renderCommandHelp(root, command('write'), { topic: 'unknown' })).toThrow('Unknown help topic')
    expect(() => renderRootHelp(root, COMMAND_DEFINITIONS, { topic: 'unknown' })).toThrow('Unknown root help topic')
  })

  test('focused pages select the requested domain and advertise every links provider', () => {
    const documents = renderCommandHelp(root, command('extract'), { topic: 'documents' })
    expect(documents).toContain('--docx-markdown')
    expect(documents).not.toContain('--stt-segment-concurrency')
    const concurrent = renderCommandHelp(root, command('tts'), { topic: 'concurrency' })
    expect(concurrent).toContain('--tts-chunk-concurrency')
    expect(concurrent).not.toContain('--ocr-concurrency')
    expect(plain(concurrent)).toContain('not a parallelism limit')
    const provider = plain(renderCommandHelp(root, command('video'), { topic: 'provider:grok' }))
    for (const model of Object.keys(getModelRegistry().video['grok']!.models)) expect(provider).toContain(model)
    const links = plain(renderCommandHelp(root, command('links'), { topic: 'providers' }))
    for (const key of knownProviders) expect(links).toContain(key)
    expect(documents.length).toBeLessThan(renderCommandHelp(root, command('extract')).length)
  })

  test('ANSI-aware wrapping preserves complete values and bounds descriptions', () => {
    const text = '\x1b[32malpha|beta|gamma|delta|epsilon\x1b[0m accepts one or more provider values without truncation'
    const wrapped = wrapHelpDescription('    ', text, 40)
    expect(plain(wrapped)).toBe(plain(text))
    for (const line of wrapped.split('\n')) expect(helpVisibleLength(line)).toBeLessThanOrEqual(40)
    const help = renderCommandHelp(root, command('resume'), { width: 80 })
    // Copyable usage/examples can exceed width; flag rows and their continuations must fit.
    const flagSection = help.slice(help.indexOf('Provider Selection'), help.indexOf('\nExamples\n'))
    for (const line of flagSection.split('\n').filter(line => line.startsWith('  '))) expect(helpVisibleLength(line)).toBeLessThanOrEqual(80)
    expect(plain(help)).toContain('Array<String>')
  })

  test('full registry includes omitted public pages and separately marks compatibility and retired commands', () => {
    const names = inventory.map(row => row.command.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of ['comic draft-treatment', 'comic review', 'voice import', 'voice audition']) expect(names).toContain(name)
    expect(inventory.find(row => row.command.name === 'comic reference-voice import')?.visibility).toBe('compatibility')
    for (const name of RETIRED_HELP_COMMANDS) {
      expect(names).not.toContain(name)
      expect(() => parse([name, '--help'])).toThrow()
    }
    for (const { command: definition } of inventory) {
      expect(renderCommandHelp(root, definition)).toContain(definition.name)
      for (const topic of Object.keys(getHelpTopics(root, definition))) expect(() => renderCommandHelp(root, definition, { topic })).not.toThrow()
    }
  })

  test('all stored help recipes parse and reference registered provider/model identities', () => {
    const domains: Record<string, keyof ModelRegistry> = { write: 'llm', tts: 'tts', image: 'image', video: 'video', music: 'music', 'comic generate-audio': 'tts' }
    for (const { command: definition } of inventory) {
      for (const [example] of definition.help?.examples ?? []) {
        // Tokenize quoted literal recipes without executing a shell or any handler.
        const tokens = [...example.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(match => match[1] ?? match[2] ?? match[3]!)
        if (tokens[0] === '$') tokens.shift()
        expect(tokens.slice(0, 2), example).toEqual(['bun', 'autoshow'])
        const parsed = parse(tokens.slice(2).map(token => token === '<command>' ? 'write' : token))
        expect(parsed.rawParsed.unknown, example).toEqual({})
        const domain = domains[parsed.command?.name ?? '']
        if (parsed.command?.name.startsWith('voice ') && typeof parsed.flags['model'] === 'string') {
          expect(getModelRegistry().tts[String(parsed.flags['provider'])]?.models[parsed.flags['model']], example).toBeDefined()
        }
        if (parsed.command?.name === 'voice design' && !parsed.flags['save']) {
          const provider = parsed.flags['provider']
          if (provider !== 'elevenlabs' && provider !== 'inworld' && provider !== 'hume') throw new Error(`Unknown design provider in ${example}`)
          expect(() => validateVoiceDesignRequest({ provider, creationModel: String(parsed.flags['creation-model']), description: String(parsed.flags['description']), previewText: String(parsed.flags['preview-text']), candidateCount: Number(parsed.flags['candidates'] ?? 1) }), example).not.toThrow()
        }
        for (const occurrence of parsed.rawParsed.flagOccurrences) {
          const value = String(occurrence.value)
          if (domain && ['provider', 'llm'].includes(occurrence.name)) {
            const [provider, ...parts] = value.split('=')
            const entry = getModelRegistry()[domain][provider!]
            expect(entry, example).toBeDefined()
            const model = parts.join('=')
            if (model && model !== 'all') expect(entry!.models[model], example).toBeDefined()
          }
          const modelDomain = ({ 'image-model': 'image', 'llm-model': 'llm', 'qa-model': 'llm' } as const)[occurrence.name as 'image-model' | 'llm-model' | 'qa-model']
          if (modelDomain) for (const model of value.split(',')) expect(findRegistryServiceForModel(modelDomain, model), example).toBeDefined()
        }
      }
    }
  })

  test('required metadata/write inputs retain terminator support while download/extract remain optional', () => {
    for (const name of ['metadata', 'write']) {
      expect(() => parse([name])).toThrow('Missing required parameter: input')
      expect(parse([name, '--', 'sample.txt']).parameters.input).toBe('sample.txt')
      expect(parse([name, '--', 'sample.txt']).rawParsed.doubleDash).toEqual([])
      expect(() => parse([name, '--', 'one.txt', 'two.txt'])).toThrow('Unexpected parameter')
    }
    expect(parse(['download', '--', '--list-formats', 'https://example.com/video']).rawParsed.doubleDash).toHaveLength(2)
    expect(parse(['extract', '--transcript-video', '--transcript-file', 'text.txt', '--audio-file', 'audio.wav']).mode).toBe('command')
  })

  test('reference sketch rejects unsupported controls before any execution and preserves location options', () => {
    const reference = (args: string[]) => coerceAndValidateReferenceSketch(parseCommandInvocation([referenceSketchCommandDefinition.name, ...args], referenceSketchCommandDefinition, GLOBAL_FLAG_DEFINITIONS))
    for (const kind of ['character', 'location']) expect(() => reference([`--${kind}`, 'sample', '--qa-only'])).toThrow('Unexpected flag: --qa-only')
    for (const args of [['--qa'], ['--no-qa'], ['--qa-model', 'gpt-5.5'], ['--max-repairs', '0'], ['--llm-model', 'gpt-5.5'], ['--view', 'side']]) expect(() => reference(['--character', 'sample', ...args])).toThrow('only valid with --location')
    const location = reference(['--location', 'sample', '--qa-model', 'gpt-5.5', '--max-repairs', '2', '--llm-model', 'gpt-5.5', '--view', 'side'])
    expect(location.qaModel).toBe('gpt-5.5')
    expect(location.maxRepairs).toBe(2)
    expect(location.llmModel).toBe('gpt-5.5')
    expect(location.view).toBe('side')
    expect(() => reference(['--character', 'sample'])).not.toThrow()
  })

  test('write alias preserves repetitions and existing additive config behavior', () => {
    const normalize = (selector: string) => {
      const parsed = parse(['write', 'sample.txt', selector, 'openai=gpt-5.5', selector, 'gemini=gemini-3.1-pro-preview'])
      const alias = normalizeWriteProviderAlias(parsed.flags, parsed.rawParsed.explicitFlags, parsed.rawParsed.flagOccurrences)
      const merged = mergeConfigIntoRawFlags(alias.flags, { defaults: { llm: { grok: ['grok-4.5'], openai: ['gpt-5.6-sol'] } } }, alias.explicitFlags, 'write')
      return normalizeGenericProviderSelectorFlags(merged, alias.explicitFlags, alias.flagOccurrences, 'llm', WRITE_LLM_PROVIDER_TARGETS)
    }
    const current = normalize('--provider')
    const legacy = normalize('--llm')
    expect(current.flags).toEqual(legacy.flags)
    expect(current.explicitFlags).toEqual(legacy.explicitFlags)
    expect(current.flags['grok']).toEqual(['grok-4.5'])
    expect(current.flags['openai']).toEqual(['gpt-5.6-sol', 'gpt-5.5'])
    const mixed = parse(['write', 'sample.txt', '--provider', 'openai', '--llm', 'gemini'])
    expect(() => normalizeWriteProviderAlias(mixed.flags, mixed.rawParsed.explicitFlags, mixed.rawParsed.flagOccurrences)).toThrow('Do not combine')
  })

  test('links generic and legacy selectors preserve provider/section associations and ordering', () => {
    const select = (args: string[]) => parseLinksSelection(parse(['links', ...args]))
    const old = select(['text', '--openai', 'models', '--gemini', 'text', '--openai', 'text'])
    const current = select(['text', '--provider', 'openai', 'models', '--provider=gemini', 'text', '--provider', 'openai', 'text'])
    const mixed = select(['text', '--openai', 'models', '--provider', 'gemini', 'text', '--openai', 'text'])
    expect(current).toEqual(old)
    expect(mixed).toEqual(old)
    expect(current.serviceSelections.get('openai')).toEqual(['models', 'text'])
    expect(current.globalSections).toEqual(['text'])
    expect(() => assertKnownSections(current.serviceSelections, current.globalSections)).not.toThrow()
    expect(() => select(['--provider', 'missing'])).toThrow('Unknown links provider')
    expect(() => select(['--provider', 'openai=model'])).toThrow('Unknown links provider')
  })

  test('resume collision guard requires deliberate shared definitions with all domain meanings', () => {
    const one = { format: strFlag('one') }
    const two = { format: strFlag('two') }
    expect(() => composeFlags([one, two])).toThrow('format')
    expect(composeFlags([one, two], { format: strFlag('shared') })['format']!.description).toBe('shared')
    const flags = command('resume').flags!
    for (const [name, domains] of Object.entries({ format: ['OCR', 'image'], 'aspect-ratio': ['image', 'video'], duration: ['video', 'music'] })) {
      for (const domain of domains) expect(flags[name]!.description.toLowerCase()).toContain(domain.toLowerCase())
      expect(flags[name]!.help?.['group']).toBe('run-specific')
    }
    expect(renderCommandHelp(root, command('comic generate-slideshow'))).not.toContain('--allow-over-budget')
    expect(parse(['comic', 'generate-slideshow', 'script.md', '--allow-over-budget']).flags['allow-over-budget']).toBe(true)
  })

  test('video default selection follows text/image routing without provider execution', () => {
    const text: Record<string, unknown> = {}
    applyDefaultVideoSelection(text, resolveVideoInput('A mountain sunrise', text).kind)
    const cheapest = selectCheapestDefaultTextVideoSelection()
    expect(text[`${cheapest.provider}-video`]).toBe(cheapest.model)
    expect(text['all-video']).toBeUndefined()
    const image: Record<string, unknown> = {}
    applyDefaultVideoSelection(image, resolveVideoInput('sample.png', image).kind)
    expect(image['mode']).toBe('image-to-video')
    expect(image['all-video']).toBe(true)
    const explicit: Record<string, unknown> = { 'grok-video': 'grok-imagine-video' }
    applyDefaultVideoSelection(explicit, resolveVideoInput('sample.png', explicit).kind)
    expect(explicit['all-video']).toBeUndefined()
    expect(explicit['grok-video']).toBe('grok-imagine-video')
    expect(() => resolveVideoInput('sample.png', { mode: 'text' })).toThrow('infers --mode image-to-video')
  })

  test('shared resume spellings resolve into the workflow-specific runtime options', () => {
    const options = (args: string[], scope: 'extract' | 'image' | 'video' | 'music') => {
      const parsed = parse(['resume', 'recorded-run', ...args])
      return buildOptsFromFlags(parsed.flags, {}, parsed.rawParsed.explicitFlags, { scope, flagOccurrences: parsed.rawParsed.flagOccurrences })
    }
    expect(options(['--format', 'json'], 'extract').out).toBe('json')
    expect(options(['--format', 'webp'], 'image').imageFormat).toBe('webp')
    expect(options(['--aspect-ratio', '9:16'], 'image').imageAspectRatio).toBe('9:16')
    const video = options(['--aspect-ratio', '16:9', '--duration', '8'], 'video')
    expect(video.videoAspectRatio).toBe('16:9')
    expect(video.videoDuration).toBe(8)
    expect(options(['--duration', '45'], 'music').musicDuration).toBe(45)
  })
})
