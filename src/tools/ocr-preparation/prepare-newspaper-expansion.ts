import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { lstat, mkdir, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import { PROJECT_ROOT, stripProjectRoot } from '~/utils/project-root'
import { decodePngRgba8, losslesslyCompressPng } from '~/utils/lossless-png'
import { writePortableFileSync } from '../../../.codex/skills/consensus/scripts/shared/portable_paths'
import { normalizeHistoricalReference, serializeValidatedWikisource } from './prepare-historical-newspapers'

export const NEWSPAPER_EXPANSION_ROOT = 'input/examples/document/ocr-newspaper-expansion'
export const NEWSPAPER_EXPANSION_PUBLIC_PLAN = 'docs/benchmarks/ocr/newspaper-expansion-plan.json'
const selectionPath = `${NEWSPAPER_EXPANSION_ROOT}/selection.json`
const nonempty = v.pipe(v.string(), v.nonEmpty())
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const positive = v.pipe(v.number(), v.integer(), v.minValue(1))
const nonnegative = v.pipe(v.number(), v.integer(), v.minValue(0))
const scope = v.picklist(['full-page', 'region-crop'])
const sourcePin = { path: nonempty, sha256: digest, url: nonempty, revision: nonempty, identity: nonempty }
const selectionSchema = v.object({
  schemaVersion: v.literal(1), kind: v.literal('ocr-newspaper-expansion-selection'), language: v.literal('en'),
  cases: v.pipe(v.array(v.object({
    id: v.pipe(nonempty, v.regex(/^newspapers-expansion-[a-z0-9][a-z0-9-]*$/)), sourceId: nonempty,
    language: v.literal('en'), scope, status: v.picklist(['reviewed-ready', 'blocked-reference-review']),
    sourceImage: v.object({ ...sourcePin, width: positive, height: positive }),
    sourceReference: v.object({ ...sourcePin, kind: v.picklist(['wikisource-validated', 'publisher-manual-text']),
      language: v.literal('en'), coverage: scope }),
    imageCrop: v.optional(v.object({ x: nonnegative, y: nonnegative, width: positive, height: positive, reason: v.optional(nonempty) })),
    referenceSpan: v.optional(v.object({ start: nonempty, end: nonempty, basis: nonempty })),
    review: v.object({ status: v.picklist(['approved', 'blocked']), checked: v.literal(true), reviewer: nonempty,
      notes: v.pipe(v.array(nonempty), v.minLength(1)), readingOrder: v.pipe(v.array(nonempty), v.minLength(1)) }),
    referenceErrata: v.optional(v.array(v.object({ source: nonempty, corrected: nonempty, basis: nonempty }))),
    rights: v.object({ license: nonempty, imageLicense: v.optional(nonempty), referenceLicense: v.optional(nonempty),
      attributionURL: v.optional(nonempty) }), attribution: nonempty
  })), v.minLength(1))
})
export type NewspaperExpansionSelection = v.InferOutput<typeof selectionSchema>
export interface NewspaperExpansionOptions { projectRoot?: string, selection?: unknown }
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'
const decode = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
const relativePath = (path: string): void => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new AppValidationError('Expected a normalized repository-relative path')
  }
}
const inside = (root: string, path: string): void => {
  const rel = relative(root, path)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new AppValidationError('Artifact escapes project root')
}
const originalPath = (path: string): void => {
  relativePath(path)
  if (!path.startsWith(`${NEWSPAPER_EXPANSION_ROOT}/originals/`)) throw new AppValidationError('Original source must be inside the expansion originals directory')
}
const https = (url: string): void => {
  if (new URL(url).protocol !== 'https:') throw new AppValidationError('Source provenance requires an HTTPS URL')
}
const assertSingleFrameTiff = (bytes: Uint8Array): void => {
  const little = bytes[0] === 73 && bytes[1] === 73, big = bytes[0] === 77 && bytes[1] === 77
  if ((!little && !big) || bytes.length < 8) throw new AppValidationError('Invalid standard TIFF header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint16(2, little) !== 42) throw new AppValidationError('Only standard single-frame TIFF sources are admitted')
  const offset = view.getUint32(4, little)
  if (offset < 8 || offset + 2 > bytes.length) throw new AppValidationError('Invalid TIFF image-directory bounds')
  const end = offset + 2 + view.getUint16(offset, little) * 12
  if (end + 4 > bytes.length || view.getUint32(end, little) !== 0) throw new AppValidationError('Multipage or truncated TIFF sources are not admitted')
}

// This reviewed frame has two empty decorative cells; it is not a data table.
const editorialFrame = `<div style="border:2px solid black; padding:1px">\n{| style="border:3px double black; width:100%; border-collapse: collapse;"\n| style="width:20%; border-right:3px double black" |\n|{{center|{{x-larger|'''''::{{gap|3em}}Editorials{{gap|3em}}::'''''}}}}\n| style="width:20%; border-left:3px double black" |\n|}\n</div>`

/** Additional reviewed presentation templates; semantic/unknown templates fail closed. */
export const serializeNewspaperWikisource = (raw: string): string => {
  const reviewed = raw.replace(/<!--[^]*?-->/g, '').replace(editorialFrame, '\n&#58;&#58; Editorials &#58;&#58;\n')
  if (/\{\||\|\}/.test(reviewed)) throw new AppValidationError('Unreviewed Wikisource table markup')
  let text = reviewed.replace(/<section\s+(?:begin|end)="[^"]*"\s*\/\s*>/gi, '')
    .replace(/<\/?noinclude>/g, '\n')
    .replace(/<span style="border-bottom: 3px double; vertical-align: top;">([^]*?)<\/span>/g, '$1')
    .replace(/<\/?(?:sup|sub)>/gi, '')
    .replace(/(\{\{plainlist\/s(?:\|[^{}]*)?\}\})([^]*?)(\{\{plainlist\/e\}\})/gi,
      (_, start: string, body: string, end: string) => start + body.replace(/^\*\s?/gm, '') + end)
  let passes = 0
  while (text.includes('{{')) {
    const before = text
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, contents: string) => {
      const [rawName, ...rawArgs] = contents.split('|'), name = rawName!.trim().toLowerCase().replace(/\s+/g, ' ')
      const args = rawArgs.map((arg, index) => index === 0 ? arg.replace(/^\s*1=/, '') : arg).filter(arg => {
        if (!/^\s*[a-z][a-z0-9_-]*\s*=/i.test(arg)) return true
        if (!/^\s*(?:style|class|offset|gutter|width|maxwidth|height|align|font-size|hanging-indent|margin_tb|start|end)\s*=/i.test(arg)) {
          throw new AppValidationError(`Unreviewed newspaper template option: ${name}`)
        }
        return false
      })
      if (['sic'].includes(name)) {
        if (!args.length || args.length > 3 || args[2] !== undefined && args[2] !== 'nodash') throw new AppValidationError('Unreviewed SIC template arguments')
        return args[0]!
      }
      if (name === 'mc' && args.length === 0) return 'Mc'
      if (name === 'continues') {
        if (args.length !== 1) throw new AppValidationError('Unreviewed continues template arguments')
        return `\n${args[0]}\n`
      }
      if (['gap'].includes(name)) return ' '
      if (['-', 'bar', 'dhr', 'clear', 'rule', 'anchor', 'plainlist/s', 'plainlist/e', 'block center/s', 'block center/e'].includes(name)) return '\n'
      if (name === 'plainlist') return args.join('|').replace(/^\*\s?/gm, '')
      if (name === 'ls') return 'ſ'
      if (name === 'style') return args.slice(1).join('|')
      if (['sc', 'small-caps', 'uc'].includes(name)) return args.join('|').toUpperCase()
      if (name === 'lsp' || name === 'fs') {
        if (args.length < 2 || !/^\s*\d+(?:\.\d+)?(?:em|rem|px|pt|%)\s*$/.test(args[0]!)) throw new AppValidationError(`Unreviewed ${name} size argument`)
        return args.slice(1).join('')
      }
      if (['larger', 'x-larger', 'xx-larger', 'xxx-larger', 'smaller', 'center', 'c', 'right', 'hi', 'dropinitial', 'di', 'sp', 'sup', 'nowrap', 'block center', 'block right', 'float right', 'float left', 'frame', 'border'].includes(name) || /^fs\d+$/.test(name)) return args.join('|')
      if (name === 'rh' || name === 'running header' || name === 'runningheader') return args.filter(arg => arg.trim()).join('\n') + '\n'
      if (name === 'ppoem') return args.join('|')
      if (name === 'pline') return `{{pline|${args.join('|')}}}`
      throw new AppValidationError(`Unreviewed newspaper template: ${name}`)
    })
    // pline remains for the existing checked marginal-line-number converter.
    const unfinished = text.replace(/\{\{pline\|[^{}]*\}\}/g, '')
    if (!unfinished.includes('{{')) break
    if (text === before || ++passes > 40) throw new AppValidationError('Unbalanced newspaper template markup')
  }
  return serializeValidatedWikisource(text)
}

/** Apply only a reviewer-recorded exact, unique source anchor; originals remain immutable. */
export const applyNewspaperReferenceErrata = (text: string, errata: readonly { source: string, corrected: string, basis: string }[]): string => {
  let result = text
  for (const entry of errata) {
    if (!entry.source || !entry.corrected || !entry.basis.trim() || entry.source === entry.corrected
      || result.split(entry.source).length !== 2) throw new AppValidationError('Reference erratum requires an exact unique source anchor and review basis')
    result = result.replace(entry.source, entry.corrected)
  }
  return result
}

/** A reviewed crop selects one exact contiguous publisher-text span; it never rewrites the source. */
export const selectNewspaperReferenceSpan = (text: string, span: { start: string, end: string, basis: string }): string => {
  if (!span.start || !span.end || !span.basis.trim() || text.split(span.start).length !== 2 || text.split(span.end).length !== 2) {
    throw new AppValidationError('Reference span requires unique start/end anchors and a review basis')
  }
  const start = text.indexOf(span.start), end = text.indexOf(span.end)
  if (end < start + span.start.length) throw new AppValidationError('Reference span end must follow the complete start anchor')
  return text.slice(start, end + span.end.length)
}

const collect = async (options: NewspaperExpansionOptions) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const read = async (path: string) => {
    relativePath(path)
    const absolute = await realpath(resolve(root, path)); inside(root, absolute)
    return new Uint8Array(await Bun.file(absolute).arrayBuffer())
  }
  const selectionBytes = options.selection === undefined ? await read(selectionPath) : undefined
  const rawSelection = options.selection ?? JSON.parse(decode(selectionBytes!))
  const selection = v.parse(selectionSchema, rawSelection)
  const selectionSha256 = hash(selectionBytes ?? json(selection))
  const seen = { id: new Set<string>(), source: new Set<string>(), identity: new Set<string>(), image: new Set<string>(), pixels: new Set<string>(), reference: new Set<string>(), text: new Set<string>() }
  const outputs = new Map<string, Uint8Array | string>()
  const cases: Record<string, unknown>[] = []
  const remember = (set: Set<string>, value: string, label: string) => { if (set.has(value)) throw new AppValidationError(`Duplicate ${label}`); set.add(value) }
  for (const entry of selection.cases) {
    remember(seen.id, entry.id, 'case ID'); remember(seen.source, entry.sourceId, 'source ID')
    if (entry.sourceImage.identity !== entry.sourceReference.identity) throw new AppValidationError('Image and gold source identity mismatch')
    remember(seen.identity, entry.sourceImage.identity, 'source image/reference identity')
    if (entry.sourceReference.coverage !== entry.scope) throw new AppValidationError('Gold reference coverage differs from the input scope')
    if (entry.referenceSpan && (entry.scope !== 'region-crop' || !entry.imageCrop)) throw new AppValidationError('A reference span requires a declared image crop and matching region-crop scope')
    if (entry.status === 'reviewed-ready' ? entry.review.status !== 'approved' : entry.review.status !== 'blocked') throw new AppValidationError('Case status and checked review approval differ')
    for (const pin of [entry.sourceImage, entry.sourceReference]) { originalPath(pin.path); https(pin.url) }
    if (entry.rights.attributionURL) https(entry.rights.attributionURL)
    const imageBytes = await read(entry.sourceImage.path), referenceBytes = await read(entry.sourceReference.path)
    if (hash(imageBytes) !== entry.sourceImage.sha256 || hash(referenceBytes) !== entry.sourceReference.sha256) throw new AppValidationError(`Pinned original image/reference changed: ${entry.id}`)
    remember(seen.image, entry.sourceImage.sha256, 'source image bytes'); remember(seen.reference, entry.sourceReference.sha256, 'original reference bytes')
    if (imageBytes[0] === 73 && imageBytes[1] === 73 || imageBytes[0] === 77 && imageBytes[1] === 77) assertSingleFrameTiff(imageBytes)
    const source = new Bun.Image(imageBytes, { autoOrient: false, maxPixels: 64 * 1024 * 1024 }), metadata = await source.metadata()
    if (!['png', 'jpeg', 'webp', 'tiff'].includes(metadata.format ?? '') || metadata.width !== entry.sourceImage.width || metadata.height !== entry.sourceImage.height) throw new AppValidationError('Source image dimensions or format differ from the pinned identity')
    const sourcePng = metadata.format === 'png' ? imageBytes : await source.png().bytes()
    const originalPixels = decodePngRgba8(sourcePng)
    let before = originalPixels, preparedPng = sourcePng
    if (entry.imageCrop) {
      const crop = entry.imageCrop
      if (crop.x + crop.width > originalPixels.width || crop.y + crop.height > originalPixels.height) throw new AppValidationError('Declared publication crop escapes source image bounds')
      const pixels = new Uint8Array(crop.width * crop.height * 4)
      for (let row = 0; row < crop.height; row++) {
        const offset = ((crop.y + row) * originalPixels.width + crop.x) * 4
        pixels.set(originalPixels.pixels.subarray(offset, offset + crop.width * 4), row * crop.width * 4)
      }
      const process = Bun.spawn(['magick', 'png:-', '-crop', `${crop.width}x${crop.height}+${crop.x}+${crop.y}`, '+repage', '-strip', 'PNG32:-'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
      process.stdin.write(sourcePng); process.stdin.end()
      const [bytes, stderr, exitCode] = await Promise.all([new Response(process.stdout).arrayBuffer(), new Response(process.stderr).text(), process.exited])
      if (exitCode) throw new AppInfrastructureError(`Publication crop failed: ${stderr}`)
      preparedPng = new Uint8Array(bytes)
      before = { width: crop.width, height: crop.height, pixels, pixelSha256: hash(pixels) }
    }
    const compressed = await losslesslyCompressPng(preparedPng)
    const png = compressed.bytes, after = decodePngRgba8(png)
    if (before.width !== after.width || before.height !== after.height || before.pixelSha256 !== after.pixelSha256) throw new AppValidationError('Derived PNG changed decoded pixels')
    remember(seen.pixels, before.pixelSha256, 'decoded source image pixels')
    const base = `${NEWSPAPER_EXPANSION_ROOT}/cases/${entry.id}`, ready = entry.status === 'reviewed-ready'
    const input = `${base}/input.png`, structuredReference = `${base}/reference.json`
    const reference = ready ? `${base}/canonical-reference.txt` : null, normalizedReference = ready ? `${base}/normalized-reference.txt` : null
    let canonical: string | undefined
    if (ready) {
      const originalText = decode(referenceBytes)
      canonical = entry.sourceReference.kind === 'wikisource-validated' ? serializeNewspaperWikisource(originalText) : originalText
      if (entry.referenceSpan) canonical = selectNewspaperReferenceSpan(canonical, entry.referenceSpan)
      canonical = applyNewspaperReferenceErrata(canonical, entry.referenceErrata ?? [])
      if (!canonical.trim()) throw new AppValidationError('Canonical gold text is empty')
      remember(seen.text, normalizeHistoricalReference(canonical).toLowerCase(), 'canonical reference text')
      outputs.set(reference!, canonical); outputs.set(normalizedReference!, normalizeHistoricalReference(canonical))
    } else {
      for (const path of [`${base}/canonical-reference.txt`, `${base}/normalized-reference.txt`]) {
        if (await Bun.file(resolve(root, path)).exists()) throw new AppValidationError('Blocked case has stale scoring references; preserve and reconcile before preparation')
      }
    }
    const structure = {
      schemaVersion: 1, sourceId: entry.sourceId, sourceRevision: entry.sourceReference.revision,
      sourceIdentity: entry.sourceImage.identity, sourceImageFormat: metadata.format, imageSize: { width: before.width, height: before.height },
      sourceImageSize: { width: originalPixels.width, height: originalPixels.height }, readingOrder: entry.review.readingOrder, errata: entry.referenceErrata ?? [],
      imageTransform: { operation: entry.imageCrop ? 'publication-margin-crop' : 'lossless-format-conversion', format: 'png', resampling: false,
        ...(entry.imageCrop ? { crop: entry.imageCrop } : {}),
        decodedPixelSha256: before.pixelSha256, policy: 'PNG samples preserved exactly; JPEG/WebP/single-frame TIFF conversion preserves Bun.Image codec-decoded pixels with auto-orientation disabled. Declared crops preserve the exact source pixel rectangle.' },
      referenceCoverage: { scope: entry.scope, bounds: { x: 0, y: 0, width: before.width, height: before.height },
        sourceBounds: { x: entry.imageCrop?.x ?? 0, y: entry.imageCrop?.y ?? 0, width: before.width, height: before.height },
        fullInputCovered: ready, independentOfProviders: true, originalReferenceSha256: entry.sourceReference.sha256 },
      ...(entry.referenceSpan ? { referenceSpan: entry.referenceSpan } : {}),
      goldProvenance: entry.sourceReference, review: entry.review
    }
    outputs.set(input, png); outputs.set(structuredReference, json(structure))
    cases.push({ id: entry.id, sourceId: entry.sourceId, category: 'newspapers', language: 'en',
      status: ready ? 'prepared-not-run' : 'blocked-reference-review', scope: entry.scope, synthetic: false,
      input, inputSha256: hash(png), decodedPixelSha256: before.pixelSha256,
      ...(entry.imageCrop ? { imageCrop: entry.imageCrop } : {}),
      ...(entry.referenceSpan ? { referenceSpan: entry.referenceSpan } : {}), referenceSpanSelected: entry.referenceSpan !== undefined,
      reference, referenceSha256: canonical === undefined ? null : hash(canonical), normalizedReference,
      normalizedReferenceSha256: canonical === undefined ? null : hash(normalizeHistoricalReference(canonical)),
      structuredReference, structuredReferenceSha256: hash(json(structure)), originalReference: entry.sourceReference.path,
      originalReferences: [{ ...entry.sourceImage }, { ...entry.sourceReference }],
      sourceURL: entry.sourceImage.url, annotationURL: entry.sourceReference.url, sourceRevision: entry.sourceReference.revision,
      sourceImageName: entry.sourceImage.identity, sourceFamily: entry.sourceReference.kind === 'wikisource-validated' ? 'Wikisource/Commons' : 'Publisher manual ground truth',
      width: before.width, height: before.height, pageCount: 1, format: 'png', chars: canonical?.length ?? 0,
      words: canonical?.trim().split(/\s+/).length ?? 0, rights: entry.rights, attribution: entry.attribution, review: entry.review,
      serializationPolicy: { sourceText: entry.sourceReference.kind === 'wikisource-validated' ? 'Pinned validated Wikisource text; reviewed presentation templates converted deterministically; printed SIC spelling retained; separately recorded exact-anchor review errata only.' : 'Immutable original publisher-manual UTF-8 text preserved byte for byte except separately recorded exact-anchor review errata.',
        normalization: 'Only the separate normalized companion uses NFKC, quote/dash folding and whitespace folding.',
        readingOrder: 'Explicitly reviewed source order; a crop does not establish full-page layout accuracy.' }
    })
  }
  const readyCaseCount = cases.filter(entry => entry['status'] === 'prepared-not-run').length
  const bundle = { schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category: 'newspapers', language: 'en',
    status: 'prepared-not-run', selectionSha256, caseCount: cases.length, readyCaseCount, cases }
  outputs.set(`${NEWSPAPER_EXPANSION_ROOT}/bundle.json`, json(bundle))
  const publicPlan = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-prepared-plan', category: 'ocr', language: 'en',
    status: 'prepared-not-run', executionAuthorized: false, modelCalls: 0, selectionSha256,
    sourceBundle: `${NEWSPAPER_EXPANSION_ROOT}/bundle.json`, caseCount: cases.length, readyCaseCount,
    blockedCaseCount: cases.length - readyCaseCount,
    inventorySemantics: 'Acquisition inventory only. No OCR runs, scores or completed dashboard entries are asserted.',
    cases: cases.map(entry => Object.fromEntries(['id', 'sourceId', 'category', 'language', 'status', 'scope', 'synthetic',
      'input', 'inputSha256', 'decodedPixelSha256', 'imageCrop', 'referenceSpanSelected', 'reference', 'referenceSha256', 'normalizedReference', 'normalizedReferenceSha256',
      'structuredReference', 'structuredReferenceSha256', 'originalReference', 'sourceURL', 'annotationURL', 'sourceRevision',
      'sourceImageName', 'sourceFamily', 'width', 'height', 'pageCount', 'format', 'chars', 'words', 'rights', 'attribution'].map(key => [key, entry[key]]))) }
  outputs.set(NEWSPAPER_EXPANSION_PUBLIC_PLAN, json(publicPlan))
  return { root, read, outputs, summary: { status: 'prepared-not-run', executionAuthorized: false, caseCount: cases.length,
    readyCaseCount, blockedCaseCount: cases.length - readyCaseCount, sourceHashesVerified: cases.length * 2,
    imagesFullyDecoded: cases.length, modelCalls: 0, selectionSha256 } }
}

export const prepareNewspaperExpansion = async (options: NewspaperExpansionOptions = {}) => {
  const context = await collect(options)
  for (const [path, content] of context.outputs) {
    const absolute = resolve(context.root, path)
    let parent = dirname(absolute)
    while (true) { try { await stat(parent); break } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; parent = dirname(parent) } }
    const actualParent = await realpath(parent); inside(context.root, actualParent)
    if (actualParent !== parent) throw new AppValidationError('Output directory symlinks are not permitted')
    await mkdir(dirname(absolute), { recursive: true })
    // Existing output symlinks must never redirect a write outside the checkout.
    if (await Bun.file(absolute).exists() && (await lstat(absolute)).isSymbolicLink()) throw new AppValidationError('Output file symlinks are not permitted')
    if (typeof content === 'string' && path.endsWith('.json')) writePortableFileSync(absolute, content)
    else await Bun.write(absolute, content)
  }
  return { ...context.summary, writes: context.outputs.size }
}

/** Reconstruct all derived artifacts in memory from pinned source bytes, without downloads or OCR. */
export const validateNewspaperExpansion = async (options: NewspaperExpansionOptions = {}) => {
  const context = await collect(options)
  for (const [path, expected] of context.outputs) {
    const actual = await context.read(path), expectedBytes = typeof expected === 'string' ? new TextEncoder().encode(expected) : expected
    if (hash(actual) !== hash(expectedBytes)) throw new AppValidationError(`Derived artifact differs from pinned source reconstruction: ${path}`)
  }
  return { ...context.summary, derivedArtifactsVerified: context.outputs.size, writes: 0 }
}

export const parseNewspaperExpansionMode = (args: readonly string[]): '--prepare-local' | '--validate' => {
  if (args.length !== 1 || !['--prepare-local', '--validate'].includes(args[0]!)) throw new AppUsageError('Usage: bun src/tools/ocr-preparation/prepare-newspaper-expansion.ts --prepare-local|--validate (local-only; no downloads, OCR or provider execution)')
  return args[0] as '--prepare-local' | '--validate'
}
if (import.meta.main) {
  try {
    const mode = parseNewspaperExpansionMode(Bun.argv.slice(2))
    writeCommandPayload((json(mode === '--validate' ? await validateNewspaperExpansion() : await prepareNewspaperExpansion())) + '\n')
  } catch (error) { writeCommandPayload((error instanceof Error ? stripProjectRoot(error.message) : 'Newspaper source preparation failed') + '\n', 'stderr'); process.exitCode = 1 }
}
