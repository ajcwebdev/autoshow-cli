import { mkdir } from 'node:fs/promises'
import { downloadHuggingFaceSnapshot } from '~/cli/commands/setup-and-utilities/setup/setup-download/huggingface'
import * as l from '~/utils/app-logger/app-logger'
import { withRetry } from '~/utils/retries'
import { InfraError, InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { getHuggingFaceToken } from './reverb-huggingface'
import { checkReverbDiarizationAssets, checkReverbAsrAssets, getMissingReverbDiarizationFiles, getMissingReverbAsrFiles, REVERB_ASR_REQUIRED_FILES, REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES, REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES, reverbDiarizationDir, reverbDiarizationEmbeddingDir, reverbModelDir } from './reverb-assets'
import type { ReverbDiarizationRequiredFile } from '~/types'

// Pinned commit SHAs rather than `main`: these are ~450 MB of model weights, and
// every other managed asset installs from a fixed reference. Refresh a pin with
// `curl -s https://huggingface.co/api/models/<repo> | jq -r .sha`.
const REVERB_ASR_REPO = 'Revai/reverb-asr'
const REVERB_ASR_REVISION = 'fc269766a3ea15d72e513a897d30397d77f325f7'
const REVERB_DIARIZATION_REPO = 'Revai/reverb-diarization-v2'
const REVERB_DIARIZATION_REVISION = 'f08664832352c36c72c194c5ff5e1305ec75126c'
const REVERB_DIARIZATION_EMBEDDING_REPO = 'Revai/pyannote-wespeaker-voxceleb-resnet34-LM'
const REVERB_DIARIZATION_EMBEDDING_REVISION = '8b39fe790a820a6764b2b8b942e743c73643eac2'

export const checkReverbModelExists = async (): Promise<boolean> => {
  return await checkReverbAsrAssets()
}

const checkDiarizationModelCached = async (): Promise<boolean> => {
  return await checkReverbDiarizationAssets()
}

export const downloadReverbModel = async (): Promise<void> => {
  l.write('info', 'Downloading Reverb ASR model from Hugging Face')

  if (await checkReverbModelExists()) {
    return
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.error('HUGGINGFACE_TOKEN is required to download Reverb model assets')
    throw InternalError('Missing HUGGINGFACE_TOKEN', { stage: 'stt:reverb-download', hints: hintsForMissingEnv('HUGGINGFACE_TOKEN') })
  }

  await withRetry(
    { retryClass: 'setup_download', operationName: 'reverb-model' },
    async () => {
      const missingBeforeDownload = await getMissingReverbAsrFiles()
      if (missingBeforeDownload.length === 0) {
        return
      }

      await mkdir(reverbModelDir, { recursive: true })
      await downloadHuggingFaceSnapshot({
        repoId: REVERB_ASR_REPO,
        revision: REVERB_ASR_REVISION,
        token: hfToken,
        destination: reverbModelDir,
        allowPatterns: [...missingBeforeDownload],
        requiredFiles: [...REVERB_ASR_REQUIRED_FILES]
      })

      const missing = await getMissingReverbAsrFiles()
      if (missing.length > 0) {
        throw InfraError(`Reverb ASR files missing after download: ${missing.join(', ')}`, { stage: 'stt:reverb-download' })
      }
    }
  )

  l.write('success', 'Reverb ASR model downloaded')
}

export const downloadDiarizationModel = async (): Promise<boolean> => {
  if (await checkDiarizationModelCached()) {
    return true
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.warn('No HUGGINGFACE_TOKEN found, cannot download diarization model')
    return false
  }

  try {
    await withRetry(
      { retryClass: 'setup_download', operationName: 'reverb-diarization-model' },
      async () => {
        const missingBeforeDownload = await getMissingReverbDiarizationFiles()
        if (missingBeforeDownload.length === 0) {
          return
        }

        const missingPipelineFiles = missingBeforeDownload
          .filter((file): file is Extract<ReverbDiarizationRequiredFile, `diarization-v2/${string}`> =>
            file.startsWith('diarization-v2/')
          )
          .map(file => file.replace('diarization-v2/', ''))

        if (missingPipelineFiles.length > 0) {
          await mkdir(reverbDiarizationDir, { recursive: true })
          await downloadHuggingFaceSnapshot({
            repoId: REVERB_DIARIZATION_REPO,
            revision: REVERB_DIARIZATION_REVISION,
            token: hfToken,
            destination: reverbDiarizationDir,
            allowPatterns: missingPipelineFiles,
            requiredFiles: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES]
          })
        }

        const missingEmbeddingFiles = missingBeforeDownload
          .filter((file): file is Extract<ReverbDiarizationRequiredFile, `pyannote-wespeaker-voxceleb-resnet34-LM/${string}`> =>
            file.startsWith('pyannote-wespeaker-voxceleb-resnet34-LM/')
          )
          .map(file => file.replace('pyannote-wespeaker-voxceleb-resnet34-LM/', ''))

        if (missingEmbeddingFiles.length > 0) {
          await mkdir(reverbDiarizationEmbeddingDir, { recursive: true })
          await downloadHuggingFaceSnapshot({
            repoId: REVERB_DIARIZATION_EMBEDDING_REPO,
            revision: REVERB_DIARIZATION_EMBEDDING_REVISION,
            token: hfToken,
            destination: reverbDiarizationEmbeddingDir,
            allowPatterns: missingEmbeddingFiles,
            requiredFiles: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES]
          })
        }

        const missing = await getMissingReverbDiarizationFiles()
        if (missing.length > 0) {
          throw InfraError(`Reverb diarization files missing after download: ${missing.join(', ')}`, { stage: 'stt:reverb-download' })
        }
      }
    )
  } catch (error) {
    l.error('Failed to download diarization model v2')
    const details = error instanceof Error ? error.message : String(error)
    if (details) l.error(`Error details: ${details}`)
    return false
  }

  l.write('success', 'Diarization model v2 downloaded')
  return true
}
