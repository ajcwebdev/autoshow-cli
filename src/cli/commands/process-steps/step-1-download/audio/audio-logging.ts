import { basename } from 'node:path'
import type { AudioDownloadSummary, AudioNormalizeSummary } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

export const logAudioDownload = (summary: AudioDownloadSummary): void => {
  l.write('info', `Audio download: ${summary.status}, ${summary.target}`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logAudioNormalize = (summary: AudioNormalizeSummary): void => {
  l.write('info', `Audio normalized: ${summary.status}, ${basename(summary.inputPath) || 'audio'} to ${basename(summary.outputPath) || 'audio'}`, {
    category: 'pipeline',
    metadata: {
      status: summary.status,
      inputPath: summary.inputPath,
      outputPath: summary.outputPath,
      plan: summary.plan
    }
  })
}

export const logAudioOutput = (audioPath: string): void => {
  l.write('info', `Audio output: ${audioPath}`, { category: 'artifact', metadata: { audioPath } })
}
