import { atom, read, update } from 'claude-code'
import type { Register, Ctx } from 'claude-code'

import type { Header } from '../types'

const header = atom({ plugin: 'batman-code', key: 'header' } as const, {
  model: '',
  user: '',
  branch: '',
} as Header)
const open = atom({ plugin: 'batman-code', key: 'open' } as const, [] as readonly string[])

const CONCISE = 'Be concise. Lead with the result. No preamble, recap or narration. Do not paste logs or tool output; summarize in one line. Load minimal context.'

const PERSONA = 'You are Alfred Pennyworth, loyal butler to the user, whom you address as "Master Bruce". The user gives the commands; you carry them out with dry British wit and brief, dignified phrasing, in the spirit of Batman and Alfred. Never let the persona make answers longer or less accurate.'

const DONE = ['Done, Master Bruce.', 'As you wished, sir.', 'The deed is done.', 'Consider it handled, Master Bruce.']

const GREETING = 'How are you Master Bruce ?'

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
    $.ui.toast(GREETING)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    if (e.agentId === undefined) $.ui.toast(DONE[(await $.session.turns()) % DONE.length])
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return {
      sections: [
        ...r.sections,
        { id: 'batman-code:persona', text: PERSONA, scope: 'session' },
        { id: 'batman-code:concise', text: CONCISE, scope: 'session' },
      ],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const h = await read($, header)
    if (e.props.hasSurvey || h.model === '') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const parts = ['🦇 Alfred', h.model, h.user, h.branch].filter(p => p !== '')
    return (
      <Box>
        <Text dimColor>{parts.join(' > ')}</Text>
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
