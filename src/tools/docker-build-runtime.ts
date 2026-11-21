/** Build-time import of the image's pinned distribution packages. Never runs on normal CLI startup. */
import { chmod, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stageInstalledLinuxToolchain } from '../cli/commands/setup-and-utilities/setup/setup-download/managed-linux-tools'
import { recordManagedJsRuntimeImageSource } from '../cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime'
import { writeDockerRuntimeSeedManifest } from './docker-runtime-seed'
import { ensureProjectRuntimeDependencies } from './project-runtime-dependencies'

const root = '/opt/autoshow-runtime'
await stageInstalledLinuxToolchain(root, {
  catalogPrefix: '/app/runtime/tools/linux-root',
  additionalCatalogPrefixes: ['/opt/autoshow-runtime/tools/linux-root']
})
await mkdir(join(root, 'tools/bun/bin'), { recursive: true })
await copyFile(process.execPath, join(root, 'tools/bun/bin/bun'))
await chmod(join(root, 'tools/bun/bin/bun'), 0o755)
await recordManagedJsRuntimeImageSource('bun', process.env['BUN_IMAGE_SOURCE'] ?? '', { runtimeRoot: root })
await recordManagedJsRuntimeImageSource('deno', process.env['DENO_IMAGE_SOURCE'] ?? '', { runtimeRoot: root })
await writeFile(join(root, 'bin/yt-dlp'), `#!/bin/sh
runtime_root=$(CDPATH= cd "$(dirname "$0")/.." && pwd) || exit 1
exec "$runtime_root/bin/python3" "$runtime_root/tools/yt-dlp/yt-dlp" --js-runtimes "deno:$runtime_root/bin/deno" "$@"
`)
await chmod(join(root, 'bin/yt-dlp'), 0o755)
await ensureProjectRuntimeDependencies({ projectRoot: '/app', runtimeRoot: '/app/runtime', storageRuntimeRoot: root, production: true })
// The distribution receipt contains package integrity metadata, and must be
// readable by the unprivileged user that activates a fresh runtime volume.
await chmod(join(root, 'tools/project-dependencies/project-dependencies.json'), 0o644)
// Build-time probe caches are not part of the immutable distribution.
for (const name of ['cache', 'tmp', 'state']) await rm(join(root, name), { recursive: true, force: true })
await writeDockerRuntimeSeedManifest(root)
