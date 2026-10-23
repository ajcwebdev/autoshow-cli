import { createApprovedOcrBenchmarkSpendingGuard, CATEGORIES_BC_SPENDING_RATES } from './ocr-categories-bc-spending-guard'
import type {
  CategoriesBcExecutionPlan, CategoriesBcManualReconciliation, CategoriesBcPagePin,
  CategoriesBcSpendingGuardOptions, CategoriesBcSpendingLedger, CategoriesBcSpendingReceipt
} from './ocr-categories-bc-spending-guard'

export { CATEGORIES_EFG_CASE_PAGES } from './ocr-categories-bc-spending-guard'
export const CATEGORIES_EFG_BUDGET_CENTS = 3000
export const CATEGORIES_EFG_SPENDING_RATES = Object.fromEntries(Object.entries(CATEGORIES_BC_SPENDING_RATES)
  .filter(([key]) => key !== 'mistral/mistral-ocr-4-0'))
export type CategoriesEfgSpendingGuardOptions = CategoriesBcSpendingGuardOptions
export type CategoriesEfgSpendingReceipt = CategoriesBcSpendingReceipt
export type CategoriesEfgPagePin = CategoriesBcPagePin & { format: 'png' | 'jpg' }
export type CategoriesEfgSpendingLedger = Omit<CategoriesBcSpendingLedger, 'kind'> & { kind: 'ocr-categories-efg-spending-ledger' }
export type CategoriesEfgManualReconciliation = Omit<CategoriesBcManualReconciliation, 'kind' | 'approvalBudgetCents' | 'approvalEvidence'> & {
  kind: 'ocr-categories-efg-manual-reconciliation'
  approvalBudgetCents: 3000
  approvalEvidence: 'User approved up to $30 for categories 5–7'
}
export type CategoriesEfgExecutionPlan = Omit<CategoriesBcExecutionPlan, 'kind' | 'approval' | 'pages'> & {
  kind: 'ocr-categories-efg-execution-plan'
  approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30 for categories 5–7' }
  pages: CategoriesEfgPagePin[]
}
export const createCategoriesEfgSpendingGuard = (options: CategoriesEfgSpendingGuardOptions): typeof fetch =>
  createApprovedOcrBenchmarkSpendingGuard('categories-efg', options)

if (process.env['AUTOSHOW_OCR_EFG_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || (() => { throw new Error(`OCR spending guard: missing ${name}`) })()
  globalThis.fetch = createCategoriesEfgSpendingGuard({
    planPath: required('AUTOSHOW_OCR_EFG_PLAN'), planSha256: required('AUTOSHOW_OCR_EFG_PLAN_SHA256'),
    ledgerPath: required('AUTOSHOW_OCR_EFG_LEDGER'), pageId: required('AUTOSHOW_OCR_EFG_PAGE'),
    provider: required('AUTOSHOW_OCR_EFG_PROVIDER'), model: required('AUTOSHOW_OCR_EFG_MODEL')
  })
}
