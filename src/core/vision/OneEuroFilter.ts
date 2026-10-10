function smoothingAlpha(cutoff: number, deltaSeconds: number): number {
  const timeConstant = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + timeConstant / deltaSeconds)
}

export class OneEuroFilter {
  private previousTime: number | null = null
  private previousRaw = 0
  private filteredValue = 0
  private filteredDerivative = 0
  private readonly minCutoff: number
  private readonly beta: number
  private readonly derivativeCutoff: number

  constructor(
    minCutoff = 1.2,
    beta = 0.008,
    derivativeCutoff = 1,
  ) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.derivativeCutoff = derivativeCutoff
  }

  filter(value: number, timestampMs: number): number {
    if (this.previousTime === null) {
      this.previousTime = timestampMs
      this.previousRaw = value
      this.filteredValue = value
      return value
    }

    const deltaSeconds = Math.max(0.001, (timestampMs - this.previousTime) / 1000)
    const derivative = (value - this.previousRaw) / deltaSeconds
    const derivativeAlpha = smoothingAlpha(this.derivativeCutoff, deltaSeconds)
    this.filteredDerivative +=
      derivativeAlpha * (derivative - this.filteredDerivative)

    const cutoff = this.minCutoff + this.beta * Math.abs(this.filteredDerivative)
    const valueAlpha = smoothingAlpha(cutoff, deltaSeconds)
    this.filteredValue += valueAlpha * (value - this.filteredValue)
    this.previousRaw = value
    this.previousTime = timestampMs
    return this.filteredValue
  }

  reset(): void {
    this.previousTime = null
    this.previousRaw = 0
    this.filteredValue = 0
    this.filteredDerivative = 0
  }
}