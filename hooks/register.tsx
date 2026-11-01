import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Reading } from '../types'
import { BAR_HEIGHT, BAR_WIDTH, SPECS, barSvg, detailsFor, formatAge, measure } from './pace'

const reading = atom({ plugin: 'pacergram', key: 'reading' } as const, null)
const now = atom({ plugin: 'pacergram', key: 'now' } as const, 0)
const isExpanded = atom({ plugin: 'pacergram', key: 'isExpanded' } as const, false)

const MINUTE = 60_000
const STALE = 5 * MINUTE
const EXPANDED_KEY = 'isExpanded'

async function keep($: EngineInterface, windows: readonly SessionRateLimit[]): Promise<void> {
  if (windows.length === 0) {
    return
  }

  const readAt = await $.clock.now()
  const value: Reading = {
    windows: windows.map(w => ({ kind: w.kind, percentUsed: w.percentUsed, resetsAt: w.resetsAt })),
    readAt,
  }
  await update($, reading, () => value)
  await update($, now, () => readAt)
}

async function toggle($: EngineInterface): Promise<void> {
  const value = !(await read($, isExpanded))
  await update($, isExpanded, () => value)
  await $.store.set(EXPANDED_KEY, value)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    if ((await read($, reading)) === null) {
      await keep($, (await $.session.usage()).rateLimits)
    }

    const stored = (await $.store.get(EXPANDED_KEY)) === true
    await update($, isExpanded, () => stored)

    const startedAt = await $.clock.now()
    await update($, now, () => startedAt)
    $.clock.every(MINUTE, () => {
      void $.clock.now().then(t => update($, now, () => t))
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await keep($, e.rateLimits)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }

    const r = await read($, reading)
    if (r === null) {
      return next(e)
    }

    const t = Math.max(await read($, now), r.readAt)
    const expanded = await read($, isExpanded)
    const { Box, Text, Button, Svg } = $.ui.resolve(e)

    const columns = SPECS.map(spec => {
      const w = r.windows.find(x => x.kind === spec.kind)
      const percentUsed = w?.percentUsed ?? 0
      const resetsAt = w?.resetsAt === undefined ? undefined : Date.parse(w.resetsAt)
      const bar = measure(spec, percentUsed, resetsAt, t)
      const details = detailsFor(spec, percentUsed, resetsAt ?? 0, t, bar)
      const label = bar.isIdle ? 'idle' : `${percentUsed.toFixed(1)} / ${bar.pace.toFixed(1)}%`

      return (
        <Box key={spec.kind} flexDirection="column">
          <Box key={`bar-${spec.kind}`} flexDirection="row" alignItems="center" gap={1}>
            <Text dimColor>{spec.label}</Text>
            <Svg source={barSvg(bar, `clip-${spec.kind}`)} alt={details.summary} width={BAR_WIDTH} height={BAR_HEIGHT} />
            <Button key={`toggle-${spec.kind}`} plain onPress={() => toggle($)}>
              {bar.isIdle ? <Text dimColor>{label}</Text> : label}
            </Button>
            <Box
              position="absolute"
              top={-3}
              left={0}
              display="none"
              hover={{ display: 'flex' }}
              borderStyle="round"
              borderDimColor
              backgroundColor="inverseText"
              paddingX={1}
            >
              <Text>{details.summary}</Text>
            </Box>
          </Box>
          {expanded ? (
            <Box flexDirection="column" paddingLeft={3}>
              <Text dimColor>{details.summary}</Text>
              {details.headroom === '' ? null : <Text dimColor>{details.headroom}</Text>}
              {details.reset === '' ? null : <Text dimColor>{details.reset}</Text>}
            </Box>
          ) : null}
        </Box>
      )
    })

    const age = t - r.readAt

    return (
      <Box flexDirection="row" alignItems="flex-start" gap={3}>
        {columns}
        {age > STALE ? <Text dimColor>{formatAge(age)}</Text> : null}
      </Box>
    )
  })
}
