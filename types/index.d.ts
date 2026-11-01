export type Window = { kind: string; percentUsed: number; resetsAt?: string }

export type Reading = { windows: Window[]; readAt: number }

declare module 'claude-code' {
  interface PluginState {
    'pacergram': { reading: Reading | null; now: number; isExpanded: boolean }
  }
}
