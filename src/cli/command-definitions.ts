import { metadataCommand } from '~/cli/commands/sources/metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/sources/download/define-download-command'
import { extractCommand } from '~/cli/commands/command-shared/extract-routing/define-extract-command'
import { writeCommand } from '~/cli/commands/text/write/define-write-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { ttsCommand } from '~/cli/commands/audio/tts/define-tts-command'
import { imageCommand } from '~/cli/commands/visuals/image/define-image-command'
import { videoCommand } from '~/cli/commands/visuals/video/define-video-command'
import { musicCommand } from '~/cli/commands/audio/music/define-music-command'
import { comicCommand } from '~/cli/commands/visuals/comic/define-comic-command'
import { voiceCommand } from '~/cli/commands/audio/voice/define-voice-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import type { CliCommandDefinition, HelpCommandGroupKey } from '~/types'

export const HELP_COMMAND_GROUP_BY_NAME: Readonly<Record<string, HelpCommandGroupKey>> = {
  version: 'core',
  help: 'core',
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
