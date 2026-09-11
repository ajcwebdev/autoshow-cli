import { InfraError } from '~/utils/error-handler'
import { readdirSync, statSync } from 'node:fs'

// Existing root directories are the fixed baseline. New directories belong below them.
const ROOT_DIRECTORIES = new Set(['.claude', '.codex', '.git', '.github', '.test-work', 'config', 'docs', 'input', 'node_modules', 'output', 'runtime', 'src', 'test'])

export const findRepositoryStructureViolations = (rootDirectories: string[], projectFiles: string[]): string[] => [
  ...rootDirectories.filter(name => !ROOT_DIRECTORIES.has(name)).map(name => `Prohibited root directory: ${name}/. Use an existing directory under src/, test/, config/, or docs/.`),
  ...projectFiles.filter(path => /\.py$/i.test(path)).map(path => `Python source files are prohibited: ${path}`)
]

if (import.meta.main) {
  const listing = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { stdout: 'pipe', stderr: 'pipe' })
  if (listing.exitCode !== 0) throw InfraError(listing.stderr.toString())
  const files = listing.stdout.toString().split('\0').filter(path => {
    try { return statSync(path).isFile() } catch { return false }
  })
  const directories = readdirSync('.', { withFileTypes: true }).filter(entry => entry.isDirectory() || (entry.isSymbolicLink() && statSync(entry.name).isDirectory())).map(entry => entry.name)
  const violations = findRepositoryStructureViolations(directories, files)
  if (violations.length) {
    console.error(violations.join('\n'))
    process.exitCode = 1
  }
}
