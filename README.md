# Cfx Lua IntelliSense

[![VS Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/ihyajb.cfxlua-intellisense-aj)](https://marketplace.visualstudio.com/items?itemName=ihyajb.cfxlua-intellisense-aj) [![VS Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/ihyajb.cfxlua-intellisense-aj)](https://marketplace.visualstudio.com/items?itemName=ihyajb.cfxlua-intellisense-aj) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Visual Studio Code extension that brings full IntelliSense, auto-completion, diagnostics, and type annotations to the Lua scripting environment used by [FiveM](https://fivem.net/) and [RedM](https://redm.gg/). Built on top of the [Lua Language Server](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) by sumneko, this extension automatically configures your workspace with the correct runtime definitions, native function signatures, and LuaGLM type information so you can write Cfx.re Lua scripts with confidence.

> [!NOTE]
> This project is an independently maintained fork. The [original repository](https://github.com/overextended/cfxlua-vscode) by Overextended was archived and its CI/CD pipeline was disabled, meaning native definitions could no longer be updated. This fork exists to keep the extension alive, with native definitions refreshed weekly from [fivem-lls-addon](https://github.com/ihyajb/fivem-lls-addon) via automated CI, and continued maintenance.
>
> **This extension is not authored, published, sponsored, nor endorsed by Cfx.re or Rockstar Games.**

---

## Table of Contents

- [What It Does](#what-it-does)
- [Supported Platforms](#supported-platforms)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Configuration](#configuration)
- [Diagnostics](#diagnostics)
- [Manifest Support](#manifest-support)
- [Snippets](#snippets)
- [Sharing Configuration With a Team](#sharing-configuration-with-a-team)
- [Native Libraries](#native-libraries)
- [Runtime Definitions](#runtime-definitions)
- [LuaGLM Support](#luaglm-support)
- [The Plugin System](#the-plugin-system)
- [How It Works Under the Hood](#how-it-works-under-the-hood)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Credits](#credits)

---

## What It Does

When you open a Lua file in VS Code with this extension active, it will:

1. **Auto-configure the Lua Language Server** — sets the runtime to Lua 5.4, enables Cfx-specific nonstandard operators (`+=`, `-=`, `*=`, `/=`, backtick strings, block comments, etc.), and configures workspace ignore directories for performance.
2. **Inject native function definitions** — provides typed signatures for thousands of GTA V, Red Dead Redemption 3, and CFX-specific native functions, complete with parameter names, types, and documentation links.
3. **Provide runtime globals** — adds type definitions for Cfx runtime APIs like `Citizen.CreateThread`, `Citizen.Wait`, `PerformHttpRequest`, promises, statebags, events, JSON helpers, and msgpack utilities.
4. **Add LuaGLM types** — defines `vector2`, `vector3`, `vector4`, `quat`, and matrix types with full operator overloads and method signatures, matching the custom Lua implementation used by Cfx.re.
5. **Install a language server plugin** — a Lua plugin that handles Cfx-specific syntax edge cases, such as safe navigation operators (`foo?.bar`), `fxmanifest.lua` / `__resource.lua` global suppression, and FX asset protection headers.
6. **Complete your resource manifest** — signatures and documentation for every documented `fxmanifest.lua` key, and a warning when one looks misspelled.
7. **Catch wrong-side native calls** — a warning when a client-only native is called from a file your manifest loads with `server_scripts`, or the reverse.
8. **Search the natives** — find any native by name, namespace or hash without leaving the editor, then insert the call, copy the hash, or open its documentation.

---

## Supported Platforms

| Platform | Natives | Runtime Globals |
|----------|---------|-----------------|
| **FiveM** (GTA V) | ~64,000 lines of typed definitions across 43 categories (VEHICLE, PED, ENTITY, HUD, etc.) | Full support |
| **RedM** (RDR3) | ~50,000+ lines of typed definitions across 60+ categories | Full support |
| **CFX Shared** | ~9,000 lines of CFX-specific native definitions | Full support |

---

## Prerequisites

- **Visual Studio Code** v1.71.0 or later
- **[Lua Language Server](https://marketplace.visualstudio.com/items?itemName=sumneko.lua)** extension by sumneko (installed automatically as a dependency)

---

## Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **Cfx Lua IntelliSense** by `ihyajb`.
4. Click **Install**.

---

## Getting Started

Once installed, the extension activates when you open a `.lua` file or a folder containing a resource manifest. There is no manual setup required.

Configuration is applied only to workspaces that contain an `fxmanifest.lua` or `__resource.lua`, so opening an unrelated Lua project — a Neovim config, a LÖVE game — leaves its settings alone. If your resources live somewhere a manifest search won't reach them, set `cfxlua.autoConfigure` to `always`. Running any CfxLua command configures the current workspace regardless of that setting.

By default, **GTA V (FiveM) natives** are loaded. To switch to RedM natives, click the **`Game: GTA V` status bar item** in the bottom-left corner to toggle between games, or use the Command Palette:

- `Ctrl+Shift+P` → **CfxLua: Use RDR3 natives**
- `Ctrl+Shift+P` → **CfxLua: Use GTAV natives**
- `Ctrl+Shift+P` → **CfxLua: Toggle Game (GTAV / RDR3)**

Your selection is persisted in your VS Code settings, and you can switch at any time — nothing is inferred from your manifest.

---

## Commands

All commands are available from the Command Palette under the **CfxLua** category.

| Command | Description |
|---------|-------------|
| **Use GTAV natives** | Switch to GTA V / FiveM native definitions |
| **Use RDR3 natives** | Switch to Red Dead Redemption 3 / RedM native definitions |
| **Toggle Game (GTAV / RDR3)** | Switch to whichever game isn't currently active |
| **Find Native** | Search every native available to the current game, then insert the call, copy the hash or signature, or open the documentation |
| **New Resource** | Scaffold a resource: a manifest with the right game and `lua54`, plus `client/`, `server/` and `shared/` stubs |
| **Write .luarc.json** | Write the configuration into the workspace so it can be committed |
| **Repair configuration** | Recopy the definition library and reapply every setting |
| **Remove configuration** | Remove everything the extension added to your settings |
| **Show Log** | Open the CfxLua output channel |

---

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cfxlua.game` | `"gtav"` \| `"rdr3"` | `"gtav"` | Determines which set of game-specific natives to load into the language server. |
| `cfxlua.autoConfigure` | `"auto"` \| `"always"` \| `"never"` | `"auto"` | When to configure the Lua Language Server. `auto` requires a resource manifest in the workspace; `never` leaves configuration to the commands. |
| `cfxlua.diagnostics.nativeScope` | `boolean` | `true` | Warn when a native is called from the wrong side. |
| `cfxlua.diagnostics.manifestKeys` | `boolean` | `true` | Warn about misspelled manifest keys. |

You can change this in your VS Code `settings.json` — the change is applied immediately (including when it arrives via Settings Sync):

```json
{
  "cfxlua.game": "rdr3"
}
```

Or use the provided commands from the Command Palette (also available via the status bar toggle):

| Command | Description |
|---------|-------------|
| **CfxLua: Use GTAV natives** | Switch to GTA V / FiveM native definitions |
| **CfxLua: Use RDR3 natives** | Switch to Red Dead Redemption 3 / RedM native definitions |
| **CfxLua: Toggle Game (GTAV / RDR3)** | Switch to whichever game isn't currently active |

When switching games, the extension will remove the previous game's native library and add the new one, keeping CFX shared natives always active.

### Multi-root workspaces

`cfxlua.game` is resource-scoped, so in a multi-root workspace each folder can select its own game — FiveM and RedM resources can coexist in one window. Switching games applies to the workspace folder of the file you're currently editing, and the status bar reflects the game for the active editor.

---

## Diagnostics

Two checks run on top of whatever the Lua Language Server reports. Both can be
turned off individually.

### Wrong-side native calls

Every native is visible in every file, which makes calling a client-only native
from a server script easy to do and impossible to notice until it fails at
runtime. This check reads your manifest's `client_scripts`, `server_scripts` and
`shared_scripts` globs to work out which side a file runs on, then warns when a
native cannot work there:

> `SetNuiFocus` is a client native, but this file is loaded as a server script.

It is deliberately conservative, and stays silent unless it is certain:

- A native is only reported when the sides it supports and the side the file runs
  on have **nothing** in common.
- Many game natives have a server-side RPC equivalent in the CFX set, so they are
  valid on both sides and are never reported. There are 159 of these.
- Shared scripts run on both sides, so they are never reported.
- Files your manifest doesn't load are skipped entirely — nothing is assumed.
- Runtime functions such as `Wait` and `CreateThread` are provided by the Lua
  runtime rather than the game, and are never reported.

Set `cfxlua.diagnostics.nativeScope` to `false` to turn this off.

### Misspelled manifest keys

A manifest may carry arbitrary metadata keys, which is why unknown globals aren't
reported there — and why `client_scrpits` silently loads nothing. This check warns
only when a key looks like a near-miss of a documented one:

> Unknown manifest key "client_scrpits". Did you mean "client_scripts"?

Custom metadata keys such as `ox_inventory` are left alone. Set
`cfxlua.diagnostics.manifestKeys` to `false` to turn this off.

---

## Manifest Support

`fxmanifest.lua` and `__resource.lua` get completion, hover documentation and
argument types for every documented key — `fx_version`, `game`, `games`,
`lua54`, the script and file lists, `dependency`, `provide`, `data_file`,
`escrow_ignore`, the loading screen keys, and the rest. Value completion is
offered where the set of valid values is known, so `fx_version` suggests
`cerulean`, `bodacious` and `adamant`.

Type `fxmanifest` in an empty manifest for a complete skeleton.

---

## Snippets

Available in any Lua file:

| Prefix | Expands to |
|--------|------------|
| `createthread` | `CreateThread(function() … end)` |
| `threadloop` | A thread looping on a `Wait` interval |
| `registernetevent` | `RegisterNetEvent` with a handler |
| `addeventhandler` | `AddEventHandler` with a handler |
| `registercommand` | `RegisterCommand` with `source, args, raw` |
| `registerkeymapping` | `RegisterKeyMapping` for a rebindable key |
| `exportfunction` | `exports('name', function() … end)` |
| `callexport` | `exports['resource']:method()` |
| `performhttprequest` | An HTTP request with status handling |
| `promise` | A promise, awaited with `Citizen.Await` |
| `statebaghandler` | `AddStateBagChangeHandler` |
| `nuicallback` | `RegisterNUICallback` with a reply |
| `fxmanifest` | A complete resource manifest |

---

## Sharing Configuration With a Team

Everything above is written to your personal VS Code settings, which a team can't
commit and `lua-language-server --check` can't read. **CfxLua: Write .luarc.json**
writes the same runtime version, plugin path, nonstandard operators and library
paths into a `.luarc.json` in your workspace, where it can be reviewed, committed,
and picked up by teammates using other editors and by CI.

Paths are written relative to `~`, so the file stays valid across machines.

---

## Native Libraries

Native function definitions are organized into three sets:

### CFX Shared Natives (`CFX-NATIVE/`)

These are platform-independent natives provided by the Cfx.re framework itself, such as `AddAudioSubmixOutput`, `ActivateTimecycleEditor`, and hundreds of other CFX-specific functions. These are **always loaded** regardless of your game selection.

### GTA V Natives (`GTAV/`)

Game-specific natives split across 43 files by category:

`APP` · `AUDIO` · `BRAIN` · `CAM` · `CLOCK` · `CUTSCENE` · `DATAFILE` · `DECORATOR` · `DLC` · `ENTITY` · `EVENT` · `FILES` · `FIRE` · `GRAPHICS` · `HUD` · `INTERIOR` · `ITEMSET` · `LOADINGSCREEN` · `LOCALIZATION` · `MISC` · `MOBILE` · `MONEY` · `NETSHOPPING` · `NETWORK` · `OBJECT` · `PAD` · `PATHFIND` · `PED` · `PHYSICS` · `PLAYER` · `RECORDING` · `REPLAY` · `SAVEMIGRATION` · `SCRIPT` · `SHAPETEST` · `SOCIALCLUB` · `STATS` · `STREAMING` · `SYSTEM` · `TASK` · `VEHICLE` · `WATER` · `WEAPON` · `ZONE`

### RDR3 Natives (`RDR3/`)

Game-specific natives split across 60+ files by category, including RedM-specific categories like:

`ANIMSCENE` · `ATTRIBUTE` · `BOUNTY` · `COLLECTION` · `COMPANION` · `COMPENDIUM` · `DATABINDING` · `FLOCK` · `GANG` · `INVENTORY` · `ITEMDATABASE` · `LAW` · `MAP` · `MINIGAME` · `MISSIONDATA` · `PERSCHAR` · `PERSISTENCE` · `POPULATION` · and many more.

Each native definition includes:
- Full function signature with typed parameters and return values
- A link to the official FiveM/RedM native documentation
- The native category and execution context (client/server)
- Deprecated aliases where applicable

---

## Runtime Definitions

The extension ships with type annotations for the Cfx.re Lua runtime environment. These are located in the `plugin/library/runtime/` directory:

### `citizen.lua` — Core Citizen API

Typed definitions for the global `Citizen` table and its convenience aliases:

- `Citizen.CreateThread` / `CreateThread` — Create an async coroutine (executes next tick)
- `Citizen.CreateThreadNow` — Create an async coroutine (executes immediately)
- `Citizen.SetTimeout` / `SetTimeout` — Execute a callback after a delay
- `Citizen.Wait` / `Wait` — Yield (pause) a coroutine for a duration
- `Citizen.Trace` — Output to trace/console
- `Citizen.Await` — Yield until a promise resolves
- `Citizen.InvokeNative` — Invoke a native by hash

### `env.lua` — Environment Globals

Typed definitions for server/client globals:

- `GetPlayerIdentifiers`, `GetPlayerTokens`, `GetPlayers`
- `PerformHttpRequest` / `PerformHttpRequestAwait`
- `StateBag` class and `EntityInterface` types
- Event registration: `AddEventHandler`, `RegisterNetEvent`, `TriggerEvent`, `TriggerServerEvent`, `TriggerClientEvent`
- Resource metadata: `GetCurrentResourceName`, `GetResourceState`

### `promise.lua` — Promise Library

Full type definitions for the [lua-promises](https://github.com/zserge/lua-promises) library bundled with Cfx.re:

- `promise.new`, `promise.all`, `promise.map`, `promise.first`
- `promise` class with `resolve`, `reject`, `next`, `value`, and `state` fields

### `json.lua` — JSON Encoding/Decoding

Type definitions for the built-in `json.encode` and `json.decode` functions.

### `msgpack.lua` — MessagePack

Type definitions for the `msgpack` utilities available in the Cfx.re runtime.

### `event.lua` — Event Handling

Additional event-related type definitions and helpers.

### `luaglm.lua` — LuaGLM Math Types

See the dedicated section below.

---

## LuaGLM Support

Cfx.re uses a [custom fork of Lua](https://github.com/citizenfx/lua/tree/luaglm-dev/cfx) called **LuaGLM** that extends the language with mathematical types and nonstandard syntax. This extension provides full type support for:

### Vector Types

| Type | Fields | Description |
|------|--------|-------------|
| `vector2` | `x`, `y` (aliases: `r`, `g`) | 2D vector with arithmetic operator overloads |
| `vector3` | `x`, `y`, `z` (aliases: `r`, `g`, `b`) | 3D vector extending `vector2` |
| `vector4` | `x`, `y`, `z`, `w` (aliases: `r`, `g`, `b`, `a`) | 4D vector extending `vector3` |
| `quat` | `x`, `y`, `z`, `w` | Quaternion type extending `vector4` |

All vector types support:
- Arithmetic operators: `+`, `-`, `*`, `/`, unary `-`
- Length operator: `#`
- Swizzle access: `.xy`, `.xyz`, etc.
- Indexed access: `[1]`, `[2]`, `[3]`, `[4]`

### Nonstandard Operators

The extension configures the Lua Language Server to recognize these Cfx-specific operators:

```lua
+=  -=  *=  /=  <<=  >>=  &=  |=  ^=
`template strings`
/**/  (block comments)
```

> [!CAUTION]
> Some of these "power patches" have been known to cause instability. Use extended syntax features with caution in production scripts.

---

## The Plugin System

The extension installs a Lua Language Server plugin (`plugin.lua`) that preprocesses Lua files before the language server analyzes them. This plugin handles several Cfx-specific quirks:

### Safe Navigation Operator

Cfx Lua supports `foo?.bar` and `foo?[index]` syntax, which standard Lua does not. The plugin strips the `?` character from these expressions to prevent parse errors, and rewrites usage to suppress `need-check-nil` diagnostics.

### Manifest File Support

Files named `fxmanifest.lua` and `__resource.lua` use globals like `fx_version`, `game`, `client_script`, etc., that aren't defined anywhere in user code. The plugin injects `---@diagnostic disable: undefined-global` at the top of these files to prevent false positive warnings.

### FX Asset Protection

Files beginning with the `FXAP` header (FiveM asset protection) are encrypted and not valid Lua — the plugin returns an empty string for these files so the language server skips them gracefully.

### `.vscode` and `@meta` Filtering

The plugin ignores files inside `.vscode` directories and files starting with `---@meta` (such as the native definition files themselves) to avoid unnecessary processing.

---

## How It Works Under the Hood

When the extension activates (triggered by opening a `.lua` file, or by a resource manifest in the workspace):

0. **Workspace Detection** — Unless `cfxlua.autoConfigure` says otherwise, the extension looks for an `fxmanifest.lua` or `__resource.lua` in the open folders. If it finds none, it registers its commands and stops there, leaving unrelated Lua projects untouched. A manifest appearing later, or a folder being added to a multi-root workspace, triggers configuration then.

1. **File Migration** — The bundled `plugin.lua` and `library/` directory are copied from the extension's install location to VS Code's global storage for the extension. This ensures a stable path that persists across extension updates. The copy is versioned: a `.version` marker in global storage records which extension version last populated it, so the ~150-file library is only recopied after an extension update — not on every VS Code launch.

2. **Plugin Registration** — The path to `plugin.lua` is written to the `Lua.runtime.plugin` setting, telling the Lua Language Server to load it.

3. **Library Injection** — The paths to the appropriate definition folders (`runtime/`, `manifest/`, `natives/CFX-NATIVE/`, and either `natives/GTAV/` or `natives/RDR3/`) are appended to `Lua.workspace.library`, making all type information available to the language server.

4. **Runtime Configuration** — The Lua runtime version is set to `5.4`, nonstandard symbols are registered, and workspace ignore directories are configured to improve performance.

5. **Native Index** — The compressed native index that ships with the definition library is read from the extension directory and kept in memory for native search, hash lookup and the wrong-side check. If it is missing, those features stay quiet and everything else works as normal.

Settings are **left in place** when VS Code closes. Earlier versions removed them on deactivation and rewrote them on the next launch, which meant two `settings.json` writes and two language server reloads per session, a spurious diff in any tracked `.code-workspace`, and no guarantee the removal completed — VS Code does not wait for asynchronous work during shutdown. Use **CfxLua: Remove configuration** to undo everything deliberately.

All paths written to settings are stored `~`-relative on every platform, so they stay portable across machines (e.g. via Settings Sync). Stale entries in older formats — including leftovers from the archived Overextended extension — are cleaned up automatically. Settings only get written when their value actually changes, so activation doesn't touch your `settings.json` or restart the language server unnecessarily.

Settings are applied at the **workspace level** when a `.code-workspace` file is present, or at the **global (user) level** otherwise. In **multi-root workspaces**, game-specific settings (`cfxlua.game` and the corresponding `Lua.workspace.library` entries) are written at the **workspace folder level** for the folder of the active editor.

---

## Project Structure

```
cfxlua-vscode/
├── src/                          # Extension source code (TypeScript)
│   ├── extension.ts              # Entry point — activation, command registration
│   ├── isCfxWorkspace.ts         # Manifest-based detection of a Cfx project
│   ├── ensureStorage.ts          # Version-gated copy of bundled files to global storage
│   ├── getLuaConfig.ts           # Helper to access the Lua Language Server configuration
│   ├── getSettingsScope.ts       # Determines folder vs. workspace vs. global settings scope
│   ├── libraryUtils.ts           # Pure helpers for library-entry cleanup and comparison
│   ├── logger.ts                 # "CfxLua" output channel logging
│   ├── lua.ts                    # Minimal Lua tokenizer — tells code from strings and comments
│   ├── manifest.ts               # Manifest parsing, script globs, key suggestions
│   ├── nativeCatalog.ts          # Queries over the native index (pure)
│   ├── nativesIndex.ts           # Loads the compressed native index
│   ├── nativeScope.ts            # Finds natives called from the wrong side (pure)
│   ├── diagnostics.ts            # Publishes the diagnostics to VS Code
│   ├── findNative.ts             # "Find Native" quick pick
│   ├── nativeHover.ts            # Resolves a native hash on hover
│   ├── newResource.ts            # "New Resource" scaffold
│   ├── writeLuarc.ts             # ".luarc.json" export
│   ├── setLibrary.ts             # Manages Lua.workspace.library entries
│   ├── setNativeLibrary.ts       # Handles game-specific native library switching
│   ├── setPlugin.ts              # Configures Lua.runtime.plugin and related settings
│   ├── toTildePath.ts            # Rewrites home-relative paths to portable ~ form
│   └── test/unit/                # Unit tests for the pure modules
│
├── snippets/cfxlua.json          # Lua snippets for common Cfx patterns
│
├── plugin/                       # Git submodule (ihyajb/fivem-lls-addon) — plugin and library definitions
│   ├── plugin.lua               # Lua Language Server plugin for Cfx-specific preprocessing
│   ├── config.json              # Default Lua Language Server addon configuration
│   ├── natives-index.json.gz    # Every native as data, for search and diagnostics
│   └── library/
│       ├── manifest/            # fxmanifest.lua / __resource.lua definitions
│       ├── runtime/             # Cfx runtime type definitions
│       │   ├── citizen.lua      # Citizen API (CreateThread, Wait, etc.)
│       │   ├── env.lua          # Environment globals (events, HTTP, statebags)
│       │   ├── event.lua        # Event handling types
│       │   ├── json.lua         # JSON encode/decode types
│       │   ├── luaglm.lua       # Vector, quaternion, matrix types
│       │   ├── msgpack.lua      # MessagePack types
│       │   └── promise.lua      # Promise library types
│       └── natives/
│           ├── CFX-NATIVE/      # CFX shared natives (always loaded)
│           │   └── CFX.lua
│           ├── GTAV/            # GTA V natives (43 category files)
│           │   ├── VEHICLE.lua
│           │   ├── PED.lua
│           │   └── ...
│           └── RDR3/            # RDR3 natives (60+ category files)
│               ├── PED.lua
│               ├── ENTITY.lua
│               └── ...
│
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
├── webpack.config.js             # Build configuration
└── biome.json                    # Linting and formatting configuration
```

---

## Troubleshooting

### IntelliSense isn't working

- Ensure the **Lua Language Server** extension is installed and enabled.
- Check that the workspace contains an `fxmanifest.lua` or `__resource.lua`. Without one, the extension configures nothing — set `cfxlua.autoConfigure` to `always`, or run any CfxLua command to configure the workspace anyway.
- Run **CfxLua: Show Log** to see what happened on activation.
- Run **CfxLua: Repair configuration** to recopy the definition library and reapply every setting.
- Check that `cfxlua.game` is set to a valid value (`"gtav"` or `"rdr3"`).

### Natives from the old Overextended extension are duplicating

This extension includes migration logic that automatically removes library paths from the original `overextended.cfxlua-vscode` extension. If you still see duplicates, manually check your `Lua.workspace.library` setting and remove any paths containing `overextended.cfxlua-vscode`.

### Diagnostics appear in `fxmanifest.lua`

The extension's plugin suppresses `undefined-global` warnings in manifest files. If you're still seeing them, verify that `Lua.runtime.plugin` points to the correct `plugin.lua` path in your settings.

### Safe navigation (`?.`) shows errors

The plugin rewrites safe navigation syntax to prevent parse errors. If it's not working, ensure the plugin is correctly loaded by checking `Lua.runtime.plugin` in your settings.

### Extension settings aren't applying

The extension applies settings at the workspace level if a `.code-workspace` file is open, otherwise at the user (global) level. In multi-root workspaces, game-specific settings are written per workspace folder (for the folder of the active editor). Check the appropriate settings scope for your configuration — folder settings override workspace settings, which override user settings.

### A wrong-side warning is wrong

Open an issue with the native's name and the manifest entry that loads the file — the check reads `client_scripts`, `server_scripts` and `shared_scripts` globs, so an unusual glob is the likeliest cause. In the meantime, set `cfxlua.diagnostics.nativeScope` to `false`.

### Native search says the index is unavailable

The index ships in the `plugin` submodule. In a development checkout, run `git submodule update --init --recursive`. Everything except native search, hash hover and the wrong-side check works without it.

### Natives seem out of date

Native definitions are pulled weekly from the [fivem-lls-addon](https://github.com/ihyajb/fivem-lls-addon) repository and shipped in extension updates, so make sure the extension is up to date. The definition files in global storage are refreshed automatically the first time a new extension version activates.

---

## Contributing

1. Clone the repository **including the `plugin` submodule** (without it, the extension has no native definitions to load):
   ```bash
   git clone --recurse-submodules https://github.com/ihyajb/cfxlua-vscode.git
   ```
   If you already cloned without submodules, run `git submodule update --init --recursive`.
2. Install dependencies:
   ```bash
   cd cfxlua-vscode
   yarn install
   ```
3. Open the project in VS Code and press `F5` to launch the Extension Development Host.
4. The `npm: watch` task will automatically compile TypeScript on changes.

### Building

```bash
yarn run compile        # Development build
yarn run package        # Production build
```

### Testing

```bash
yarn test               # Compile and run the unit tests
yarn run typecheck      # Typecheck without emitting
```

Tests cover the pure modules: the tokenizer, manifest parsing and glob matching,
the native catalog, and the wrong-side check — including cases asserted against
the index that actually ships, so a data regression fails the build rather than
reaching users as a false warning.

### Linting & Formatting

```bash
yarn biome lint --write src
yarn biome format --write src
```

---

## Credits

This project builds upon the work of many contributors to the Cfx.re ecosystem:

- **[Overextended](https://github.com/overextended)** — creators of the [original cfxlua-vscode extension](https://github.com/overextended/cfxlua-vscode)
- **[CitizenFX Collective](https://github.com/citizenfx)** — developers of FiveM, RedM, and the LuaGLM runtime
- **[sumneko](https://github.com/LuaLS)** — author of the Lua Language Server
- **gottfriedleibniz** — LuaGLM implementation
- **alloc8or, iTexZoz, TasoOneAsia** — community contributions to native definitions and tooling

---

## License

This project is licensed under the [MIT License](LICENSE).
