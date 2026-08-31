import { describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ComicPresentationDialogueBinding, ComicPresentationPanelInput } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { canonicalTtsJson, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { writeImmutableArtifactFile } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/safe-artifact-store'
import {
  createComicPresentationPlan,
  resolveComicPanelTimeline,
  validateResolvedPanelTimeline,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-plan'
import {
  PRESENTATION_ARCHIVE_PATH,
  PRESENTATION_FINAL_MP4,
  PRESENTATION_FINAL_WAV,
  buildPresentationAudioCommand,
  publishComicPresentationFinal,
  renderComicPresentation,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-renderer'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const HASH = 'a'.repeat(64)

const runFfmpeg = async (args: string[]): Promise<void> => {
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-loglevel', 'error', '-threads', '1', ...args])
  if (result.exitCode !== 0) throw new Error(result.stderr || `ffmpeg exited ${result.exitCode}`)
}

const fileHash = async (path: string): Promise<string> => sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer()))

const signChanges = (bytes: Uint8Array): number => {
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2))
  let prior = 0
  let changes = 0
  for (const sample of samples) {
    const sign = sample > 100 ? 1 : sample < -100 ? -1 : 0
    if (sign !== 0 && prior !== 0 && sign !== prior) changes += 1
    if (sign !== 0) prior = sign
  }
  return changes
}

describe('comic presentation local FFmpeg rendering', () => {
  test('renders exact-size hard cuts with synchronized H.264/AAC audio and immutable reruns', async () => {
    const root = await makeTempDir('autoshow-presentation-ffmpeg-')
    try {
      await mkdir(join(root, 'panels'), { recursive: true })
      await mkdir(join(root, 'audio'), { recursive: true })
      const firstPanelPath = join(root, 'panels', 'panel-01.png')
      const secondPanelPath = join(root, 'panels', 'panel-02.png')
      const dialoguePath = join(root, 'audio', 'dialogue.wav')
      await runFfmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=30:d=0.04', '-frames:v', '1', '-y', firstPanelPath])
      await runFfmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=30:d=0.04', '-frames:v', '1', '-y', secondPanelPath])
      await runFfmpeg([
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.400',
        '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=0.600',
        '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[dialogue]', '-map', '[dialogue]',
        '-ac', '2', '-c:a', 'pcm_s16le', '-y', dialoguePath,
      ])

      const panels: ComicPresentationPanelInput[] = [
        { panelNumber: 1, path: 'panels/panel-01.png', sha256: await fileHash(firstPanelPath), width: 64, height: 64 },
        { panelNumber: 2, path: 'panels/panel-02.png', sha256: await fileHash(secondPanelPath), width: 64, height: 64 },
      ]
      const dialogueBindings: ComicPresentationDialogueBinding[] = [
        { turnId: 'turn-1', sourceSegmentId: 'dialogue-1', panelNumber: 1, subjectKey: 'pilot', speakerLabel: 'PILOT', canonicalText: 'One.', evidence: { kind: 'source-segment-id', sourceSegmentId: 'dialogue-1', panelSourceSegmentIds: ['dialogue-1'], speechOrdinal: 1 } },
        { turnId: 'turn-2', sourceSegmentId: 'dialogue-2', panelNumber: 2, subjectKey: 'pilot', speakerLabel: 'PILOT', canonicalText: 'Two.', evidence: { kind: 'source-segment-id', sourceSegmentId: 'dialogue-2', panelSourceSegmentIds: ['dialogue-2'], speechOrdinal: 1 } },
      ]
      const dialogueSha256 = await fileHash(dialoguePath)
      const plan = createComicPresentationPlan({
        schemaVersion: 1,
        sceneRunIdentity: HASH,
        sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/script.md', scriptSlug: 'script', contentSha256: HASH, identityHash: HASH },
        createdAt: '2026-08-13T00:00:00.000Z',
        options: { untimedPanelMs: 2000, fps: 30 },
        inputs: {
          reviewedScene: { path: 'metadata/scene.json', sha256: HASH },
          structuredScript: { path: 'metadata/structured-script.json', sha256: HASH },
          dialoguePlan: { path: 'audio/dialogue-plan.json', sha256: HASH, dialoguePlanId: HASH },
          audioTarget: { kind: 'dialogue', targetKey: 'local=fixture', provider: 'local', model: 'fixture' },
          dialogueAudioRun: { path: 'audio/audio-run.json', sha256: HASH, audioRunId: HASH },
          dialogueTimeline: { path: 'audio/final-timeline.json', sha256: HASH, timelineId: HASH },
          dialogueAudio: { path: 'audio/dialogue.wav', sha256: dialogueSha256, durationMs: 1000, format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 48000, channels: 2 } },
          panels,
        },
        dialogueBindings,
        soundBindings: [],
        ambience: [],
      })
      const timeline = validateResolvedPanelTimeline(resolveComicPanelTimeline({
        presentationId: plan.presentationId,
        panels,
        dialogueBindings,
        dialogueRanges: new Map([['turn-1', { start: 0, end: 400 }], ['turn-2', { start: 400, end: 1000 }]]),
        soundBindings: [],
        untimedPanelMs: 2000,
      }))
      const planFile = await writeImmutableArtifactFile(root, `presentation/runs/${plan.presentationId}/comic-presentation-plan.json`, `${canonicalTtsJson(plan)}\n`)
      const timelineFile = await writeImmutableArtifactFile(root, `presentation/runs/${plan.presentationId}/resolved-panel-timeline.json`, `${canonicalTtsJson(timeline)}\n`)
      const renderInput = {
        sceneRunDir: root,
        plan,
        planRef: { path: planFile.relativePath, sha256: planFile.sha256 },
        timeline,
        timelineRef: { path: timelineFile.relativePath, sha256: timelineFile.sha256 },
      }
      const first = await renderComicPresentation(renderInput)
      const published = await publishComicPresentationFinal(root, first.run)
      const second = await renderComicPresentation(renderInput)
      expect(second).toEqual(first)
      expect(await publishComicPresentationFinal(root, second.run)).toEqual(published)
      expect(first.run.outputs.wav.path).toBe(PRESENTATION_FINAL_WAV)
      expect(first.run.outputs.mp4.path).toBe(PRESENTATION_FINAL_MP4)
      expect(first.runRef.path).toBe(PRESENTATION_ARCHIVE_PATH)
      const names = (await readdir(root, { recursive: true })).map(String)
      expect(names.some(name => name === PRESENTATION_ARCHIVE_PATH || name.endsWith('presentation.json'))).toBe(true)
      expect(names.some(name => name.includes('presentation/runs') || name.includes('presentation\\runs'))).toBe(false)
      expect(first.run.encoderProfile).toMatchObject({ width: 64, height: 64, videoCodec: 'h264', pixelFormat: 'yuv420p', fps: 30, audioCodec: 'aac', transitions: 'hard-cuts' })
      expect(['libx264', 'h264_videotoolbox', 'h264_nvenc', 'h264_amf']).toContain(first.run.encoderProfile.videoEncoder)
      expect(Math.abs(first.run.outputs.mp4.durationMs - timeline.durationMs)).toBeLessThanOrEqual(1000 / 30 + 1)
      expect(first.run.audioTransforms.some(transform => transform.kind === 'digital-silence')).toBe(true)
      const recordedCommands = first.run.commands.flatMap(command => command.args).join(' ')
      expect(recordedCommands).not.toMatch(/\b(?:zoompan|xfade|fade|scale|crop|pad)\b/u)

      const mp4Path = join(root, first.run.outputs.mp4.path)
      const earlyFrame = join(root, 'early.rgb')
      const lateFrame = join(root, 'late.rgb')
      const earlyAudio = join(root, 'early.pcm')
      const lateAudio = join(root, 'late.pcm')
      await runFfmpeg(['-i', mp4Path, '-ss', '0.200', '-frames:v', '1', '-an', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', earlyFrame])
      await runFfmpeg(['-i', mp4Path, '-ss', '0.700', '-frames:v', '1', '-an', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-y', lateFrame])
      await runFfmpeg(['-ss', '0.100', '-i', mp4Path, '-t', '0.200', '-vn', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 's16le', '-y', earlyAudio])
      await runFfmpeg(['-ss', '0.600', '-i', mp4Path, '-t', '0.200', '-vn', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 's16le', '-y', lateAudio])
      const firstPixel = new Uint8Array(await Bun.file(earlyFrame).arrayBuffer()).slice(0, 3)
      const secondPixel = new Uint8Array(await Bun.file(lateFrame).arrayBuffer()).slice(0, 3)
      expect(firstPixel[0]).toBeGreaterThan(200)
      expect(firstPixel[2]).toBeLessThan(40)
      expect(secondPixel[0]).toBeLessThan(40)
      expect(secondPixel[2]).toBeGreaterThan(200)
      const earlyChanges = signChanges(new Uint8Array(await Bun.file(earlyAudio).arrayBuffer()))
      const lateChanges = signChanges(new Uint8Array(await Bun.file(lateAudio).arrayBuffer()))
      expect(earlyChanges).toBeGreaterThan(100)
      expect(lateChanges).toBeGreaterThan(earlyChanges * 1.7)

      const ambienceBuild = buildPresentationAudioCommand({
        sceneRunDir: root,
        plan: { ...plan, ambience: [{ cueId: 'ambience-1', prompt: 'tone', sourceSpan: { kind: 'sound-effect', start: 0, end: 1, indexUnit: 'unicode-scalar-value', text: 'tone' }, sourceAudio: { path: 'audio/dialogue.wav', sha256: dialogueSha256, durationMs: 1000 }, gainDb: -12, pan: 0 }] },
        timeline,
        outputPath: join(root, 'ambience.wav'),
      })
      expect(ambienceBuild.command.args).toContain('-stream_loop')
      expect(ambienceBuild.command.args).toContain('-1')
      expect(ambienceBuild.transforms.find(transform => transform.kind === 'ambience-loop')?.finalRangeMs).toEqual({ start: 0, end: 1000 })
      expect(ambienceBuild.transforms.some(transform => transform.kind === 'digital-silence')).toBe(false)

      const replacementWav = await writeImmutableArtifactFile(root, 'presentation/replacement/presentation.wav', new Uint8Array([1, 2, 3]))
      const replacementMp4 = await writeImmutableArtifactFile(root, 'presentation/replacement/slideshow.mp4', new Uint8Array([4, 5, 6]))
      const replacementRun = {
        ...first.run,
        outputs: {
          wav: { ...first.run.outputs.wav, path: replacementWav.relativePath, sha256: replacementWav.sha256 },
          mp4: { ...first.run.outputs.mp4, path: replacementMp4.relativePath, sha256: replacementMp4.sha256 },
        },
      }
      expect(await publishComicPresentationFinal(root, replacementRun)).toEqual([
        { path: PRESENTATION_FINAL_WAV, sha256: replacementWav.sha256 },
        { path: PRESENTATION_FINAL_MP4, sha256: replacementMp4.sha256 },
      ])
      expect(await fileHash(join(root, PRESENTATION_FINAL_WAV))).toBe(replacementWav.sha256)
      expect(await fileHash(join(root, PRESENTATION_FINAL_MP4))).toBe(replacementMp4.sha256)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
