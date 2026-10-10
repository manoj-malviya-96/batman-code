import { atom, read, update } from 'claude-code'
import type { Register, Ctx } from 'claude-code'

import type { Career, Gadget, Header } from '../types'

const header = atom({ plugin: 'batman-code', key: 'header' } as const, {
  model: '',
  user: '',
  branch: '',
} as Header)
const open = atom({ plugin: 'batman-code', key: 'open' } as const, [] as readonly string[])

const gadgets = atom({ plugin: 'batman-code', key: 'gadgets' } as const, [] as readonly Gadget[])
const career = atom({ plugin: 'batman-code', key: 'career' } as const, { turns: 0 } as Career)

const PANE = 'batcomputer'
const QUIET = '🦇 Gotham: quiet'

const GADGET_NAMES: Readonly<Record<string, string>> = {
  Bash: 'Utility Belt',
  Read: 'Detective Mode',
  Grep: 'Batcomputer query',
  Edit: 'Batarang',
  Write: 'Batarang',
}

const gadgetName = (tool: string) => GADGET_NAMES[tool] ?? tool

const FORBIDDEN: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\brm\s+(-\w*r\w*f|-\w*f\w*r)\b/, why: 'a recursive forced delete' },
  { pattern: /\bgit\s+push\b.*(--force\b|\s-f\b)/, why: 'a forced push' },
  { pattern: /\bgit\s+reset\s+--hard\b/, why: 'a hard reset' },
]

const CONCISE = 'Be concise. Lead with the result. No preamble, recap or narration. Do not paste logs or tool output; summarize in one line. Load minimal context.'

const TOOLING =
  'If a .codegraph/ directory exists at the repo root, call codegraph_explore BEFORE grep, find or reading files to locate or understand code; name the symbols or files in the query. Without .codegraph/, skip CodeGraph and use the normal tools. Command output is condensed by RTK: treat it as complete, batch related commands into one call, and re-run as `rtk proxy <cmd>` only when a result is empty, garbled or contradicts its exit code.'

const PERSONA = 'You are Alfred Pennyworth, loyal butler to the user, whom you address as "Master Bruce". The user gives the commands; you carry them out with dry British wit and brief, dignified phrasing, in the spirit of Batman and Alfred. Never let the persona make answers longer or less accurate.'

const DONE = ['Done, Master Bruce.', 'As you wished, sir.', 'The deed is done.', 'Consider it handled, Master Bruce.']

const GREETING = 'How are you Master Bruce ?'

const RANKS = [
  { name: 'Recruit', from: 0 },
  { name: 'Robin', from: 10 },
  { name: 'Nightwing', from: 30 },
  { name: 'Dark Knight', from: 75 },
  { name: 'The Batman', from: 150 },
] as const

const rankOf = (turns: number) => {
  const i = RANKS.reduce((best, r, idx) => (turns >= r.from ? idx : best), 0)
  return { rank: RANKS[i], next: RANKS[i + 1] }
}

const meter = (value: number, max: number, width = 10) => {
  const filled = Math.round(Math.min(1, value / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const threatOf = (list: readonly Gadget[]) => {
  const recent = list.slice(-10).filter(g => g.isErrored).length
  if (recent >= 4) return { label: 'CRITICAL', color: 'red', recent }
  if (recent >= 2) return { label: 'ALERT', color: 'yellow', recent }
  return { label: 'CALM', color: 'green', recent }
}

const VILLAINS = ['The Joker', 'The Riddler', 'Two-Face', 'The Penguin', 'Bane', 'Scarecrow']

const SKYLINE = '▁▂▃▅█▆▃▂▁▂▅▇█▇▅▂▁▃▆█▅▃▁▂▄▇█▆▄▂▁'

const out = async ($: Ctx, argv: readonly string[]) => {
  try {
    return (await $.process.run(argv)).stdout.trim()
  } catch {
    return ''
  }
}

const refresh = async ($: Ctx) => {
  const [model, user, branch] = await Promise.all([
    $.session.model(),
    out($, ['git', 'config', 'user.name']),
    out($, ['git', 'branch', '--show-current']),
  ])
  await update($, header, () => ({ model, user, branch }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($)
    const turns = Number((await $.store.get('turns')) ?? 0)
    await update($, career, () => ({ turns }))
    await $.command.register({
      name: 'batcomputer',
      description: 'Open the Batcomputer: a live log of the gadgets used this session',
    })
    $.ui.status(QUIET)
    $.ui.toast(GREETING)
    return next(e)
  })

  on('command.run', { command: 'batcomputer' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Batcomputer' })
    return { text: 'The Batcomputer is online, Master Bruce.' }
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const rule = FORBIDDEN.find(r => r.pattern.test(e.command))
    if (rule === undefined) return next(e)
    return {
      deny: `Rules of engagement: ${rule.why} is forbidden. Batman does not kill, and neither do we. Ask Master Bruce to do it himself.`,
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'Rules of engagement: the guard failed, so the call is held back.' },
  )

  on('tool.call', async ($, e, next) => {
    const gadget: Gadget = { id: e.tool_use_id, tool: gadgetName(e.tool), isDone: false, isErrored: false }
    await update($, gadgets, list => [...list, gadget].slice(-200))
    $.ui.status(`🔦 Signal lit: ${gadget.tool}`)
    const ran = await next(e)
    const isErrored = ran.deny !== undefined || ran.isError === true
    await update($, gadgets, list =>
      list.map(g => (g.id === gadget.id ? { ...g, isDone: true, isErrored } : g)),
    )
    const villain = VILLAINS[(await read($, gadgets)).length % VILLAINS.length]
    $.ui.status(isErrored ? `🚨 ${villain} sabotaged the ${gadget.tool}` : QUIET)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, gadgets)
    const { turns } = await read($, career)
    const { rank, next } = rankOf(turns)
    const threat = threatOf(list)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 12)
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">🦇 AGENT FILE</Text>
        <Text>{rank.name} · {turns} missions</Text>
        <Text color="yellow">{meter(turns - rank.from, next === undefined ? 1 : next.from - rank.from)} {next === undefined ? 'max rank' : `${next.from - turns} to ${next.name}`}</Text>
        <Text color={threat.color}>⚠ THREAT {threat.label} {meter(threat.recent, 4, 8)}</Text>
        <Text dimColor>── GADGET LOG ──</Text>
        {list.length === 0 && <Text dimColor>All quiet in Gotham.</Text>}
        {list.slice(-room).map(g => (
          <Text dimColor={g.isDone && !g.isErrored}>
            {g.isErrored ? '🚨' : g.isDone ? '✔' : '🔦'} {g.tool}
          </Text>
        ))}
      </Box>
    )
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    if (e.agentId === undefined) {
      const turns = Number((await $.store.get('turns')) ?? 0) + 1
      await $.store.set('turns', turns)
      await update($, career, () => ({ turns }))
      const { rank } = rankOf(turns)
      const isPromoted = turns > 0 && RANKS.some(r => r.from === turns)
      $.ui.toast(isPromoted ? `🦇 Promoted: ${rank.name}!` : DONE[(await $.session.turns()) % DONE.length])
    }
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return {
      sections: [
        ...r.sections,
        { id: 'batman-code:persona', text: PERSONA, scope: 'session' },
        { id: 'batman-code:concise', text: CONCISE, scope: 'session' },
        { id: 'batman-code:tooling', text: TOOLING, scope: 'session' },
      ],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const h = await read($, header)
    if (e.props.hasSurvey || h.model === '') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const parts = ['🦇 batman-code', h.model, h.user, h.branch].filter(p => p !== '')
    const { turns } = await read($, career)
    const threat = threatOf(await read($, gadgets))
    return (
      <Box flexDirection="column">
        <Text color="yellow" dimColor>{SKYLINE} 🦇 {SKYLINE}</Text>
        <Text dimColor>
          {parts.join(' > ')} · {rankOf(turns).rank.name} · <Text color={threat.color}>{threat.label}</Text>
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const id = e.props.tool_use_id
    const isOpen = (await read($, open)).includes(id)
    const toggle = () =>
      update($, open, ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]))
    const { Box, Button } = $.ui.resolve(e)
    const label = `${isOpen ? '▾' : '▸'} ${e.props.isErrored ? 'error' : 'output'}`
    if (!isOpen) {
      return (
        <Box>
          <Button key={id} label={label} onPress={toggle} />
        </Box>
      )
    }
    const shown = await next(e)
    return (
      <Box>
        <Button key={id} label={label} onPress={toggle} />
        {shown}
      </Box>
    )
  })
}
