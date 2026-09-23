import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseNativeCli } from '~/cli/native/native-parser'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { PROJECT_ROOT } from '~/utils/project-root'

// Read only concrete CLI examples in maintained user guides. Never execute their text.
const concreteExamples = (markdown: string): string[] => {
  const examples: string[] = []
  const add = (text: string): void => {
    const command = text.trim().replace(/^\$\s+/, '')
    if (/^bun\s+(?:--no-env-file\s+)?(?:autoshow|as)\s+\S/.test(command)
      && !/[<>$`;|&\[\]{}]|\.\.\./.test(command)) examples.push(command)
  }
  const prose = markdown.replace(/^\s*```([^\n]*)\n([\s\S]*?)^\s*```\s*$/gm, (_, language: string, body: string) => {
    if (/^(?:bash|sh|shell|zsh|console|text)?$/.test(language.trim())) {
      for (const line of body.replace(/[ \t]*\\\r?\n\s*/g, ' ').split('\n')) add(line)
    }
    return ''
  })
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) add(match[1]!)
  return [...new Set(examples)]
}

const validateExample = (command: string): void => {
  const words = [...command.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^\s"']+)/g)]
    .map(match => match[1]?.replace(/\\(["\\])/g, '$1') ?? match[2] ?? match[3]!)
  const args = words.slice(words[1] === '--no-env-file' ? 3 : 2)
  const parsed = parseNativeCli(args, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
  if (parsed.mode === 'command') expect(Object.keys(parsed.rawParsed.unknown), command).toEqual([])
  const registry = getModelRegistry()
  const families = { write: 'llm', tts: 'tts', image: 'image', video: 'video', music: 'music', extract: 'extract' } as const
  const family = families[args[0] as keyof typeof families]
  for (let i = 0; i < args.length; i++) {
    const selector = args[i] === '--provider' ? args[++i] : args[i]?.startsWith('--provider=') ? args[i]!.slice(11) : undefined
    if (!selector?.includes('=')) continue
    const [provider, ...modelParts] = selector.split('=')
    const model = modelParts.join('=')
    const services = family === 'extract' ? [registry.extract, registry.stt] : family ? [registry[family]] : Object.values(registry)
    expect(services.some(configs => Object.entries(configs).some(([service, config]) =>
      (service === provider || service.startsWith(`${provider}-`)) && config.models?.[model] !== undefined
    )), `${command}: unknown provider model ${selector}`).toBe(true)
  }
}

test('README and command-guide examples use registered commands, flags, and explicit provider models', async () => {
  const files = ['README.md', ...await Array.fromAsync(new Bun.Glob('docs/commands/**/*.md').scan({ cwd: PROJECT_ROOT, onlyFiles: true }))].sort()
  const failures: string[] = []
  for (const file of files) {
    const examples = concreteExamples(await Bun.file(resolve(PROJECT_ROOT, file)).text())
    if (file === 'README.md') expect(examples.length).toBeGreaterThan(0)
    for (const example of examples) {
      try { validateExample(example) }
      catch (error) { failures.push(`${file}: ${example}\n${String(error)}`) }
    }
  }
  expect(failures).toEqual([])
})

test('example selection includes continuations, aliases and inline commands without shell or template execution', () => {
  expect(concreteExamples([
    '```sh',
    'bun autoshow image "a mug" \\',
    '  --provider openai=gpt-image-2 --price',
    'bun autoshow extract <input> --provider tesseract',
    'bun autoshow image "$(cat secret.txt)" --price',
    'bun autoshow setup --show | cat',
    '```',
    'Use `bun as --version` or `bun --no-env-file autoshow --help`.',
    '```json',
    'bun autoshow invalid-command',
    '```'
  ].join('\n'))).toEqual([
    'bun autoshow image "a mug" --provider openai=gpt-image-2 --price',
    'bun as --version',
    'bun --no-env-file autoshow --help'
  ])
})

test('example validation rejects stale commands, flags, models and mismatched model families', () => {
  for (const command of [
    'bun autoshow removed-command',
    'bun autoshow image "a mug" --removed-option',
    'bun autoshow image "a mug" --provider openai=removed-model',
    'bun autoshow image "a mug" --provider=openai=gpt-4o-mini-tts-2025-12-15'
  ]) expect(() => validateExample(command)).toThrow()
  for (const command of [
    'bun as image "a mug" --provider=openai=gpt-image-2 --price',
    'bun --no-env-file autoshow image "a mug" --provider openai=gpt-image-2 --price'
  ]) expect(() => validateExample(command)).not.toThrow()
})
