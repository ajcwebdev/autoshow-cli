import type ts from 'typescript'

export type BudgetSourceInspection = {
  keys: string[]
  issues: string[]
}

export type StringRead =
  | { kind: 'missing' }
  | { kind: 'dynamic' }
  | { kind: 'literal'; value: string }

export type ModelsRead = {
  kind: 'missing' | 'literal' | 'dynamic'
  values: string[]
}

export type BudgetLiteralRead = {
  values: string[]
  dynamic: boolean
}

export type InspectionState = {
  explicitKeys: string[]
  propertyKeys: string[]
  declarationKeys: string[]
  helperCalls: Map<string, ts.CallExpression[]>
  issues: string[]
  generationWrapperCalls: number
}
