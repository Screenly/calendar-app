import { describe, expect, test } from 'bun:test'
import {
  formatCountdown,
  formatDayLabel,
  formatEventTime,
  formatStartTime,
  getDayKey,
  getTitleSizeClass,
  groupByDay,
  isOngoing,
  selectUpcoming,
  toScheduleEvent,
  type ScheduleEvent,
} from './schedule'

const TIMEZONE = 'Europe/London'
const LOCALE = 'en-GB'
const NOW = new Date('2026-08-12T12:00:00Z')

function makeEvent(
  title: string,
  start: string,
  end: string,
  isAllDay = false,
): ScheduleEvent {
  return {
    id: title,
    title,
    start: new Date(start),
    end: new Date(end),
    isAllDay,
  }
}

describe('toScheduleEvent', () => {
  test('parses the ISO timestamps into dates', () => {
    const event = toScheduleEvent({
      id: 'abc',
      title: 'Standup',
      startTime: '2026-08-12T09:00:00.000Z',
      endTime: '2026-08-12T09:15:00.000Z',
      isAllDay: false,
    })

    expect(event.title).toBe('Standup')
    expect(event.start.toISOString()).toBe('2026-08-12T09:00:00.000Z')
    expect(event.end.toISOString()).toBe('2026-08-12T09:15:00.000Z')
    expect(event.isAllDay).toBe(false)
  })
})

describe('getDayKey', () => {
  test('uses the calendar day in the given timezone', () => {
    const lateEvening = new Date('2026-08-12T23:30:00Z')

    expect(getDayKey(lateEvening, 'Europe/London')).toBe('2026-08-13')
    expect(getDayKey(lateEvening, 'America/New_York')).toBe('2026-08-12')
  })
})

describe('isOngoing', () => {
  test('is true while an event is running', () => {
    const event = makeEvent(
      'Workshop',
      '2026-08-12T11:00:00Z',
      '2026-08-12T13:00:00Z',
    )

    expect(isOngoing(event, NOW)).toBe(true)
  })

  test('is false once an event has ended', () => {
    const event = makeEvent(
      'Workshop',
      '2026-08-12T09:00:00Z',
      '2026-08-12T10:00:00Z',
    )

    expect(isOngoing(event, NOW)).toBe(false)
  })
})

const finished = makeEvent(
  'Finished',
  '2026-08-12T08:00:00Z',
  '2026-08-12T09:00:00Z',
)
const running = makeEvent(
  'Running',
  '2026-08-12T11:30:00Z',
  '2026-08-12T12:30:00Z',
)
const laterToday = makeEvent(
  'Later today',
  '2026-08-12T16:00:00Z',
  '2026-08-12T17:00:00Z',
)
const nextWeek = makeEvent(
  'Next week',
  '2026-08-18T10:00:00Z',
  '2026-08-18T11:00:00Z',
)

describe('selectUpcoming', () => {
  test('drops events that have already ended', () => {
    const result = selectUpcoming(
      [finished, laterToday],
      NOW,
      'schedule',
      TIMEZONE,
    )

    expect(result.map((event) => event.title)).toEqual(['Later today'])
  })

  test('keeps a running event at the front', () => {
    const result = selectUpcoming(
      [laterToday, running],
      NOW,
      'schedule',
      TIMEZONE,
    )

    expect(result.map((event) => event.title)).toEqual([
      'Running',
      'Later today',
    ])
  })

  test('limits the daily range to the current day', () => {
    const result = selectUpcoming(
      [laterToday, nextWeek],
      NOW,
      'daily',
      TIMEZONE,
    )

    expect(result.map((event) => event.title)).toEqual(['Later today'])
  })

  test('limits the weekly range to the next seven days', () => {
    const beyondWeek = makeEvent(
      'Beyond',
      '2026-08-25T10:00:00Z',
      '2026-08-25T11:00:00Z',
    )
    const result = selectUpcoming(
      [nextWeek, beyondWeek],
      NOW,
      'weekly',
      TIMEZONE,
    )

    expect(result.map((event) => event.title)).toEqual(['Next week'])
  })

  test('sorts all-day events ahead of timed events on the same day', () => {
    const allDay = makeEvent(
      'Company offsite',
      '2026-08-13T00:00:00Z',
      '2026-08-14T00:00:00Z',
      true,
    )
    const timed = makeEvent(
      'Review',
      '2026-08-13T09:00:00Z',
      '2026-08-13T10:00:00Z',
    )
    const result = selectUpcoming([timed, allDay], NOW, 'schedule', TIMEZONE)

    expect(result.map((event) => event.title)).toEqual([
      'Company offsite',
      'Review',
    ])
  })
})

describe('groupByDay', () => {
  test('groups consecutive events that fall on the same day', () => {
    const events = [
      makeEvent('One', '2026-08-12T14:00:00Z', '2026-08-12T15:00:00Z'),
      makeEvent('Two', '2026-08-12T16:00:00Z', '2026-08-12T17:00:00Z'),
      makeEvent('Three', '2026-08-13T09:00:00Z', '2026-08-13T10:00:00Z'),
    ]

    const groups = groupByDay(events, TIMEZONE)

    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('2026-08-12')
    expect(groups[0].events.map((event) => event.title)).toEqual(['One', 'Two'])
    expect(groups[1].key).toBe('2026-08-13')
    expect(groups[1].events.map((event) => event.title)).toEqual(['Three'])
  })

  test('returns nothing for an empty list', () => {
    expect(groupByDay([], TIMEZONE)).toEqual([])
  })
})

describe('formatEventTime', () => {
  test('shows a start and end time', () => {
    const event = makeEvent(
      'Review',
      '2026-08-12T14:00:00Z',
      '2026-08-12T15:30:00Z',
    )

    // Intl spaces the range dash differently between ICU versions, so match
    // the times rather than the separator
    expect(formatEventTime(event, LOCALE, TIMEZONE)).toMatch(
      /^15:00\s*–\s*16:30$/,
    )
  })

  test('labels all-day events', () => {
    const event = makeEvent(
      'Offsite',
      '2026-08-13T00:00:00Z',
      '2026-08-14T00:00:00Z',
      true,
    )

    expect(formatEventTime(event, LOCALE, TIMEZONE)).toBe('All day')
  })
})

describe('formatStartTime', () => {
  test('shows only the start time', () => {
    const event = makeEvent(
      'Review',
      '2026-08-12T14:00:00Z',
      '2026-08-12T15:30:00Z',
    )

    expect(formatStartTime(event, LOCALE, TIMEZONE)).toBe('15:00')
  })
})

describe('formatCountdown', () => {
  test('reports a running event as now', () => {
    const event = makeEvent(
      'Running',
      '2026-08-12T11:30:00Z',
      '2026-08-12T12:30:00Z',
    )

    expect(formatCountdown(event, NOW, LOCALE)).toBe('now')
  })

  test('counts down in minutes within the hour', () => {
    const event = makeEvent(
      'Soon',
      '2026-08-12T12:25:00Z',
      '2026-08-12T13:00:00Z',
    )

    expect(formatCountdown(event, NOW, LOCALE)).toBe('in 25 minutes')
  })

  test('counts down in hours within the day', () => {
    const event = makeEvent(
      'Tonight',
      '2026-08-12T17:00:00Z',
      '2026-08-12T18:00:00Z',
    )

    expect(formatCountdown(event, NOW, LOCALE)).toBe('in 5 hours')
  })

  test('says nothing for events more than a day away', () => {
    const event = makeEvent(
      'Next week',
      '2026-08-18T10:00:00Z',
      '2026-08-18T11:00:00Z',
    )

    expect(formatCountdown(event, NOW, LOCALE)).toBe('')
  })
})

describe('formatDayLabel', () => {
  test('names today and tomorrow', () => {
    const today = new Date('2026-08-12T16:00:00Z')
    const tomorrow = new Date('2026-08-13T09:00:00Z')

    expect(formatDayLabel(today, NOW, LOCALE, TIMEZONE)).toBe('today')
    expect(formatDayLabel(tomorrow, NOW, LOCALE, TIMEZONE)).toBe('tomorrow')
  })

  test('spells out any other day', () => {
    const later = new Date('2026-08-18T09:00:00Z')

    expect(formatDayLabel(later, NOW, LOCALE, TIMEZONE)).toBe(
      'Tuesday 18 August',
    )
  })
})

describe('getTitleSizeClass', () => {
  test('leaves a short title at the full size', () => {
    expect(getTitleSizeClass('Standup')).toBe('')
    expect(getTitleSizeClass('a'.repeat(45))).toBe('')
  })

  test('steps down for a long title', () => {
    expect(getTitleSizeClass('a'.repeat(46))).toBe('is-long')
    expect(getTitleSizeClass('a'.repeat(90))).toBe('is-long')
  })

  test('steps down again for a very long title', () => {
    expect(getTitleSizeClass('a'.repeat(91))).toBe('is-very-long')
  })
})
