import { join } from 'node:path'
import type { LocationReferenceEntry } from '~/types'

export const createLiveLocationFixture = async (root: string, entries: LocationReferenceEntry[], imageBytes: Uint8Array): Promise<string[]> => {
  const locationsRoot = join(root, 'input', 'locations')
  const imageSha256 = new Bun.CryptoHasher('sha256').update(imageBytes).digest('hex')
  const paths: string[] = []
  const sketches = []
  for (const entry of entries) {
    const image = `${entry.key}.png`
    const path = join(locationsRoot, image)
    await Bun.write(path, imageBytes)
    paths.push(path)
    sketches.push({ locationKey: entry.key, specificationSha256: new Bun.CryptoHasher('sha256').update(entry.specification).digest('hex'), views: [{ view: 'establishing', generationId: `fixture-${entry.key}`, image, imageSha256, model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] })
  }
  await Bun.write(join(locationsRoot, 'locations-reference.json'), JSON.stringify({ schemaVersion: 1, styleImage: '../characters/hero.png', locations: entries }))
  await Bun.write(join(locationsRoot, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches }))
  return paths
}
