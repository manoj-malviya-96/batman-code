# batman-code

## Why

Claude Code's default UI is noisy and dull. This mod strips it down and turns the session into Gotham.

## Vision

- Quiet by default: short replies, tool output on demand.
- A session that feels like a game: ranks, threats, villains.
- Guardrails that stop the irreversible stuff.

## Architecture

```mermaid
flowchart LR
  A[session.start / turn.complete] --> B[header: model, user, branch]
  A --> C[career: missions in $.store]
  D[tool.call] --> E{Bash forbidden?}
  E -- yes --> F[deny]
  E -- no --> G[gadget log]
  G --> H[threat: errors in last 10 gadgets]
  I[prompt.compose] --> J[Alfred persona + concise reply]
  K[ui.render] --> L[AbovePrompt: skyline, rank, threat]
  K --> M[/batcomputer pane]
  K --> N[ToolResult: collapsed]
  B --> L
  C --> L
  C --> M
  H --> L
  H --> M
```

## Plan

- [x] Minimal header above the prompt
- [x] Concise replies
- [x] Tool logs hidden until clicked
- [x] Alfred persona, greeting, turn toasts
- [x] `/batcomputer` gadget log
- [x] Skyline, ranks, threat meter
- [x] Block `rm -rf`, force push, hard reset
- [ ] Add author to manifest
- [ ] Tests for ranks, meter, threat, promotion

## Setup

```
/plugin install batman-code --marketplace manoj-malviya-96/batman-code
```

Answer `y` to add the marketplace, then pick the user scope.
