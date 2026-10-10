import { useEffect, useState } from 'react'
import { bus } from './core/bus.ts'
import { SiteLayout, type SiteRoute } from './app/shell/SiteLayout.tsx'
import { HomePage } from './app/screens/HomePage.tsx'
import { BookingPage } from './app/screens/BookingPage.tsx'
import { CalibrationPage } from './app/screens/CalibrationPage.tsx'
import { ShopPage } from './app/screens/ShopPage.tsx'
import { VisionDebugPage } from './app/screens/VisionDebugPage.tsx'
import { ArenaPage } from './app/screens/ArenaPage.tsx'
import { ResultsPage } from './app/screens/ResultsPage.tsx'
import { StatusHUD } from './app/shell/StatusHUD.tsx'
import { DictationStatus } from './app/shell/DictationStatus.tsx'
import { TargetNumbers } from './app/shell/TargetNumbers.tsx'
import { CursorOverlay } from './app/shell/CursorOverlay.tsx'
import { VisionRuntime } from './app/shell/VisionRuntime.tsx'
import { GovernorRuntime } from './app/shell/GovernorRuntime.tsx'
import { BenchmarkRuntime } from './app/shell/BenchmarkRuntime.tsx'
import { useAppStore } from './app/store.ts'

function routeFromHash(): SiteRoute {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path === '/shop') return 'shop'
  if (path === '/booking') return 'booking'
  if (path === '/debug/vision') return 'debug'
  if (path === '/calibrate') return 'calibrate'
  if (path === '/arena') return 'arena'
  if (path === '/results') return 'results'
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<SiteRoute>(routeFromHash)

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = routeFromHash()
      setRoute(nextRoute)
      if (nextRoute === 'home' || nextRoute === 'shop' || nextRoute === 'booking') {
        useAppStore.getState().syncTabSite(nextRoute)
      }
    }
    window.addEventListener('hashchange', syncRoute)
    syncRoute()
    const toHref = (site: 'home' | 'shop' | 'booking') => site === 'home' ? '#/' : `#/${site}`
    const offTabAction = bus.on('TAB_ACTION_REQUESTED', ({ action }) => {
      const store = useAppStore.getState()
      const tab = action === 'new' ? store.createTab() : action === 'next' ? store.nextTab() : store.closeTab()
      window.location.hash = toHref(tab.site)
      setRoute(tab.site)
    })
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      offTabAction()
    }
  }, [])

  return (
    <>
      <VisionRuntime debug={route === 'debug'} />
      <GovernorRuntime />
      <BenchmarkRuntime />
      <SiteLayout route={route}>
        {route === 'home' ? (
          <HomePage />
        ) : route === 'shop' ? (
          <ShopPage />
        ) : route === 'debug' ? (
          <VisionDebugPage />
        ) : route === 'calibrate' ? (
          <CalibrationPage />
        ) : route === 'arena' ? (
          <ArenaPage />
        ) : route === 'results' ? (
          <ResultsPage />
        ) : (
          <BookingPage />
        )}
      </SiteLayout>
      <TargetNumbers />
      <CursorOverlay />
      <DictationStatus />
      <StatusHUD />
    </>
  )
}
