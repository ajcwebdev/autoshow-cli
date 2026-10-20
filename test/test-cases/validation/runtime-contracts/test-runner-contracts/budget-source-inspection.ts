import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import type { BudgetLiteralRead, BudgetSourceInspection, BudgetSourceInvocation, HelperBudgetKeySpec, InspectionState, ModelsRead, StringRead } from '~/types'
import { ocrServiceTestCases } from '../../../../test-utils/define-ocr-service-test'
import { sttServiceTestCases } from '../../../../test-utils/define-stt-service-test'

const helperBudgetKeySpecs: HelperBudgetKeySpec[] = [
  { callName: 'defineLLMWriteTest', prefix: 'write', serviceProperty: 'llmService', modelMode: 'strings' },
  { callName: 'defineSTTServiceTest', prefix: 'transcribe', serviceProperty: 'sttService', modelMode: 'strings' },
  { callName: 'defineOCRServiceTest', prefix: 'extract', serviceFromCliFlag: true, modelMode: 'strings' },
  { callName: 'defineImageServiceTest', prefix: 'image', serviceProperty: 'imageService', modelMode: 'objects' },
  { callName: 'defineVideoServiceTest', prefix: 'video', serviceProperty: 'videoService', modelMode: 'objects' },
  { callName: 'defineMusicServiceTest', prefix: 'music', serviceProperty: 'musicService', modelMode: 'objects' },
  { callName: 'defineTTSServiceTest', prefix: 'tts', serviceProperty: 'ttsService', modelMode: 'strings' },
]

const helperSpecsByCallName = new Map(helperBudgetKeySpecs.map(spec => [spec.callName, spec]))

const literalString = (expression: ts.Expression): string | undefined => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text
  }
  return undefined
}

const propertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return undefined
}

const findObjectProperty = (
  object: ts.ObjectLiteralExpression,
  propertyName: string
): ts.ObjectLiteralElementLike | undefined =>
  object.properties.find((property) => {
    if (ts.isSpreadAssignment(property)) {
      return false
    }
    return propertyNameText(property.name) === propertyName
  })

const readStringProperty = (object: ts.ObjectLiteralExpression, propertyName: string): StringRead => {
  const property = findObjectProperty(object, propertyName)
  if (!property) {
    return { kind: 'missing' }
  }
  if (!ts.isPropertyAssignment(property)) {
    return { kind: 'dynamic' }
  }

  const value = literalString(property.initializer)
  return value === undefined ? { kind: 'dynamic' } : { kind: 'literal', value }
}

const readStringModels = (initializer: ts.Expression): ModelsRead => {
  if (!ts.isArrayLiteralExpression(initializer)) {
    return { kind: 'dynamic', values: [] }
  }

  const values: string[] = []
  let dynamic = false
  for (const element of initializer.elements) {
    const value = literalString(element)
    if (value === undefined) {
      dynamic = true
    } else {
      values.push(value)
    }
  }
  return { kind: dynamic ? 'dynamic' : 'literal', values }
}

const readObjectModel = (element: ts.Expression): string | undefined => {
  if (!ts.isObjectLiteralExpression(element)) {
    return undefined
  }
  const model = findObjectProperty(element, 'model')
  return model && ts.isPropertyAssignment(model) ? literalString(model.initializer) : undefined
}

const readObjectModels = (initializer: ts.Expression): ModelsRead => {
  if (!ts.isArrayLiteralExpression(initializer)) {
    return { kind: 'dynamic', values: [] }
  }

  const values: string[] = []
  let dynamic = false
  for (const element of initializer.elements) {
    const value = readObjectModel(element)
    if (value === undefined) {
      dynamic = true
    } else {
      values.push(value)
    }
  }
  return { kind: dynamic ? 'dynamic' : 'literal', values }
}

const readModelsProperty = (
  object: ts.ObjectLiteralExpression,
  mode: HelperBudgetKeySpec['modelMode']
): ModelsRead => {
  const property = findObjectProperty(object, 'models')
  if (!property) {
    return { kind: 'missing', values: [] }
  }
  if (!ts.isPropertyAssignment(property)) {
    return { kind: 'dynamic', values: [] }
  }
  return mode === 'objects'
    ? readObjectModels(property.initializer)
    : readStringModels(property.initializer)
}

const readHelperService = (
  object: ts.ObjectLiteralExpression,
  spec: HelperBudgetKeySpec
): StringRead => {
  if (!spec.serviceFromCliFlag) {
    return readStringProperty(object, spec.serviceProperty)
  }

  const expectedService = readStringProperty(object, 'expectedService')
  return expectedService.kind === 'missing'
    ? readStringProperty(object, 'provider')
    : expectedService
}

const helperServiceLabel = (spec: HelperBudgetKeySpec): string =>
  spec.serviceFromCliFlag ? 'expectedService/provider' : spec.serviceProperty

const appendHelperModels = (
  file: string,
  object: ts.ObjectLiteralExpression,
  spec: HelperBudgetKeySpec,
  service: string,
  keys: string[],
  issues: string[]
): void => {
  const models = readModelsProperty(object, spec.modelMode)
  if (models.kind === 'missing') {
    issues.push(`${file}: ${spec.callName} has no inspectable models`)
    return
  }
  if (models.kind === 'dynamic') {
    issues.push(`${file}: ${spec.callName} models contain dynamic values; use only inspectable string/model literals`)
  }
  if (models.values.length === 0) {
    if (models.kind !== 'dynamic') {
      issues.push(`${file}: ${spec.callName} has no inspectable models`)
    }
    return
  }

  for (const model of models.values) {
    keys.push(`${spec.prefix}-${service}-${model}`)
  }
}

const inspectHelperCall = (
  file: string,
  call: ts.CallExpression,
  spec: HelperBudgetKeySpec,
  keys: string[],
  issues: string[]
): void => {
  const argument = call.arguments[0]
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    issues.push(`${file}: ${spec.callName} has no inspectable ${helperServiceLabel(spec)}`)
    return
  }

  const object = argument
  const service = readHelperService(object, spec)
  if (service.kind === 'missing') {
    issues.push(`${file}: ${spec.callName} has no inspectable ${helperServiceLabel(spec)}`)
    return
  }
  if (service.kind === 'dynamic') {
    issues.push(`${file}: ${spec.callName} has a dynamic ${helperServiceLabel(spec)}; use a string literal`)
    return
  }

  appendHelperModels(file, object, spec, service.value, keys, issues)
}

type ModuleReader = (path: string) => string | undefined
type ResolutionScope = Readonly<{ file: string, sourceFile: ts.SourceFile, readModule: ModuleReader, parsed: Map<string, ts.SourceFile | undefined> }>
type ResolvedValue = Readonly<{ expression: ts.Expression, scope: ResolutionScope }>
type ResolvedProperties = { values: Map<string, ResolvedValue>, unresolvedSpreads: number }

const readSiblingModule: ModuleReader = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

const unwrapExpression = (expression: ts.Expression): ts.Expression =>
  ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)
    ? unwrapExpression(expression.expression)
    : expression

const parseModuleScope = (scope: ResolutionScope, path: string): ResolutionScope | undefined => {
  if (!scope.parsed.has(path)) {
    const source = scope.readModule(path)
    scope.parsed.set(path, source === undefined ? undefined : ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
  }
  const sourceFile = scope.parsed.get(path)
  return sourceFile ? { ...scope, file: path, sourceFile } : undefined
}

// Resolves a top-level const of this module, or a named import from a relative sibling module.
const resolveIdentifier = (name: string, scope: ResolutionScope, depth = 0): ResolvedValue | undefined => {
  if (depth > 3) return undefined
  for (const statement of scope.sourceFile.statements) {
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name)
      if (declaration?.initializer) return { expression: unwrapExpression(declaration.initializer), scope }
    }
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith('.')) continue
    const bindings = statement.importClause?.namedBindings
    const element = bindings && ts.isNamedImports(bindings) ? bindings.elements.find(item => item.name.text === name) : undefined
    if (!element) continue
    const specifier = statement.moduleSpecifier.text
    const target = parseModuleScope(scope, join(dirname(scope.file), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`))
    return target ? resolveIdentifier((element.propertyName ?? element.name).text, target, depth + 1) : undefined
  }
  return undefined
}

const resolveValue = (expression: ts.Expression, scope: ResolutionScope): ResolvedValue => {
  const value = unwrapExpression(expression)
  return (ts.isIdentifier(value) ? resolveIdentifier(value.text, scope) : undefined) ?? { expression: value, scope }
}

// Applies properties in source order, so a later property or spread overrides an earlier one.
const collectResolvedProperties = (
  object: ts.ObjectLiteralExpression,
  scope: ResolutionScope,
  collected: ResolvedProperties = { values: new Map(), unresolvedSpreads: 0 }
): ResolvedProperties => {
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveValue(property.expression, scope)
      if (ts.isObjectLiteralExpression(spread.expression)) collectResolvedProperties(spread.expression, spread.scope, collected)
      else collected.unresolvedSpreads += 1
    } else if (ts.isShorthandPropertyAssignment(property)) {
      collected.values.set(property.name.text, resolveValue(property.name, scope))
    } else if (ts.isPropertyAssignment(property)) {
      const name = propertyNameText(property.name)
      if (name !== undefined) collected.values.set(name, resolveValue(property.initializer, scope))
    }
  }
  return collected
}

const DYNAMIC = Symbol('dynamic')

const readResolvedString = (properties: ResolvedProperties, name: string): string | undefined | typeof DYNAMIC => {
  const entry = properties.values.get(name)
  if (!entry) return undefined
  return literalString(entry.expression) ?? DYNAMIC
}

const readResolvedStrings = (properties: ResolvedProperties, name: string): string[] | undefined | typeof DYNAMIC => {
  const entry = properties.values.get(name)
  if (!entry) return undefined
  if (!ts.isArrayLiteralExpression(entry.expression)) return DYNAMIC
  const values = entry.expression.elements.map(element => literalString(resolveValue(element, entry.scope).expression))
  return values.every((value): value is string => value !== undefined) ? values : DYNAMIC
}

type ServiceCases = readonly { budgetKey: string, args: readonly string[] }[] | string

const readOcrCases = (properties: ResolvedProperties, models: string[], provider: string): ServiceCases => {
  const expectedService = readResolvedString(properties, 'expectedService')
  const inputMode = readResolvedString(properties, 'inputMode')
  const imageInput = readResolvedString(properties, 'imageInput')
  if (expectedService === DYNAMIC || inputMode === DYNAMIC || imageInput === DYNAMIC) return 'has a dynamic expectedService, inputMode or imageInput; use string literals or inspectable constants'
  if (inputMode !== undefined && inputMode !== 'pdf-and-image' && inputMode !== 'image-only') return `has an unknown inputMode ${inputMode}`
  return ocrServiceTestCases({ models, provider, expectedService, inputMode, imageInput })
}

const readSttCases = (properties: ResolvedProperties, models: string[], provider: string): ServiceCases => {
  const sttService = readResolvedString(properties, 'sttService')
  const inputPath = readResolvedString(properties, 'inputPath')
  const extraArgs = readResolvedStrings(properties, 'extraArgs')
  if (typeof sttService !== 'string') return 'has no inspectable sttService'
  if (inputPath === DYNAMIC || extraArgs === DYNAMIC) return 'has a dynamic inputPath or extraArgs; use string literals or inspectable constants'
  return sttServiceTestCases({ models, provider, sttService, inputPath, extraArgs })
}

// OCR and STT helpers expose their exact CLI invocations, so price commands can be compared with them.
const inspectServiceCaseCall = (
  file: string,
  call: ts.CallExpression,
  spec: HelperBudgetKeySpec,
  scope: ResolutionScope,
  keys: string[],
  invocations: BudgetSourceInvocation[],
  issues: string[]
): void => {
  const argument = call.arguments[0]
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    issues.push(`${file}: ${spec.callName} has no inspectable configuration object`)
    return
  }
  const properties = collectResolvedProperties(argument, scope)
  if (properties.unresolvedSpreads > 0) {
    issues.push(`${file}: ${spec.callName} spreads a value that is not an inspectable object literal`)
    return
  }
  const models = readResolvedStrings(properties, 'models')
  const provider = readResolvedString(properties, 'provider')
  if (models === undefined || models === DYNAMIC || models.length === 0 || typeof provider !== 'string') {
    issues.push(`${file}: ${spec.callName} needs inspectable literal models and provider`)
    return
  }
  const cases = spec.callName === 'defineOCRServiceTest'
    ? readOcrCases(properties, models, provider)
    : readSttCases(properties, models, provider)
  if (typeof cases === 'string') {
    issues.push(`${file}: ${spec.callName} ${cases}`)
    return
  }
  for (const testCase of cases) {
    keys.push(testCase.budgetKey)
    invocations.push({ key: testCase.budgetKey, args: testCase.args })
  }
}

const isBudgetKeyLiteral = (value: string): boolean =>
  /^(?:extract|image|music|transcribe|tts|video|write)-/.test(value)

const combineBudgetReads = (left: BudgetLiteralRead, right: BudgetLiteralRead): BudgetLiteralRead => ({
  values: [...left.values, ...right.values],
  dynamic: left.dynamic || right.dynamic,
})

const readBudgetLiterals = (expression: ts.Expression): BudgetLiteralRead => {
  const value = literalString(expression)
  if (value !== undefined) {
    return { values: isBudgetKeyLiteral(value) ? [value] : [], dynamic: !isBudgetKeyLiteral(value) }
  }
  if (ts.isParenthesizedExpression(expression)) {
    return readBudgetLiterals(expression.expression)
  }
  if (ts.isConditionalExpression(expression)) {
    return combineBudgetReads(
      readBudgetLiterals(expression.whenTrue),
      readBudgetLiterals(expression.whenFalse)
    )
  }
  return { values: [], dynamic: true }
}

const readBudgetedTestKeys = (expression: ts.Expression): BudgetLiteralRead => {
  const value = literalString(expression)
  if (value !== undefined) {
    return { values: [value], dynamic: false }
  }
  if (!ts.isArrayLiteralExpression(expression)) {
    return { values: [], dynamic: true }
  }

  const values: string[] = []
  let dynamic = false
  for (const element of expression.elements) {
    const elementValue = literalString(element)
    if (elementValue === undefined) {
      dynamic = true
    } else {
      values.push(elementValue)
    }
  }
  return { values, dynamic }
}

const inspectBudgetedTestCall = (
  file: string,
  call: ts.CallExpression,
  state: InspectionState
): void => {
  const argument = call.arguments[0]
  if (argument && ts.isIdentifier(argument) && argument.text === 'budgetKey') {
    return
  }
  const read = argument ? readBudgetedTestKeys(argument) : { values: [], dynamic: true }
  state.explicitKeys.push(...read.values)
  if (read.dynamic) {
    state.issues.push(`${file}: budgetedTest has a dynamic budget key; use a string literal, literal array, or inspectable budgetKey declaration`)
  }
}

const inspectBudgetKeyProperty = (
  file: string,
  property: ts.PropertyAssignment,
  state: InspectionState
): void => {
  if (propertyNameText(property.name) !== 'budgetKey') {
    return
  }
  const value = literalString(property.initializer)
  if (value === undefined) {
    state.issues.push(`${file}: budgetKey property has a dynamic value; use a string literal`)
  } else {
    state.propertyKeys.push(value)
  }
}

const inspectBudgetKeyDeclaration = (
  file: string,
  declaration: ts.VariableDeclaration,
  state: InspectionState
): void => {
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'budgetKey') {
    return
  }
  const declarationList = declaration.parent
  if ((declarationList.flags & ts.NodeFlags.BlockScoped) === 0) {
    return
  }
  const read = declaration.initializer
    ? readBudgetLiterals(declaration.initializer)
    : { values: [], dynamic: true }
  state.declarationKeys.push(...read.values)
  if (read.dynamic || read.values.length === 0) {
    state.issues.push(`${file}: budgetKey declaration has dynamic or non-budget values; use inspectable budget key literals`)
  }
}

const inspectCallExpression = (
  file: string,
  call: ts.CallExpression,
  state: InspectionState
): void => {
  if (!ts.isIdentifier(call.expression)) {
    return
  }
  const callName = call.expression.text
  if (callName === 'budgetedTest' || callName === 'localBudgetedTest' || callName === 'defineBudgetedLiveServiceTest') {
    inspectBudgetedTestCall(file, call, state)
  }
  if (callName === 'defineGenerationServiceTest') {
    state.generationWrapperCalls += 1
  }
  if (helperSpecsByCallName.has(callName)) {
    state.helperCalls.get(callName)?.push(call)
  }
}

const visitBudgetNodes = (file: string, node: ts.Node, state: InspectionState): void => {
  if (ts.isCallExpression(node)) {
    inspectCallExpression(file, node, state)
  }
  if (ts.isPropertyAssignment(node)) {
    inspectBudgetKeyProperty(file, node, state)
  }
  if (ts.isVariableDeclaration(node)) {
    inspectBudgetKeyDeclaration(file, node, state)
  }
  ts.forEachChild(node, child => visitBudgetNodes(file, child, state))
}

const parseIssues = (file: string, sourceFile: ts.SourceFile): string[] => {
  const diagnostics = (
    sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics
  return diagnostics.map((diagnostic) => {
    const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    return `${file}:${position.line + 1}:${position.character + 1}: TypeScript parse error: ${message}`
  })
}

const createInspectionState = (): InspectionState => ({
  explicitKeys: [],
  propertyKeys: [],
  declarationKeys: [],
  helperCalls: new Map(helperBudgetKeySpecs.map(spec => [spec.callName, []])),
  issues: [],
  generationWrapperCalls: 0,
})

export const inspectBudgetSource = (file: string, source: string, readModule: ModuleReader = readSiblingModule): BudgetSourceInspection => {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const syntaxIssues = parseIssues(file, sourceFile)
  if (syntaxIssues.length > 0) {
    return { keys: [], issues: syntaxIssues }
  }

  const state = createInspectionState()
  visitBudgetNodes(file, sourceFile, state)
  if (state.generationWrapperCalls > 0) {
    state.issues.push(`${file}: generation e2e consumers must call the image, video, or music wrapper so budget keys remain source-inspectable`)
  }

  const helperKeys: string[] = []
  const invocations: BudgetSourceInvocation[] = []
  const scope: ResolutionScope = { file, sourceFile, readModule, parsed: new Map() }
  for (const spec of helperBudgetKeySpecs) {
    for (const call of state.helperCalls.get(spec.callName) ?? []) {
      if (spec.callName === 'defineOCRServiceTest' || spec.callName === 'defineSTTServiceTest') {
        inspectServiceCaseCall(file, call, spec, scope, helperKeys, invocations, state.issues)
      } else {
        inspectHelperCall(file, call, spec, helperKeys, state.issues)
      }
    }
  }

  return {
    keys: [
      ...state.explicitKeys,
      ...state.propertyKeys,
      ...state.declarationKeys,
      ...helperKeys,
    ],
    issues: state.issues,
    invocations,
  }
}
