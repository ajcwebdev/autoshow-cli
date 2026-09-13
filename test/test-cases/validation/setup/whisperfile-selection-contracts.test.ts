import { expect, test } from 'bun:test'
import * as v from 'valibot'
import { AutoshowConfigSchema, SETUP_STEP_IDS } from '~/types'
import { resolveSetupModel, runModelDownloads } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import { SUPPORTED_WHISPERFILE_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { resolveWhisperfileCalibration } from '~/cli/commands/stt/workflows/timing/calibrate-whisper-timing'
import { MODEL_SELECTORS, selectDockerScenarios } from '../../../docker-acceptance/docker-scenarios'
import { runCommand } from '../../../test-utils/test-helpers'

test('bare and prefixed downloads keep the full whisperfile catalog', () => {
  for (const model of SUPPORTED_WHISPERFILE_MODELS) {
    expect(resolveSetupModel(model)).toBe(model)
    expect(resolveSetupModel(`whisperfile:${model}` as const)).toBe(model)
  }
  expect(() => resolveSetupModel('whisper:tiny')).toThrow('Unknown model prefix')
  expect(() => resolveSetupModel('base')).toThrow('Invalid model')
})

test('all download selections validate before any download begins', async () => {
  await expect(runModelDownloads(['tiny', 'whisper:tiny'])).rejects.toThrow('Unknown model prefix')
})

test('removed local selectors, setup steps and configuration fail without redirecting', async () => {
  for (const args of [
    ['extract', 'audio.wav', '--provider', 'whisper=tiny', '--price'],
    ['config', '--stt', 'whisper=tiny'],
    ['setup', '--step', 'whisper-binary'],
    ['setup', '--step', 'whisper-model'],
    ['setup', '--models', 'whisper:tiny']
  ]) {
    const result = await runCommand(['src/cli/create-cli.ts', ...args])
    expect(result.exitCode).toBe(2)
    expect(result.stderr + result.stdout).toMatch(/Unknown|Invalid|unsupported/i)
  }
  expect(SETUP_STEP_IDS).not.toContain('whisper-binary')
  expect(SETUP_STEP_IDS).not.toContain('whisper-model')
  expect(v.safeParse(AutoshowConfigSchema, { defaults: { extract: { stt: { whisper: ['tiny'] } } } }).success).toBe(false)
})

test('timing calibration defaults to whisperfile tiny and rejects the removed engine', () => {
  expect(resolveWhisperfileCalibration({})).toEqual({ engine: 'whisperfile', model: 'tiny' })
  expect(resolveWhisperfileCalibration({ 'whisper-calibration-model': 'small.en' }).model).toBe('small.en')
  expect(() => resolveWhisperfileCalibration({ 'whisper-engine': 'whisper' })).toThrow('must be whisperfile')
})

test('native, Docker, and comparison coverage is limited to the four recommended models', async () => {
  const models = ['tiny', 'tiny.en', 'small', 'small.en'] as const
  expect([...MODEL_SELECTORS]).toEqual(models.map(model => `whisperfile:${model}` as const))
  const preset = await Bun.file('config/stt-local.json').json()
  expect(preset.defaults.extract.stt).toEqual({ localConcurrency: 1, whisperfile: models })
  const native = await Bun.file('test/test-cases/e2e/local/stt/whisperfile/whisperfile-default.test.ts').text()
  expect([...native.matchAll(/model: '([^']+)'/g)].map(match => match[1]).filter((model, index, all) => all.indexOf(model) === index)).toEqual([...models])
  const cases = selectDockerScenarios({ suite: 'models' })
  expect(cases.find(entry => entry.id === 'lyrics-default')?.model).toBe('whisperfile:small.en')
  expect(cases.find(entry => entry.id === 'stt-default')?.model).toBe('whisperfile:tiny')
  expect(cases.filter(entry => entry.id.startsWith('stt-split-'))).toHaveLength(2)
})
