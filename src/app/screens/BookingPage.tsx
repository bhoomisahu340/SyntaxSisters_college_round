import { useEffect, useRef, useState } from 'react'

type BookingSummary = ReadonlyArray<{ label: string; value: string }>

const appointmentTypes = [
  'General Consultation',
  'Eye Consultation',
  'Dental Consultation',
  'Follow-up Visit',
]

const appointmentTimes = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
]

function getLocalDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const minimumBookingDate = getLocalDateString(new Date())

export function BookingPage() {
  const formRef = useRef<HTMLFormElement>(null)
  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const [confirmation, setConfirmation] = useState<BookingSummary | null>(null)

  useEffect(() => {
    if (confirmation) successHeadingRef.current?.focus()
  }, [confirmation])

  function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return

    const formData = new FormData(form)
    setConfirmation([
      { label: 'Name', value: String(formData.get('fullName') ?? '') },
      { label: 'Email', value: String(formData.get('email') ?? '') },
      { label: 'Service', value: String(formData.get('service') ?? '') },
      { label: 'Date', value: String(formData.get('appointmentDate') ?? '') },
      { label: 'Time', value: String(formData.get('appointmentTime') ?? '') },
    ])
  }

  function bookAnotherAppointment() {
    formRef.current?.reset()
    setConfirmation(null)
    formHeadingRef.current?.focus()
  }

  return (
    <main className="booking-page">
      <section className="booking-heading">
        <span className="section-label">DRISHVA SERVICES</span>
        <h1>Book an <span>Appointment.</span></h1>
        <p>
          Schedule a sample appointment using our simple and accessible booking
          interface.
        </p>
      </section>

      <section className="booking-layout">
        <aside className="booking-info">
          <div className="booking-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
              <path d="M12 13v5M9.5 15.5h5" />
            </svg>
          </div>

          <h2>Your time matters.</h2>
          <p>
            Choose a service, select your preferred date and time, and review
            your details before submitting.
          </p>

          <div className="booking-benefits">
            <div className="benefit">
              <span>01</span>
              <div>
                <h3>Choose a service</h3>
                <p>Select the appointment type you need.</p>
              </div>
            </div>
            <div className="benefit">
              <span>02</span>
              <div>
                <h3>Select a time</h3>
                <p>Choose a date and available time slot.</p>
              </div>
            </div>
            <div className="benefit">
              <span>03</span>
              <div>
                <h3>Confirm your details</h3>
                <p>Review your information before submitting.</p>
              </div>
            </div>
          </div>

          <p className="demo-note">
            Demo only — appointments are not sent to a real clinic.
          </p>
        </aside>

        <div className="booking-form-card">
          {confirmation ? (
            <section className="booking-success" aria-live="polite">
              <div className="success-icon" aria-hidden="true">✓</div>
              <h2 ref={successHeadingRef} tabIndex={-1}>
                Appointment details submitted!
              </h2>
              <p>Your demo appointment summary is shown below.</p>
              <div className="confirmation-details">
                {confirmation.map((item) => (
                  <div className="confirmation-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="booking-submit"
                onClick={bookAnotherAppointment}
              >
                Book Another Appointment
              </button>
            </section>
          ) : (
            <>
              <div className="form-heading">
                <h2 ref={formHeadingRef} tabIndex={-1}>Appointment details</h2>
                <p>Fields marked with * are required.</p>
              </div>

              <form ref={formRef} onSubmit={submitBooking}>
                <div className="form-group">
                  <label htmlFor="fullName">Full name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="email">Email address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      placeholder="Optional"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="service">Appointment type *</label>
                  <select id="service" name="service" required defaultValue="">
                    <option value="">Select an appointment type</option>
                    {appointmentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="appointmentDate">Preferred date *</label>
                    <input
                      type="date"
                      id="appointmentDate"
                      name="appointmentDate"
                      min={minimumBookingDate}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="appointmentTime">Preferred time *</label>
                    <select
                      id="appointmentTime"
                      name="appointmentTime"
                      required
                      defaultValue=""
                    >
                      <option value="">Choose a time</option>
                      {appointmentTimes.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Additional notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    placeholder="Anything you would like us to know? (Optional)"
                  />
                </div>

                <label className="consent-row">
                  <input type="checkbox" id="confirmDetails" required />
                  <span>I have checked my appointment details.</span>
                </label>

                <button type="submit" className="booking-submit">
                  Confirm Appointment <span aria-hidden="true">→</span>
                </button>
                <p className="form-footnote">
                  This is a prototype. Submitting does not create a real booking.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}