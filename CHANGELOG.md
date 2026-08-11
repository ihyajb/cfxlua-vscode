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

### Performance

- **The language server plugin skips the work it does not need.** `OnSetText` runs
  for every Lua file in the workspace on every edit, and always made two
  full-text pattern scans looking for safe navigation. A plain search for `?`
  now guards both: **15.7x faster** on a file that contains none, which is nearly
  all of them. It also returns nothing instead of an empty table when there is
  nothing to rewrite. `plugin.lua` now has a test suite that runs it in a real
  Lua 5.4 runtime, and all sixteen behaviour cases are unchanged.
- **Nothing is loaded during activation.** The native data was read and parsed on
  every activation — around 28ms — including in windows that were never
  configured and windows where no feature ever asked for it. Both files now load
  on first use.
- **The native data is split by how often it is needed.** The wrong-side check
  only needs to know which sides a native supports, so that is now its own
  119 KiB file that loads in ~4.5ms, instead of parsing the full 354 KiB index at
  ~19ms. The full index is read only for native search and hash hovers.
- **Parameter and return lists are stored joined rather than as arrays**, which
  removed 43,000 arrays from the parsed index and took its load from 28ms to
  19ms.
- **The wrong-side scan no longer tokenises the document.** It walks the text once
  and allocates only for the names it reports, and side lookups are a bitmask
  test rather than a `Set` built per call site: **1.6x faster**, and no longer
  linear in allocations.
- **Manifests are parsed once and their globs compiled once.** Each diagnostic
  refresh used to re-read the manifest from disk, walk the directory tree again,
  and recompile every glob; matching a path is now **14x faster** and the read is
  gone. Caches are dropped when a manifest changes.
- **The catalog is cached per game.** It was rebuilt on every editor change, which
  discarded its sorted name list and hash map each time you switched tabs. The
  Find Native list is built once per game rather than on every invocation.
- The generator fetches all three native documents concurrently instead of one
  after another, and writes each definition file once instead of creating it and
  then appending to it.
- `addon`: the vsix no longer carries the definition submodule's own tooling or
  `node_modules`.

### Changed — toolchain

- **Migrated to Bun.** It is now the package manager, bundler and test runner.
  Removed yarn, webpack, ts-loader, mocha, glob and `@vscode/test-electron`; the
  extension's only devDependencies are Bun's types, VS Code's types, TypeScript
  (for `bun run typecheck`) and Biome.
  - `bun build --target=node --format=cjs` produces the same shape of bundle
    webpack did — CommonJS, `vscode` external — at a comparable size.
  - `tsc` is kept for typechecking only; Bun does not typecheck.
  - `@vscode/vsce` still packages the `.vsix`, run through `bunx`. It is a Node
    CLI with no Bun integration, and it is the only supported way to build and
    publish a VS Code extension, so this is as far as the migration goes. The
    release workflow packages with `vsce --no-dependencies` and hands the
    resulting file to the publish action, so publishing no longer depends on the
    action being able to drive the package manager.
  - `trustedDependencies` declares Biome, whose postinstall fetches its platform
    binary; Bun blocks lifecycle scripts by default.
- Added a `Verify` workflow: typecheck, tests, lint and a packaging dry run on
  every push and pull request. The repository previously had CI only for
  releases.

### Fixed

- **`game 'gta5'` was reported as invalid on every manifest.** The manifest key
  takes `gta5`; `gtav` is only the name of the definition folder. The value enum
  said `gtav`, the `fxmanifest` snippet inserted `gtav`, and **CfxLua: New
  Resource** scaffolded it — so every FiveM resource was warned about, and the
  snippet and scaffold produced a manifest that warned about itself. Also dropped
  `server` from the game values, which is not one.
- **Manifest value enums no longer bind.** Every value-taking key accepts a plain
  string alongside the suggested values, so completion still offers them but a
  value these definitions have not heard of can never be flagged. The `gta5` bug
  was only visible because the enum was strict; the next platform addition would
  have done the same thing.
- `yarn test` pointed at a test harness that was never written, so only part of the
  suite could run. Tests now run under `bun test`.
- `lint` and `format` invoked `pnpm` from inside a yarn project, failing anywhere
  pnpm was not installed.
- Biome only linted the top level of `src/`, skipping the tests and type
  declarations.
- The `Extension Tests` launch configuration pointed at `out/test/suite/index`,
  which never existed.
- Removed a stale `fivem-lls-addon` submodule entry from `.gitmodules`; only
  `plugin` was ever checked out.
