import { CO2_FACTORS, TransportMedium } from '@/types'

export function calculateCO2(medium: TransportMedium, km: number): number {
  const factor = CO2_FACTORS[medium] ?? 0
  return parseFloat((factor * km).toFixed(3))
}

export function formatCO2(kg: number): string {
  if (kg >= 1) return `${kg.toFixed(2)} kg CO₂`
  return `${(kg * 1000).toFixed(0)} g CO₂`
}
