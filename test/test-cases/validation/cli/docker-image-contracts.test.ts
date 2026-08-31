import { expect, test } from 'bun:test'
import { readFile,readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const dockerfilePath = resolve(repositoryRoot, 'Dockerfile')
const dockerDocsPath = resolve(repositoryRoot, 'docs/docker.md')
const scriptsPath = resolve(repositoryRoot, 'scripts')

test('Docker yt-dlp pin matches resolved native setup metadata in both directions', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const dockerArgs = Object.fromEntries(
    [...dockerfile.matchAll(/^ARG (YT_DLP_[A-Z0-9_]+)=(\S+)$/gm)]
      .map(([, name, value]) => [name, value])
  )
  const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp', 'linux')
  const expectedArgs = {
    YT_DLP_URL: url,
    YT_DLP_SHA256: sha256
  }

  expect({
    missing: Object.keys(expectedArgs).filter(name => !(name in dockerArgs)),
    extra: Object.keys(dockerArgs).filter(name => !(name in expectedArgs))
  }).toEqual({ missing: [], extra: [] })
  expect(dockerArgs).toEqual(expectedArgs)

  const downloadIndex = dockerfile.indexOf("const response = await fetch(url)")
  const checksumIndex = dockerfile.indexOf('"${YT_DLP_SHA256}" /usr/local/bin/yt-dlp | sha256sum -c -')
  const chmodIndex = dockerfile.indexOf('chmod 0755 /usr/local/bin/yt-dlp')

  expect(downloadIndex).toBeGreaterThan(-1)
  expect(checksumIndex).toBeGreaterThan(downloadIndex)
  expect(chmodIndex).toBeGreaterThan(checksumIndex)

  const fetchStage = dockerfile.slice(dockerfile.indexOf('AS fetch'), dockerfile.indexOf('AS runtime'))
  const runtimeStage = dockerfile.slice(dockerfile.indexOf('AS runtime'))
  expect(fetchStage).toContain('for await (const chunk of response.body) writer.write(chunk)')
  expect(fetchStage).not.toContain('curl')
  expect(runtimeStage).not.toContain('curl')
  expect(runtimeStage).toContain('COPY --from=fetch /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp')
})

test('Docker documentation exposes only the native CLI and direct image invocation', async () => {
  const dockerDocs = await readFile(dockerDocsPath, 'utf8')

  expect(existsSync(scriptsPath) ? await readdir(scriptsPath) : []).toEqual([])
  expect(dockerDocs).toContain('bun autoshow extract content/book/book.epub')
  expect(dockerDocs).toContain('docker run --rm -i')
})

test('Docker images carry immutable build identity and publish provenance plus SBOM attestations', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')

  expect(dockerfile).toContain('ARG AUTOSHOW_VERSION=')
  expect(dockerfile).toContain('ARG BUILD_DATE=')
  expect(dockerfile).toContain('ARG VCS_REF=')
  expect(dockerfile).toContain('org.opencontainers.image.revision="${VCS_REF}"')
  expect(dockerfile).toContain('org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"')
  expect(workflow.match(/--provenance=mode=max/g)).toHaveLength(2)
  expect(workflow.match(/--sbom=true/g)).toHaveLength(2)
  expect(workflow.match(/--build-arg "VCS_REF=\$\{GITHUB_SHA\}"/g)).toHaveLength(2)
})
