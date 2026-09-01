import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseJsonlBytes } from '~/utils/jsonl-reader'
import { readMetrics } from '../../../test-runner/parsers'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-jsonl-reader-' })
const encode = (value: string): Uint8Array => new TextEncoder().encode(value)

describe('Bun.JSONL crash-torn readers', () => {
  test('parses BOM-prefixed records across arbitrary byte assembly boundaries', () => {
    const chunks = [
      new Uint8Array([0xef]),
      new Uint8Array([0xbb, 0xbf, 0x7b, 0x22]),
      encode('id":1}\n{"id":2}\n')
    ]
    const bytes = Buffer.concat(chunks)
    expect(parseJsonlBytes(bytes, { allowTornFinalRecord: true, label: 'Fixture' })).toEqual([{ id: 1 }, { id: 2 }])
  })

  test('ignores only structurally torn final records, including torn UTF-8', () => {
    expect(parseJsonlBytes(encode('{"id":1}\n{"id":'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toEqual([{ id: 1 }])
    expect(parseJsonlBytes(new Uint8Array([
      ...encode('{"id":1}\n{"text":"'),
      0xe2,
      0x82
    ]), { allowTornFinalRecord: true, label: 'Fixture' })).toEqual([{ id: 1 }])
    expect(parseJsonlBytes(encode('{"id":1}\n{"value": tru'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toEqual([{ id: 1 }])
  })

  test('rejects malformed complete records and balanced malformed suffixes', () => {
    expect(() => parseJsonlBytes(encode('{"id":1}\nnot-json\n'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toThrow('malformed complete JSONL record')
    expect(() => parseJsonlBytes(encode('{"id":1}\n{"id":}'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toThrow('malformed complete JSONL record')
    expect(() => parseJsonlBytes(encode('{"id":1}\n{"id": xyz'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toThrow('malformed complete JSONL record')
    expect(() => parseJsonlBytes(encode('{"id":1} garbage {'), {
      allowTornFinalRecord: true,
      label: 'Fixture'
    })).toThrow('malformed complete JSONL record')
  })

  test('test metrics reader accepts a torn suffix but rejects a complete malformed line', async () => {
    const directory = await tempDirs.make()
    const path = join(directory, 'metrics.ndjson')
    const metric = { source: 'fixture', command: 'bun', args: [], exitCode: 0, durationMs: 1 }
    await writeFile(path, `${JSON.stringify(metric)}\n{"source":`)
    expect(await readMetrics(path)).toHaveLength(1)
    await writeFile(path, `${JSON.stringify(metric)}\nmalformed\n`)
    await expect(readMetrics(path)).rejects.toThrow('malformed complete JSONL record')
  })
})
