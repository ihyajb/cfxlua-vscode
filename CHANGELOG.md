# Changelog

## Unreleased

### Added

- **Wrong-side native diagnostics.** Warns when a native is called from a file the
  resource manifest loads on the wrong side, such as a client-only native in a
  `server_scripts` file. Only reports a native when the sides it supports and the
  side the file runs on have nothing in common, so the 159 game natives with a
  server RPC equivalent, shared scripts, runtime functions such as `Wait`, and
  files the manifest does not load are all left alone. Configurable with
  `cfxlua.diagnostics.nativeScope`.
- **Manifest IntelliSense.** Completion, hover documentation and argument types
  for every documented `fxmanifest.lua` key, with value completion where the valid
  values are known.
- **Misspelled manifest key warnings.** `client_scrpits` is now reported with a
  suggestion instead of silently loading nothing. Custom metadata keys are left
  alone. Configurable with `cfxlua.diagnostics.manifestKeys`.
- **CfxLua: Find Native.** Search every native available to the current game by
  name, namespace or hash, then insert the call, copy the hash or signature, or
  open the documentation.
- **Native hash resolution on hover.** Hovering the hash in
  `Citizen.InvokeNative(0x…)` shows the native's name, signature and
  documentation link.
- **CfxLua: New Resource.** Scaffolds a manifest with the correct game and
  `lua54`, plus `client/`, `server/` and `shared/` stubs.
- **CfxLua: Write .luarc.json.** Writes the configuration into the workspace so it
  can be committed, shared with teammates on other editors, and read by
  `lua-language-server --check` in CI.
- **CfxLua: Remove configuration**, **Repair configuration** and **Show Log**
  commands.
- **Snippets** for the common Cfx patterns: threads, events, commands, exports,
  HTTP requests, promises, state bag handlers, NUI callbacks and manifests.
- `cfxlua.autoConfigure` setting (`auto` / `always` / `never`).

### Changed

- **Configuration is now limited to Cfx workspaces.** The extension activates on
  any Lua file but only writes Lua Language Server settings when the workspace
  contains an `fxmanifest.lua` or `__resource.lua`. Opening an unrelated Lua
  project no longer rewrites its runtime version, plugin path or library paths.
  Set `cfxlua.autoConfigure` to `always` for the previous behaviour; running any
  CfxLua command still configures the current workspace.
- **Settings are no longer removed on deactivation.** Every window close used to
  strip the settings and every launch wrote them back, which meant two
  `settings.json` writes and two language server reloads per session, a spurious
  diff in any tracked `.code-workspace`, and no guarantee the removal completed.
  Use **CfxLua: Remove configuration** instead.
- The status bar item is hidden outside Lua files and unconfigured workspaces.
- A folder added to a multi-root workspace, or a manifest created in one, now
  triggers configuration.
- Definition libraries now include `library/manifest`.

### Fixed

- `yarn test` pointed at a test harness that was never written, so only part of the
  suite could run. Tests now run under the Node test runner.
- `lint` and `format` invoked `pnpm` from inside a yarn project, failing anywhere
  pnpm was not installed.
- Biome only linted the top level of `src/`, skipping the tests and type
  declarations.
- Removed a stale `fivem-lls-addon` submodule entry from `.gitmodules`; only
  `plugin` was ever checked out.
