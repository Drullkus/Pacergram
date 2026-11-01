const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type Spec = { kind: string; label: string; length: number; tick: number }

export const SPECS: readonly Spec[] = [
  { kind: 'seven_day', label: '7d', length: 7 * DAY, tick: DAY },
  { kind: 'five_hour', label: '5h', length: 5 * HOUR, tick: HOUR },
]

export type Grade = 'under' | 'near' | 'over'

export type Bar =
  | { isIdle: true }
  | { isIdle: false; pace: number; fill: number; grade: Grade; ticks: number[] }

export const NEAR = 0.9

export function measure(spec: Spec, percentUsed: number, resetsAt: number | undefined, now: number): Bar {
  if (resetsAt === undefined || !Number.isFinite(resetsAt) || resetsAt <= now) {
    return { isIdle: true }
  }

  const elapsed = Math.min(Math.max(now - (resetsAt - spec.length), 0), spec.length)
  // The pace never reads lower than the first checkpoint.
  const span = Math.max(elapsed, spec.tick)
  const pace = (span / spec.length) * 100
  const ratio = percentUsed / pace
  const grade: Grade = percentUsed > pace ? 'over' : ratio >= NEAR ? 'near' : 'under'

  const ticks: number[] = []
  for (let t = spec.tick; t < span; t += spec.tick) {
    ticks.push(t / span)
  }

  return { isIdle: false, pace, fill: grade === 'over' ? 1 : ratio, grade, ticks }
}

export const IDLE_NOTE = 'Idle: the window starts with your next message.'

export function formatCountdown(ms: number): string {
  const total = Math.max(Math.floor(ms / MINUTE), 0)
  const d = Math.floor(total / (24 * 60))
  const h = Math.floor((total % (24 * 60)) / 60)
  const m = total % 60
  if (d > 0) {
    return `${d}d ${h}h ${m}m`
  }
  if (h > 0) {
    return `${h}h ${m}m`
  }
  return `${m}m`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatClock(at: Date): string {
  const h = at.getHours()
  const m = String(at.getMinutes()).padStart(2, '0')
  return `${h % 12 === 0 ? 12 : h % 12}:${m}${h < 12 ? 'am' : 'pm'}`
}

export function formatWhen(spec: Spec, resetsAt: number, now: number): string {
  const at = new Date(resetsAt)
  const isSameDay = at.toDateString() === new Date(now).toDateString()
  return spec.kind === 'five_hour' && isSameDay ? formatClock(at) : `${DAYS[at.getDay()]} ${formatClock(at)}`
}

export type Details = { summary: string; headroom: string; reset: string }

export function detailsFor(spec: Spec, percentUsed: number, resetsAt: number, now: number, bar: Bar): Details {
  if (bar.isIdle) {
    return { summary: IDLE_NOTE, headroom: '', reset: '' }
  }

  const summary = `Usage ${percentUsed.toFixed(1)}% · Pace ${bar.pace.toFixed(1)}%`
  const untilReset = `Resets in ${formatCountdown(resetsAt - now)}`
  let headroom: string
  if (bar.grade !== 'over') {
    headroom = `${(bar.pace - percentUsed).toFixed(1)} points left before pace`
  } else {
    const caughtUpAt = resetsAt - spec.length + (percentUsed / 100) * spec.length
    headroom = caughtUpAt >= resetsAt ? untilReset : `Back on pace in ${formatCountdown(caughtUpAt - now)}`
  }

  return {
    summary,
    headroom,
    reset: `Resets ${formatWhen(spec, resetsAt, now)} · in ${formatCountdown(resetsAt - now)}`,
  }
}

export function formatAge(ms: number): string {
  if (ms < HOUR) {
    return `${Math.floor(ms / MINUTE)}m ago`
  }
  if (ms < DAY) {
    return `${Math.floor(ms / HOUR)}h ago`
  }
  return `${Math.floor(ms / DAY)}d ago`
}

const COLORS: Record<Grade, string> = {
  under: '#2f9e44',
  near: '#e0a800',
  over: '#e03131',
}

export const BAR_WIDTH = 180
export const BAR_HEIGHT = 10

export function barSvg(bar: Bar, id: string): string {
  const w = BAR_WIDTH
  const h = BAR_HEIGHT
  const fill = bar.isIdle ? '' : `<rect width="${(bar.fill * w).toFixed(2)}" height="${h}" fill="${COLORS[bar.grade]}"/>`
  const ticks = bar.isIdle
    ? ''
    : bar.ticks
        .map(f => `<line x1="${(f * w).toFixed(2)}" y1="0" x2="${(f * w).toFixed(2)}" y2="${h}" stroke="#808080" stroke-width="1.5"/>`)
        .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<clipPath id="${id}"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath>` +
    `<g clip-path="url(#${id})"><rect width="${w}" height="${h}" fill="rgba(128,128,128,0.25)"/>${fill}${ticks}</g>` +
    `</svg>`
  )
}
