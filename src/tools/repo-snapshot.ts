import { execFileSync } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import type { TreeNode } from '~/types'
import { countReferenceTokens } from '~/utils/reference-tokenizer'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

// In-repository replacement for the retired Repomix dependency. It reproduces
// the previous `bun repo` snapshot byte for byte: the same include set
// (top-level files plus src/), the same ignore rules, the same Markdown layout
// (# Directory Structure, # Files with four-backtick fences, # Instruction),
// and o200k_base token counts from the reference tokenizer.
const INCLUDED = (path: string): boolean => !path.includes('/') || path.startsWith('src/')

const IGNORE_PATHS = [
  'new-*.md',
  'TODO.md',
  'bun.lock',
  'src/tools/repo-snapshot.ts',
  'project/links/all-all-links.md'
]

const TOP_FILES_LENGTH = 20

const DEFAULT_INSTRUCTION = "I'm going to ask you to refactor my code, write a new feature, or fix a bug.\n"

// The subset of Repomix's extension-to-language table this repository can
// realistically contain; unknown extensions render an untagged fence.
const FENCE_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  toml: 'toml',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  css: 'css',
  html: 'html',
  xml: 'xml',
  sql: 'sql'
}

const fenceLanguageFor = (path: string): string => {
  const base = path.split('/').pop() ?? path
  if (base === 'Dockerfile') return 'dockerfile'
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return FENCE_LANGUAGES[base.slice(dot + 1).toLowerCase()] ?? ''
}

const matchesIgnore = (path: string): boolean => {
  const base = path.split('/').pop() ?? path
  return IGNORE_PATHS.some((pattern) => {
    if (pattern.includes('/')) return path === pattern
    if (!pattern.includes('*')) return base === pattern
    const regex = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
    return regex.test(base)
  })
}

const isPlainFile = (path: string): boolean => {
  const stats = lstatSync(join(PROJECT_ROOT, path), { throwIfNoEntry: false })
  return stats !== undefined && stats.isFile() && !stats.isSymbolicLink()
}

const looksBinary = (bytes: Uint8Array): boolean => {
  const window = bytes.subarray(0, 8192)
  return window.includes(0)
}

// Tracked plus untracked-but-not-ignored, exactly the visibility .gitignore
// already defines for the repository.
const listCandidatePaths = (): string[] => {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  return [...new Set(output.split('\n').filter(Boolean))]
}

const newTreeNode = (): TreeNode => ({ dirs: new Map(), files: [] })

const insertPath = (root: TreeNode, path: string): void => {
  const segments = path.split('/')
  let node = root
  for (const segment of segments.slice(0, -1)) {
    let child = node.dirs.get(segment)
    if (!child) {
      child = newTreeNode()
      node.dirs.set(segment, child)
    }
    node = child
  }
  const file = segments[segments.length - 1]
  if (file) node.files.push(file)
}

const byNameCaseInsensitive = (left: string, right: string): number => {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a < b) return -1
  if (a > b) return 1
  return left < right ? -1 : left > right ? 1 : 0
}

// Depth-first, directories before files, both case-insensitively sorted: the
// traversal order Repomix used for the tree section and the file sections.
const walkTree = (
  node: TreeNode,
  prefix: string,
  depth: number,
  treeLines: string[],
  orderedFiles: string[]
): void => {
  const indent = '  '.repeat(depth)
  for (const dirName of [...node.dirs.keys()].sort(byNameCaseInsensitive)) {
    treeLines.push(`${indent}${dirName}/`)
    const child = node.dirs.get(dirName)
    if (child) walkTree(child, `${prefix}${dirName}/`, depth + 1, treeLines, orderedFiles)
  }
  for (const fileName of [...node.files].sort(byNameCaseInsensitive)) {
    treeLines.push(`${indent}${fileName}`)
    orderedFiles.push(`${prefix}${fileName}`)
  }
}

const fenceFor = (content: string): string => {
  let longestRun = 0
  for (const match of content.matchAll(/`+/g)) {
    if (match[0].length > longestRun) longestRun = match[0].length
  }
  return '`'.repeat(Math.max(4, longestRun + 1))
}

const resolveInstructionFile = async (): Promise<{ path: string, tempDir?: string }> => {
  const projectInstruction = join(PROJECT_ROOT, 'repomix-instruction.md')
  if (await Bun.file(projectInstruction).exists()) {
    return { path: projectInstruction }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-repo-snapshot-'))
  const instructionPath = join(tempDir, 'repo-snapshot-instruction-temp.md')
  await Bun.write(instructionPath, DEFAULT_INSTRUCTION)
  l.write('info', `Created temporary instruction file: ${instructionPath}`)
  return { path: instructionPath, tempDir }
}

const resolveOutputFile = async (): Promise<string> => {
  let counter = 1
  while (true) {
    const fileName = `new-llm-${counter}.md`
    if (!await Bun.file(join(PROJECT_ROOT, fileName)).exists()) {
      return fileName
    }
    counter++
  }
}

const formatCount = (value: number): string => value.toLocaleString('en-US')

const run = async (): Promise<number> => {
  const instruction = await resolveInstructionFile()
  const outputFile = await resolveOutputFile()

  try {
    // Binary files stay in the directory tree but get no file section, the
    // same split Repomix made.
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const contentByPath = new Map<string, string>()
    const tree = newTreeNode()
    for (const path of listCandidatePaths()) {
      if (!INCLUDED(path) || matchesIgnore(path) || !isPlainFile(path)) continue
      insertPath(tree, path)
      const bytes = new Uint8Array(await Bun.file(join(PROJECT_ROOT, path)).arrayBuffer())
      if (looksBinary(bytes)) continue
      contentByPath.set(path, decoder.decode(bytes))
    }

    const treeLines: string[] = []
    const orderedPaths: string[] = []
    walkTree(tree, '', 0, treeLines, orderedPaths)

    const sectionLines: string[] = []
    const metrics: { path: string, tokens: number, chars: number }[] = []
    for (const path of orderedPaths) {
      const raw = contentByPath.get(path)
      if (raw === undefined) continue
      const content = raw.trim()
      const fence = fenceFor(content)
      sectionLines.push(`## File: ${path}`, `${fence}${fenceLanguageFor(path)}`, content, fence, '')
      metrics.push({ path, tokens: countReferenceTokens(content), chars: content.length })
    }

    const instructionText = await Bun.file(instruction.path).text()
    const document = [
      '# Directory Structure',
      '```',
      treeLines.join('\n'),
      '```',
      '',
      '# Files',
      '',
      ...sectionLines,
      '',
      '',
      '',
      '# Instruction',
      instructionText
    ].join('\n').trim() + '\n'

    await Bun.write(join(PROJECT_ROOT, outputFile), document)

    const totalTokens = countReferenceTokens(document)
    const totalChars = document.length
    const topFiles = [...metrics].sort((a, b) => b.tokens - a.tokens || b.chars - a.chars).slice(0, TOP_FILES_LENGTH)
    const topFileRows = topFiles.map((file, index) => {
      const share = totalTokens > 0 ? ((file.tokens / totalTokens) * 100).toFixed(1) : '0.0'
      return {
        rank: index + 1,
        // Deliberately not named `path`: the ranked listing is the payload here, so the
        // wide-path detail lifting that suits artifact summaries would break it apart.
        module: file.path,
        tokens: formatCount(file.tokens),
        chars: formatCount(file.chars),
        share: `${share}%`
      }
    })

    l.write('success', `Successfully created ${outputFile}`, {
      category: 'artifact',
      humanSections: [
        {
          title: `Top ${TOP_FILES_LENGTH} Files by Token Count`,
          table: createHumanTable(topFileRows, ['rank', 'module', 'tokens', 'chars', 'share'], {
            align: { tokens: 'right', chars: 'right', share: 'right' }
          })
        },
        {
          title: 'Pack Summary',
          table: createKeyValueTable([
            ['Total Files', `${formatCount(metrics.length)} files`],
            ['Total Tokens', `${formatCount(totalTokens)} tokens (o200k_base)`],
            ['Total Chars', `${formatCount(totalChars)} chars`],
            ['Output file', outputFile]
          ])
        }
      ],
      metadata: {
        outputFile,
        totalFiles: metrics.length,
        totalTokens,
        totalChars
      }
    })
    return 0
  } catch (error) {
    l.error(`Error creating repository snapshot: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  } finally {
    if (instruction.tempDir) {
      await rm(instruction.tempDir, { recursive: true, force: true })
    }
  }
}

process.exit(await run())
