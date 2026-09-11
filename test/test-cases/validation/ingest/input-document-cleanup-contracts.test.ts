import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { withTemporaryDirectDocument } from '~/cli/commands/sources/download/download-targets/single/temporary-direct-document'



describe('input classification contracts', () => {

  test('temporary direct-document cleanup runs after successful handling', async () => {
    const events: string[] = []
    const result = await withTemporaryDirectDocument(
      'https://example.com/report.pdf',
      async (filePath) => {
        events.push(`handle:${filePath}`)
        return 'complete'
      },
      async () => ({
        filePath: 'document.pdf',
        cleanup: async () => {
          events.push('cleanup')
        }
      })
    )

    expect(result).toBe('complete')
    expect(events).toEqual(['handle:document.pdf', 'cleanup'])
  })

  test('temporary direct-document cleanup runs after handler failure', async () => {
    const events: string[] = []
    const run = withTemporaryDirectDocument(
      'https://example.com/report.pdf',
      async () => {
        events.push('handle')
        throw new Error('handler failed')
      },
      async () => ({
        filePath: 'document.pdf',
        cleanup: async () => {
          events.push('cleanup')
        }
      })
    )

    await expect(run).rejects.toThrow('handler failed')
    expect(events).toEqual(['handle', 'cleanup'])
  })

  test('single-target coordinator and cleanup boundary remain explicit in the AST', () => {
    const declarations = (path: string): Map<string, ts.Expression> => {
      const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const found = new Map<string, ts.Expression>()
      const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          found.set(node.name.text, node.initializer)
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      return found
    }

    const runner = declarations(resolve(
      process.cwd(),
      'src/cli/commands/sources/download/download-targets/single/single-target-runner.ts'
    ))
    const coordinator = runner.get('processSingleTarget')
    expect(coordinator).toBeDefined()
    const coordinatorText = coordinator?.getText() ?? ''
    expect(coordinatorText.match(/normalizeSingleTargetIntent\(/g)).toHaveLength(1)
    expect(coordinatorText.match(/classifySingleTargetInput\(/g)).toHaveLength(1)
    for (const handler of ['handleMetadataRoute', 'handleDownloadRoute', 'handleExtractRoute']) {
      expect(coordinatorText).toContain(`${handler}(`)
    }

    const cleanupDeclarations = declarations(resolve(
      process.cwd(),
      'src/cli/commands/sources/download/download-targets/single/temporary-direct-document.ts'
    ))
    const cleanupBoundary = cleanupDeclarations.get('withTemporaryDirectDocument')
    expect(cleanupBoundary).toBeDefined()
    let tryStatements = 0
    let finallyBlocks = 0
    if (cleanupBoundary) {
      const visit = (node: ts.Node): void => {
        if (ts.isTryStatement(node)) {
          tryStatements += 1
          if (node.finallyBlock) finallyBlocks += 1
        }
        ts.forEachChild(node, visit)
      }
      visit(cleanupBoundary)
    }
    expect(tryStatements).toBe(1)
    expect(finallyBlocks).toBe(1)
  })
})
