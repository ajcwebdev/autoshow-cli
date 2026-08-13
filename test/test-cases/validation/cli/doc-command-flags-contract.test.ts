import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { benchmarkCommand } from '~/cli/commands/setup-and-utilities/benchmark/define-benchmark-command'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { voiceCommand } from '~/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import type { CliCommandDefinition, CliFlagDefinition } from '~/types'

const docsRoot = resolve(import.meta.dir, '../../../../docs/commands')
const configDoc = 'setup-and-utilities/config/config.md'
const commandByDoc = {
  'process-steps/step-0-metadata/metadata.md': metadataCommand,
  'process-steps/step-1-download/download-file.md': downloadCommand,
  'process-steps/step-2-extract/01-extract.md': extractCommand,
  'process-steps/step-2-extract/02-extract-stt.md': extractCommand,
  'process-steps/step-2-extract/03-extract-ocr.md': extractCommand,
  'process-steps/step-2-extract/04-extract-url.md': extractCommand,
  'process-steps/step-3-write/write-text.md': writeCommand,
  'process-steps/step-4-tts/text-to-speech.md': ttsCommand,
  'process-steps/step-4-tts/voice-management.md': voiceCommand,
  'process-steps/step-5-image/text-to-image.md': imageCommand,
  'process-steps/step-6-video/text-to-video-services.md': videoCommand,
  'process-steps/step-7-music/text-to-music-services.md': musicCommand,
  'process-steps/step-8-comic/comic.md': comicCommand,
  'setup-and-utilities/benchmark/benchmark.md': benchmarkCommand,
  'setup-and-utilities/links/links.md': linksCommand,
  'setup-and-utilities/resume/resume.md': resumeCommand,
  'setup-and-utilities/setup/setup.md': setupCommand
} as const satisfies Record<string, CliCommandDefinition>

type DocumentedFlag = {
  heading: string | undefined
  line: number
  name: string
}

const tableCells = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

const isTableDivider = (line: string): boolean => {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

const documentedFlags = (markdown: string): DocumentedFlag[] => {
  const lines = markdown.split('\n')
  const flags: DocumentedFlag[] = []
  let heading: string | undefined
  let inFence = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ''
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const headingMatch = line.match(/^##\s+(.+?)\s*$/)
    if (headingMatch) heading = headingMatch[1]

    const nextLine = lines[index + 1] ?? ''
    if (!line.trim().startsWith('|') || !isTableDivider(nextLine)) continue
    if (!tableCells(line).some((cell) => /\bflags?\b/i.test(cell))) continue

    for (index += 2; index < lines.length && (lines[index] ?? '').trim().startsWith('|'); index++) {
      const row = lines[index] ?? ''
      for (const match of row.matchAll(/--([a-z0-9][a-z0-9-]*)/g)) {
        const name = match[1]
        if (name !== undefined) flags.push({ heading, line: index + 1, name })
      }
    }
    index--
  }

  return flags
}

const commandForTable = (doc: string, heading: string | undefined): CliCommandDefinition => {
  const command = commandByDoc[doc as keyof typeof commandByDoc]
  if (command !== comicCommand) return command

  const subcommand = comicCommand.subcommands?.find((candidate) => candidate.name === `comic ${heading}`)
  if (subcommand === undefined) throw new Error(`${doc}: flag table is not under a comic subcommand heading`)
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

test('command doc flag tables name only flags registered by that command', async () => {
  const docs = (await Array.fromAsync(new Bun.Glob('**/*.md').scan({ cwd: docsRoot }))).sort()
  expect(docs.filter((doc) => doc !== configDoc)).toEqual(Object.keys(commandByDoc).sort())

  const unregistered: string[] = []
  for (const doc of docs) {
    if (doc === configDoc) continue
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
