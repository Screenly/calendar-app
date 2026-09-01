import './css/style.css'

import {
  formatLocalizedDate,
  formatTime,
  getLocale,
  getSettingWithDefault,
  getTimeZone,
  isLightColor,
  isPortrait,
  setupBrandingLogo,
  setupErrorHandling,
  setupTheme,
  signalReady,
} from '@screenly/edge-apps'
// Side-effect import: registers <auto-scaler> as a custom element
import '@screenly/edge-apps/components'
import { fetchCalendarEventsFromICal } from './events.js'
import {
  formatCountdown,
  formatDayLabel,
  formatEventTime,
  formatStartTime,
  getTitleSizeClass,
  groupByDay,
  isOngoing,
  selectUpcoming,
  toScheduleEvent,
  type ScheduleEvent,
  type TimeRange,
} from './schedule.js'

const EVENTS_REFRESH_MS = 5 * 60 * 1000
const TICK_MS = 30 * 1000
const LATER_CAPACITY_LANDSCAPE = 6
const LATER_CAPACITY_PORTRAIT = 9

const EMPTY_MESSAGE = 'Nothing scheduled'
const UNAVAILABLE_MESSAGE = 'Calendar unavailable'

let dateEl: Element | null
let clockEl: Element | null
let logoEl: HTMLImageElement | null
let nextEl: Element | null
let nextWhenEl: Element | null
let nextTimeEl: Element | null
let nextTitleEl: Element | null
let laterEl: Element | null
let statusEl: Element | null

let events: ScheduleEvent[] = []
let range: TimeRange = 'schedule'
let nextEventOnly = false
let timezone = 'UTC'
let locale = 'en'
let hasLoaded = false

function laterCapacity(): number {
  return isPortrait() ? LATER_CAPACITY_PORTRAIT : LATER_CAPACITY_LANDSCAPE
}

function createEventEntry(event: ScheduleEvent, now: Date): HTMLLIElement {
  const entry = document.createElement('li')
  entry.className = 'agenda-event'
  entry.classList.toggle('is-now', isOngoing(event, now))

  const time = document.createElement('span')
  time.className = 'agenda-event-time'
  time.textContent = formatStartTime(event, locale, timezone)

  const title = document.createElement('span')
  title.className = 'agenda-event-title'
  title.textContent = event.title

  entry.append(time, title)
  return entry
}

function createDaySection(
  label: string,
  dayEvents: ScheduleEvent[],
  now: Date,
): HTMLElement {
  const section = document.createElement('div')
  section.className = 'agenda-day'

  const heading = document.createElement('p')
  heading.className = 'agenda-day-label'
  heading.textContent = label

  const list = document.createElement('ul')
  list.className = 'agenda-day-events'
  list.append(...dayEvents.map((event) => createEventEntry(event, now)))

  section.append(heading, list)
  return section
}

function renderNext(event: ScheduleEvent, now: Date): void {
  nextEl?.classList.toggle('is-now', isOngoing(event, now))

  if (nextWhenEl) {
    nextWhenEl.textContent =
      formatCountdown(event, now, locale) ||
      formatDayLabel(event.start, now, locale, timezone)
  }

  if (nextTimeEl) {
    nextTimeEl.textContent = formatEventTime(event, locale, timezone)
  }

  if (nextTitleEl) {
    nextTitleEl.textContent = event.title
    nextTitleEl.className =
      `agenda-next-title ${getTitleSizeClass(event.title)}`.trim()
  }
}

function renderLater(upcoming: ScheduleEvent[], now: Date): void {
  document.body.classList.toggle('has-nothing-later', upcoming.length === 0)

  if (!laterEl) return

  laterEl.replaceChildren()

  const visible = upcoming.slice(0, laterCapacity())
  const sections = groupByDay(visible, timezone).map((group) =>
    createDaySection(
      formatDayLabel(group.start, now, locale, timezone),
      group.events,
      now,
    ),
  )
  laterEl.append(...sections)

  const hidden = upcoming.length - visible.length
  if (hidden <= 0) return

  const more = document.createElement('p')
  more.className = 'agenda-more'
  more.textContent = `+${hidden} more`
  laterEl.append(more)
}

function renderHeader(now: Date): void {
  if (dateEl) {
    dateEl.textContent = formatLocalizedDate(now, locale, {
      timeZone: timezone,
      weekday: 'long',
    })
  }

  if (!clockEl) return

  const time = formatTime(now, locale, timezone)
  const period = time.dayPeriod ? ` ${time.dayPeriod}` : ''
  clockEl.textContent = `${time.hour}:${time.minute}${period}`
}

function setStatus(message: string): void {
  document.body.classList.toggle('has-status', Boolean(message))
  if (statusEl) {
    statusEl.textContent = message
  }
}

function render(): void {
  const now = new Date()
  renderHeader(now)

  const upcoming = selectUpcoming(events, now, range, timezone)
  const [next, ...later] = upcoming

  if (!next) {
    setStatus(hasLoaded ? EMPTY_MESSAGE : UNAVAILABLE_MESSAGE)
    return
  }

  setStatus('')
  renderNext(next, now)

  // A room panel shows one event and nothing else
  if (nextEventOnly) return

  renderLater(later, now)
}

async function refresh(): Promise<void> {
  try {
    const calendarEvents = await fetchCalendarEventsFromICal()
    events = calendarEvents.map(toScheduleEvent)
    hasLoaded = true
  } catch (error) {
    console.error('Failed to fetch calendar events:', error)
  }
}

async function setupLogo(): Promise<void> {
  if (!logoEl) return

  logoEl.onerror = () => {
    console.error('Failed to load branding logo')
    logoEl?.classList.add('is-hidden')
  }
  logoEl.src = await setupBrandingLogo()
}

function cacheElements(): void {
  dateEl = document.querySelector('[data-date]')
  clockEl = document.querySelector('[data-clock]')
  logoEl = document.querySelector('[data-logo]')
  nextEl = document.querySelector('[data-next]')
  nextWhenEl = document.querySelector('[data-next-when]')
  nextTimeEl = document.querySelector('[data-next-time]')
  nextTitleEl = document.querySelector('[data-next-title]')
  laterEl = document.querySelector('[data-later]')
  statusEl = document.querySelector('[data-status]')
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupErrorHandling()

    const { primary } = setupTheme()
    document.body.classList.toggle('is-light-brand', isLightColor(primary))

    cacheElements()

    range = getSettingWithDefault<TimeRange>('calendar_mode', 'schedule')
    nextEventOnly = getSettingWithDefault('next_event_only', false)
    document.body.classList.toggle('is-next-only', nextEventOnly)
    timezone = await getTimeZone()
    locale = await getLocale()

    await setupLogo()
    await refresh()

    render()
    setInterval(render, TICK_MS)
    setInterval(() => {
      refresh()
        .then(render)
        .catch((error) => console.error('Failed to refresh calendar:', error))
    }, EVENTS_REFRESH_MS)
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }

  signalReady()
})
