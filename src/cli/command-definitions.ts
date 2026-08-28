import { configCommand } from './commands/setup-and-utilities/config-command/define-config-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { voiceCommand } from '~/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import type { CliCommandDefinition, HelpCommandGroupKey } from '~/types'

export const HELP_COMMAND_GROUP_BY_NAME: Readonly<Record<string, HelpCommandGroupKey>> = {
  version: 'core',
  help: 'core',
  config: 'setup',
  setup: 'setup',
  links: 'setup',
  resume: 'setup',
  metadata: 'processing',
  download: 'processing',
  extract: 'processing',
  write: 'processing',
  tts: 'processing',
  voice: 'processing',
  image: 'processing',
  video: 'processing',
  music: 'processing',
  comic: 'processing'
}

export const COMMAND_DEFINITIONS = [
  configCommand,
  setupCommand,
  linksCommand,
  metadataCommand,
  downloadCommand,
  extractCommand,
  resumeCommand,
  writeCommand,
  ttsCommand,
  voiceCommand,
  imageCommand,
  videoCommand,
  musicCommand,
  comicCommand
] as const satisfies readonly CliCommandDefinition[]
