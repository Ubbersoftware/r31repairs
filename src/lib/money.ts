export function toThebe(pula: number): number { return Math.round(pula * 100) }

export function fromThebe(thebe: number): number { return thebe / 100 }

export function formatPula(thebe: number): string {
  const whole = thebe % 100 === 0
  const value = thebe / 100
  return 'P' + value.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
