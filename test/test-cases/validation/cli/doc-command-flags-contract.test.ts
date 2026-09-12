import { expect, test } from 'bun:test'
import { dirname, resolve } from 'node:path'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { metadataCommand } from '~/cli/commands/sources/metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/sources/download/define-download-command'
import { extractCommand } from '~/cli/commands/command-shared/extract-routing/define-extract-command'
import { writeCommand } from '~/cli/commands/text/write/define-write-command'
import { ttsCommand } from '~/cli/commands/audio/tts/define-tts-command'
import { imageCommand } from '~/cli/commands/visuals/image/define-image-command'
import { videoCommand } from '~/cli/commands/visuals/video/define-video-command'
import { musicCommand } from '~/cli/commands/audio/music/define-music-command'
import { comicCommand } from '~/cli/commands/visuals/comic/define-comic-command'
import { voiceCommand } from '~/cli/commands/audio/voice/define-voice-command'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import type { CliCommandDefinition, CliFlagDefinition, DocumentedFlag, FlagTableRows, ScannerState } from '~/types'

const docsRoot = resolve(import.meta.dir, '../../../../docs/commands')
const modelReportDocs = [
  '../reports/model-refresh-stt.md',
  '../reports/model-refresh-ocr.md',
  '../reports/model-refresh-url.md',
  '../reports/model-refresh-write.md',
  '../reports/model-refresh-tts.md',
  '../reports/model-refresh-image.md',
  '../reports/model-refresh-video.md',
  '../reports/model-refresh-music.md'
] as const
const commandByDoc = {
  '01-sources/metadata/overview.md': metadataCommand,
  '01-sources/download/overview.md': downloadCommand,
  'extract.md': extractCommand,
  '02-stt/overview.md': extractCommand,
  '02-stt/local/overview.md': extractCommand,
  '02-stt/diarization/overview.md': extractCommand,
  '02-stt/diarization-off-by-default/overview.md': extractCommand,
  '02-stt/direct-url/overview.md': extractCommand,
  '02-stt/workflows/captions/overview.md': extractCommand,
  '02-stt/workflows/timing/overview.md': extractCommand,
  '02-stt/workflows/transcript-review/overview.md': extractCommand,
  '02-stt/workflows/transcript-video/overview.md': extractCommand,
  '03-text/ocr/overview.md': extractCommand,
  '03-text/url/overview.md': extractCommand,
  '03-text/write/overview.md': writeCommand,
  '04-audio/tts/overview.md': ttsCommand,
  '05-visuals/image/overview.md': imageCommand,
  '05-visuals/video/overview.md': videoCommand,
  '04-audio/music/overview.md': musicCommand,
  '05-visuals/comic/00-comic-overview.md': comicCommand,
  '05-visuals/comic/01-draft-scenes.md': comicCommand,
  '05-visuals/comic/02-reference-sketch.md': comicCommand,
  '05-visuals/comic/03-generate-images.md': comicCommand,
  '05-visuals/comic/04-generate-audio.md': comicCommand,
  '05-visuals/comic/05-generate-slideshow.md': comicCommand,
  '05-visuals/comic/06-review.md': comicCommand,
  '05-visuals/comic/07-draft-treatment.md': comicCommand,
  '04-audio/voice/00-voice-overview.md': voiceCommand,
  '04-audio/voice/01-list.md': voiceCommand,
  '04-audio/voice/02-consent.md': voiceCommand,
  '04-audio/voice/03-import.md': voiceCommand,
  '04-audio/voice/04-design.md': voiceCommand,
  '04-audio/voice/05-clone.md': voiceCommand,
  '04-audio/voice/06-audition.md': voiceCommand,
  '04-audio/voice/07-approve.md': voiceCommand,
  '04-audio/voice/08-retire.md': voiceCommand,
  '04-audio/voice/09-delete.md': voiceCommand,
  '00-setup-and-utilities/links.md': linksCommand,
  '00-setup-and-utilities/resume.md': resumeCommand,
  '00-setup-and-utilities/setup.md': setupCommand
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

const commandForDoc = (doc: string): CliCommandDefinition => {
  const command = commandByDoc[doc as keyof typeof commandByDoc]
  if (command !== comicCommand && command !== voiceCommand) return command
  if (doc.endsWith(`/00-${command.name}-overview.md`)) return command

  const name = doc.match(/\/\d+-(.+)\.md$/)?.[1]
  const subcommand = command.subcommands?.find((candidate) => candidate.name === `${command.name} ${name}`)
  if (subcommand === undefined) throw new Error(`${doc}: document does not name a registered ${command.name} subcommand`)
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

const isTestDoc = (doc: string): boolean => doc === 'testing.md' || doc.endsWith('/tests.md')

test('command documentation links and section anchors resolve after relocation', async () => {
  const docs = [...await Array.fromAsync(new Bun.Glob('**/*.md').scan({ cwd: docsRoot })), ...modelReportDocs]
  const problems: string[] = []
  for (const doc of docs) {
    const file = resolve(docsRoot, doc)
    const markdown = (await Bun.file(file).text()).replace(/^```[^\n]*\n.*?^```[^\n]*$/gms, '')
    for (const match of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
      const link = match[1]!
      if (/^<?[a-z]+:/i.test(link)) continue
      const [path = '', anchor] = link.split('#')
      const target = path ? resolve(dirname(file), path) : file
      if (!target.endsWith('.md')) continue
      if (!await Bun.file(target).exists()) {
        problems.push(`${doc}: missing ${link}`)
        continue
      }
      if (!anchor) continue
      const content = (await Bun.file(target).text()).replace(/^```[^\n]*\n.*?^```[^\n]*$/gms, '')
      const counts = new Map<string, number>()
      const anchors = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(heading => {
        const slug = heading[1]!.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-')
        const count = counts.get(slug) ?? 0
        counts.set(slug, count + 1)
        return count ? `${slug}-${count}` : slug
      })
      anchors.push(...[...content.matchAll(/(?:id|name)=["']([^"']+)["']/g)].map(match => match[1]!))
      if (!anchors.includes(decodeURIComponent(anchor))) problems.push(`${doc}: missing anchor ${link}`)
    }
  }
  expect(problems).toEqual([])
})

test('command doc flag tables name only flags registered by that command', async () => {
  const docs = (await Array.fromAsync(new Bun.Glob('**/*.md').scan({ cwd: docsRoot }))).sort()
  // Preserve the report inventory without treating historical flags as current CLI usage.
  for (const doc of modelReportDocs) expect(await Bun.file(resolve(docsRoot, doc)).exists()).toBe(true)
  const commandDocs = docs.filter((doc) => !isTestDoc(doc))
  expect(commandDocs).toEqual(Object.keys(commandByDoc).sort())

  for (const parent of [comicCommand, voiceCommand]) {
    const documentedSubcommands = commandDocs
      .filter((doc) => commandByDoc[doc as keyof typeof commandByDoc] === parent)
      .map((doc) => commandForDoc(doc).name)
      .filter((name) => name !== parent.name).sort()
    expect(documentedSubcommands).toEqual((parent.subcommands ?? []).filter((subcommand) => subcommand.help?.hidden !== true).map((subcommand) => subcommand.name).sort())
  }

  const unregistered: string[] = []
  for (const doc of commandDocs) {
    const markdown = await Bun.file(resolve(docsRoot, doc)).text()
    const command = commandForDoc(doc)
    for (const flag of documentedFlags(markdown)) {
      const registrations = { ...GLOBAL_FLAG_DEFINITIONS, ...command.flags }
      if (registrationFor(flag.name, registrations) === undefined) {
        unregistered.push(`${doc}:${flag.line} --${flag.name} (${command.name})`)
      }
    }
  }

  expect(unregistered).toEqual([])
})
