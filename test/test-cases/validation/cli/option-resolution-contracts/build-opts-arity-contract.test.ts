import { expect, test } from 'bun:test'
import * as ts from 'typescript'

test('buildOptsFromFlags has no obsolete double-dash argument calls', async () => {
  const violations: string[] = []

  for (const root of ['src', 'test']) {
    for await (const relativePath of new Bun.Glob('**/*.ts').scan(root)) {
      const path = `${root}/${relativePath}`
      const source = await Bun.file(path).text()
      if (!source.includes('buildOptsFromFlags')) continue
      const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && node.expression.text === 'buildOptsFromFlags'
          && (
            node.arguments.length > 5
            || (node.arguments[2] !== undefined && ts.isArrayLiteralExpression(node.arguments[2]))
          )
        ) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          violations.push(`${path}:${line + 1}`)
        }
        ts.forEachChild(node, visit)
      }

      visit(sourceFile)
    }
  }

  expect(violations).toEqual([])
})
