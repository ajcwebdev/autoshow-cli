import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { runCapture, runInherit, detectPlatform, whisperBinaryPath, whisperBuildDir, whisperLibDir, whisperModelsDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { downloadGithubArchive } from '~/cli/commands/setup-and-utilities/setup/setup-download/github-archives'
import { readDependencyTag } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { getWhisperModelIntegrity, resolveWhisperModelMinBytes } from './whisper-model-integrity'
import { InternalError } from '~/utils/error-handler'
import { recordSetupPerformancePhase } from '~/cli/commands/setup-and-utilities/setup/setup-performance'
import { logicalCpuCount } from '~/utils/logical-cpu-count'

const whisperBaseUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
const fileExists = async (path: string): Promise<boolean> => {
  return await pathExists(path)
}

const cleanupPath = async (path: string): Promise<void> => {
  await rm(path, { recursive: true, force: true })
}

const maybeCopyWhisperDylibs = async (buildSrcDir: string): Promise<void> => {
  const dylibMarker = `${buildSrcDir}/libwhisper.dylib`
  if (!await fileExists(dylibMarker)) {
    return
  }

  await mkdir(whisperLibDir, { recursive: true })

  const entries = await readdir(buildSrcDir, { withFileTypes: true })
  const dylibs = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.startsWith('libwhisper') && name.endsWith('.dylib'))

  for (const dylib of dylibs) {
    await copyFile(`${buildSrcDir}/${dylib}`, `${whisperLibDir}/${dylib}`)
  }
}

const verifyWhisperBinary = async (): Promise<void> => {
  const result = await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })
  if (result.exitCode !== 0) {
    l.warn('Whisper installation may have issues, but continuing', { category: 'command' })
  }
}

const readWhisperTag = async (): Promise<string> => {
  return await readDependencyTag('whisper.cpp') ?? 'v1.7.4'
}

export const setupWhisper = async (): Promise<void> => {
  if (await fileExists(whisperBinaryPath)) {
    const check = await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })
    if (check.exitCode === 0) {
      return
    }

    l.write('info', 'Whisper binary found but not working, rebuilding', { category: 'command' })
  }

  const tag = await readWhisperTag()
  const repoDir = whisperBuildDir

  l.write('info', `Building whisper.cpp ${tag}`, { category: 'command', metadata: { engine: 'whisper', tag } })

  await mkdir(repoDir, { recursive: true })
  await cleanupPath(repoDir)

  await recordSetupPerformancePhase('whisper.cpp', 'archive-preparation', async () => {
    await withRetry(
      { retryClass: 'setup_download', operationName: 'whisper-source' },
      async () => {
        await downloadGithubArchive({
          owner: 'ggerganov',
          repo: 'whisper.cpp',
          ref: tag,
          destination: repoDir,
          stripComponents: 1,
          flowId: 'whisper-source'
        })
      }
    )
  }, { sourceCached: false })

  const platform = detectPlatform()
  await recordSetupPerformancePhase('whisper.cpp', 'configure-generate', async () => {
    if (platform === 'darwin') {
      await runInherit('cmake', ['-B', 'build', '-DGGML_METAL=ON', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_BUILD_TYPE=Release'], { cwd: repoDir })
    } else {
      await runInherit('cmake', ['-B', 'build', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_BUILD_TYPE=Release'], { cwd: repoDir })
    }
  })

  const parallelJobs = logicalCpuCount()
  await recordSetupPerformancePhase('whisper.cpp', 'compile-link', async () => {
    await runInherit('cmake', ['--build', 'build', '-j', '--config', 'Release'], { cwd: repoDir })
  }, { parallelJobs })

  await recordSetupPerformancePhase('whisper.cpp', 'install-promote', async () => {
    await mkdir(dirname(whisperBinaryPath), { recursive: true })
    await mkdir(whisperLibDir, { recursive: true })

    const binCandidateA = `${repoDir}/build/bin/whisper-cli`
    const binCandidateB = `${repoDir}/build/whisper-cli`
    const sourceBinary = await fileExists(binCandidateA) ? binCandidateA : binCandidateB

    await copyFile(sourceBinary, whisperBinaryPath)
    await makeExecutable(whisperBinaryPath)

    if (platform === 'darwin') {
      await maybeCopyWhisperDylibs(`${repoDir}/build/src`)
    }
  })

  await recordSetupPerformancePhase('whisper.cpp', 'health-check', verifyWhisperBinary)

  // The checked-out source and object tree are inputs to the binary we just
  // copied into runtime/bin; keeping them only costs disk.
  await recordSetupPerformancePhase('whisper.cpp', 'cleanup', async () => {
    await cleanupPath(repoDir)
  })

  l.write('success', 'Whisper.cpp installed', { category: 'command' })
}

export const downloadWhisperModel = async (modelName: string): Promise<void> => {
  await mkdir(whisperModelsDir, { recursive: true })

  const modelFile = `ggml-${modelName}.bin`
  const destination = `${whisperModelsDir}/${modelFile}`

  if (await fileExists(destination)) {
  } else {
    l.write('info', `Downloading whisper model: ${modelName}`, { category: 'command', metadata: { engine: 'whisper', model: modelName } })

    const url = `${whisperBaseUrl}/${modelFile}`
    const integrity = getWhisperModelIntegrity(modelName)

    await withRetry(
      { retryClass: 'setup_download', operationName: `whisper-model-${modelName}` },
      async () => {
        // No cleanup between attempts: downloadFile keeps a verified partial
        // file so a retry resumes instead of refetching gigabytes from zero.
        await downloadFile({
          url,
          destination,
          expectedMinBytes: resolveWhisperModelMinBytes(modelName),
          ...(integrity ? { sha256: integrity.sha256 } : {}),
          flowId: 'whisper-model'
        })
      }
    )

    l.write('success', `Whisper model ${modelName} downloaded`, { category: 'command', metadata: { engine: 'whisper', model: modelName } })
  }
}

export const ensureWhisperReady = async (modelName: string): Promise<void> => {
  if (!modelName) {
    l.error('Model name required', { category: 'command' })
    throw InternalError('Model name required', { stage: 'setup:whisper' })
  }

  if (await fileExists(whisperBinaryPath)) {
    const healthy = (await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })).exitCode === 0

    if (!healthy) {
      l.write('info', 'Rebuilding whisper', { category: 'command' })
      await setupWhisper()
    }
  } else {
    await setupWhisper()
  }

  await downloadWhisperModel(modelName)
}
