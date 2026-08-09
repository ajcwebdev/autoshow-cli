import { describe, expect, test } from 'bun:test'
import { HELP_FLAG_GROUPS } from '~/cli/native/root-definition'
import { benchmarkCommand } from '~/cli/commands/setup-and-utilities/benchmark/define-benchmark-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { configCommand } from '~/cli/commands/setup-and-utilities/config/define-config-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { draftScenesFlags, generateImagesFlags, referenceSketchFlags } from '~/cli/flags/comic-flags'
import type { CliFlagsDefinition } from '~/types'

// Mirrors `COMMAND_DEFINITIONS` in `create-cli.ts`, which cannot be imported
// here because that module runs the CLI on load. The comic subcommands parse and
// render their own help from these three flag sets (`comic-utils/subcommand-help.ts`),
// so they are walked directly rather than through `comicCommand.flags`.
const GROUPED_FLAG_SETS: (CliFlagsDefinition | undefined)[] = [
  configCommand.flags,
  setupCommand.flags,
  linksCommand.flags,
  metadataCommand.flags,
  downloadCommand.flags,
  extractCommand.flags,
  resumeCommand.flags,
  writeCommand.flags,
  ttsCommand.flags,
  imageCommand.flags,
  videoCommand.flags,
  musicCommand.flags,
  comicCommand.flags,
  benchmarkCommand.flags,
  draftScenesFlags,
  generateImagesFlags,
  referenceSketchFlags
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collectClaimedGroups = (): Set<string> => {
  const claimed = new Set<string>()
  for (const flags of GROUPED_FLAG_SETS) {
    if (!isRecord(flags)) continue
    for (const definition of Object.values(flags)) {
      if (!isRecord(definition)) continue
      const help = definition['help']
      if (!isRecord(help)) continue
      const group = help['group']
      if (typeof group === 'string') claimed.add(group)
    }
  }
  return claimed
}

const declaredGroupKeys = (): string[] => HELP_FLAG_GROUPS.map(([key]) => key)

describe('help flag group catalog contracts', () => {
  // A group key nothing claims is invisible: `renderGroupedFlags` skips empty
  // groups, so a stale entry survives every `--help` run without a symptom.
  test('every declared group is claimed by at least one flag', () => {
    const claimed = collectClaimedGroups()

    expect(declaredGroupKeys().filter((key) => !claimed.has(key))).toEqual([])
  })

  // The failure this one catches is user-visible but quiet: `renderGroupedFlags`
  // dumps flags whose group is missing from the catalog into an unlabeled block
  // after every labeled section, so the flags still print — just detached from
  // any heading. That is how the fal.ai video flags went unnoticed.
  test('every claimed group is declared, so no flag renders ungrouped', () => {
    const declared = new Set(declaredGroupKeys())

    expect([...collectClaimedGroups()].filter((key) => !declared.has(key)).sort()).toEqual([])
  })

  test('declared group keys are unique', () => {
    const keys = declaredGroupKeys()

    expect(keys.length).toBe(new Set(keys).size)
  })
})
