import type { ReactNode } from 'react'
import { TabBar } from './TabBar.tsx'

export type SiteRoute = 'home' | 'shop' | 'booking' | 'calibrate' | 'debug' | 'arena' | 'results'

type SiteLayoutProps = {
  route: SiteRoute
  children: ReactNode
}

const navigation: ReadonlyArray<{ label: string; route: SiteRoute }> = [
  { label: 'Home', route: 'home' },
  { label: 'Shop', route: 'shop' },
  { label: 'Appointments', route: 'booking' },
]

function routeHref(route: SiteRoute): string {
  if (route === 'home') return '#/'
  if (route === 'debug') return '#/debug/vision'
  return `#/${route}`
}

export function SiteLayout({ route, children }: SiteLayoutProps) {
  return (
    <div className="drishva-site pb-28">
      <TabBar />
      <header className="navbar">
        <a href="#/" className="brand" aria-label="Drishva home">
          Drishva<span>.</span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.route}
              href={routeHref(item.route)}
              className={route === item.route ? 'active' : undefined}
              aria-current={route === item.route ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href={route === 'home' ? '#explore' : '#/'}
          className="nav-cta"
        >
          {route === 'home' ? 'Get Started ↗' : 'Back to Home ↗'}
        </a>
      </header>

      {children}

      <footer className="footer">
        <a href="#/" className="brand" aria-label="Drishva home">
          Drishva<span>.</span>
        </a>
        <p>See. Speak. Browse.</p>
        <span>Designed with accessibility in mind.</span>
        <a className="text-xs font-semibold text-[#066772] underline" href="#/arena">Benchmark</a>
      </footer>
    </div>
  )
}