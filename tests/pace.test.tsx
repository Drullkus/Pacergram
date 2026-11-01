import { describe, expect, mock, test } from 'claude-code/testing'

import { IDLE_NOTE, SPECS, detailsFor, formatAge, formatClock, formatCountdown, measure } from '../hooks/pace'

const HOUR = 3_600_000
const WEEK = SPECS[0]!
const FIVE = SPECS[1]!

const RESET = Date.parse('2026-11-04T13:00:00Z')
const SATURDAY = Date.parse('2026-10-31T13:00:00Z')

const BAND = {
  plugin: 'pacergram',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

describe('measure', () => {
  test('three days into the week, the pace is 42.9% with two ticks', async () => {
    const bar = measure(WEEK, 38.2, RESET, SATURDAY)
    if (bar.isIdle) throw new Error('idle')
    expect(bar.pace.toFixed(1)).toBe('42.9')
    expect(bar.grade).toBe('under')
    expect(bar.ticks.map(t => t.toFixed(3))).toEqual(['0.333', '0.667'])
  })

  test('usage from 90% of pace is near, past pace is over', async () => {
    expect(measure(WEEK, 40, RESET, SATURDAY)).toMatchObject({ grade: 'near' })
    expect(measure(WEEK, 43, RESET, SATURDAY)).toMatchObject({ grade: 'over', fill: 1 })
  })

  test('the weekly pace is never below one day', async () => {
    const bar = measure(WEEK, 5, RESET, RESET - 7 * 24 * HOUR + 5 * 60_000)
    if (bar.isIdle) throw new Error('idle')
    expect(bar.pace.toFixed(1)).toBe('14.3')
    expect(bar.ticks).toEqual([])
  })

  test('the 5-hour pace is never below one hour', async () => {
    const bar = measure(FIVE, 5, SATURDAY + 4.5 * HOUR, SATURDAY)
    if (bar.isIdle) throw new Error('idle')
    expect(bar.pace).toBe(20)
  })

  test('a window with no reset time is idle', async () => {
    expect(measure(FIVE, 0, undefined, SATURDAY)).toEqual({ isIdle: true })
  })

  test('ages read in minutes, hours and days', async () => {
    expect(formatAge(12 * 60_000)).toBe('12m ago')
    expect(formatAge(3 * HOUR)).toBe('3h ago')
    expect(formatAge(50 * HOUR)).toBe('2d ago')
  })
})

describe('details', () => {
  test('countdowns drop leading zero units only', async () => {
    expect(formatCountdown((2 * 24 + 3) * HOUR + 5 * 60_000)).toBe('2d 3h 5m')
    expect(formatCountdown(3 * HOUR + 5 * 60_000)).toBe('3h 5m')
    expect(formatCountdown(4 * 24 * HOUR)).toBe('4d 0h 0m')
    expect(formatCountdown(59_000)).toBe('0m')
  })

  test('under pace, headroom reads the points left', async () => {
    const bar = measure(WEEK, 38.2, RESET, SATURDAY)
    const d = detailsFor(WEEK, 38.2, RESET, SATURDAY, bar)
    expect(d.summary).toBe('Usage 38.2% · Pace 42.9%')
    expect(d.headroom).toBe('4.7 points left before pace')
    const at = new Date(RESET)
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()]
    expect(d.reset).toBe(`Resets ${day} ${formatClock(at)} · in 4d 0h 0m`)
  })

  test('over pace, headroom reads the wait until pace catches up', async () => {
    // 45% of a week is 3.15 days, so pace catches up 0.15 days (3h 36m) after Saturday 1pm.
    const bar = measure(WEEK, 45, RESET, SATURDAY)
    expect(detailsFor(WEEK, 45, RESET, SATURDAY, bar).headroom).toBe('Back on pace in 3h 36m')
  })

  test('over pace past the reset, headroom reads the reset countdown', async () => {
    const resetsAt = SATURDAY + 4 * HOUR
    const bar = measure(FIVE, 100, resetsAt, SATURDAY)
    expect(detailsFor(FIVE, 100, resetsAt, SATURDAY, bar).headroom).toBe('Resets in 4h 0m')
  })

  test('a 5-hour reset on the same day names the time only', async () => {
    const resetsAt = new Date(2026, 9, 31, 16, 30).getTime()
    const now = new Date(2026, 9, 31, 13, 0).getTime()
    const bar = measure(FIVE, 9, resetsAt, now)
    expect(detailsFor(FIVE, 9, resetsAt, now, bar).reset).toBe('Resets 4:30pm · in 3h 30m')
  })

  test('an idle window reads the idle note', async () => {
    expect(detailsFor(FIVE, 0, 0, SATURDAY, { isIdle: true }).summary).toBe(IDLE_NOTE)
  })
})

test('the band shows usage over pace, an idle 5-hour bar and the age', async ($, on) => {
  const clock = mock.clock(on, { now: SATURDAY })
  const saved: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: saved[e.key] }))
  on('store.set', (_, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: {
      startedAt: SATURDAY,
      context: { window: 200_000 },
      rateLimits: [{ kind: 'seven_day', percentUsed: 38.2, resetsAt: '2026-11-04T13:00:00Z' }],
    },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ key: 'toggle-seven_day' }))?.text).toBe('38.2 / 42.9%')
  expect((await ui.find({ key: 'toggle-five_hour' }))?.text).toBe('idle')
  expect(await ui.find({ type: 'Text', text: /ago/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /points left/ })).toBeUndefined()

  await ui.press({ key: 'toggle-seven_day' })
  expect((await ui.find({ type: 'Text', text: /points left/ }))?.text).toBe('4.7 points left before pace')
  expect(saved.isExpanded).toBe(true)

  await clock.advance(6 * 60_000)
  expect((await ui.find({ type: 'Text', text: /ago/ }))?.text).toBe('6m ago')

  await ui.press({ key: 'toggle-five_hour' })
  expect(await ui.find({ type: 'Text', text: /points left/ })).toBeUndefined()
  expect(saved.isExpanded).toBe(false)
  await ui.unmount()
})

test('the band draws nothing on the terminal', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('state.get', () => ({
    value: { value: { windows: [], readAt: SATURDAY }, version: 1 },
  }))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})
