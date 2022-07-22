import denomList from './denoms-config.json'

export const denomsAvailable = new Map<string, MicronDenom>(Object.entries(denomList))

export function defaultMicroDenomAvailable(): string {
  return denomsAvailable.keys().next().value
}

export function checkMicroDenomAvailable(microDenom: string): boolean {
  return denomsAvailable.has(microDenom)
}

export function microDenomToDenom(microDenom: string): string {
  return denomsAvailable.has(microDenom) ? denomsAvailable.get(microDenom)!.denom : microDenom
}

interface MicronDenom {
  denom: string
}