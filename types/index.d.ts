export type Header = { model: string; user: string; branch: string }
export type Gadget = { id: string; tool: string; isDone: boolean; isErrored: boolean }

declare module 'claude-code' {
  interface PluginState {
    'batman-code': { header: Header; open: readonly string[]; gadgets: readonly Gadget[] }
  }
}
