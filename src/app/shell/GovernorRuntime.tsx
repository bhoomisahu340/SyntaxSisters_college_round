import { useEffect } from 'react'
import { attachHealthGovernor } from '../../core/governor/health.ts'

export function GovernorRuntime() {
  useEffect(() => attachHealthGovernor(), [])
  return null
}