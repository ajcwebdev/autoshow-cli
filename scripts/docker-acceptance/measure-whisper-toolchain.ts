import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { IMAGE_REPOSITORY, REQUESTED_IMAGE } from './docker-options'
import { runDockerProcess } from './docker-process'

// Separate packaging experiment, never called by t:docker. No acceptance case uses these images.
export function whisperToolchainLayer(dockerfile: string): string {
  const match = dockerfile.match(/RUN apt-get update \\\n    && apt-get install -y --no-install-recommends cmake make gcc g\+\+ libc6-dev \\\n    && rm -rf \/var\/lib\/apt\/lists\/\*/)
  assert(match, 'Missing isolated Whisper toolchain layer in Dockerfile')
  return match[0]
}

if (import.meta.main) {
  const root = resolve('runtime/docker-acceptance/size', new Date().toISOString().replaceAll(':', '-'))
  await mkdir(root, { recursive: true })
  let sequence = 0
  async function command(args: string[], timeoutMs = 120_000, onTimeout?: () => Promise<void>): Promise<string> {
    const prefix = join(root, `command-${++sequence}`)
    await Bun.write(`${prefix}.command.json`, `${JSON.stringify({ argv: ['docker', ...args], timeoutMs }, null, 2)}\n`)
    const result = await runDockerProcess(args, timeoutMs, prefix, onTimeout)
    await Bun.write(`${prefix}.result.json`, `${JSON.stringify(result, null, 2)}\n`)
    assert(!result.timedOut && result.exitCode === 0, `Measurement command failed: ${JSON.stringify(args)}\n${result.stderr.slice(-4000)}`)
    return result.stdout.trim()
  }
  const digest = await command(['buildx', 'imagetools', 'inspect', '--format', '{{.Manifest.Digest}}', REQUESTED_IMAGE])
  assert(/^sha256:[a-f0-9]{64}$/.test(digest))
  const reference = `${IMAGE_REPOSITORY}@${digest}`
  const layer = whisperToolchainLayer(await Bun.file(resolve(import.meta.dir, '../../Dockerfile')).text())
  const results = []
  for (const architecture of ['arm64', 'amd64']) {
    const platform = `linux/${architecture}`
    const directory = join(root, architecture)
    await mkdir(directory)
    await command(['pull', '--platform', platform, reference], 1800_000)
    const before = Number(await command(['image', 'inspect', '--platform', platform, reference, '--format', '{{.Size}}']))
    const tag = `autoshow-toolchain-measure:${architecture}-${crypto.randomUUID()}`
    await Bun.write(join(directory, 'Dockerfile'), `FROM ${reference}\nUSER root\n${layer}\nUSER bun\n`)
    console.log(`Measuring ${platform}; base ${reference}`)
    await command(['build', '--platform', platform, '--tag', tag, directory], 1800_000)
    const after = Number(await command(['image', 'inspect', '--platform', platform, tag, '--format', '{{.Size}}']))
    // Containerd can report zero history bytes for a layer until it is unpacked.
    const name = `autoshow-size-${crypto.randomUUID()}`
    const removeOwned = async (): Promise<void> => { await runDockerProcess(['rm', '--force', name], 20_000, join(directory, 'unpack-cleanup')) }
    try {
      await command(['run', '--rm', '--name', name, '--platform', platform, '--network', 'none', '--entrypoint', '/bin/true', tag], 120_000, removeOwned)
    } finally { await removeOwned() }
    const history = await command(['history', '--platform', platform, '--no-trunc', '--human=false', '--format', '{{json .}}', tag])
    await Bun.write(join(directory, 'history.jsonl'), `${history}\n`)
    const measurement = { platform, base: reference, measuredImage: tag, beforeBytes: before, afterBytes: after, increaseBytes: after - before, method: 'Derived image containing only the production Whisper prerequisite layer; local Docker daemon (AMD64 may be emulated)' }
    results.push(measurement)
    await Bun.write(join(root, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`)
    console.log(JSON.stringify(measurement))
  }
  console.log(`Size evidence: ${root}`)
}
