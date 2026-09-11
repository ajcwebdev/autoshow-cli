import { existsSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { CharacterCatalogEntry, CharacterKey, CharacterReferenceConfig } from '~/types'

import { asCharacterKey, CHARACTER_KEY_PATTERN, fail, freezeEntry, normalizeCharacterLookup } from './character-catalog-validation'
const SUPPORTED_SOURCE_EXTENSIONS = /\.(?:png|webp|jpe?g)$/i

const validateCharacterCatalogRelations = (config: CharacterReferenceConfig, configPath: string, byKey: Map<CharacterKey, CharacterCatalogEntry>): void => {
  for (const authored of config.characters) {
    const key = asCharacterKey(authored.key)
    if (authored.variantOf !== undefined) {
      if (authored.variantOf === key) fail(configPath, `Character "${key}" variantOf "${authored.variantOf}" cannot name itself`)
      if (!byKey.has(authored.variantOf)) fail(configPath, `Character "${key}" variantOf "${authored.variantOf}" is not a catalog key`)
    }
    for (const cue of authored.distinguishFrom ?? []) {
      if (!CHARACTER_KEY_PATTERN.test(cue.characterKey) || !byKey.has(cue.characterKey as CharacterKey)) fail(configPath, `Character "${key}" distinguishFrom "${cue.characterKey}" is not a catalog key`)
      if (!cue.cue.trim()) fail(configPath, `Character "${key}" distinguishFrom "${cue.characterKey}" must carry a non-empty cue`)
    }
    for (const [index, token] of (authored.wardrobe?.colorTokens ?? []).entries()) {
      if (!token.trim()) fail(configPath, `Character "${key}" wardrobe colorTokens[${index}] must not be blank`)
    }
  }
}

export const buildCharacterCatalogIndex = (root: string, configPath: string, config: CharacterReferenceConfig) => {
  const byKey = new Map<CharacterKey, CharacterCatalogEntry>()
  const byLookup = new Map<string, readonly CharacterKey[]>()
  const sourcePaths = new Set<string>()
  const outlineSheetPaths = new Set<string>()
  const assetPaths = new Set<string>()

  const resolveCatalogAsset = (key: CharacterKey, field: 'image' | 'outlineSheet', authoredPath: string): string => {
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

  const addLookup = (label: string, keys: readonly CharacterKey[]): void => {
    const normalized = normalizeCharacterLookup(label)
    if (!normalized) fail(configPath, 'character aliases and names cannot be blank')
    const existing = byLookup.get(normalized)
    if (existing && existing.join('|') !== keys.join('|')) {
      fail(configPath, `ambiguous alias or display name "${label}"`)
    }
    byLookup.set(normalized, Object.freeze([...keys]))
  }

  for (const authored of config.characters) {
    const key = asCharacterKey(authored.key)
    if (byKey.has(key)) fail(configPath, `duplicate character key "${key}"`)
    if (!authored.name.trim()) fail(configPath, `character "${key}" has an empty display name`)
    if (!authored.description.trim()) fail(configPath, `character "${key}" has an empty description`)
    for (const [index, rule] of (authored.sceneTextRules ?? []).entries()) {
      if (!rule.pattern.trim() || !rule.description.trim()) fail(configPath, `character "${key}" sceneTextRules[${index}] must have a non-empty pattern and description`)
      try {
        new RegExp(rule.pattern, 'iu')
      } catch (error) {
        fail(configPath, `character "${key}" sceneTextRules[${index}] has an invalid regular expression: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const sourcePath = resolveCatalogAsset(key, 'image', authored.image)
    const outlineSheetPath = resolveCatalogAsset(key, 'outlineSheet', authored.outlineSheet)
    const generationReferencePath = authored.generationReference
      ? resolveCatalogAsset(key, 'image', authored.generationReference)
      : undefined
    const normalizedSourcePath = sourcePath.replace(/\\/g, '/')
    if (sourcePaths.has(normalizedSourcePath)) fail(configPath, `duplicate source image path "${authored.image}"`)
    const normalizedOutlineSheetPath = outlineSheetPath.replace(/\\/g, '/')
    if (outlineSheetPaths.has(normalizedOutlineSheetPath)) fail(configPath, `duplicate outline sheet path "${authored.outlineSheet}"`)
    if (assetPaths.has(normalizedSourcePath) || assetPaths.has(normalizedOutlineSheetPath)) {
      fail(configPath, 'character asset paths must be unique across source images and outline sheets')
    }
    const hasSource = existsSync(sourcePath) && statSync(sourcePath).isFile()
    if (!hasSource) {
      const bootstrapReferencePath = generationReferencePath ?? fail(configPath, `source image for "${key}" was not found at ${sourcePath}`)
      if (sourcePath !== outlineSheetPath) {
        fail(configPath, `character "${key}" may omit its source image only when image and outlineSheet name the same canonical destination`)
      }
      if (!existsSync(bootstrapReferencePath) || !statSync(bootstrapReferencePath).isFile()) {
        fail(configPath, `generation reference for "${key}" was not found at ${bootstrapReferencePath}`)
      }
    }
    sourcePaths.add(normalizedSourcePath)
    outlineSheetPaths.add(normalizedOutlineSheetPath)
    assetPaths.add(normalizedSourcePath)
    assetPaths.add(normalizedOutlineSheetPath)
    const entry = freezeEntry({ ...authored, key, sourcePath, outlineSheetPath, ...(generationReferencePath ? { generationReferencePath } : {}) })
    byKey.set(key, entry)
    addLookup(key, [key])
    addLookup(authored.name, [key])
    for (const alias of authored.aliases) addLookup(alias, [key])
  }

  validateCharacterCatalogRelations(config, configPath, byKey)

  for (const group of config.groupAliases) {
    if (group.characterKeys.length === 0) fail(configPath, `group alias "${group.alias}" has no targets`)
    const keys = group.characterKeys.map(rawKey => {
      const key = asCharacterKey(rawKey)
      if (!byKey.has(key)) fail(configPath, `group alias "${group.alias}" targets unknown key "${key}"`)
      return key
    })
    if (new Set(keys).size !== keys.length) fail(configPath, `group alias "${group.alias}" has duplicate targets`)
    addLookup(group.alias, keys)
  }

  return { byKey, byLookup }
}
