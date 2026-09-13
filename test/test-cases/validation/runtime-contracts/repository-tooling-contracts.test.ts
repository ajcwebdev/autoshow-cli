import { expect, test } from 'bun:test'
import { findRepositoryStructureViolations } from '~/tools/repository-structure-check'
import { triageImageAdvisories } from '~/tools/triage-image-advisories'

test('repository structure rejects new root directories and Python sources while allowing nested tools', () => {
  expect(findRepositoryStructureViolations(['src', 'test', 'docs', 'config'], ['src/tools/example.ts', 'test/docker-acceptance/example.ts'])).toEqual([])
  const violations = findRepositoryStructureViolations(['src', 'scripts', 'another-root'], ['src/nested/tool.py', 'test/check.PY'])
  expect(violations).toHaveLength(4)
  expect(violations.join('\n')).toContain('scripts/')
  expect(violations.join('\n')).toContain('another-root/')
  expect(violations.join('\n')).toContain('src/nested/tool.py')
})

test('advisory triage retains duplicate match counts, distinct binaries, fixes and exact scan provenance', () => {
  const first = { vulnerability: { id: 'CVE-TEST-2', severity: 'High', dataSource: 'https://example.invalid/advisory' }, artifact: { name: 'libavcodec', version: '1' }, matchDetails: [{ searchedBy: { package: { name: 'ffmpeg' } } }] }
  const matches = [first, first, { ...first, artifact: { name: 'libavformat', version: '1' } }, { ...first, vulnerability: { ...first.vulnerability, id: 'CVE-TEST-1', severity: 'Critical', fix: { versions: ['2'] } }, artifact: { name: 'curl', version: '1' }, matchDetails: [] }, { ...first, vulnerability: { ...first.vulnerability, severity: 'Low' } }]
  const scan = Buffer.from(JSON.stringify({ matches }, null, 2) + '\n')
  const result = triageImageAdvisories(scan, { Id: 'sha256:fixture', RepoDigests: ['fixture@sha256:fixture'], Architecture: 'arm64' })
  expect(result).toMatchObject({ matchCount: 4, advisorySourceGroupCount: 2, imageConfigDigest: 'sha256:fixture', architecture: 'arm64', scanSha256: new Bun.CryptoHasher('sha256').update(scan).digest('hex') })
  expect(result.groups.map(group => [group.advisory, group.sourcePackage, group.disposition, group.matches, group.binaries.length])).toEqual([
    ['CVE-TEST-1', 'curl', 'remediate-before-release', 1, 1],
    ['CVE-TEST-2', 'ffmpeg', 'open-no-fix', 3, 2]
  ])
})

test('advisory CLI rejects report output outside docs/reports before reading evidence', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/triage-image-advisories.ts', '/missing-evidence', '/tmp/forbidden-triage.json'], { stdout: 'pipe', stderr: 'pipe' })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(code).not.toBe(0)
  expect(stderr).toContain('Report artifacts must be stored under docs/reports/')
})
