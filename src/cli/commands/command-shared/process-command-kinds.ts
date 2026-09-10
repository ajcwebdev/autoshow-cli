import type { InputFamily, ProcessCommand, ProcessCommandCapabilities } from '~/types'

const PROCESS_COMMAND_CAPABILITIES: Record<ProcessCommand, ProcessCommandCapabilities> = {
  metadata: {
    supportsBatchSourceExpansion: true
  },
  download: {
    supportsBatchSourceExpansion: true
  },
  extract: {
    supportsBatchSourceExpansion: true,
    supportedInputFamilies: ['media', 'document', 'html_article', 'x_space']
  },
  write: {
    supportsBatchSourceExpansion: true
  },
  tts: {
    supportsBatchSourceExpansion: false
  },
  image: {
    supportsBatchSourceExpansion: false
  },
  music: {
    supportsBatchSourceExpansion: false
  },
  video: {
    supportsBatchSourceExpansion: false
  },
  comic: {
    supportsBatchSourceExpansion: false
  }
}

export const isExtractCommand = (command: ProcessCommand): command is 'extract' =>
  command === 'extract'

export const usesExtractInputRouting = (command: ProcessCommand): command is 'extract' =>
  command === 'extract'

const getProcessCommandCapabilities = (
  command: ProcessCommand
): ProcessCommandCapabilities => PROCESS_COMMAND_CAPABILITIES[command]

export const commandSupportsBatchSourceExpansion = (
  command: ProcessCommand
): boolean => getProcessCommandCapabilities(command).supportsBatchSourceExpansion

export const commandSupportsInputFamily = (
  command: ProcessCommand,
  family: InputFamily
): boolean => {
  const supported = getProcessCommandCapabilities(command).supportedInputFamilies
  return supported ? supported.includes(family) : true
}
