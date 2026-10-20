import type { CalendarEvent } from '@screenly/edge-apps'

export type TimeRange = 'daily' | 'weekly' | 'schedule'

export interface ScheduleEvent {
  id?: string
  title: string
  start: Date
  end: Date
  isAllDay: boolean
}

export interface DayGroup {
  key: string
  start: Date
  events: ScheduleEvent[]
}

const ALL_DAY_LABEL = 'All day'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

const RANGE_DAYS: Record<Exclude<TimeRange, 'daily'>, number> = {
  weekly: 7,
  schedule: 30,
}

export const MAX_HORIZON_DAYS = RANGE_DAYS.schedule

/**
 * Long titles need a smaller size to stay readable in full on a one-event
 * screen. The thresholds are character counts, which track wrapped line count
 * closely enough for the fixed reference canvas.
 */
const LONG_TITLE_CHARS = 45
const VERY_LONG_TITLE_CHARS = 90

export function getTitleSizeClass(title: string): string {
  if (title.length > VERY_LONG_TITLE_CHARS) return 'is-very-long'
  if (title.length > LONG_TITLE_CHARS) return 'is-long'
  return ''
}

export function toScheduleEvent(event: CalendarEvent): ScheduleEvent {
  return {
    id: event.id,
    title: event.title,
    start: new Date(event.startTime),
    end: new Date(event.endTime),
    isAllDay: event.isAllDay,
  }
}

/**
 * Calendar day an instant falls on, as `YYYY-MM-DD` in the screen's timezone.
 * `en-CA` is used because it is the one common locale that formats dates in
 * that order, which makes the key sortable as a string.
 */
export function getDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isOngoing(event: ScheduleEvent, now: Date): boolean {
  return event.start.getTime() <= now.getTime() && event.end > now
}

function isWithinRange(
  event: ScheduleEvent,
  now: Date,
  range: TimeRange,
  timeZone: string,
): boolean {
  if (isOngoing(event, now)) return true

  if (range === 'daily') {
    return getDayKey(event.start, timeZone) === getDayKey(now, timeZone)
  }

  return event.start.getTime() < now.getTime() + RANGE_DAYS[range] * MS_PER_DAY
}

/**
 * Events still worth showing, soonest first. Anything that has already
 * finished is dropped, so the top of the list is always what happens next.
 * All-day events sort ahead of timed ones because they frame the whole day.
 */
export function selectUpcoming(
  events: ScheduleEvent[],
  now: Date,
  range: TimeRange,
  timeZone: string,
): ScheduleEvent[] {
  return events
    .filter((event) => event.end > now)
    .filter((event) => isWithinRange(event, now, range, timeZone))
    .sort((a, b) => {
      const dayComparison = getDayKey(a.start, timeZone).localeCompare(
        getDayKey(b.start, timeZone),
      )
      if (dayComparison !== 0) return dayComparison
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
      return a.start.getTime() - b.start.getTime()
    })
}

export function groupByDay(
  events: ScheduleEvent[],
  timeZone: string,
): DayGroup[] {
  const groups: DayGroup[] = []

  for (const event of events) {
    const key = getDayKey(event.start, timeZone)
    const current = groups.at(-1)

    if (current?.key === key) {
      current.events.push(event)
      continue
    }

    groups.push({ key, start: event.start, events: [event] })
  }

  return groups
}

function timeFormatter(locale: string, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEventTime(
  event: ScheduleEvent,
  locale: string,
  timeZone: string,
): string {
  if (event.isAllDay) return ALL_DAY_LABEL

  return timeFormatter(locale, timeZone).formatRange(event.start, event.end)
}

export function formatStartTime(
  event: ScheduleEvent,
  locale: string,
  timeZone: string,
): string {
  if (event.isAllDay) return ALL_DAY_LABEL

  return timeFormatter(locale, timeZone).format(event.start)
}

/**
 * How far away an event is, in words, for anything starting within a day.
 * Returns an empty string further out, where the day label says it better.
 */
export function formatCountdown(
  event: ScheduleEvent,
  now: Date,
  locale: string,
): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (isOngoing(event, now)) return relative.format(0, 'second')

  const millisecondsAway = event.start.getTime() - now.getTime()
  if (millisecondsAway >= MS_PER_DAY) return ''

  if (millisecondsAway < MS_PER_HOUR) {
    return relative.format(
      Math.round(millisecondsAway / MS_PER_MINUTE),
      'minute',
    )
  }

  return relative.format(Math.round(millisecondsAway / MS_PER_HOUR), 'hour')
}

export function formatDayLabel(
  date: Date,
  now: Date,
  locale: string,
  timeZone: string,
): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const dayKey = getDayKey(date, timeZone)
  const tomorrow = new Date(now.getTime() + MS_PER_DAY)

  if (dayKey === getDayKey(now, timeZone)) return relative.format(0, 'day')
  if (dayKey === getDayKey(tomorrow, timeZone)) return relative.format(1, 'day')

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}
