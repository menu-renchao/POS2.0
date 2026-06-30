import type { ApiCoverageLevel } from './first-batch-api-cases';

export function shouldRunContractSmokeCase(coverage: ApiCoverageLevel): boolean {
  return coverage === 'contract-only' || coverage === 'deferred-external';
}
