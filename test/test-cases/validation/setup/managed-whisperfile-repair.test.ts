import { expect, spyOn, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { whisperfileBinaryPath, whisperfileDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { setupWhisperfile } from '~/cli/commands/stt/local/whisperfile/whisperfile'
import { WHISPERFILE_ARTIFACTS } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'

const fixture = async (run: (model: string, destination: string, install: (script: string) => void, requests: () => number) => Promise<void>): Promise<void> => {
  const model = `fixture-${crypto.randomUUID()}`
  const destination = whisperfileBinaryPath(model)
  const registry = WHISPERFILE_ARTIFACTS as Record<string, { size: number, sha256: string }>
  let payload = '', requests = 0
  const install = (script: string): void => {
    payload = script
    registry[model] = { size: Buffer.byteLength(script), sha256: new Bun.CryptoHasher('sha256').update(script).digest('hex') }
  }
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async () => {
    requests += 1
    return new Response(payload)
  }, { preconnect: () => {} }))
  try {
    await mkdir(whisperfileDir, { recursive: true })
    await run(model, destination, install, () => requests)
  } finally {
    fetch.mockRestore()
    delete registry[model]
    await Promise.all([destination, `${destination}.download`, `${destination}.download.part`, `${destination}.download.part.json`].map(path => rm(path, { force: true })))
  }
}

test('managed Whisperfile repairs corrupt cached bytes and reuses the verified replacement without another download', async () => fixture(async (model, destination, install, requests) => {
  const healthy = '#!/bin/sh\nexit 0\n'
  install(healthy)
  await Bun.write(destination, 'corrupt previous artifact')
  await setupWhisperfile(model)
  expect(await Bun.file(destination).text()).toBe(healthy)
  expect(requests()).toBe(1)
  await setupWhisperfile(model)
  expect(requests()).toBe(1)
}))

test('forced Whisperfile replacement preserves the previous executable when the new verified artifact fails health checks', async () => fixture(async (model, destination, install, requests) => {
  const healthy = '#!/bin/sh\nexit 0\n'
  install(healthy)
  await setupWhisperfile(model)
  expect(requests()).toBe(1)
  install('#!/bin/sh\nexit 42\n')
  await expect(setupWhisperfile(model, { forceRedownload: true })).rejects.toThrow('executable health check')
  expect(await Bun.file(destination).text()).toBe(healthy)
  expect(requests()).toBe(2)
}))
