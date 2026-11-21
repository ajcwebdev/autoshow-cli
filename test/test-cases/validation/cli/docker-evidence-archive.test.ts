import { expect, test } from 'bun:test'

const uploadPaths = (source: string, artifactName: string): string[] => {
  const start = source.indexOf(`name: ${artifactName}\n`)
  if (start < 0) throw new Error(`Missing artifact ${artifactName}`)
  const block = source.slice(start).split(/\n      - /)[0]!
  const match = block.match(/\n          path: \|\n((?:            .+\n)+)/)
  if (!match?.[1]) throw new Error(`Missing artifact path list ${artifactName}`)
  return match[1].trim().split('\n').map(line => line.trim())
}

const selectedByUpload = (paths: string[], path: string): boolean => {
  const matches = (pattern: string): boolean => pattern.includes('*')
    ? new Bun.Glob(pattern).match(path)
    : path === pattern || path.startsWith(`${pattern}/`)
  return paths.some(pattern => !pattern.startsWith('!') && matches(pattern)) &&
    !paths.some(pattern => pattern.startsWith('!') && matches(pattern.slice(1)))
}

test('artifact selection retains archives and logs while excluding only the raw authored cache', async () => {
  const dependency = await Bun.file('.github/workflows/dependency-graphs.yml').text()
  const release = await Bun.file('.github/workflows/docker-publish.yml').text()
  const targets = [
    { paths: uploadPaths(dependency, 'current-image-${{ matrix.target }}-${{ matrix.platform.arch }}-${{ github.sha }}'), root: 'runtime/dependency-evidence' },
    ...['amd64', 'arm64'].map(arch => ({ paths: uploadPaths(release, `docker-audit-${arch}`), root: `runtime/ci/docker-${arch}` }))
  ]
  for (const { paths, root } of targets) {
    for (const retained of ['image.spdx.json', 'image-advisories.json', 'runtime-state/default/result.json', 'runtime-state/host/commands.log', 'runtime-state/authored-cache.evidence.tar.gz', 'runtime-state/authored-cache.evidence.tar.gz.sha256']) {
      expect(selectedByUpload(paths, `${root}/${retained}`)).toBe(true)
    }
    for (const raw of ['default/runtime/private.bin', 'host/runtime/var/lib/dpkg/info/gcc-14-base:amd64.list']) {
      expect(selectedByUpload(paths, `${root}/runtime-state/authored-cache/${raw}`)).toBe(false)
    }
    expect(paths.filter(path => path.startsWith('!'))).toEqual([`!${root}/runtime-state/authored-cache/**`])
  }
  for (const arch of ['amd64', 'arm64']) expect(selectedByUpload(uploadPaths(release, `docker-audit-${arch}`), `docs/reports/release-evidence/${arch}/advisory-triage.json`)).toBe(true)
})
