import { AppValidationError } from '~/utils/error-handler'
import { createApprovedOcrBenchmarkSpendingGuard, CATEGORIES_BC_SPENDING_RATES } from './ocr-categories-bc-spending-guard'
import type {
  CategoriesBcExecutionPlan, CategoriesBcManualReconciliation, CategoriesBcPagePin,
  CategoriesBcSpendingGuardOptions, CategoriesBcSpendingLedger, CategoriesBcSpendingReceipt
} from './ocr-categories-bc-spending-guard'

export { NEWSPAPER_EXPANSION_CASE_PAGES } from './ocr-categories-bc-spending-guard'
export { validateNewspaperFinalBreachAccountingReview, readNewspaperFinalBreachAccountingReview } from './ocr-categories-bc-spending-guard'
export type { NewspaperFinalBreachAccountingReview, NewspaperFinalBreachAccountingProof } from './ocr-categories-bc-spending-guard'
export const NEWSPAPER_EXPANSION_BUDGET_CENTS = 3000
export const NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE = 'User approved up to $30 for the 12-input newspaper expansion'
export const NEWSPAPER_EXPANSION_SPENDING_RATES = Object.fromEntries(Object.entries(CATEGORIES_BC_SPENDING_RATES)
  .filter(([key]) => key !== 'mistral/mistral-ocr-4-0'))
export type NewspaperExpansionSpendingGuardOptions = CategoriesBcSpendingGuardOptions
export type NewspaperExpansionSpendingReceipt = CategoriesBcSpendingReceipt
export type NewspaperExpansionPagePin = CategoriesBcPagePin & { format: 'png' }
export type NewspaperExpansionSpendingLedger = Omit<CategoriesBcSpendingLedger, 'kind'> & { kind: 'ocr-newspaper-expansion-spending-ledger' }
export type NewspaperExpansionManualReconciliation = Omit<CategoriesBcManualReconciliation, 'kind' | 'approvalBudgetCents' | 'approvalEvidence'> & {
  kind: 'ocr-newspaper-expansion-manual-reconciliation'
  approvalBudgetCents: 3000
  approvalEvidence: typeof NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE
}
export type NewspaperExpansionExecutionPlan = Omit<CategoriesBcExecutionPlan, 'kind' | 'approval' | 'pages'> & {
  kind: 'ocr-newspaper-expansion-execution-plan'
  approval: { status: 'approved', budgetCents: 3000, evidence: typeof NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE }
  pages: NewspaperExpansionPagePin[]
}
export const createNewspaperExpansionSpendingGuard = (options: NewspaperExpansionSpendingGuardOptions): typeof fetch =>
  createApprovedOcrBenchmarkSpendingGuard('newspaper-expansion', options)

if (process.env['AUTOSHOW_OCR_NEWSPAPER_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || (() => { throw new AppValidationError(`OCR spending guard: missing ${name}`) })()
  globalThis.fetch = createNewspaperExpansionSpendingGuard({
    planPath: required('AUTOSHOW_OCR_NEWSPAPER_PLAN'), planSha256: required('AUTOSHOW_OCR_NEWSPAPER_PLAN_SHA256'),
    ledgerPath: required('AUTOSHOW_OCR_NEWSPAPER_LEDGER'), pageId: required('AUTOSHOW_OCR_NEWSPAPER_PAGE'),
    provider: required('AUTOSHOW_OCR_NEWSPAPER_PROVIDER'), model: required('AUTOSHOW_OCR_NEWSPAPER_MODEL')
  })
}
