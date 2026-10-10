import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  failed: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Drishva UI rendering failed.', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-[#17324f]">Drishva needs to reload</h1>
          <p className="mt-3 text-sm text-[#718096]">The interface hit an unexpected rendering error. Reload to try again.</p>
          <button
            type="button"
            className="button primary mt-6"
            onClick={() => window.location.reload()}
          >
            Reload Drishva
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
