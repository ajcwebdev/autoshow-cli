import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import ts from 'typescript'
import type { AnalysisScope, CallableMetric, FileMetric, ScopeAnalysis } from '~/types'

const EXECUTABLE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx'
])

const BINARY_EXTENSIONS = new Set([
  '.aac',
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.pdf',
  '.png',
  '.wav',
  '.webm',
  '.webp'
])

const BINARY_COMPLEXITY_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken
])

const GROUPING_PUNCTUATION = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.OpenBraceToken,
  ts.SyntaxKind.CloseBraceToken,
  ts.SyntaxKind.OpenParenToken,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.OpenBracketToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.CommaToken
])

const normalizePath = (filePath: string): string => filePath.replace(/\\/g, '/')

const physicalLineCount = (source: string): number => {
  let lines = 0
  for (const character of source) {
    if (character === '\n') lines += 1
  }
  return lines
}

const comparePaths = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0

const listRepositoryFiles = (scope: AnalysisScope): string[] =>
  [...new Set(
    execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', scope],
      { encoding: 'utf8' }
    )
      .split('\0')
      .filter(Boolean)
      .map(normalizePath)
  )]
    .filter((filePath) => {
      try {
        return statSync(filePath).isFile()
      } catch {
        return false
      }
    })
    .sort(comparePaths)

const scriptKindForPath = (filePath: string): ts.ScriptKind => {
  switch (extname(filePath)) {
    case '.js':
    case '.cjs':
    case '.mjs':
      return ts.ScriptKind.JS
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.json':
      return ts.ScriptKind.JSON
    default:
      return ts.ScriptKind.TS
  }
}

const isCallable = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node)
  || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node)
  || ts.isMethodDeclaration(node)
  || ts.isConstructorDeclaration(node)
  || ts.isGetAccessorDeclaration(node)
  || ts.isSetAccessorDeclaration(node)

const propertyNameText = (name: ts.PropertyName | ts.BindingName | undefined, sourceFile: ts.SourceFile): string | undefined => {
  if (!name) return undefined
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return name.getText(sourceFile)
}

const literalTitle = (node: ts.Expression | undefined): string | undefined => {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return undefined
}

const callableName = (node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string => {
  if ('name' in node) {
    const ownName = propertyNameText(node.name, sourceFile)
    if (ownName) return ts.isConstructorDeclaration(node) ? 'constructor' : `${ownName}()`
  }

  const parent = node.parent
  if (ts.isVariableDeclaration(parent)) {
    const name = propertyNameText(parent.name, sourceFile)
    if (name) return `${name}()`
  }
  if (ts.isPropertyAssignment(parent)) {
    const name = propertyNameText(parent.name, sourceFile)
    if (name) return `${name}()`
  }
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression.getText(sourceFile)
    const title = literalTitle(parent.arguments[0])
    return title ? `${callee}(${JSON.stringify(title)}) callback` : `${callee}() callback`
  }
  return '<anonymous> callback'
}

const cyclomaticComplexity = (callable: ts.FunctionLikeDeclaration): number => {
  let complexity = 1

  const visit = (node: ts.Node): void => {
    if (node !== callable && isCallable(node)) return

    if (
      ts.isIfStatement(node)
      || ts.isForStatement(node)
      || ts.isForInStatement(node)
      || ts.isForOfStatement(node)
      || ts.isWhileStatement(node)
      || ts.isDoStatement(node)
      || ts.isCaseClause(node)
      || ts.isCatchClause(node)
      || ts.isConditionalExpression(node)
    ) {
      complexity += 1
    } else if (ts.isBinaryExpression(node) && BINARY_COMPLEXITY_OPERATORS.has(node.operatorToken.kind)) {
      complexity += 1
    }

    ts.forEachChild(node, visit)
  }

  if (callable.body) visit(callable.body)
  return complexity
}

const logicalRunIncrement = (node: ts.BinaryExpression): number => {
  const operator = node.operatorToken.kind
  if (!BINARY_COMPLEXITY_OPERATORS.has(operator)) return 0
  const parent = node.parent
  return ts.isBinaryExpression(parent) && parent.operatorToken.kind === operator ? 0 : 1
}

const cognitiveComplexity = (callable: ts.FunctionLikeDeclaration): number => {
  let complexity = 0

  const visit = (node: ts.Node, nesting: number, elseIf = false): void => {
    if (node !== callable && isCallable(node)) return

    if (ts.isIfStatement(node)) {
      complexity += 1 + (elseIf ? 0 : nesting)
      visit(node.expression, nesting)
      visit(node.thenStatement, nesting + 1)
      if (node.elseStatement) {
        if (ts.isIfStatement(node.elseStatement)) {
          visit(node.elseStatement, nesting, true)
        } else {
          complexity += 1
          visit(node.elseStatement, nesting + 1)
        }
      }
      return
    }

    if (
      ts.isForStatement(node)
      || ts.isForInStatement(node)
      || ts.isForOfStatement(node)
      || ts.isWhileStatement(node)
      || ts.isDoStatement(node)
    ) {
      complexity += 1 + nesting
      ts.forEachChild(node, (child) => visit(child, child === node.statement ? nesting + 1 : nesting))
      return
    }

    if (ts.isSwitchStatement(node)) {
      complexity += 1 + nesting
      visit(node.expression, nesting)
      visit(node.caseBlock, nesting + 1)
      return
    }

    if (ts.isCatchClause(node)) {
      complexity += 1 + nesting
      ts.forEachChild(node, (child) => visit(child, child === node.block ? nesting + 1 : nesting))
      return
    }

    if (ts.isConditionalExpression(node)) {
      complexity += 1 + nesting
      ts.forEachChild(node, (child) => visit(child, nesting + 1))
      return
    }

    if (ts.isBinaryExpression(node)) {
      complexity += logicalRunIncrement(node)
    }

    ts.forEachChild(node, (child) => visit(child, nesting))
  }

  if (callable.body) visit(callable.body, 0)
  return complexity
}

const isOperandToken = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.Identifier
  || kind === ts.SyntaxKind.PrivateIdentifier
  || (kind >= ts.SyntaxKind.FirstLiteralToken && kind <= ts.SyntaxKind.LastLiteralToken)
  || (kind >= ts.SyntaxKind.FirstTemplateToken && kind <= ts.SyntaxKind.LastTemplateToken)

const isOperatorToken = (kind: ts.SyntaxKind): boolean =>
  (kind >= ts.SyntaxKind.FirstKeyword && kind <= ts.SyntaxKind.LastKeyword)
  || (
    kind >= ts.SyntaxKind.FirstPunctuation
    && kind <= ts.SyntaxKind.LastPunctuation
    && !GROUPING_PUNCTUATION.has(kind)
  )

const halsteadVolume = (source: string, scriptKind: ts.ScriptKind): number => {
  const languageVariant = scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, languageVariant, source)
  const operators = new Set<string>()
  const operands = new Set<string>()
  let operatorCount = 0
  let operandCount = 0

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const text = scanner.getTokenText()
    if (isOperandToken(token)) {
      operands.add(text)
      operandCount += 1
    } else if (isOperatorToken(token)) {
      operators.add(text)
      operatorCount += 1
    }
  }

  const vocabulary = operators.size + operands.size
  const length = operatorCount + operandCount
  return vocabulary === 0 ? 0 : length * Math.log2(vocabulary)
}

const maintainabilityIndex = (volume: number, cyclomatic: number, loc: number): number => {
  if (loc <= 0) return 100
  const safeVolume = Math.max(volume, 1)
  return Math.max(
    0,
    (171 - 5.2 * Math.log(safeVolume) - 0.23 * cyclomatic - 16.2 * Math.log(loc)) * 100 / 171
  )
}

const round = (value: number, digits = 1): number => Number(value.toFixed(digits))

const comparePathLine = (left: CallableMetric, right: CallableMetric): number =>
  left.path.localeCompare(right.path) || left.line - right.line

const rankDescending = (
  metrics: CallableMetric[],
  select: (metric: CallableMetric) => number
): CallableMetric[] =>
  [...metrics].sort((left, right) => select(right) - select(left) || comparePathLine(left, right)).slice(0, 5)

const analyzeExecutableFile = (filePath: string, source: string): {
  callables: CallableMetric[]
  parseDiagnostics: number
} => {
  const scriptKind = scriptKindForPath(filePath)
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const callables: CallableMetric[] = []

  const visit = (node: ts.Node): void => {
    if (isCallable(node) && node.body) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1
      const loc = end - start + 1
      const cyclomatic = cyclomaticComplexity(node)
      const cognitive = cognitiveComplexity(node)
      const volume = halsteadVolume(node.getText(sourceFile), scriptKind)
      callables.push({
        path: filePath,
        line: start,
        endLine: end,
        loc,
        name: callableName(node, sourceFile),
        cyclomatic,
        cognitive,
        cognitiveSeverity: Math.min(10, Math.max(1, Math.round(cognitive / 9))),
        halsteadVolume: round(volume),
        maintainabilityIndex: round(maintainabilityIndex(volume, cyclomatic, loc))
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  // parseDiagnostics is populated by createSourceFile but marked @internal in the public typings.
  const { parseDiagnostics } = sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  return {
    callables,
    parseDiagnostics: parseDiagnostics.length
  }
}

export const analyzeScope = (scope: AnalysisScope): ScopeAnalysis => {
  const repositoryPaths = listRepositoryFiles(scope)
  const files: FileMetric[] = []
  const callableMetrics: CallableMetric[] = []
  let physicalLines = 0
  let executableFiles = 0
  let parseDiagnostics = 0
  let textFiles = 0

  for (const filePath of repositoryPaths) {
    if (BINARY_EXTENSIONS.has(extname(filePath).toLowerCase())) continue
    let source: string
    try {
      source = readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    textFiles += 1
    const loc = physicalLineCount(source)
    physicalLines += loc
    files.push({ path: filePath, loc })

    if (!EXECUTABLE_EXTENSIONS.has(extname(filePath))) continue
    executableFiles += 1
    const analysis = analyzeExecutableFile(filePath, source)
    callableMetrics.push(...analysis.callables)
    parseDiagnostics += analysis.parseDiagnostics
  }

  return {
    scope,
    trackedFiles: repositoryPaths.length,
    textFiles,
    physicalLines,
    executableFiles,
    callables: callableMetrics.length,
    parseDiagnostics,
    files,
    callableMetrics,
    rankings: {
      largestFiles: [...files]
        .sort((left, right) => right.loc - left.loc || left.path.localeCompare(right.path))
        .slice(0, 5),
      longestCallables: rankDescending(callableMetrics, (metric) => metric.loc),
      worstCyclomatic: rankDescending(callableMetrics, (metric) => metric.cyclomatic),
      worstCognitive: rankDescending(callableMetrics, (metric) => metric.cognitive),
      worstMaintainability: [...callableMetrics]
        .sort((left, right) =>
          left.maintainabilityIndex - right.maintainabilityIndex || comparePathLine(left, right))
        .slice(0, 5)
    }
  }
}

export const analyzeScopes = (scopes: AnalysisScope[]): ScopeAnalysis[] => scopes.map(analyzeScope)

const parseScopes = (argv: string[]): AnalysisScope[] => {
  const scopes: AnalysisScope[] = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--scope') continue
    const scope = argv[index + 1]
    if (scope !== 'src' && scope !== 'test') {
      throw new Error(`Expected --scope src or --scope test, received ${scope ?? '<missing>'}`)
    }
    scopes.push(scope)
    index += 1
  }
  return scopes.length > 0 ? scopes : ['src', 'test']
}

if (import.meta.main) {
  const analyses = analyzeScopes(parseScopes(process.argv.slice(2)))
  console.log(JSON.stringify(analyses.map(({ files: _files, callableMetrics: _callableMetrics, ...analysis }) => analysis), null, 2))
}
