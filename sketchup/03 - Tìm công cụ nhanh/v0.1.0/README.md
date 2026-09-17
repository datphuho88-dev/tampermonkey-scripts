# Quick Tool Finder for SketchUp

Fast command palette for SketchUp 2022+.

## What it does

- Adds a **Quick Tool Finder** toolbar button and an **Extensions** menu entry.
- Opens a lightweight search window.
- Indexes existing `UI::Command` objects once, caches them in memory, and searches in JavaScript while typing.
- Press **Enter** or click a result to run the original command.
- Use **Refresh (↻)** only when new extensions were loaded after SketchUp started.
- Searches command name, tooltip, extension name, source folder, and toolbar name.

If an extension exposes a command named **Make Box** through `UI::Command`, typing `make box` should find it and run it directly.

## Performance design

The plugin does **not** rescan all commands on every keystroke. Ruby scans only when the palette is first opened or Refresh is pressed. Filtering happens in the embedded HTML dialog against an in-memory array, capped to 80 visible results.

## Limitation

SketchUp does not provide a universal API to enumerate and invoke every menu item from every extension. This plugin can directly run commands created with `UI::Command` on SketchUp 2022+, because `UI::Command#proc` is available there. Extensions that only use `menu.add_item { ... }` without a `UI::Command` cannot be invoked generically and need a small adapter.

## Install

1. Download `quick_tool_finder_v0.1.0.rbz`.
2. SketchUp → **Extension Manager** → **Install Extension**.
3. Enable **Quick Tool Finder**.
4. The toolbar appears on first install. If hidden later, enable it from **View → Toolbars**.

## Version

- `0.1.0`: first working build.
