import { chmod, copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import manifest from '../../package.json'
import { SOURCE_ROOT } from '../utils/project-root'
import { InternalError, ValidationError } from '../utils/error-handler'

const models = 'src/cli/commands/setup-and-utilities/models'
const worker = 'src/cli/commands/stt/workflows/timing/stt-onnx-worker.ts'
const cookieGuide = 'docs/commands/00-setup-and-utilities/cookies.md'

const buildPackage = async (destination: string): Promise<void> => {
  // Reserve a fresh directory before writing. Never replace another build or a user's files.
  await mkdir(destination)
  try {
    const files = ['autoshow.js', 'stt-onnx-worker.js', 'README.md', cookieGuide]
    for (const [entrypoint, filename] of [
      ['src/cli/create-cli.ts', 'autoshow.js'],
      [worker, 'stt-onnx-worker.js'],
    ] as const) {
      const result = await Bun.build({
        entrypoints: [join(SOURCE_ROOT, entrypoint)],
        target: 'bun',
        format: 'esm',
        define: { __AUTOSHOW_INSTALLED_CLI__: 'true' },
        ...(filename === 'autoshow.js' ? { banner: '#!/usr/bin/env bun' } : {}),
      })
      if (!result.success || result.outputs.length !== 1) throw InternalError(`Unable to bundle ${entrypoint}: ${result.logs.join('\n')}`, { stage: 'build:package' })
      await Bun.write(join(destination, filename), result.outputs[0]!)
    }
    await chmod(join(destination, 'autoshow.js'), 0o755)

    const copy = async (from: string, to = from): Promise<void> => {
      const source = join(SOURCE_ROOT, from)
      if (!(await lstat(source)).isFile()) throw ValidationError(`Expected regular package input: ${from}`, { stage: 'build:package' })
      await mkdir(dirname(join(destination, to)), { recursive: true })
      await copyFile(source, join(destination, to))
      files.push(to)
    }
    for (const group of [
      `${models}/llm-config.json`, `${models}/image-config.json`,
      `${models}/video-config.json`, `${models}/music-config.json`,
      `${models}/stt-config/*.json`, `${models}/ocr-config/*.json`, `${models}/tts-config/*.json`,
      'src/prompts/entries/**/*.json',
      'src/tools/o200k-base-ranks.tiktoken.gz',
      'src/cli/commands/visuals/comic/comic-prompts/prompts.json',
    ]) {
      const paths = [...new Bun.Glob(group).scanSync({ cwd: SOURCE_ROOT })].sort()
      if (!paths.length) throw ValidationError(`Missing package input: ${group}`, { stage: 'build:package' })
      for (const path of paths) await copy(path)
    }
    for (const tool of ['defuddle', 'stt-alignment']) {
      for (const name of ['package.json', 'bun.lock', 'bunfig.toml']) await copy(`config/${tool}/${name}`)
    }
    for (const name of Object.keys(manifest.dependencies)) {
      await copy(`node_modules/${name}/LICENSE.md`, `licenses/${name}/LICENSE.md`)
    }

    await mkdir(dirname(join(destination, cookieGuide)), { recursive: true })
    const guide = await readFile(join(SOURCE_ROOT, cookieGuide), 'utf8')
    await writeFile(join(destination, cookieGuide), guide
      .replaceAll('bun autoshow ', 'autoshow ')
      .replace('[yt-dlp passthrough](../01-sources/download/overview.md#yt-dlp-passthrough)', '`autoshow help download`'))
    const bunVersion = manifest.packageManager.slice('bun@'.length)
    await writeFile(join(destination, 'README.md'), `# AutoShow CLI

Install Bun ${bunVersion} and put its executable on your PATH. After installing this package, run \`autoshow\` in your working directory.

\`\`\`sh
autoshow --version
autoshow help
autoshow setup --dry-run
autoshow setup --doctor
\`\`\`

Setup previews list the planned changes. Doctor checks local readiness. Run \`autoshow setup\` to provision tools and download dependencies for this workspace. AutoShow stores managed tools, configuration, and caches under the workspace's \`runtime/\` directory. Return to the same workspace to reuse them.

The [YouTube cookies guide](${cookieGuide}) explains authenticated downloads.
`)
    await writeFile(join(destination, 'package.json'), JSON.stringify({
      name: manifest.name,
      private: true,
      version: manifest.version,
      type: 'module',
      author: manifest.author,
      license: manifest.license,
      bin: { autoshow: 'autoshow.js' },
      engines: { bun: bunVersion },
      files: files.sort(),
    }, null, 2) + '\n')
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  const usage = 'Usage: bun run build:package <new-directory>'
  if (args.length === 1 && args[0] === '--help') console.log(usage)
  else if (args.length !== 1 || !args[0] || args[0].startsWith('-')) {
    console.error(usage)
    process.exitCode = 2
  } else {
    const destination = resolve(args[0])
    await buildPackage(destination)
    console.log(`Built ${manifest.name}@${manifest.version} in ${destination}`)
  }
}
