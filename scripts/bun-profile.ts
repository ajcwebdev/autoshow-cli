import { mkdir, readFile, stat } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'

type ProfileRecipe = 'cpu' | 'heap' | 'bundle' | 'tokenizer' | 'all'

type ProfileOptions = {
  recipe: ProfileRecipe
  outputDir: string
}

type CommandRecord = {
  label: string
  command: string[]
  exitCode: number
  durationMs: number
  stdoutLog: string
  stderrLog: string
}

type CommandResult = {
  record: CommandRecord
  stdout: string
}

type BundleInput = {
  bytes?: number
  imports?: Array<{ path?: string, kind?: string }>
}

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const DEFAULT_OUTPUT_ROOT = resolve(PROJECT_ROOT, 'runtime/profiling/bun-runtime')
const RECIPE_VALUES = new Set<ProfileRecipe>(['cpu', 'heap', 'bundle', 'tokenizer', 'all'])

const timestampSegment = (): string => new Date().toISOString().replace(/[:.]/g, '-')

const usage = (): never => {
  process.stderr.write(`Usage: bun profile:<recipe> [--output-dir <path>]

Recipes: cpu, heap, bundle, tokenizer, all
Generated profiles and metadata remain under runtime/profiling by default.
`)
  process.exit(2)
}

const parseOptions = (args: string[]): ProfileOptions => {
  const rawRecipe = args[0]
  if (!rawRecipe || !RECIPE_VALUES.has(rawRecipe as ProfileRecipe)) usage()
  const recipe = rawRecipe as ProfileRecipe
  let outputDir = resolve(DEFAULT_OUTPUT_ROOT, `${timestampSegment()}-${recipe}`)

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--output-dir') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) usage()
      outputDir = resolve(PROJECT_ROOT, value as string)
      index++
      continue
    }
    if (arg === '--help' || arg === '-h') usage()
    process.stderr.write(`Unknown profiling option: ${arg}\n`)
    usage()
  }
  return { recipe, outputDir }
}

const relativePath = (path: string): string => relative(PROJECT_ROOT, path).replace(/\\/g, '/')

const main = async (): Promise<void> => {
  const options = parseOptions(Bun.argv.slice(2))
  await mkdir(options.outputDir, { recursive: true })
  const metadataPath = resolve(options.outputDir, 'metadata.json')
  const packageJson = await Bun.file(resolve(PROJECT_ROOT, 'package.json')).json() as { packageManager?: string }
  const startedAt = new Date().toISOString()
  const commandRecords: CommandRecord[] = []
  let status: 'running' | 'passed' | 'failed' = 'running'

  const writeMetadata = async (): Promise<void> => {
    await Bun.write(metadataPath, `${JSON.stringify({
      schemaVersion: 1,
      recipe: options.recipe,
      status,
      startedAt,
      completedAt: status === 'running' ? null : new Date().toISOString(),
      bunVersion: Bun.version,
      packageManager: packageJson.packageManager ?? null,
      platform: process.platform,
      architecture: process.arch,
      environment: { inheritedKeys: ['HOME', 'PATH'], dotenvLoading: false },
      commands: commandRecords
    }, null, 2)}\n`)
  }

  const runBun = async (label: string, args: string[]): Promise<CommandResult> => {
    const command = ['bun', '--no-env-file', ...args]
    const stdoutPath = resolve(options.outputDir, `${label}.stdout.log`)
    const stderrPath = resolve(options.outputDir, `${label}.stderr.log`)
    const started = performance.now()
    const proc = Bun.spawn(command, {
      cwd: PROJECT_ROOT,
      env: {
        HOME: process.env['HOME'] ?? '',
        PATH: process.env['PATH'] ?? ''
      },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])
    await Promise.all([Bun.write(stdoutPath, stdout), Bun.write(stderrPath, stderr)])
    const record = {
      label,
      command,
      exitCode,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      stdoutLog: relativePath(stdoutPath),
      stderrLog: relativePath(stderrPath)
    }
    commandRecords.push(record)
    await writeMetadata()
    if (exitCode !== 0) {
      throw new Error(`Profiling command failed (${label}, exit ${exitCode}). See ${relativePath(stderrPath)}.`)
    }
    return { record, stdout }
  }

  const runCpuProfiles = async (): Promise<void> => {
    await runBun('cli-help-cpu', [
      '--cpu-prof-md', '--cpu-prof-dir', options.outputDir, '--cpu-prof-name', 'cli-help.cpu.md',
      'src/cli/create-cli.ts', '--help'
    ])
    await runBun('test-price-cpu', [
      '--cpu-prof-md', '--cpu-prof-dir', options.outputDir, '--cpu-prof-name', 'test-price.cpu.md',
      'test/test-runner.ts', '--price'
    ])
  }

  const runHeapProfile = async (): Promise<void> => {
    await runBun('local-parsing-normalization-heap', [
      '--heap-prof-md', '--heap-prof-dir', options.outputDir, '--heap-prof-name', 'local-parsing-normalization.heap.md',
      'scripts/profile-workloads/local-parsing-normalization.ts'
    ])
  }

  const buildBundleInventory = async (): Promise<void> => {
    const metafilePath = resolve(options.outputDir, 'test-cli.metafile.json')
    const raw = JSON.parse(await readFile(metafilePath, 'utf8')) as { inputs?: Record<string, BundleInput> }
    const inputs = Object.entries(raw.inputs ?? {})
    const largestModules = inputs
      .map(([path, input]) => ({ path, bytes: input.bytes ?? 0 }))
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 30)
    const dynamicImports = inputs.flatMap(([importer, input]) =>
      (input.imports ?? []).filter(item => item.kind === 'dynamic-import').map(item => ({ importer, path: item.path ?? '' }))
    )
    const promptFiles = await Array.fromAsync(new Bun.Glob('src/prompts/**/*.json').scan({ cwd: PROJECT_ROOT, onlyFiles: true }))
    const promptStats = await Promise.all(promptFiles.map(async path => ({ path, bytes: (await stat(resolve(PROJECT_ROOT, path))).size })))
    const tokenizerPath = resolve(PROJECT_ROOT, 'src/tools/o200k-base-ranks.tiktoken.gz')
    const tokenizerBytes = (await stat(tokenizerPath)).size
    const sourceLayoutReferences: Array<{ path: string, line: number, excerpt: string }> = []
    const sourceFiles = await Array.fromAsync(new Bun.Glob('src/**/*.ts').scan({ cwd: PROJECT_ROOT, onlyFiles: true }))
    for (const path of sourceFiles) {
      const lines = (await readFile(resolve(PROJECT_ROOT, path), 'utf8')).split('\n')
      lines.forEach((line, index) => {
        if (line.includes('import.meta.dir')) sourceLayoutReferences.push({ path, line: index + 1, excerpt: line.trim().slice(0, 240) })
      })
    }
    await Bun.write(resolve(options.outputDir, 'bundle-inventory.json'), `${JSON.stringify({
      schemaVersion: 1,
      bunVersion: Bun.version,
      entrypoint: 'src/cli/create-cli.ts',
      largestModules,
      dynamicImports,
      runtimeAssets: {
        promptJson: {
          fileCount: promptStats.length,
          totalBytes: promptStats.reduce((sum, entry) => sum + entry.bytes, 0),
          files: promptStats.sort((left, right) => right.bytes - left.bytes)
        },
        referenceTokenizer: { path: relativePath(tokenizerPath), bytes: tokenizerBytes }
      },
      sourceLayoutReferences
    }, null, 2)}\n`)
  }

  const runBundleProfile = async (): Promise<void> => {
    await runBun('test-cli-bundle', [
      'build', 'src/cli/create-cli.ts', '--target=bun',
      `--outfile=${resolve(options.outputDir, 'test-cli.js')}`,
      `--metafile=${resolve(options.outputDir, 'test-cli.metafile.json')}`,
      `--metafile-md=${resolve(options.outputDir, 'test-cli.metafile.md')}`
    ])
    await buildBundleInventory()
  }

  const parseHeapBytes = async (path: string): Promise<number | null> => {
    const source = await readFile(path, 'utf8')
    const match = source.match(/Total Heap Size\s*\|[^\n]*\((\d+) bytes\)/)
    return match ? Number.parseInt(match[1] ?? '', 10) : null
  }

  const runTokenizerProfiles = async (): Promise<void> => {
    const states = ['before-load', 'after-load', 'after-eviction', 'after-reconstruction'] as const
    const observations: Array<Record<string, unknown> & { state: string, profileHeapBytes: number | null }> = []
    for (const state of states) {
      const profileName = `reference-tokenizer-${state}.heap.md`
      const result = await runBun(`reference-tokenizer-${state}`, [
        '--heap-prof-md', '--heap-prof-dir', options.outputDir, '--heap-prof-name', profileName,
        'scripts/profile-workloads/reference-tokenizer-memory.ts', state
      ])
      const observation = JSON.parse(result.stdout.trim()) as Record<string, unknown>
      observations.push({
        ...observation,
        state,
        profileHeapBytes: await parseHeapBytes(resolve(options.outputDir, profileName))
      })
    }
    await Bun.write(resolve(options.outputDir, 'reference-tokenizer-memory-summary.json'), `${JSON.stringify({
      schemaVersion: 1,
      bunVersion: Bun.version,
      fixture: 'synthetic-reference-tokenizer-v1',
      observations
    }, null, 2)}\n`)
  }

  await writeMetadata()
  try {
    if (options.recipe === 'cpu' || options.recipe === 'all') await runCpuProfiles()
    if (options.recipe === 'heap' || options.recipe === 'all') await runHeapProfile()
    if (options.recipe === 'bundle' || options.recipe === 'all') await runBundleProfile()
    if (options.recipe === 'tokenizer' || options.recipe === 'all') await runTokenizerProfiles()
    status = 'passed'
  } catch (error) {
    status = 'failed'
    throw error
  } finally {
    await writeMetadata()
    process.stdout.write(`Profiling ${status}: ${relativePath(options.outputDir)}/${basename(metadataPath)}\n`)
  }
}

await main()
