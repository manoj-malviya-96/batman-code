export type Header = { model: string; user: string; branch: string }

declare module 'claude-code' {
  interface PluginState {
    'batman-remode': { header: Header; open: readonly string[] }
  }
}
