import { expect } from 'bun:test'
import { defineBudgetedLiveServiceTest } from '../service-test-kit'

// Synthetic callbacks only: this fixture never invokes a provider or CLI command.
defineBudgetedLiveServiceTest('gate-single', 'single credential callback', ['SERVICE_GATE_FIRST_KEY'], () => {
  expect(process.env['SERVICE_GATE_FIRST_KEY']?.trim()).toBe('synthetic')
})

defineBudgetedLiveServiceTest('gate-multi', 'multiple credential callback', ['SERVICE_GATE_FIRST_KEY', 'SERVICE_GATE_SECOND_KEY'], () => {
  expect(process.env['SERVICE_GATE_FIRST_KEY']?.trim()).toBe('synthetic')
  expect(process.env['SERVICE_GATE_SECOND_KEY']?.trim()).toBe('synthetic')
})
