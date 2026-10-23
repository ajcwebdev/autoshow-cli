import { AppValidationError } from '~/utils/error-handler'
import { createApprovedOcrBenchmarkSpendingGuard, CATEGORIES_BC_SPENDING_RATES } from './ocr-categories-bc-spending-guard'
import type {
  CategoriesBcExecutionPlan, CategoriesBcManualReconciliation, CategoriesBcPagePin,
  CategoriesBcSpendingGuardOptions, CategoriesBcSpendingLedger, CategoriesBcSpendingReceipt
} from './ocr-categories-bc-spending-guard'

export const CATEGORY_D_BUDGET_CENTS = 2500
export const CATEGORY_D_SPENDING_RATES = Object.fromEntries(Object.entries(CATEGORIES_BC_SPENDING_RATES)
  .filter(([key]) => key !== 'mistral/mistral-ocr-4-0'))
export const CATEGORY_D_CASE_PAGES: Readonly<Record<string, number>> = {
  'advertisement-three-masons': 1, 'advertisement-newtown-cruise': 1, 'advertisement-legend-1900': 1,
  'advertisement-metrolink': 1, 'advertisement-nyc-skate': 1, 'd-rerun-01-ad-copy': 1
}
export type CategoryDSpendingGuardOptions = CategoriesBcSpendingGuardOptions
export type CategoryDSpendingReceipt = CategoriesBcSpendingReceipt
export type CategoryDPagePin = CategoriesBcPagePin
export type CategoryDSpendingLedger = Omit<CategoriesBcSpendingLedger, 'kind'> & { kind: 'ocr-category-d-spending-ledger' }
export type CategoryDManualReconciliation = Omit<CategoriesBcManualReconciliation, 'kind' | 'approvalBudgetCents' | 'approvalEvidence'> & {
  kind: 'ocr-category-d-manual-reconciliation'
  approvalBudgetCents: 2500
  approvalEvidence: 'User approved up to $25 for category 4'
}
export type CategoryDExecutionPlan = Omit<CategoriesBcExecutionPlan, 'kind' | 'approval'> & {
  kind: 'ocr-category-d-execution-plan'
  approval: { status: 'approved', budgetCents: 2500, evidence: 'User approved up to $25 for category 4' }
}
export const createCategoryDSpendingGuard = (options: CategoryDSpendingGuardOptions): typeof fetch =>
  createApprovedOcrBenchmarkSpendingGuard('category-d', options)

if (process.env['AUTOSHOW_OCR_D_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || (() => { throw new AppValidationError(`OCR spending guard: missing ${name}`) })()
  globalThis.fetch = createCategoryDSpendingGuard({
    planPath: required('AUTOSHOW_OCR_D_PLAN'), planSha256: required('AUTOSHOW_OCR_D_PLAN_SHA256'),
    ledgerPath: required('AUTOSHOW_OCR_D_LEDGER'), pageId: required('AUTOSHOW_OCR_D_PAGE'),
    provider: required('AUTOSHOW_OCR_D_PROVIDER'), model: required('AUTOSHOW_OCR_D_MODEL')
  })
}
