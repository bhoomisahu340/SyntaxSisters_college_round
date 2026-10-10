import type { ReactNode } from 'react'

export type SiteRoute = 'home' | 'shop' | 'booking'

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
  return route === 'home' ? '#/' : `#/${route}`
}

export function SiteLayout({ route, children }: SiteLayoutProps) {
  return (
    <div className="drishva-site pb-28">
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
      </footer>
    </div>
  )
}