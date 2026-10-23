import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { PROJECT_ROOT } from '~/utils/project-root'
import sourceCatalog from '../../../docs/benchmarks/ocr/source-catalog.json'

/** These converters process published human references only; they never call an OCR engine. */
const xmlText = (text: string): string => text.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&')

export const normalizeHistoricalReference = (text: string): string => text.normalize('NFKC')
  .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim() + '\n'

export const serializeValidatedWikisource = (raw: string): string => {
  if (!/<pagequality\s+level="4"/.test(raw)) throw new AppValidationError('Wikisource page must have validated level 4')
  let text = raw.replace(/<!--[^]*?-->/g, '').replace(/<pagequality[^>]*\/\s*>/g, '')
    .replace(/<\/?noinclude>/g, '\n').replace(/<references\s*\/>/g, '')
    .replace(/<\/?nowiki>/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?i>/g, '')
    .replace(/\[\[([^\[\]]+)\]\]/g, (_, contents: string) => contents.split('|').at(-1) ?? '')
  let passes = 0
  while (text.includes('{{')) {
    const previous = text
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, contents: string) => {
      const [rawName, ...args] = contents.split('|')
      const name = rawName?.trim().toLowerCase()
      if (name === 'ls') return 'ſ'
      if (name === 'rule' || name === 'anchor') return ''
      if (name === 'style') return args.slice(1).join('|')
      if (name === 'sc' || name === 'small-caps') return args.join('|').toUpperCase()
      if (['larger', 'x-larger', 'xx-larger', 'smaller', 'center', 'c', 'right', 'hi', 'dropinitial'].includes(name ?? '')) return args.join('|')
      if (name === 'rh' || name === 'running header') return args.filter(a => a.trim()).join('\n') + '\n'
      if (name === 'ppoem') return args.filter(a => !/^(start|end)=/.test(a)).join('|')
      if (name === 'pline') return `\uFFF0${args[0]}\uFFF1`
      throw new AppValidationError(`Unreviewed Wikisource template: ${name}`)
    })
    if (text === previous || ++passes > 30) throw new AppValidationError('Unbalanced Wikisource templates')
  }
  text = text.replace(/'''|''/g, '').replace(/<<</g, '').replace(/^:+/gm, '')
    .split('\n').map(line => {
      const number = /\uFFF0([^\uFFF1]+)\uFFF1/.exec(line)
      const body = line.replace(/\uFFF0[^\uFFF1]+\uFFF1/g, '').trim()
      return number ? `${number[1]} ${body}` : body
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (/\{\{|\}\}|\[\[|\]\]|<\/?[A-Za-z]/.test(text)) throw new AppValidationError('Unserialized reference markup')
  return xmlText(text) + '\n'
}

interface PageRegion { id: string, type: string, text: string, bounds: { x: number, y: number, width: number, height: number } }
export const serializeImpactPage = (xml: string, expectedPageId = 'pc-00667895') => {
  if (!xml.includes(`pcGtsId="${expectedPageId}"`)) throw new AppValidationError('Wrong IMPACT source page identity')
  const regions: PageRegion[] = [...xml.matchAll(/<TextRegion\b([^>]*)>([^]*?)<\/TextRegion>/g)].map(match => {
    const attrs = match[1] ?? '', body = match[2] ?? ''
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1], type = /\btype="([^"]+)"/.exec(attrs)?.[1]
    const text = /<Unicode>([^]*?)<\/Unicode>/.exec(body)?.[1]
    const points = [...body.matchAll(/<Point x="(\d+)" y="(\d+)"/g)].map(p => [Number(p[1]), Number(p[2])])
    if (!id || !type || text === undefined || !points.length) throw new AppValidationError('Incomplete IMPACT text region')
    const xs = points.map(p => p[0]!), ys = points.map(p => p[1]!)
    return { id, type, text: xmlText(text), bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } }
  })
  const byId = new Map(regions.map(region => [region.id, region]))
  if (byId.size !== regions.length) throw new AppValidationError('Duplicate IMPACT region ID')
  const refs = [...xml.matchAll(/<RegionRefIndexed regionRef="([^"]+)" index="(\d+)"/g)]
    .map(m => ({ id: m[1]!, index: Number(m[2]) })).sort((a, b) => a.index - b.index)
  if (new Set(refs.map(r => r.id)).size !== refs.length || refs.some((r, i) => r.index !== i)) throw new AppValidationError('Invalid IMPACT reading order')
  const ordered = refs.map(ref => { const region = byId.get(ref.id); if (!region) throw new AppValidationError('Missing IMPACT ordered region'); return region })
  const unordered = regions.filter(region => !refs.some(ref => ref.id === region.id))
  if (unordered.some(region => !['header', 'page-number'].includes(region.type))) throw new AppValidationError('Unordered IMPACT body region')
  const all = [...unordered.sort((a, b) => a.type === b.type ? a.bounds.x - b.bounds.x : a.type === 'header' ? -1 : 1), ...ordered]
  const blocks: string[] = []
  for (let i = 0; i < all.length; i++) {
    const region = all[i]!
    if (region.type === 'drop-capital') {
      const next = all[++i]
      if (!next || next.type !== 'paragraph') throw new AppValidationError('Orphan IMPACT drop capital')
      blocks.push(region.text + next.text)
    } else blocks.push(region.text)
  }
  return { text: blocks.join('\n\n') + '\n', regions: all }
}

export interface HistoricalSourceSpec {
  id: string, category: 'historical-print' | 'newspapers', slug: string,
  imageURL: string, referenceURL: string, revision: string, leaf?: number,
  file?: string, imageMember?: string, referenceMember?: string,
  crop?: { x: number, y: number, width: number, height: number },
}
export const HISTORICAL_NEWSPAPER_SOURCES: HistoricalSourceSpec[] = sourceCatalog.historicalNewspaperSources as HistoricalSourceSpec[]
const impactImageFilename = sourceCatalog.impactImageFilename

const sourceHashes: Record<string, readonly [string, string]> = {
  C1: ['26c224e051f66e9a81047a53817a02fde2f6237f15128be75e40b1f6ea3c4b22', '7290428bb75682ca87866b266f674dafb66c13eddfc9550dea3ac46965d5cbc8'],
  C2: ['37dbbd346d6a9c00c7924f415a1ddd018071d10865a676d9ba50f5f27251b925', '7d3a33a2d2e9fe5cac0119a914b7a43f5fd9271168d023274268d44e10f926a9'],
  C3: ['cda1366674e1e8ea4dbf63173adc0c366f34c416012ad124166a15532d5988ad', 'fadcd65db0e89b18bc870612e84d3668fec6bbaef7e8a1b2cba91c35f61cea39'],
  C4: ['644de8eb1df9e6d272c8e75c257cf4a3630a5386d92b99c9d36d6319bd21d331', '56fc1d72ce48a9df0033e49172b4f7073e96f78d7511d078d0937b62ab575f28'],
  C5: ['db2e0b69fc0d980c874d88984d94d538750c47355427a8a05bc80b9832c11406', 'b49a7f1d7e97b3d21cd68dbea5a725e1960f4297a7c3b71331dccd0dc74f94b3'],
  G1: ['e26436a3dfb6d30d1f25ed62c49454911ebc132532eb6cd83b2e362c5099a8a1', '2c3796d8bfad54ba92d0a1fbc74a8f0fae133b8411c5388cf5f201f6597b3455'],
  G2: ['eeb631dc32c7d7bd151ff917e5e36e244e91190d39999ad8355feec8560641a1', 'dd7fa77cf9cfcf84ed5e106321b4f3e6babae6df12e0807c669001bfcb46377a'],
  G3: ['d2c23a7ca391c0fc91015a96992244ad518f521fcab21575452d4c03d572c97c', 'b3e547a3b19f5bf85829f87d491b3306de513c88cdfa707f67bc6a885f861990'],
  G4: ['8df3f1d6339d4fd06fe025f0ae98fe35ec34648361e347b6ef0afdceb3a6a20d', 'a9ce38ec08dc003bc1fef702bf62010bc0cc2c8e734456fbf8e2313124417434'],
  G5: ['04576de34499610c59d301c6295f0a76b7d5cf6b8610b3bdecaa3118656315f1', '168cd7bb0c94116f673cdc2c576dfa45d5b22c22479d0bf333589e1cd33eb0c0'],
  G6: ['5465144cd0b2927ca1e44f0ecb9ef3ad98be1b02b7c22a4c23fa80fc295844ee', '538b051856a629c3dcd36d35a97a6b920c616659e09f237ed39d25049b9a7823']
}

const provenanceHashes: Record<string, string> = {
  'input/examples/document/ocr-historical-print/originals/impact-README.md': 'd9fb4491dc5d949867b4f43dc78227e6f4a597fce93b2c5c2ccc04e906872f68',
  'input/examples/document/ocr-historical-print/originals/finebooks-README.md': '6b2f9a7f48c5bec9c78a744c92d0dcbd6e24c1f63d19e505069800f5e0f470fd',
  'input/examples/document/ocr-historical-print/originals/C1.commons.json': 'e4eb8ef88c28f49aca527fd5b96b379c0804954238a832dd6a971fa2c38c6144',
  'input/examples/document/ocr-historical-print/originals/C2.commons.json': '62a062aea9a3ad1c8312dd0c0cf99fcd001150d0afe8c58f63b3e7b379823eee',
  'input/examples/document/ocr-historical-print/originals/C3.commons.json': 'cef1067cb5ea864e6c3f14eede98bb2a3e67e7810923a44dedbeec4aff3fa636',
  'input/examples/document/ocr-historical-print/originals/C4.commons.json': '66abb330e817cf217bedb77cef040a49602fc7634d70eb1c8b91cb25d3507694',
  'input/examples/document/ocr-newspapers/originals/G1.commons.json': '56cd59caacd631b57447ebacf1d7fb9737ff9b06671db881ddd70884c83a5b81',
  'input/examples/document/ocr-newspapers/originals/G2.commons.json': '9ad6802a701cafd669e87cd58c8588ae983ba703b40eb79f3275e014314ea61c',
  'input/examples/document/ocr-newspapers/originals/ncse-images.zip': '57497f5c1a9dcc92a445edb26912f722380dbbb0fec1af36c927385c9dba6eb7',
  'input/examples/document/ocr-newspapers/originals/ncse-ground-truth.zip': '2589503fc897c8c406c2646ddb830286a611841275be4c33b755dc9e24c07161',
  'input/examples/document/ocr-newspapers/originals/ncse-release.json': 'a158fa92aefa72873cc419f59c4f64209168fa702ca64377975e0e7bda440e99'
}

const rootFor = (spec: HistoricalSourceSpec) => `input/examples/document/ocr-${spec.category === 'historical-print' ? 'historical-print' : 'newspapers'}`
const hash = (bytes: string | Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const localRead = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(resolve(PROJECT_ROOT, path)).arrayBuffer())
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'

export const assertHistoricalSourceBytes = (id: string, imageBytes: Uint8Array, referenceBytes: Uint8Array): void => {
  const pins = sourceHashes[id]
  if (!pins || hash(imageBytes) !== pins[0] || hash(referenceBytes) !== pins[1]) throw new AppValidationError(`Pinned image/reference bytes differ: ${id}`)
}

const reviewNotes: Record<string, string[]> = {
  C1: ['Full leaf reviewed against validated same-leaf text, including long-s, line numbers 660/670/680 and final catchword Rifl’d.', 'Marginal numbers are serialized before the associated line; punctuation/spacing follow source; no modernized spelling.'],
  C2: ['Crop retains introduction heading and both complete visible paragraphs; excludes adjacent-page sliver and Google/Emory digitization watermark below the publication.', 'Reference retains source ﬁ ligature; normalized companion expands compatibility ligatures and folds typographic quotation variants. Physical line wraps and line-end word breaks are not lexical differences.'],
  C3: ['Full leaf reviewed, printed page 184, running head, stanza markers 3.–6. and last comma.', 'Poem template <<< indentation syntax is removed; wrapped continuation lines retain source logical verse order.'],
  C4: ['Full leaf reviewed, printed page 3 and running head INTRODUCTION.; no continuation from the next leaf.', 'Publisher line-break hyphenation is joined by the independently proofread source; source paragraphs preserved.'],
  C5: ['Full leaf reviewed, printed page 35, header, both species headings, Æ, initial A/T and final brownish-.', 'PAGE reading order omits header/page number; both are included explicitly before body. Drop-capital regions are joined to their following paragraph without a space.'],
  G1: ['BLOCKED: validated source displays Wakerley while scan reads Waverley; linked title displays Lady where scan reads Lay; masthead serialization splits one sentence across left/right blocks.', 'Raw source is retained. No correct scoring reference is asserted; G6 replaces this case in the ready quota. A recorded bottom crop excludes the later COMPOSITE COPY stamp, preserving all publication columns.'],
  G2: ['Full page reviewed, printed page 42; left column runs through 2d West India Regiment; right column starts BREVET. and ends 31st August 1835.', 'One incidental three-word Latin quotation Primus in Indis is part of predominantly English notices; source line wraps may differ from scan.'],
  G3: ['Article crop reviewed line by line; starts As we cannot give and ends Magistrates themselves. Partial nonlexical ink at upstream crop edges is outside article scope.', 'Manual published source non sequilur is visually corrected to non sequitur in derived text; original file retained. Quotes/dash type and small-cap case use the source convention.'],
  G4: ['Article crop reviewed line by line; starts There were very good reasons and ends Board of Control.', 'Manual published source tho often is visually corrected to the often in derived text; original file retained.'],
  G5: ['Entire supplied article crop reviewed, headline VOX PUMPULI! and all five numbered instructions.', 'The satirical Latin-style headline remains a small quotation within an English article; lexical reference preserves source words and line-end hyphens.'],
  G6: ['Entire single-column crop reviewed line by line; begins have been designed and ends an angel, will not only fall short of.', 'Official manually transcribed exact region B0C1R2 replaces the known-bad G1 full page; no new full-page layout claim.']
}

export const deriveReference = (spec: HistoricalSourceSpec, raw: string): string => {
  if (spec.id === 'G1') throw new AppValidationError('G1 has known reference errors and must remain blocked')
  if (spec.id === 'C5') return serializeImpactPage(raw).text
  if (spec.file) return serializeValidatedWikisource(raw)
  let text = raw.replaceAll('\r\n', '\n').trim() + '\n'
  if (spec.id === 'G3') {
    if (!text.includes('non sequilur')) throw new AppValidationError('G3 erratum anchor changed')
    text = text.replace('non sequilur', 'non sequitur')
  }
  if (spec.id === 'G4') {
    if (!text.includes('tho often')) throw new AppValidationError('G4 erratum anchor changed')
    text = text.replace('tho often', 'the often')
  }
  return text
}

export const assertSourceIdentity = (spec: HistoricalSourceSpec, metadata: { revision: string, leaf?: number, sourceImageName: string }) => {
  if (metadata.revision !== spec.revision || metadata.leaf !== spec.leaf || metadata.sourceImageName !== (spec.file ? `${spec.file}/${spec.leaf}` : spec.imageMember ?? impactImageFilename)) {
    throw new AppValidationError(`Source leaf/revision/member identity mismatch: ${spec.id}`)
  }
}

interface ImageSize { width: number, height: number }
const referenceStructure = (spec: HistoricalSourceSpec, sourceText: string, metadata: ImageSize, sourceMetadata: ImageSize, imageFileRevision: unknown) => ({
  sourceId: spec.id, sourceLeaf: spec.leaf ?? null, sourceRevision: spec.revision,
  imageFileRevision, imageSize: { width: metadata.width, height: metadata.height },
  sourceImageSize: { width: sourceMetadata.width, height: sourceMetadata.height },
  imageTransform: spec.crop ? { operation: 'crop', ...spec.crop, resampling: false } : { operation: 'lossless-format-conversion', format: 'png', resampling: false },
  readingOrder: spec.id === 'C5' ? serializeImpactPage(sourceText).regions : spec.id === 'G2' ? ['page number', 'left column top-to-bottom', 'right column top-to-bottom'] : spec.file ? ['header', 'body top-to-bottom', 'catchword/footer if present'] : ['supplied article region top-to-bottom'],
  errata: spec.id === 'G3' ? [{ source: 'non sequilur', corrected: 'non sequitur', basis: 'visible italic word in scan, line beginning glaring a' }] : spec.id === 'G4' ? [{ source: 'tho often', corrected: 'the often', basis: 'visible line beginning hension of the often' }] : [],
  reviewNotes: reviewNotes[spec.id],
  reviewDetails: spec.id === 'G3' ? [{ path: `${rootFor(spec)}/originals/${spec.id}-review-detail.png`, sourceCrop: { x: 0, y: 1175, width: 670, height: 110 }, scale: 2 }] : spec.id === 'G4' ? [{ path: `${rootFor(spec)}/originals/${spec.id}-review-detail.png`, sourceCrop: { x: 0, y: 830, width: 465, height: 130 }, scale: 3 }] : []
})

const prepare = async () => {
  const cases: Record<string, unknown>[] = []
  for (const spec of HISTORICAL_NEWSPAPER_SOURCES) {
    const base = rootFor(spec), original = `${base}/originals/${spec.id}`
    const sourceImage = `${original}.${spec.file ? 'jpg' : spec.id === 'C5' ? 'webp' : 'png'}`
    const sourceReference = `${original}.${spec.file ? 'wikitext' : spec.id === 'C5' ? 'xml' : 'txt'}`
    const imageBytes = await localRead(sourceImage), referenceBytes = await localRead(sourceReference)
    assertHistoricalSourceBytes(spec.id, imageBytes, referenceBytes)
    const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(referenceBytes)
    const input = `${base}/${spec.slug}.png`
    if (spec.crop) {
      const c = spec.crop
      const proc = Bun.spawn(['magick', resolve(PROJECT_ROOT, sourceImage), '-crop', `${c.width}x${c.height}+${c.x}+${c.y}`, '+repage', '-strip', `PNG32:${resolve(PROJECT_ROOT, input)}`], { stdout: 'pipe', stderr: 'pipe' })
      if (await proc.exited !== 0) throw new AppInfrastructureError(await new Response(proc.stderr).text())
    } else await Bun.write(resolve(PROJECT_ROOT, input), await new Bun.Image(imageBytes).png().bytes())
    const inputBytes = await localRead(input), metadata = await new Bun.Image(inputBytes).metadata()
    const sourceMetadata = await new Bun.Image(imageBytes).metadata()
    const blocked = spec.id === 'G1'
    const reference = blocked ? null : `${base}/${spec.slug}.txt`
    const normalizedReference = blocked ? null : `${base}/${spec.slug}.normalized.txt`
    const text = blocked ? null : deriveReference(spec, sourceText)
    if (reference && normalizedReference && text) {
      await Bun.write(resolve(PROJECT_ROOT, reference), text)
      await Bun.write(resolve(PROJECT_ROOT, normalizedReference), normalizeHistoricalReference(text))
    }
    const originalReferences: Array<Record<string, unknown>> = [
      { path: sourceImage, sha256: hash(imageBytes), url: spec.imageURL, revision: spec.file ? undefined : spec.id === 'C5' ? 'b7bda5fac0471d6d2237360abc799c6d13559465' : spec.revision, selector: spec.imageMember ?? (spec.file ? `scan leaf ${spec.leaf}` : impactImageFilename) },
      { path: sourceReference, sha256: hash(referenceBytes), url: spec.referenceURL, revision: spec.revision, selector: spec.referenceMember ?? (spec.id === 'C5' ? 'pcGtsId=pc-00667895' : `pagequality=4; scan leaf ${spec.leaf}`) }
    ]
    let imageFileRevision: unknown = undefined
    if (spec.file) {
      const commonsPath = `${original}.commons.json`, commonsBytes = await localRead(commonsPath)
      const commons = JSON.parse(new TextDecoder().decode(commonsBytes)) as { query: { pages: Record<string, { imageinfo: Array<{ timestamp: string, sha1: string, descriptionurl: string }> }> } }
      const info = Object.values(commons.query.pages)[0]?.imageinfo[0]
      if (!info) throw new AppValidationError(`Missing Commons source image revision ${spec.id}`)
      imageFileRevision = { timestamp: info.timestamp, sha1: info.sha1, descriptionURL: info.descriptionurl }
      originalReferences.push({ path: commonsPath, sha256: hash(commonsBytes), url: `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&titles=${encodeURIComponent(`File:${spec.file}`)}&iiprop=timestamp|url|sha1|size|extmetadata&format=json`, revision: info.timestamp })
      originalReferences[0]!['revision'] = info.timestamp
    } else if (spec.id === 'C5') {
      for (const [name, url, revision] of [
        ['finebooks-README.md', 'https://huggingface.co/datasets/finebooks/bhl-impact-gt/raw/b7bda5fac0471d6d2237360abc799c6d13559465/README.md', 'b7bda5fac0471d6d2237360abc799c6d13559465'],
        ['impact-README.md', 'https://raw.githubusercontent.com/impactcentre/groundtruth-bhl/9eb0fc75166bfaaec24c8523ccb69da48f6cf13f/README.md', spec.revision]
      ]) {
        const path = `${base}/originals/${name}`
        originalReferences.push({ path, sha256: hash(await localRead(path)), url, revision })
      }
    } else {
      const path = `${base}/originals/ncse-release.json`
      originalReferences.push({ path, sha256: hash(await localRead(path)), url: 'https://api.figshare.com/v2/articles/28381610/versions/1', revision: spec.revision })
      for (const [name, expectedMD5, url] of [
        ['ncse-images.zip', 'aff636e809778173aec741e426f7ae85', spec.imageURL],
        ['ncse-ground-truth.zip', 'c698461e74c78a0e077fd952ec859724', spec.referenceURL]
      ]) {
        const archivePath = `${base}/originals/${name}`, bytes = await localRead(archivePath)
        if (new Bun.CryptoHasher('md5').update(bytes).digest('hex') !== expectedMD5) throw new AppValidationError('NCSE archive differs from release checksum')
        originalReferences.push({ path: archivePath, sha256: hash(bytes), md5: expectedMD5, url, revision: spec.revision })
      }
    }
    const structuredReference = `${base}/${spec.slug}.reference.json`
    const structure = referenceStructure(spec, sourceText, metadata, sourceMetadata, imageFileRevision)
    await Bun.write(resolve(PROJECT_ROOT, structuredReference), json(structure))
    cases.push({ id: spec.slug, sourceId: spec.id, category: spec.category, language: 'en', status: blocked ? 'blocked-reference-review' : 'prepared-not-run',
      input, reference, normalizedReference, structuredReference, originalReference: sourceReference, originalReferences,
      inputSha256: hash(inputBytes), referenceSha256: text ? hash(text) : null,
      width: metadata.width, height: metadata.height, pageCount: 1, format: 'png', chars: text?.length ?? 0, words: text?.trim().split(/\s+/).length ?? 0,
      scope: spec.imageMember ? 'region-crop' : 'full-page', synthetic: false, sourceFamily: spec.file ? 'Wikisource/Commons' : spec.id === 'C5' ? 'IMPACT-BHL/FineBooks' : 'NCSE evaluation subset',
      sourceURL: spec.imageURL, annotationURL: spec.referenceURL, sourceRevision: spec.revision,
      sourceImageName: spec.file ? `${spec.file}/${spec.leaf}` : spec.imageMember ?? impactImageFilename, leaf: spec.leaf,
      imageFileRevision, acquisitionAlternativeFor: spec.id === 'G6' ? 'G1' : undefined, replacementId: blocked ? 'newspapers-monthly-repository' : undefined,
      rights: spec.file ? { imageLicense: 'Public domain', referenceLicense: 'CC-BY-SA-4.0', attributionURL: spec.referenceURL.replace('&action=raw', ''), notice: 'Commons mechanical scans of public-domain originals; Wikisource contributor attribution via pinned page and revision history. Derived text retains share-alike terms.', redistributable: true } : spec.id === 'C5' ? { license: 'CC-BY-3.0', notice: 'IMPACT-BHL ground truth and FineBooks paired scan; attribute IMPACT Centre of Competence and BHL.', redistributable: true } : { license: 'CC-BY-4.0', notice: 'NCSE manually annotated evaluation subset, DOI 10.5522/04/28381610.v1; retain author attribution in release metadata.', redistributable: true },
      attribution: spec.file ? `Wikisource contributors, page ${spec.file}/${spec.leaf}, revision ${spec.revision}; Commons scan metadata in ${original}.commons.json` : spec.id === 'C5' ? 'IMPACT Centre of Competence, BHL; FineBooks pairing b7bda5fac0471d6d2237360abc799c6d13559465' : `Jonno Bourne, NCSE evaluation subset, 10.5522/04/28381610.v1; ${spec.referenceMember}`,
      serializationPolicy: { sourceText: 'Immutable original gold retained; deterministic conversion and separately recorded review errata only.', typography: 'Source small-cap templates become uppercase; long-s and ﬁ retained in main text. NFKC, quote/dash folding and whitespace normalization occur only in companion reference.', pageFurniture: 'Publication header, page number, marginal line/stanza numbers and catchword included. Explicit acquisition crop removes out-of-publication margins.', readingOrder: 'Whole-page logical column order; region crops do not establish full-page ordering. XML drop capitals attach to the next paragraph.', lineBreaks: 'Validated Wikisource logical lines/paragraphs retained; NCSE published physical lines and hyphens retained. Treat layout whitespace independently from lexical fidelity.' },
      review: { status: blocked ? 'blocked-reference-review' : 'visually-reviewed-source-pair', modelExecution: false, sourceIndependentOfModels: true, notes: reviewNotes[spec.id] },
      observations: spec.crop ? [`Recorded crop: ${JSON.stringify(spec.crop)} in original pixels; original preserved.`] : []
    })
  }
  for (const category of ['historical-print', 'newspapers'] as const) {
    const selected = cases.filter(entry => entry['category'] === category)
    await Bun.write(resolve(PROJECT_ROOT, `input/examples/document/ocr-${category === 'historical-print' ? 'historical-print' : 'newspapers'}/bundle.json`), json({ schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category, language: 'en', status: 'prepared-not-run', caseCount: selected.length, readyCaseCount: selected.filter(entry => entry['status'] === 'prepared-not-run').length, cases: selected }))
  }
  return { acquired: cases.length, ready: cases.filter(entry => entry['status'] === 'prepared-not-run').length, blocked: 1, modelCalls: 0 }
}

const objectRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppValidationError(`Expected object: ${label}`)
  return value as Record<string, unknown>
}
const requireMatch = (actual: unknown, expected: unknown, label: string): void => {
  if (!isDeepStrictEqual(actual, JSON.parse(json(expected)))) throw new AppValidationError(`Validation mismatch: ${label}`)
}

/** Read-only source admission. Rebuilds derived text/layout and PNGs in memory; never downloads or runs OCR. */
export const validateHistoricalNewspaperBundles = async (projectRoot = PROJECT_ROOT) => {
  const root = await realpath(projectRoot), cache = new Map<string, Uint8Array>()
  const boundedPath = async (path: unknown): Promise<string> => {
    if (typeof path !== 'string' || isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected repository-relative artifact path')
    const actual = await realpath(resolve(root, path)), rel = relative(root, actual)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new AppValidationError('Artifact path escapes project root')
    return actual
  }
  const read = async (path: string): Promise<Uint8Array> => {
    const cached = cache.get(path)
    if (cached) return cached
    const bytes = new Uint8Array(await Bun.file(await boundedPath(path)).arrayBuffer())
    cache.set(path, bytes)
    return bytes
  }
  const text = async (path: string): Promise<string> => new TextDecoder('utf-8', { fatal: true }).decode(await read(path))
  let ready = 0, blocked = 0, provenanceHashesVerified = 0, imagesFullyDecoded = 0
  for (const category of ['historical-print', 'newspapers'] as const) {
    const base = `input/examples/document/ocr-${category}`, bundle = objectRecord(JSON.parse(await text(`${base}/bundle.json`)), 'bundle')
    const expectedSources = HISTORICAL_NEWSPAPER_SOURCES.filter(spec => spec.category === category)
    for (const [key, expected] of Object.entries({ schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category, language: 'en', status: 'prepared-not-run', caseCount: expectedSources.length, readyCaseCount: 5 })) requireMatch(bundle[key], expected, `bundle ${category}.${key}`)
    if (!Array.isArray(bundle['cases']) || bundle['cases'].length !== expectedSources.length) throw new AppValidationError(`Wrong case population: ${category}`)
    const caseEntries = bundle['cases'].map(value => objectRecord(value, 'case'))
    requireMatch(caseEntries.map(entry => entry['sourceId']).sort(), expectedSources.map(spec => spec.id).sort(), `source ID population ${category}`)
    for (const spec of expectedSources) {
      const entry = caseEntries.find(value => value['sourceId'] === spec.id)!, original = `${base}/originals/${spec.id}`
      const sourceImage = `${original}.${spec.file ? 'jpg' : spec.id === 'C5' ? 'webp' : 'png'}`
      const sourceReference = `${original}.${spec.file ? 'wikitext' : spec.id === 'C5' ? 'xml' : 'txt'}`
      const input = `${base}/${spec.slug}.png`, reference = spec.id === 'G1' ? null : `${base}/${spec.slug}.txt`
      const normalizedReference = spec.id === 'G1' ? null : `${base}/${spec.slug}.normalized.txt`, structuredReference = `${base}/${spec.slug}.reference.json`
      for (const [key, expected] of Object.entries({ id: spec.slug, category, language: 'en', input, reference, normalizedReference, structuredReference, originalReference: sourceReference, status: spec.id === 'G1' ? 'blocked-reference-review' : 'prepared-not-run', sourceURL: spec.imageURL, annotationURL: spec.referenceURL, sourceRevision: spec.revision, sourceImageName: spec.file ? `${spec.file}/${spec.leaf}` : spec.imageMember ?? impactImageFilename, pageCount: 1, format: 'png', synthetic: false, scope: spec.imageMember ? 'region-crop' : 'full-page' })) requireMatch(entry[key], expected, `${spec.id}.${key}`)
      assertSourceIdentity(spec, { revision: String(entry['sourceRevision']), ...(typeof entry['leaf'] === 'number' ? { leaf: entry['leaf'] } : {}), sourceImageName: String(entry['sourceImageName']) })
      const imageBytes = await read(sourceImage), referenceBytes = await read(sourceReference), sourceText = new TextDecoder('utf-8', { fatal: true }).decode(referenceBytes)
      assertHistoricalSourceBytes(spec.id, imageBytes, referenceBytes)
      const expectedExtraPaths = spec.file ? [`${original}.commons.json`] : spec.id === 'C5' ? [`${base}/originals/finebooks-README.md`, `${base}/originals/impact-README.md`] : [`${base}/originals/ncse-release.json`, `${base}/originals/ncse-images.zip`, `${base}/originals/ncse-ground-truth.zip`]
      if (!Array.isArray(entry['originalReferences'])) throw new AppValidationError('Missing original source provenance')
      const originals = entry['originalReferences'].map(value => objectRecord(value, 'original reference'))
      requireMatch(originals.map(value => value['path']), [sourceImage, sourceReference, ...expectedExtraPaths], `${spec.id} original provenance population`)
      for (const artifact of originals) {
        const path = String(artifact['path']), bytes = await read(path), expectedHash = path === sourceImage ? sourceHashes[spec.id]![0] : path === sourceReference ? sourceHashes[spec.id]![1] : provenanceHashes[path]
        if (!expectedHash || hash(bytes) !== expectedHash || artifact['sha256'] !== expectedHash) throw new AppValidationError(`Pinned provenance hash mismatch: ${path}`)
        provenanceHashesVerified++
      }
      requireMatch(originals[0]!['url'], spec.imageURL, `${spec.id} image URL`)
      requireMatch(originals[0]!['selector'], spec.imageMember ?? (spec.file ? `scan leaf ${spec.leaf}` : impactImageFilename), `${spec.id} image selector`)
      requireMatch(originals[1]!['url'], spec.referenceURL, `${spec.id} reference URL`)
      requireMatch(originals[1]!['revision'], spec.revision, `${spec.id} reference revision`)
      requireMatch(originals[1]!['selector'], spec.referenceMember ?? (spec.id === 'C5' ? 'pcGtsId=pc-00667895' : `pagequality=4; scan leaf ${spec.leaf}`), `${spec.id} reference selector`)
      let imageFileRevision: unknown = undefined
      if (spec.file) {
        const commons = JSON.parse(await text(`${original}.commons.json`)) as { query: { pages: Record<string, { imageinfo: Array<{ timestamp: string, sha1: string, descriptionurl: string }> }> } }
        const info = Object.values(commons.query.pages)[0]?.imageinfo[0]
        if (!info) throw new AppValidationError('Missing pinned Commons metadata')
        imageFileRevision = { timestamp: info.timestamp, sha1: info.sha1, descriptionURL: info.descriptionurl }
        requireMatch(entry['imageFileRevision'], imageFileRevision, `${spec.id} Commons image revision`)
        requireMatch(originals[0]!['revision'], info.timestamp, `${spec.id} thumbnail source revision`)
      }
      const bytes = await read(input), image = new Bun.Image(bytes), metadata = await image.metadata(), sourceMetadata = await new Bun.Image(imageBytes).metadata()
      const decoded = await image.png().bytes()
      if (!decoded.length || hash(bytes) !== entry['inputSha256'] || metadata.format !== 'png' || metadata.width !== entry['width'] || metadata.height !== entry['height']) throw new AppValidationError(`Invalid prepared PNG: ${spec.id}`)
      let regenerated: Uint8Array
      if (spec.crop) {
        const c = spec.crop
        const process = Bun.spawn(['magick', await boundedPath(sourceImage), '-crop', `${c.width}x${c.height}+${c.x}+${c.y}`, '+repage', '-strip', 'PNG32:-'], { stdout: 'pipe', stderr: 'pipe' })
        const result = await new Response(process.stdout).arrayBuffer()
        if (await process.exited !== 0) throw new AppInfrastructureError(await new Response(process.stderr).text())
        regenerated = new Uint8Array(result)
      } else regenerated = await new Bun.Image(imageBytes).png().bytes()
      if (hash(await new Bun.Image(regenerated).png().bytes()) !== hash(decoded)) throw new AppValidationError(`Prepared image differs from pinned source/recorded crop: ${spec.id}`)
      imagesFullyDecoded++
      requireMatch(JSON.parse(await text(structuredReference)), referenceStructure(spec, sourceText, metadata, sourceMetadata, imageFileRevision), `${spec.id} structured reference`)
      const review = objectRecord(entry['review'], 'review')
      requireMatch(review['modelExecution'], false, `${spec.id} model execution`)
      requireMatch(review['notes'], reviewNotes[spec.id], `${spec.id} review notes`)
      if (spec.id === 'G1') {
        requireMatch(entry['referenceSha256'], null, 'G1 must not claim correct gold')
        requireMatch(entry['replacementId'], 'newspapers-monthly-repository', 'G1 replacement')
        blocked++
        continue
      }
      const derived = deriveReference(spec, sourceText)
      requireMatch(await text(reference!), derived, `${spec.id} canonical text regeneration`)
      requireMatch(await text(normalizedReference!), normalizeHistoricalReference(derived), `${spec.id} normalized text regeneration`)
      requireMatch(entry['referenceSha256'], hash(derived), `${spec.id} reference hash`)
      requireMatch(entry['chars'], derived.length, `${spec.id} character count`)
      requireMatch(entry['words'], derived.trim().split(/\s+/).length, `${spec.id} word count`)
      ready++
    }
  }
  return { ready, blocked, provenanceHashesVerified, imagesFullyDecoded, modelCalls: 0, writes: 0 }
}

export const parseHistoricalPreparationMode = (args: readonly string[]): '--validate' | '--prepare-local' => {
  if (args.length !== 1 || (args[0] !== '--validate' && args[0] !== '--prepare-local')) throw new AppUsageError('Usage: bun src/tools/ocr-preparation/prepare-historical-newspapers.ts --validate|--prepare-local (local source preparation/validation only; no OCR, downloads or provider execution)')
  return args[0]
}

if (import.meta.main) {
  const mode = parseHistoricalPreparationMode(Bun.argv.slice(2))
  writeCommandPayload((json(mode === '--validate' ? await validateHistoricalNewspaperBundles() : await prepare())) + '\n')
}
