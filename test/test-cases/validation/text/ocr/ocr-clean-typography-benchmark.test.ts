import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCleanTypographySlotCommand, createCleanTypographyCliSnapshot } from '~/tools/ocr-clean-typography-benchmark'
import { PROJECT_ROOT } from '~/utils/project-root'
import { redDotPng } from '../../../../test-utils/media-fixtures'

test('budgeted OCR slot command is accepted by the native price-only parser without network dispatch or output writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-slot-price-'))
  try {
    const input = join(root, 'fixture.png')
    const output = join(root, 'must-not-be-created')
    await Bun.write(input, redDotPng)
    const argv = [...buildCleanTypographySlotCommand(input, 'openai', 'gpt-6-luna', output), '--price']
    const child = Bun.spawn(argv, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, AUTOSHOW_OCR_SPENDING_GUARD: undefined } })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(stderr.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    expect(code).toBe(0)
    const result = stdout.trim().split('\n').map(line => JSON.parse(line)).find(row => row.type === 'result')
    expect(result.data.dryRun).toBe(true)
    expect(result.data.estimate.steps).toHaveLength(1)
    expect(result.data.estimate.steps[0]).toMatchObject({ provider: 'openai', model: 'gpt-6-luna' })
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a frozen CLI snapshot accepts the guarded OCR command and matches native price-only provider selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-frozen-cli-'))
  try {
    const input = join(root, 'fixture.png'), output = join(root, 'must-not-be-created')
    await Bun.write(input, redDotPng)
    const snapshot = await createCleanTypographyCliSnapshot()
    expect(new Bun.CryptoHasher('sha256').update(await Bun.file(snapshot.path).arrayBuffer()).digest('hex')).toBe(snapshot.sha256)
    const child = Bun.spawn([...buildCleanTypographySlotCommand(input, 'openai', 'gpt-6-luna', output, snapshot.path), '--price'], {
      stdout: 'pipe', stderr: 'pipe', env: { ...process.env, AUTOSHOW_PROJECT_ROOT: PROJECT_ROOT, AUTOSHOW_OCR_SPENDING_GUARD: undefined }
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code).toBe(0)
    expect(stderr.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(row => row.level === 'error')).toEqual([])
    const result = stdout.trim().split('\n').map(line => JSON.parse(line)).find(row => row.type === 'result')
    expect(result.data.dryRun).toBe(true)
    expect(result.data.estimate.steps.map((row: { provider: string, model: string }) => [row.provider, row.model])).toEqual([['openai', 'gpt-6-luna']])
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
