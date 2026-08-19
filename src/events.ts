import ical from 'ical.js'
import { getSettingWithDefault } from '@screenly/edge-apps'
import type { CalendarEvent } from '@screenly/edge-apps'
import { MAX_HORIZON_DAYS } from './schedule.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const fetchCalendarEventsFromICal = async (): Promise<
  CalendarEvent[]
> => {
  try {
    const screenlySettings = screenly.settings
    const { ical_url: icalUrl } = screenlySettings
    const corsProxy = screenly.cors_proxy_url
    const bypassCors = getSettingWithDefault('bypass_cors', false)
    const icalUrlWithProxy = bypassCors
      ? `${corsProxy}/${icalUrl as string}`
      : (icalUrl as string)

    const response = await fetch(icalUrlWithProxy)

    if (!response.ok) {
      throw new Error('Failed to fetch iCal feed')
    }

    const icalData = await response.text()
    const jcalData = ical.parse(icalData)
    const vcalendar = new ical.Component(jcalData)
    const vevents = vcalendar.getAllSubcomponents('vevent')

    const now = Date.now()
    const horizonTimestamp = now + MAX_HORIZON_DAYS * MS_PER_DAY

    const chunkSize = 100
    const events: CalendarEvent[] = []

    for (let i = 0; i < vevents.length; i += chunkSize) {
      const chunk = vevents.slice(i, i + chunkSize)

      chunk.forEach((vevent) => {
        const event = new ical.Event(vevent)
        const eventStart = event.startDate.toJSDate()
        const eventEnd = event.endDate.toJSDate()

        if (eventStart.getTime() >= horizonTimestamp) return
        if (eventEnd.getTime() <= now) return

        events.push({
          id: event.uid || undefined,
          title: event.summary || 'Busy',
          startTime: eventStart.toISOString(),
          endTime: eventEnd.toISOString(),
          isAllDay: event.startDate.isDate,
        })
      })

      if (i % (chunkSize * 3) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    events.sort((a, b) => a.startTime.localeCompare(b.startTime))

    return events
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Error fetching calendar events: ${errorMessage}`, {
      cause: error,
    })
  }
}
