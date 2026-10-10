import { useEffect, useRef, useState } from 'react'
import { bus } from '../../core/bus.ts'

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
  const nameRef = useRef<HTMLInputElement>(null)
  const serviceRef = useRef<HTMLSelectElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLSelectElement>(null)
  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const [confirmation, setConfirmation] = useState<BookingSummary | null>(null)
  const [service, setService] = useState('')
  const [time, setTime] = useState('')
  const [voiceNotice, setVoiceNotice] = useState('')

  useEffect(() => {
    const focusControl = (element: HTMLElement | null) => {
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element?.focus()
    }
    const selectService = (index: number) => {
      const next = appointmentTypes[index - 1]
      if (!next) {
        setVoiceNotice('That service number is not available.')
        return
      }
      setService(next)
      setVoiceNotice(`Selected ${next}.`)
      bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'search-service' })
    }
    const searchService = (query: string) => {
      const match = appointmentTypes.find((item) => item.toLowerCase().includes(query.toLowerCase()))
      if (match) {
        setService(match)
        setVoiceNotice(`Selected ${match}.`)
        bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'search-service' })
      } else {
        setVoiceNotice(`No appointment type matches “${query}”.`)
      }
    }
    const offAction = bus.on('BOOKING_VOICE_ACTION_REQUESTED', ({ action, value }) => {
      if (confirmation) return
      switch (action) {
        case 'show-doctors':
          focusControl(serviceRef.current)
          setVoiceNotice('This demo lists appointment types, not individual doctors.')
          break
        case 'search':
          if (typeof value === 'string') searchService(value)
          break
        case 'select-doctor':
          if (typeof value === 'number') selectService(value)
          break
        case 'choose-date':
          focusControl(dateRef.current)
          setVoiceNotice('Choose a date in the date picker.')
          break
        case 'show-slots':
          focusControl(timeRef.current)
          setVoiceNotice('Available appointment times are in the time selector.')
          break
        case 'select-slot':
          if (typeof value === 'number' && appointmentTimes[value - 1]) {
            setTime(appointmentTimes[value - 1])
            setVoiceNotice(`Selected ${appointmentTimes[value - 1]}.`)
            bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'select-slot' })
          } else {
            setVoiceNotice('That appointment time number is not available.')
          }
          break
      }
    })
    const offSearch = bus.on('VOICE_SEARCH_REQUESTED', ({ query }) => searchService(query))
    const offCancel = bus.on('UI_CANCEL_REQUESTED', () => {
      if (confirmation) {
        formRef.current?.reset()
        setConfirmation(null)
      } else {
        formRef.current?.reset()
      }
      setService('')
      setTime('')
      setVoiceNotice('Appointment form cleared.')
    })

    // "Computer, enter name" → focus the Patient Name field and begin dictation.
    // The dictation module resolves the now-focused field via the DOM target
    // scanner, so spoken text lands in this input. Booking is never auto-submitted.
    const offNameFocus = bus.on('BOOKING_NAME_FOCUS_REQUESTED', () => {
      if (confirmation) return
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameRef.current?.focus()
      setVoiceNotice('Patient Name field selected. Speak your name, or say “start typing”.')
      bus.emit('DICTATION_START_REQUESTED', { targetId: null })
    })

    return () => {
      offAction()
      offSearch()
      offCancel()
      offNameFocus()
    }
  }, [confirmation])

  useEffect(() => {
    if (confirmation) successHeadingRef.current?.focus()
  }, [confirmation])

  function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) return

    const formData = new FormData(form)
    bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'complete-booking' })
    setConfirmation([
      { label: 'Patient Name', value: String(formData.get('fullName') ?? '') },
      { label: 'Email', value: String(formData.get('email') ?? '') },
      { label: 'Service', value: String(formData.get('service') ?? '') },
      { label: 'Date', value: String(formData.get('appointmentDate') ?? '') },
      { label: 'Time', value: String(formData.get('appointmentTime') ?? '') },
    ])
  }

  function bookAnotherAppointment() {
    formRef.current?.reset()
    setService('')
    setTime('')
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
                  <label htmlFor="fullName">Patient Name *</label>
                  <input
                    ref={nameRef}
                    type="text"
                    id="fullName"
                    name="fullName"
                    placeholder="Enter the patient's full name"
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
                  <label htmlFor="service">Appointment type / specialty *</label>
                  <select
                    ref={serviceRef}
                    id="service"
                    name="service"
                    required
                    value={service}
                    onChange={(event) => {
                      setService(event.target.value)
                      if (event.target.value) bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'search-service' })
                    }}
                  >
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
                      ref={dateRef}
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
                      ref={timeRef}
                      id="appointmentTime"
                      name="appointmentTime"
                      required
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value)
                        if (event.target.value) bus.emit('BENCHMARK_TASK_SIGNAL', { task: 'select-slot' })
                      }}
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
                {voiceNotice ? <p className="form-footnote" role="status">{voiceNotice}</p> : null}
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}