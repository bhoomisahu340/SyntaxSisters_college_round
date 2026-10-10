import { useEffect, useState } from 'react'
import { SiteLayout, type SiteRoute } from './app/shell/SiteLayout.tsx'
import { HomePage } from './app/screens/HomePage.tsx'
import { BookingPage } from './app/screens/BookingPage.tsx'
import { ShopPage } from './app/screens/ShopPage.tsx'
import { StatusHUD } from './app/shell/StatusHUD.tsx'
import { TargetNumbers } from './app/shell/TargetNumbers.tsx'

function routeFromHash(): SiteRoute {
  const path = window.location.hash.slice(1).split('?')[0]
  if (path === '/shop') return 'shop'
  if (path === '/booking') return 'booking'
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<SiteRoute>(routeFromHash)

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  return (
    <>
      <SiteLayout route={route}>
        {route === 'home' ? (
          <HomePage />
        ) : route === 'shop' ? (
          <ShopPage />
        ) : (
          <BookingPage />
        )}
      </SiteLayout>
      <TargetNumbers />
      <StatusHUD />
    </>
  )
}
