import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { voiceCommand } from '~/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import type { CliCommandDefinition, CliFlagDefinition, DocumentedFlag, FlagTableRows, ScannerState } from '~/types'

const docsRoot = resolve(import.meta.dir, '../../../../docs/commands')
const configDoc = 'setup-and-utilities/config-command/config.md'
const commandByDoc = {
  'process-steps/step-0-metadata/metadata.md': metadataCommand,
  'process-steps/step-1-download/download-file.md': downloadCommand,
  'process-steps/step-2-extract/01-extract.md': extractCommand,
  'process-steps/step-2-extract/02-extract-stt.md': extractCommand,
  'process-steps/step-2-extract/03-extract-ocr.md': extractCommand,
  'process-steps/step-2-extract/04-extract-url.md': extractCommand,
  'process-steps/step-3-write/write-text.md': writeCommand,
  'process-steps/step-4-tts/text-to-speech-and-voice.md': ttsCommand,
  'process-steps/step-5-image/text-to-image.md': imageCommand,
  'process-steps/step-6-video/text-to-video-services.md': videoCommand,
  'process-steps/step-7-music/text-to-music-services.md': musicCommand,
  'process-steps/step-8-comic/00-comic-overview.md': comicCommand,
  'process-steps/step-8-comic/01-draft-scenes.md': comicCommand,
  'process-steps/step-8-comic/02-reference-sketch.md': comicCommand,
  'process-steps/step-8-comic/03-generate-images.md': comicCommand,
  'process-steps/step-8-comic/04-reference-voice.md': comicCommand,
  'process-steps/step-8-comic/05-generate-audio.md': comicCommand,
  'process-steps/step-8-comic/06-generate-slideshow.md': comicCommand,
  'process-steps/step-8-comic/07-review-notes.md': comicCommand,
  'process-steps/step-8-comic/08-review-sheet.md': comicCommand,
  'process-steps/step-9-voice/00-voice-overview.md': voiceCommand,
  'process-steps/step-9-voice/01-list.md': voiceCommand,
  'process-steps/step-9-voice/02-consent.md': voiceCommand,
  'process-steps/step-9-voice/03-import.md': voiceCommand,
  'process-steps/step-9-voice/04-design.md': voiceCommand,
  'process-steps/step-9-voice/05-clone.md': voiceCommand,
  'process-steps/step-9-voice/06-audition.md': voiceCommand,
  'process-steps/step-9-voice/07-approve.md': voiceCommand,
  'process-steps/step-9-voice/08-retire.md': voiceCommand,
  'process-steps/step-9-voice/09-delete.md': voiceCommand,
  'setup-and-utilities/links/links.md': linksCommand,
  'setup-and-utilities/resume/resume.md': resumeCommand,
  'setup-and-utilities/setup/setup.md': setupCommand
} as const satisfies Record<string, CliCommandDefinition>

const tableCells = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

const isTableDivider = (line: string): boolean => {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

const isFlagTableHeader = (lines: string[], currentLine: number): boolean => {
  const header = lines[currentLine] ?? ''
  const divider = lines[currentLine + 1] ?? ''
  if (!header.trim().startsWith('|') || !isTableDivider(divider)) return false
  return tableCells(header).some((cell) => /\bflags?\b/i.test(cell))
}

const flagsFromTableRow = (
  row: string,
  heading: string | undefined,
  line: number
): DocumentedFlag[] => {
  const flags: DocumentedFlag[] = []
  for (const match of row.matchAll(/--([a-z0-9][a-z0-9-]*)/g)) {
    const name = match[1]
    if (name !== undefined) flags.push({ heading, line, name })
  }
  return flags
}

const readFlagTableRows = (
  lines: string[],
  firstRow: number,
  heading: string | undefined
): FlagTableRows => {
  const flags: DocumentedFlag[] = []
  let nextLine = firstRow
  while ((lines[nextLine] ?? '').trim().startsWith('|')) {
    flags.push(...flagsFromTableRow(lines[nextLine] ?? '', heading, nextLine + 1))
    nextLine += 1
  }
  return { flags, nextLine }
}

const documentedFlags = (markdown: string): DocumentedFlag[] => {
  const lines = markdown.split('\n')
  const flags: DocumentedFlag[] = []
  const state: ScannerState = {
    currentLine: 0,
    currentH2: undefined,
    inFence: false
  }

  while (state.currentLine < lines.length) {
    const line = lines[state.currentLine] ?? ''
    if (/^\s*```/.test(line)) {
      state.inFence = !state.inFence
      state.currentLine += 1
      continue
    }
    if (state.inFence) {
      state.currentLine += 1
      continue
    }

    const headingMatch = line.match(/^##\s+(.+?)\s*$/)
    if (headingMatch !== null) state.currentH2 = headingMatch[1]

    if (isFlagTableHeader(lines, state.currentLine)) {
      const table = readFlagTableRows(lines, state.currentLine + 2, state.currentH2)
      flags.push(...table.flags)
      state.currentLine = table.nextLine
      continue
    }
    state.currentLine += 1
  }

  return flags
}

test('documented flag scanner excludes fenced tables', () => {
  const markdown = [
    '## Options',
    '```md',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--hidden` | Example only |',
    '```',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--visible` | Registered option |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: 'Options', line: 9, name: 'visible' }
  ])
})

test('documented flag scanner ignores non-flag tables', () => {
  const markdown = [
    '## Options',
    '| Setting | Description |',
    '| --- | --- |',
    '| `--not-a-flag-table` | Example text |',
    '',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--included` | Registered option |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: 'Options', line: 8, name: 'included' }
  ])
})

test('documented flag scanner reads consecutive flag tables in order', () => {
  const markdown = [
    '## Options',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--first` | First option |',
    '',
    '| FLAGS | Description |',
    '| :--- | ---: |',
    '| `--second` | Second option |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: 'Options', line: 4, name: 'first' },
    { heading: 'Options', line: 8, name: 'second' }
  ])
})

test('documented flag scanner scopes tables to the current H2 heading', () => {
  const markdown = [
    '## First command',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--first` | First option |',
    '',
    '## Second command',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--second` | Second option |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: 'First command', line: 4, name: 'first' },
    { heading: 'Second command', line: 9, name: 'second' }
  ])
})

test('documented flag scanner preserves multiple flags and duplicates in row order', () => {
  const markdown = [
    '| Flag | Description |',
    '| --- | --- |',
    '| `--alpha`, `--beta`, `--alpha` | Aliases and duplicate reference |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: undefined, line: 3, name: 'alpha' },
    { heading: undefined, line: 3, name: 'beta' },
    { heading: undefined, line: 3, name: 'alpha' }
  ])
})

test('documented flag scanner preserves negated flags', () => {
  const markdown = [
    '## Options',
    '| Flag | Description |',
    '| --- | --- |',
    '| `--feature`, `--no-feature` | Positive and negated forms |'
  ].join('\n')

  expect(documentedFlags(markdown)).toEqual([
    { heading: 'Options', line: 4, name: 'feature' },
    { heading: 'Options', line: 4, name: 'no-feature' }
  ])
})

const numberedParentCommands = [
  { prefix: 'process-steps/step-8-comic/', command: comicCommand, overview: 'comic-overview' },
  { prefix: 'process-steps/step-9-voice/', command: voiceCommand, overview: 'voice-overview' },
] as const

const numberedSubcommandFromDoc = (doc: string): string | undefined => {
  const parent = numberedParentCommands.find((entry) => doc.startsWith(entry.prefix))
  if (parent === undefined) return undefined
  const file = doc.slice(parent.prefix.length)
  const match = /^[0-9]+-(.+)\.md$/.exec(file)
  if (match === null || match[1] === parent.overview) return undefined
  return `${parent.command.name} ${match[1]}`
}

const commandForTable = (doc: string, heading: string | undefined): CliCommandDefinition => {
  const command = commandByDoc[doc as keyof typeof commandByDoc]
  const wanted = numberedSubcommandFromDoc(doc) ?? (
    command === comicCommand && heading !== undefined ? `comic ${heading}` : undefined
  )
  if (wanted === undefined) return command

  const parent = command === voiceCommand ? voiceCommand : comicCommand
  const subcommand = parent.subcommands?.find((candidate) => candidate.name === wanted)
  if (subcommand === undefined) throw new Error(`${doc}: flag table is not under a ${parent.name} subcommand heading`)
  return subcommand
}

const registrationFor = (
  flagName: string,
  registrations: Record<string, CliFlagDefinition>
): CliFlagDefinition | undefined => {
  const direct = registrations[flagName]
  if (direct !== undefined) return direct
  if (!flagName.startsWith('no-')) return undefined

  const negated = registrations[flagName.slice(3)]
  return negated?.negatable === true ? negated : undefined
}

const isTestDoc = (doc: string): boolean => doc === 'testing.md' || doc.endsWith('-tests.md')

test('command doc flag tables name only flags registered by that command', async () => {
  const docs = (await Array.fromAsync(new Bun.Glob('**/*.md').scan({ cwd: docsRoot }))).sort()
  expect(docs.filter((doc) => doc !== configDoc && !isTestDoc(doc))).toEqual(Object.keys(commandByDoc).sort())

  const unregistered: string[] = []
  for (const doc of docs) {
    if (doc === configDoc || isTestDoc(doc)) continue
    const markdown = await Bun.file(resolve(docsRoot, doc)).text()
    for (const flag of documentedFlags(markdown)) {
      const command = commandForTable(doc, flag.heading)
      const registrations = { ...GLOBAL_FLAG_DEFINITIONS, ...command.flags }
      if (registrationFor(flag.name, registrations) === undefined) {
        unregistered.push(`${doc}:${flag.line} --${flag.name} (${command.name})`)
      }
    }
  }

  expect(unregistered).toEqual([])
})
