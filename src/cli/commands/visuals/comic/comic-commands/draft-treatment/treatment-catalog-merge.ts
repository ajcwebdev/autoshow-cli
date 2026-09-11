import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { CharacterReferenceConfig, LocationReferenceCatalog, LocationReferenceEntry, TreatmentCatalogInputs, TreatmentCatalogPolicy, TreatmentDraftCharacter, TreatmentDraftLocation, TreatmentDroppedAlias, TreatmentStyleImageAction } from '~/types'
import { getCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { ValidationError } from '~/utils/error-handler'
import { readCharacterCatalogConfig } from '../../comic-utils/character-catalog-reader'
import { normalizeCharacterLookup } from '../../comic-utils/character-catalog-validation'
import { getLocationReferencePath, getLocationsRoot, readLocationReferenceCatalog } from '../../comic-utils/location-reference'
import { TREATMENT_STAGE } from './treatment-defaults'
import { canonicalSlugline } from './treatment-schemas'

type CharacterEntry = CharacterReferenceConfig['characters'][number]

const CHARACTER_REFERENCE_FILENAME = 'characters-reference.json'

export const characterOutlineSheetFilename = (key: string): string => `${key}--outline-sheet.png`

export const resolveLocationStyleImagePath = (styleImage: string, locationsRoot: string): string =>
  styleImage.startsWith('input/') ? resolve(dirname(dirname(resolve(locationsRoot))), styleImage) : resolve(locationsRoot, styleImage)

export const readTreatmentCatalogInputs = async (): Promise<TreatmentCatalogInputs> => {
  const charactersRoot = resolve(getCharactersRoot())
  const characterConfigPath = join(charactersRoot, CHARACTER_REFERENCE_FILENAME)
  const characters: CharacterReferenceConfig = existsSync(characterConfigPath)
    ? readCharacterCatalogConfig(characterConfigPath).config
    : { schemaVersion: 3, characters: [], groupAliases: [] }
  const locationsRoot = resolve(getLocationsRoot())
  const locationCatalogPath = getLocationReferencePath(locationsRoot)
  const locations = existsSync(locationCatalogPath) ? await readLocationReferenceCatalog(locationsRoot) : undefined
  return { charactersRoot, characterConfigPath, characters, locationsRoot, locationCatalogPath, locations }
}

const nonBlank = (values: readonly string[]): string[] => values.map(value => value.trim()).filter(Boolean)

const dedupeByLookup = (values: readonly string[], exclude: ReadonlySet<string>): string[] => {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const normalized = normalizeCharacterLookup(value)
    if (!normalized || exclude.has(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(value)
  }
  return output
}

export const mergeTreatmentCharacterCatalog = (input: {
  existing: CharacterReferenceConfig
  candidates: readonly TreatmentDraftCharacter[]
  styleSeed: string
  styleInstructions: string
  policy: TreatmentCatalogPolicy
}): { next: CharacterReferenceConfig; charactersAdded: string[]; charactersSkipped: string[]; droppedAliases: TreatmentDroppedAlias[] } => {
  const existingKeys = new Set(input.existing.characters.map(character => character.key))
  const owners = new Map<string, string>()
  const claim = (label: string, key: string): void => {
    const normalized = normalizeCharacterLookup(label)
    if (normalized && !owners.has(normalized)) owners.set(normalized, key)
  }
  for (const character of input.existing.characters) {
    claim(character.key, character.key)
    claim(character.name, character.key)
    for (const alias of character.aliases) claim(alias, character.key)
  }
  for (const group of input.existing.groupAliases) claim(group.alias, `group:${group.alias}`)

  const charactersSkipped: string[] = []
  const droppedAliases: TreatmentDroppedAlias[] = []
  const pending: TreatmentDraftCharacter[] = []
  for (const candidate of input.candidates) {
    if (existingKeys.has(candidate.key)) {
      if (input.policy === 'fail') throw ValidationError(`Character "${candidate.key}" already exists in the character catalog and --catalog-policy fail forbids skipping it`, { stage: TREATMENT_STAGE })
      charactersSkipped.push(candidate.key)
      continue
    }
    pending.push(candidate)
  }

  for (const candidate of pending) {
    for (const label of [candidate.key, candidate.name]) {
      const normalized = normalizeCharacterLookup(label)
      if (!normalized) continue
      const owner = owners.get(normalized)
      if (owner !== undefined && owner !== candidate.key) {
        throw ValidationError(`Character "${candidate.key}" label "${label}" collides with "${owner}"`, { stage: TREATMENT_STAGE })
      }
      owners.set(normalized, candidate.key)
    }
  }

  const aliasClaims = new Map<string, Set<string>>()
  for (const candidate of pending) {
    for (const alias of nonBlank(candidate.aliases)) {
      const normalized = normalizeCharacterLookup(alias)
      if (!normalized) continue
      const owner = owners.get(normalized)
      if (owner !== undefined && owner !== candidate.key) {
        if (input.policy === 'fail') throw ValidationError(`Character "${candidate.key}" alias "${alias}" collides with "${owner}"`, { stage: TREATMENT_STAGE })
        droppedAliases.push({ key: candidate.key, alias, reason: `collides with "${owner}"` })
        continue
      }
      if (owner === candidate.key) continue
      const claims = aliasClaims.get(normalized) ?? new Set<string>()
      claims.add(candidate.key)
      aliasClaims.set(normalized, claims)
    }
  }
  const ambiguous = new Set<string>()
  for (const [normalized, keys] of aliasClaims) {
    if (keys.size > 1) {
      ambiguous.add(normalized)
      if (input.policy === 'fail') throw ValidationError(`Alias "${normalized}" is claimed by ${[...keys].join(', ')}`, { stage: TREATMENT_STAGE })
      continue
    }
    owners.set(normalized, [...keys][0]!)
  }

  const added: CharacterEntry[] = []
  for (const candidate of pending) {
    const exclude = new Set([normalizeCharacterLookup(candidate.key), normalizeCharacterLookup(candidate.name)].filter(Boolean))
    const aliases: string[] = []
    for (const alias of dedupeByLookup(nonBlank(candidate.aliases), exclude)) {
      const normalized = normalizeCharacterLookup(alias)
      if (ambiguous.has(normalized)) {
        droppedAliases.push({ key: candidate.key, alias, reason: 'shared by more than one new character' })
        continue
      }
      if (owners.get(normalized) !== candidate.key) continue
      aliases.push(alias)
    }
    const never = nonBlank(candidate.wardrobe.never)
    added.push({
      key: candidate.key,
      name: candidate.name.trim(),
      aliases,
      image: characterOutlineSheetFilename(candidate.key),
      outlineSheet: characterOutlineSheetFilename(candidate.key),
      description: candidate.description.trim(),
      wardrobe: { colorTokens: nonBlank(candidate.wardrobe.colorTokens), never },
      generationReference: input.styleSeed,
      generationInstructions: input.styleInstructions.trim(),
    })
  }

  return {
    next: {
      schemaVersion: 3,
      characters: [...input.existing.characters, ...added],
      groupAliases: input.existing.groupAliases,
    },
    charactersAdded: added.map(entry => entry.key),
    charactersSkipped,
    droppedAliases,
  }
}

export const mergeTreatmentLocationCatalog = (input: {
  existing: LocationReferenceCatalog | undefined
  candidates: readonly TreatmentDraftLocation[]
  scriptPath: string
  styleInstructions: string
  styleSeed: string
  locationsRoot: string
  policy: TreatmentCatalogPolicy
}): { next: LocationReferenceCatalog; locationsAdded: string[]; locationsSkipped: string[]; styleImage: { action: TreatmentStyleImageAction; value: string } } => {
  const styleSeedReference = `../characters/${input.styleSeed}`
  let base: LocationReferenceCatalog
  let styleImage: { action: TreatmentStyleImageAction; value: string }
  if (!input.existing) {
    base = { schemaVersion: 1, styleImage: styleSeedReference, locations: [] }
    styleImage = { action: 'created', value: styleSeedReference }
  } else if (!existsSync(resolveLocationStyleImagePath(input.existing.styleImage, input.locationsRoot))) {
    base = { ...input.existing, styleImage: styleSeedReference }
    styleImage = { action: 'set', value: styleSeedReference }
  } else {
    base = input.existing
    styleImage = { action: 'kept', value: input.existing.styleImage }
  }

  const existingKeys = new Set(base.locations.map(location => location.key))
  const added: LocationReferenceEntry[] = []
  const locationsSkipped: string[] = []
  for (const candidate of input.candidates) {
    if (existingKeys.has(candidate.key)) {
      if (input.policy === 'fail') throw ValidationError(`Location "${candidate.key}" already exists in the location catalog and --catalog-policy fail forbids skipping it`, { stage: TREATMENT_STAGE })
      locationsSkipped.push(candidate.key)
      continue
    }
    const slugline = canonicalSlugline(candidate.slugline)
    const aliases = [slugline, ...nonBlank(candidate.aliases).filter(alias => canonicalSlugline(alias) !== slugline)]
    added.push({
      key: candidate.key,
      name: candidate.name.trim(),
      aliases: [...new Set(aliases)],
      specification: `${input.styleInstructions.trim()} ${candidate.specification.trim()}`.trim(),
      sourceScripts: [input.scriptPath],
    })
  }

  return {
    next: {
      schemaVersion: 1,
      styleImage: base.styleImage,
      locations: [...base.locations, ...added].sort((left, right) => left.key.localeCompare(right.key)),
    },
    locationsAdded: added.map(entry => entry.key),
    locationsSkipped,
    styleImage,
  }
}
