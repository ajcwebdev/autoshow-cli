import { InfraError } from '~/utils/error-handler'
import { readdirSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

const ROOT_DIRECTORIES = new Set(['.claude', '.codex', '.git', '.github', 'config', 'docs', 'input', 'node_modules', 'output', 'runtime', 'src', 'test'])
const REPOSITORY_DIRECTORY_NAMES = [...new Set(['autoshow-cli', basename(PROJECT_ROOT)])]

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const checkoutPathPattern = (): RegExp => new RegExp(
  String.raw`(?:/Users|/home)/[^/\s"'\x60]+(?:/[^/\s"'\x60]+)*?/(?:${REPOSITORY_DIRECTORY_NAMES.map(escapeRegExp).join('|')})(?=[/\s"'\x60)\]]|$)`,
  'gm'
)

export const findMachineSpecificPaths = (path: string, content: string): string[] =>
  content.split('\n').flatMap((line, index) => [...line.matchAll(checkoutPathPattern())].map(match =>
    `Machine-specific checkout path in ${path}:${index + 1}: ${match[0]}. Store project paths relative to the repository root.`
  ))

const HTTP_PAYLOAD_MODULE = 'src/utils/http-payload.ts'
const RAW_HTTP_BODY_READ = /\bawait\s+\(?\s*(?:res|resp|response|\w*(?:Res|Resp|Response))\s*\)?\s*\.(?:json|text|arrayBuffer|bytes|blob)\(\)/

/**
 * A raw body read has no size policy: it either inherits no ceiling at all or tempts a caller back
 * to bounded capture, which truncates. Both have discarded responses a provider already billed for.
 */
export const findRawHttpBodyReads = (path: string, content: string): string[] =>
  !/^src\/.*\.ts$/.test(path) || path === HTTP_PAYLOAD_MODULE ? [] : content.split('\n').flatMap((line, index) => RAW_HTTP_BODY_READ.test(line)
    ? [`Raw HTTP body read in ${path}:${index + 1}. Use readJsonResponse or the readers in ${HTTP_PAYLOAD_MODULE} so the body is read whole under the shared payload ceiling.`]
    : [])

export const findRepositoryStructureViolations = (rootDirectories: string[], projectFiles: string[], fileContents: ReadonlyMap<string, string> = new Map(), sourceContents: ReadonlyMap<string, string> = new Map()): string[] => [
  ...rootDirectories.filter(name => !ROOT_DIRECTORIES.has(name)).map(name => `Prohibited root directory: ${name}/. Use an existing directory under src/, test/, config/, or docs/.`),
  ...projectFiles.filter(path => /\.py$/i.test(path)).map(path => `Python source files are prohibited: ${path}`),
  ...[...fileContents].flatMap(([path, content]) => findMachineSpecificPaths(path, content)),
  ...[...sourceContents].flatMap(([path, content]) => findRawHttpBodyReads(path, content))
]

const listGitGrepMatches = (patternArgs: string[]): string[] => {
  const args = ['git', 'grep', '--untracked', '-I', '-l', '-z', ...patternArgs]
  const result = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode === 1) return []
  if (result.exitCode !== 0) throw InfraError(result.stderr.toString())
  return result.stdout.toString().split('\0').filter(Boolean)
}

const listCheckoutPathCandidates = (): string[] => listGitGrepMatches(REPOSITORY_DIRECTORY_NAMES.flatMap(name => ['-e', `/${name}`]))

const listRawHttpBodyReadCandidates = (): string[] => listGitGrepMatches(['-E', '-e', String.raw`\.(json|text|arrayBuffer|bytes|blob)\(\)`, '--', 'src/*.ts'])

const readContents = async (paths: string[]): Promise<Map<string, string>> =>
  new Map(await Promise.all(paths.map(async path => [path, await Bun.file(path).text()] as const)))

if (import.meta.main) {
  const listing = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { stdout: 'pipe', stderr: 'pipe' })
  if (listing.exitCode !== 0) throw InfraError(listing.stderr.toString())
  const files = listing.stdout.toString().split('\0').filter(path => {
    try { return statSync(path).isFile() } catch { return false }
  })
  const directories = readdirSync('.', { withFileTypes: true }).filter(entry => entry.isDirectory() || (entry.isSymbolicLink() && statSync(entry.name).isDirectory())).map(entry => entry.name)
  const violations = findRepositoryStructureViolations(directories, files, await readContents(listCheckoutPathCandidates()), await readContents(listRawHttpBodyReadCandidates()))
  if (violations.length) {
    console.error(violations.join('\n'))
    process.exitCode = 1
  }
}
