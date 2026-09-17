# Source note

`quick_tool_finder_v0.3.1.rbz` is the canonical release package and contains the complete executable source: `quick_tool_finder.rb`, `quick_tool_finder/main.rb`, `quick_tool_finder/ui.html`, and icon assets.

For v0.3.1, the Ruby runtime logic is intentionally unchanged from v0.3.0 except the version constant (`VERSION = '0.3.1'`). The functional change is the optimized `ui.html` plus the loader version metadata. This keeps v0.3.0 behavior stable while improving rendering and interaction smoothness.
