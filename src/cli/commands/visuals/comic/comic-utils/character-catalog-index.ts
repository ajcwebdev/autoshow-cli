import { existsSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { CharacterCatalogEntry, CharacterKey, CharacterReferenceConfig } from '~/types'

import { asCharacterKey, CHARACTER_KEY_PATTERN, fail, freezeEntry, normalizeCharacterLookup } from './character-catalog-validation'
const SUPPORTED_SOURCE_EXTENSIONS = /\.(?:png|webp|jpe?g)$/i

type AuthoredCharacter = CharacterReferenceConfig['characters'][number]

const validateDistinguishFromCues = (authored: AuthoredCharacter, key: CharacterKey, configPath: string, byKey: Map<CharacterKey, CharacterCatalogEntry>): void => {
  for (const cue of authored.distinguishFrom ?? []) {
    if (!CHARACTER_KEY_PATTERN.test(cue.characterKey) || !byKey.has(cue.characterKey as CharacterKey)) fail(configPath, `Character "${key}" distinguishFrom "${cue.characterKey}" is not a catalog key`)
    if (!cue.cue.trim()) fail(configPath, `Character "${key}" distinguishFrom "${cue.characterKey}" must carry a non-empty cue`)
  }
}

const validateCharacterRelations = (authored: AuthoredCharacter, configPath: string, byKey: Map<CharacterKey, CharacterCatalogEntry>): void => {
  const key = asCharacterKey(authored.key)
  if (authored.variantOf !== undefined) {
    if (authored.variantOf === key) fail(configPath, `Character "${key}" variantOf "${authored.variantOf}" cannot name itself`)
    if (!byKey.has(authored.variantOf)) fail(configPath, `Character "${key}" variantOf "${authored.variantOf}" is not a catalog key`)
  }
  validateDistinguishFromCues(authored, key, configPath, byKey)
  for (const [index, token] of (authored.wardrobe?.colorTokens ?? []).entries()) {
    if (!token.trim()) fail(configPath, `Character "${key}" wardrobe colorTokens[${index}] must not be blank`)
  }
}

const validateCharacterCatalogRelations = (config: CharacterReferenceConfig, configPath: string, byKey: Map<CharacterKey, CharacterCatalogEntry>): void => {
  for (const authored of config.characters) validateCharacterRelations(authored, configPath, byKey)
}

type CatalogIndexState = {
  root: string
  configPath: string
  verifyAssets: boolean
  byKey: Map<CharacterKey, CharacterCatalogEntry>
  byLookup: Map<string, readonly CharacterKey[]>
  sourcePaths: Set<string>
  outlineSheetPaths: Set<string>
  assetPaths: Set<string>
}

const resolveCatalogAsset = (state: CatalogIndexState, key: CharacterKey, field: 'image' | 'outlineSheet', authoredPath: string): string => {
  const { root, configPath } = state
  if (isAbsolute(authoredPath)) fail(configPath, `character "${key}" ${field} must be relative`)
  if (!SUPPORTED_SOURCE_EXTENSIONS.test(authoredPath)) {
    fail(configPath, `character "${key}" ${field} must be PNG, WebP, JPG, or JPEG`)
  }
  const absolutePath = resolve(root, authoredPath)
  const relativePath = relative(root, absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    fail(configPath, `character "${key}" ${field} escapes the characters root`)
  }
  return absolutePath
}

const addLookup = (state: CatalogIndexState, label: string, keys: readonly CharacterKey[]): void => {
  const normalized = normalizeCharacterLookup(label)
  if (!normalized) fail(state.configPath, 'character aliases and names cannot be blank')
  const existing = state.byLookup.get(normalized)
  if (existing && existing.join('|') !== keys.join('|')) {
    fail(state.configPath, `ambiguous alias or display name "${label}"`)
  }
  state.byLookup.set(normalized, Object.freeze([...keys]))
}

const validateSceneTextRules = (authored: AuthoredCharacter, key: CharacterKey, configPath: string): void => {
  for (const [index, rule] of (authored.sceneTextRules ?? []).entries()) {
    if (!rule.pattern.trim() || !rule.description.trim()) fail(configPath, `character "${key}" sceneTextRules[${index}] must have a non-empty pattern and description`)
    try {
      new RegExp(rule.pattern, 'iu')
    } catch (error) {
      fail(configPath, `character "${key}" sceneTextRules[${index}] has an invalid regular expression: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

type CharacterAssetPaths = { sourcePath: string; outlineSheetPath: string; generationReferencePath: string | undefined }

const verifyCharacterSourceAssets = (state: CatalogIndexState, key: CharacterKey, paths: CharacterAssetPaths): void => {
  const { configPath } = state
  const { sourcePath, outlineSheetPath, generationReferencePath } = paths
  const hasSource = existsSync(sourcePath) && statSync(sourcePath).isFile()
  if (!state.verifyAssets || hasSource) return
  const bootstrapReferencePath = generationReferencePath ?? fail(configPath, `source image for "${key}" was not found at ${sourcePath}`)
  if (sourcePath !== outlineSheetPath) {
    fail(configPath, `character "${key}" may omit its source image only when image and outlineSheet name the same canonical destination`)
  }
  if (!existsSync(bootstrapReferencePath) || !statSync(bootstrapReferencePath).isFile()) {
    fail(configPath, `generation reference for "${key}" was not found at ${bootstrapReferencePath}`)
  }
}

const indexCharacter = (state: CatalogIndexState, authored: AuthoredCharacter): void => {
  const { configPath, byKey, sourcePaths, outlineSheetPaths, assetPaths } = state
  const key = asCharacterKey(authored.key)
  if (byKey.has(key)) fail(configPath, `duplicate character key "${key}"`)
  if (!authored.name.trim()) fail(configPath, `character "${key}" has an empty display name`)
  if (!authored.description.trim()) fail(configPath, `character "${key}" has an empty description`)
  validateSceneTextRules(authored, key, configPath)
  const sourcePath = resolveCatalogAsset(state, key, 'image', authored.image)
  const outlineSheetPath = resolveCatalogAsset(state, key, 'outlineSheet', authored.outlineSheet)
  const generationReferencePath = authored.generationReference
    ? resolveCatalogAsset(state, key, 'image', authored.generationReference)
    : undefined
  const normalizedSourcePath = sourcePath.replace(/\\/g, '/')
  if (sourcePaths.has(normalizedSourcePath)) fail(configPath, `duplicate source image path "${authored.image}"`)
  const normalizedOutlineSheetPath = outlineSheetPath.replace(/\\/g, '/')
  if (outlineSheetPaths.has(normalizedOutlineSheetPath)) fail(configPath, `duplicate outline sheet path "${authored.outlineSheet}"`)
  if (assetPaths.has(normalizedSourcePath) || assetPaths.has(normalizedOutlineSheetPath)) {
    fail(configPath, 'character asset paths must be unique across source images and outline sheets')
  }
  verifyCharacterSourceAssets(state, key, { sourcePath, outlineSheetPath, generationReferencePath })
  sourcePaths.add(normalizedSourcePath)
  outlineSheetPaths.add(normalizedOutlineSheetPath)
  assetPaths.add(normalizedSourcePath)
  assetPaths.add(normalizedOutlineSheetPath)
  const entry = freezeEntry({ ...authored, key, sourcePath, outlineSheetPath, ...(generationReferencePath ? { generationReferencePath } : {}) })
  byKey.set(key, entry)
  addLookup(state, key, [key])
  addLookup(state, authored.name, [key])
  for (const alias of authored.aliases) addLookup(state, alias, [key])
}

const indexGroupAlias = (state: CatalogIndexState, group: CharacterReferenceConfig['groupAliases'][number]): void => {
  const { configPath, byKey } = state
  if (group.characterKeys.length === 0) fail(configPath, `group alias "${group.alias}" has no targets`)
  const keys = group.characterKeys.map(rawKey => {
    const key = asCharacterKey(rawKey)
    if (!byKey.has(key)) fail(configPath, `group alias "${group.alias}" targets unknown key "${key}"`)
    return key
  })
  if (new Set(keys).size !== keys.length) fail(configPath, `group alias "${group.alias}" has duplicate targets`)
  addLookup(state, group.alias, keys)
}

export const buildCharacterCatalogIndex = (root: string, configPath: string, config: CharacterReferenceConfig, options: { verifyAssets?: boolean | undefined } = {}) => {
  const state: CatalogIndexState = {
    root,
    configPath,
    verifyAssets: options.verifyAssets ?? true,
    byKey: new Map<CharacterKey, CharacterCatalogEntry>(),
    byLookup: new Map<string, readonly CharacterKey[]>(),
    sourcePaths: new Set<string>(),
    outlineSheetPaths: new Set<string>(),
    assetPaths: new Set<string>(),
  }

  for (const authored of config.characters) indexCharacter(state, authored)

  validateCharacterCatalogRelations(config, configPath, state.byKey)

  for (const group of config.groupAliases) indexGroupAlias(state, group)

  return { byKey: state.byKey, byLookup: state.byLookup }
}
