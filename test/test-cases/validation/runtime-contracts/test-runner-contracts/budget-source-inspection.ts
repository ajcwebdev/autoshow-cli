import ts from 'typescript'
import type { BudgetLiteralRead, BudgetSourceInspection, HelperBudgetKeySpec, InspectionState, ModelsRead, StringRead } from '~/types'

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
  if (callName === 'budgetedTest') {
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

export const inspectBudgetSource = (file: string, source: string): BudgetSourceInspection => {
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
  for (const spec of helperBudgetKeySpecs) {
    for (const call of state.helperCalls.get(spec.callName) ?? []) {
      inspectHelperCall(file, call, spec, helperKeys, state.issues)
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
  }
}
