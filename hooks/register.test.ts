import { expect, test } from 'claude-code/testing'

const FORBIDDEN_COMMANDS = ['rm -rf /', 'rm -fr ~/code', 'git push --force origin main', 'git push -f', 'git reset --hard HEAD~1']

test('rules of engagement hold back destructive Bash commands', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ ref: 'r', result: { stdout: '' }, text: 'ran' }))

  for (const command of FORBIDDEN_COMMANDS) {
    const ran = await $.tool.call({ tool: 'Bash', command })
    expect(ran.deny, command).toContain('Rules of engagement')
  }
})

test('ordinary Bash commands pass the guard', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ ref: 'r', result: { stdout: '' }, text: 'ran' }))

  for (const command of ['ls -la', 'git push origin main', 'rm file.txt']) {
    const ran = await $.tool.call({ tool: 'Bash', command })
    expect(ran.text, command).toBe('ran')
  }
})
