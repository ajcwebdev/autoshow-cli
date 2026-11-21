import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { collectImageTargets } from '~/cli/commands/visuals/image/image-generation-targets'
import { runImageTargets } from '~/cli/commands/visuals/image/run-image-gen'
import { writeOpenAIImageResponseData } from '~/cli/commands/visuals/image/image-utils/image-output'
import { redDotPng } from '../../../../test-utils/media-fixtures'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const model = 'gpt-image-2.6-flare'
const secondModel = 'gpt-image-2.6-sunburst'
const validPng = { b64_json: Buffer.from(redDotPng).toString('base64') }
const truncatedPng = { b64_json: Buffer.from(redDotPng.slice(0, 45)).toString('base64') }
const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY', 'AUTOSHOW_REQUIRED_IMAGE_MODEL'], tempPrefix: 'autoshow-image-integrity-',
  beforeEachExtra: () => { process.env['OPENAI_API_KEY'] = 'mock' }
})

describe('OpenAI-compatible image response integrity', () => {
  test('rejects missing payloads, malformed base64, incomplete pixel data, and mismatched encodings before publishing', async () => {
    await tempDirs.withDir(async dir => {
      // The truncated PNG still has valid dimensions. Probing its header alone would accept it.
      expect(await new Bun.Image(redDotPng.slice(0, 45)).metadata()).toMatchObject({ width: 1, height: 1 })
      const noEndMarker = { b64_json: Buffer.from(redDotPng.slice(0, -12)).toString('base64') }
      for (const payload of [{}, { b64_json: validPng.b64_json + '!' }, truncatedPng, noEndMarker, { ...validPng, mime_type: 'image/jpeg' }]) {
        await expect(writeOpenAIImageResponseData({ data: [payload] }, dir, 'png', { model, recoveryDir: dir })).rejects.toThrow('image 1:')
        expect(await readdir(dir)).toEqual([])
      }
    })
  })

  test('downloads and decodes URL responses and preserves unpadded, URL-safe, and wrapped base64', async () => {
    await tempDirs.withDir(async dir => {
      const calls = installMockFetch(call => new Response(call.url.endsWith('bad') ? redDotPng.slice(0, 45) : redDotPng, { headers: { 'content-type': 'image/png' } }))
      const variants = [
        { url: 'https://fixture.test/good' },
        { b64_json: Buffer.from(redDotPng).toString('base64url') },
        { b64_json: validPng.b64_json.replace(/.{12}/g, '$&\n') }
      ]
      for (const payload of variants) {
        const [file] = await writeOpenAIImageResponseData({ data: [payload] }, dir, 'png', { model, recoveryDir: dir })
        expect(await Bun.file(file!).bytes()).toEqual(redDotPng)
      }
      await expect(writeOpenAIImageResponseData({ data: [{ url: 'https://fixture.test/bad' }] }, dir, 'png', { model, recoveryDir: dir })).rejects.toThrow('image 1:')
      expect(await readdir(dir)).toEqual(['generated-image.png'])
      expect(await Bun.file(join(dir, 'generated-image.png')).bytes()).toEqual(redDotPng)
      expect(calls).toHaveLength(2)
    })
  })

  test('retains a short OpenAI response for recovery without marking the requested batch complete', async () => {
    await tempDirs.withDir(async dir => {
      await expect(writeOpenAIImageResponseData({ data: [validPng] }, dir, 'png', { model, recoveryDir: dir, expectedCount: 2 })).rejects.toThrow('expected 2 images, received 1')
      const [partial] = await readdir(dir)
      expect(await Bun.file(join(dir, partial!, 'generated-image.png')).bytes()).toEqual(redDotPng)
    })
  })

  test('fan-out retains all valid slots from a corrupt reply and subsequent resume avoids a second paid dispatch', async () => {
    await tempDirs.withDir(async dir => {
      const calls = installMockFetch(call => jsonResponse({ data: call.bodyJson?.['model'] === model
        ? [validPng, truncatedPng, validPng]
        : [validPng, validPng, validPng] }))
      const opts = { openaiImageModels: [model, secondModel], imageCount: 3 }
      const targets = collectImageTargets(opts)
      const result = await runImageTargets(targets, 'synthetic', dir, opts)
      expect(result.metadata.map(entry => entry.imageModel)).toEqual([secondModel])
      expect(result.imagePaths).toHaveLength(3)
      const partial = (await readdir(dir)).find(name => name.startsWith(`partial-images-${model}-`))!
      const retained = join(dir, partial)
      expect((await readdir(retained)).sort()).toEqual(['generated-image-3.png', 'generated-image.png'])
      const retry = targets.filter(target => target.model === model)
      await expect(imageResumeConfig.runMissingTargets(retry, 'synthetic', dir, opts, {
        outputDir: dir, runtimeOptions: opts, targets: retry, existingEntries: result.metadata, currentProviderStates: [], currentManifestMetadata: {}
      })).rejects.toThrow(partial)
      for (const name of await readdir(retained)) expect(await Bun.file(join(retained, name)).bytes()).toEqual(redDotPng)
      expect(calls).toHaveLength(2)
    })
  })
})
