import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TreatmentDraft } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

export const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

export const TREATMENT_FIXTURE_TEXT = `--- Page 1 ---

# Lantern Ridge Treatment

## CHARACTERS

1. Ruth Alder (50s) - Camp ranger, tall and weathered, green ranger jacket.

2. Milo Alder (12) - Ruth's nephew, small, curious, blue hoodie.

## ACT I

Night at the Lantern Ridge firepit. Ranger Ruth leans toward the flames and tells Milo the story of the ridge. "This ridge was once a silver camp," she says. A hundred years earlier the Old Silver Mine hummed with work; miners hauled carts from the mouth of the mine. Back at the fire, Milo grins as Ruth finishes: "And that is why we never dig here."
`

export const buildTreatmentFixtureDraft = (overrides: Partial<TreatmentDraft> = {}): TreatmentDraft => ({
  schemaVersion: 1,
  title: 'Lantern Ridge',
  sceneTitle: 'The Legend of Lantern Ridge',
  styleInstructions: 'Flat ink comic style with warm firelight, coarse halftone shadows, and a muted forest palette.',
  characters: [
    {
      key: 'ranger-ruth',
      name: 'RANGER RUTH',
      aliases: ['Ruth Alder', 'the ranger', 'Ruth'],
      description: 'Tall weathered woman with grey braids, green ranger jacket, brown boots; 50s, camp ranger.',
      wardrobe: { colorTokens: ['green ranger jacket', 'brown boots'], never: ['helmet', ' '] },
    },
    {
      key: 'milo',
      name: 'MILO',
      aliases: ['Milo Alder', 'the ranger'],
      description: 'Small curious boy with a blue hoodie and a flashlight; 12, Ruth\'s nephew.',
      wardrobe: { colorTokens: ['blue hoodie', ' '], never: [] },
    },
  ],
  locations: [
    {
      key: 'ridge-firepit',
      name: 'Ridge Firepit',
      slugline: 'ext. ridge firepit – night',
      aliases: ['the firepit'],
      specification: 'A ring of river stones around a low fire, split-log benches, tall pines behind.',
    },
    {
      key: 'old-silver-mine',
      name: 'Old Silver Mine',
      slugline: 'EXT. OLD SILVER MINE - DAY',
      aliases: [],
      specification: 'A timber-framed mine mouth in a rocky hillside with ore-cart rails leading out.',
    },
  ],
  panels: [
    {
      number: 1,
      locationKey: 'ridge-firepit',
      panelNote: 'RANGER RUTH leans toward the fire while MILO listens from a log bench.',
      narration: '“the ranger leans toward the flames and begins the story of the ridge.”',
      dialogue: [],
      sourceExcerpt: 'Ranger Ruth leans toward the flames and tells Milo the story of the ridge.',
    },
    {
      number: 2,
      locationKey: 'old-silver-mine',
      panelNote: 'Miners haul carts from the mine mouth [in the flashback].',
      narration: null,
      dialogue: [{ characterKey: 'ranger-ruth', line: '"(warmly) this ridge was once a silver camp."' }],
      sourceExcerpt: 'A hundred years earlier the Old Silver Mine hummed with work.',
    },
    {
      number: 3,
      locationKey: 'ridge-firepit',
      panelNote: 'Back at the fire, MILO grins as RANGER RUTH finishes.',
      narration: null,
      dialogue: [{ characterKey: 'ranger-ruth', line: 'And that is why we never dig here.' }],
      sourceExcerpt: 'Back at the fire, Milo grins as Ruth finishes.',
    },
  ],
  ...overrides,
})

export const makeTreatmentProjectRoot = async (options: { styleSeed?: boolean } = {}): Promise<{ root: string; charactersRoot: string; locationsRoot: string; scriptsRoot: string; outputRoot: string; treatmentPath: string }> => {
  const root = await makeTempDir('autoshow-treatment-')
  const charactersRoot = join(root, 'input', 'characters')
  const locationsRoot = join(root, 'input', 'locations')
  const scriptsRoot = join(root, 'input', 'scripts')
  const outputRoot = join(root, 'output')
  await mkdir(charactersRoot, { recursive: true })
  await mkdir(locationsRoot, { recursive: true })
  await mkdir(scriptsRoot, { recursive: true })
  await mkdir(outputRoot, { recursive: true })
  if (options.styleSeed !== false) await writeFile(join(charactersRoot, 'lantern-ridge--style-seed.png'), tinyPng)
  const treatmentPath = join(root, 'input', 'lantern-ridge.md')
  await writeFile(treatmentPath, TREATMENT_FIXTURE_TEXT)
  return { root, charactersRoot, locationsRoot, scriptsRoot, outputRoot, treatmentPath }
}
