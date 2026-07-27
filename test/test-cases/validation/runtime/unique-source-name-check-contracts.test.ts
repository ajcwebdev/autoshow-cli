import { describe, expect, test } from 'bun:test'
import { findSourceNameViolations, formatSourceNameViolations } from '~/tools/unique-source-name-check'

describe('source name invariant checker', () => {
  test('reports case-folded file basename collisions', () => {
    const violations = findSourceNameViolations([
      'src/alpha/Foo.ts',
      'src/beta/foo.ts',
      'src/gamma/bar.ts'
    ])

    expect(violations).toEqual([
      {
        kind: 'file',
        name: 'foo.ts',
        paths: ['src/alpha/Foo.ts', 'src/beta/foo.ts']
      }
    ])
  })

  test('reports case-folded directory basename collisions', () => {
    const violations = findSourceNameViolations([
      'src/alpha/shared/a.ts',
      'src/beta/Shared/b.ts'
    ])

    expect(violations).toEqual([
      {
        kind: 'directory',
        name: 'shared',
        paths: ['src/alpha/shared', 'src/beta/Shared']
      }
    ])
  })

  test('allows only the retained types index file', () => {
    expect(findSourceNameViolations([
      'src/types/index.ts',
      'src/cli/create-cli.ts'
    ])).toEqual([])

    const violations = findSourceNameViolations([
      'src/cli/index.ts'
    ])

    expect(violations).toEqual([
      {
        kind: 'index',
        name: 'index.ts',
        paths: ['src/cli/index.ts']
      }
    ])
  })

  test('formats grouped violation reports', () => {
    const output = formatSourceNameViolations(findSourceNameViolations([
      'src/alpha/shared/Foo.ts',
      'src/beta/Shared/foo.ts',
      'src/cli/index.ts'
    ]))

    expect(output).toContain('Duplicate file basename: foo.ts')
    expect(output).toContain('Duplicate directory basename: shared')
    expect(output).toContain('Disallowed index.ts file')
    expect(output).toContain('  - src/beta/Shared/foo.ts')
  })
})
