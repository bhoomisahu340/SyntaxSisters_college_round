export function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            <span className="dot" /> ACCESSIBILITY FOR EVERYONE
          </span>
          <h1>
            Welcome to
            <br />
            <span>Drishva.</span>
          </h1>
          <h2>See. Speak. Browse.</h2>
          <p>
            A simpler digital experience for everyone. Discover useful
            products, explore services, and manage appointments through one
            easy-to-navigate platform.
          </p>
          <div className="hero-actions">
            <a href="#/shop" className="button primary">
              Explore Shop <span aria-hidden="true">→</span>
            </a>
            <a href="#/booking" className="button secondary">
              Book an Appointment
            </a>
          </div>
          <div className="hero-note">
            <span aria-hidden="true">✓</span> Simple, clear, and accessible by
            design
          </div>
        </div>
      </section>

      <section className="explore-section" id="explore">
        <div className="section-heading">
          <div>
            <span className="section-label">EXPLORE DRISHVA</span>
            <h2>Everything in one place.</h2>
          </div>
          <p>Choose where you&apos;d like to begin.</p>
        </div>

        <div className="feature-grid">
          <a href="#/shop" className="feature-card">
            <div className="feature-top">
              <div className="feature-icon teal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9h18l-1.5 12h-15L3 9Z" />
                  <path d="M8 9V6a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
              <span className="arrow" aria-hidden="true">↗</span>
            </div>
            <span className="card-label">01 / SHOPPING</span>
            <h3>Accessible Shopping</h3>
            <p>
              Browse useful products, search by category, and view clear
              product details.
            </p>
            <span className="card-action">Explore products →</span>
          </a>

          <a href="#/booking" className="feature-card">
            <div className="feature-top">
              <div className="feature-icon blue-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                  <path d="M12 13v5M9.5 15.5h5" />
                </svg>
              </div>
              <span className="arrow" aria-hidden="true">↗</span>
            </div>
            <span className="card-label">02 / SERVICES</span>
            <h3>Appointments</h3>
            <p>
              Choose a doctor, select a date, and try a simple appointment
              booking flow.
            </p>
            <span className="card-action">Book a visit →</span>
          </a>

          <a href="#about" className="feature-card">
            <div className="feature-top">
              <div className="feature-icon gold-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 7h.01" />
                </svg>
              </div>
              <span className="arrow" aria-hidden="true">↗</span>
            </div>
            <span className="card-label">03 / OUR MISSION</span>
            <h3>Accessibility First</h3>
            <p>
              Explore our goal of making online experiences easier for more
              people.
            </p>
            <span className="card-action">Learn more →</span>
          </a>
        </div>
      </section>

      <section className="about-section" id="about">
        <div>
          <span className="section-label">WHY DRISHVA?</span>
          <h2>A digital world that welcomes everyone.</h2>
          <p>
            We aim to make everyday online tasks easier through clear layouts,
            simple navigation, and thoughtful accessibility features.
          </p>
        </div>
        <a href="#/shop" className="button primary">
          Start Exploring →
        </a>
        <a href="#/arena" className="text-sm font-semibold text-[#066772] underline">
          Run the prototype benchmark
        </a>
      </section>
    </main>
  )
}