import { expect } from 'bun:test'
import { assertDecodableMedia, containedArtifactPath } from '../../../../../test-utils/assert-generated-content'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { defineBudgetedLiveServiceTest, requireConfiguredEnvVar, runCommandAndExpectOutputDir } from '../../../../../test-utils/service-test-kit'

// Official model/GenerateContent contract: exact model, 4K output and 8:1 ratio.
// https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1
// The provider chooses the returned image encoding; integrity is checked from that artifact.
defineBudgetedLiveServiceTest('image-gemini-gemini-nano-banana-2.1', 'Nano Banana 2.1 preserves requested identity and returns a decodable panorama; visual quality is unscored', ['GEMINI_API_KEY'], async () => {
  await requireConfiguredEnvVar('GEMINI_API_KEY', 'GEMINI_API_KEY is required for Gemini image generation')
  const outputDir = await runCommandAndExpectOutputDir('image-gen', [
    'src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background',
    '--provider', 'gemini=gemini-nano-banana-2.1', '--size', '4K', '--aspect-ratio', '8:1'
  ])
  const metadata = await readCanonicalRecord(outputDir) as {
    image?: Array<{ imageService?: string, imageModel?: string, imageSize?: string, imageFileNames?: string[] }>
  }
  const image = metadata.image?.[0]
  expect(image?.imageService).toBe('gemini')
  expect(image?.imageModel).toBe('gemini-nano-banana-2.1')
  expect(image?.imageSize).toBe('4K')
  expect(image?.imageFileNames).toHaveLength(1)
  const artifactPath = containedArtifactPath(outputDir, image!.imageFileNames![0]!)
  expect(await Bun.file(artifactPath).exists()).toBe(true)
  expect(Bun.file(artifactPath).size).toBeGreaterThan(0)
  await assertDecodableMedia(artifactPath, 'image', { aspectRatio: 8 })
})
