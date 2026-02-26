# Cfx Lua IntelliSense

[![VS Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/ihyajb.cfxlua-intellisense)](https://marketplace.visualstudio.com/items?itemName=ihyajb.cfxlua-intellisense) [![VS Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/ihyajb.cfxlua-intellisense)](https://marketplace.visualstudio.com/items?itemName=ihyajb.cfxlua-intellisense) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Visual Studio Code extension that brings full IntelliSense, auto-completion, diagnostics, and type annotations to the Lua scripting environment used by [FiveM](https://fivem.net/) and [RedM](https://redm.gg/). Built on top of the [Lua Language Server](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) by sumneko, this extension automatically configures your workspace with the correct runtime definitions, native function signatures, and LuaGLM type information so you can write Cfx.re Lua scripts with confidence.

> [!NOTE]
> This project is an independently maintained fork. The [original repository](https://github.com/overextended/cfxlua-vscode) by Overextended was archived and its CI/CD pipeline was disabled, meaning native definitions could no longer be updated. This fork exists to keep the extension alive, with actively updated native definitions and continued maintenance.
>
> **This extension is not authored, published, sponsored, nor endorsed by Cfx.re or Rockstar Games.**

---

## Table of Contents

- [What It Does](#what-it-does)
- [Supported Platforms](#supported-platforms)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
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

Once installed, the extension activates automatically whenever you open a `.lua` file. There is no manual setup required. Your workspace will be configured with the appropriate Lua Language Server settings on activation.

By default, **GTA V (FiveM) natives** are loaded. To switch to RedM natives, use the Command Palette:

- `Ctrl+Shift+P` → **CfxLua: Use RDR3 natives**
- `Ctrl+Shift+P` → **CfxLua: Use GTAV natives**

Your selection is persisted in your VS Code settings.

---

## Configuration

The extension exposes a single setting:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cfxlua.game` | `"gtav"` \| `"rdr3"` | `"gtav"` | Determines which set of game-specific natives to load into the language server. |

You can change this in your VS Code `settings.json`:

```json
{
  "cfxlua.game": "rdr3"
}
```

Or use the provided commands from the Command Palette:

| Command | Description |
|---------|-------------|
| **CfxLua: Use GTAV natives** | Switch to GTA V / FiveM native definitions |
| **CfxLua: Use RDR3 natives** | Switch to Red Dead Redemption 3 / RedM native definitions |

When switching games, the extension will remove the previous game's native library and add the new one, keeping CFX shared natives always active.

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

When the extension activates (triggered by opening any `.lua` file):

1. **File Migration** — The bundled `plugin.lua` and `library/` directory are copied from the extension's install location to VS Code's global storage for the extension. This ensures a stable path that persists across extension updates.

2. **Plugin Registration** — The path to `plugin.lua` is written to the `Lua.runtime.plugin` setting, telling the Lua Language Server to load it.

3. **Library Injection** — The paths to the appropriate native definition folders (`runtime/`, `natives/CFX-NATIVE/`, and either `natives/GTAV/` or `natives/RDR3/`) are appended to `Lua.workspace.library`, making all type information available to the language server.

4. **Runtime Configuration** — The Lua runtime version is set to `5.4`, nonstandard symbols are registered, and workspace ignore directories are configured to improve performance.

5. **Cleanup on Deactivation** — When the extension is deactivated or VS Code closes, the plugin path and all library paths added by the extension are removed from settings, leaving your configuration clean.

Settings are applied at the **workspace level** when a workspace file is present, or at the **global (user) level** otherwise. This is determined by checking for `workspace.workspaceFile`.

---

## Project Structure

```
cfxlua-vscode/
├── src/                          # Extension source code (TypeScript)
│   ├── extension.ts              # Entry point — activation, deactivation, command registration
│   ├── getLuaConfig.ts           # Helper to access the Lua Language Server configuration
│   ├── getSettingsScope.ts       # Determines workspace vs. global settings scope
│   ├── moveFile.ts              # Copies bundled files to global storage
│   ├── setLibrary.ts            # Manages Lua.workspace.library entries
│   ├── setNativeLibrary.ts      # Handles game-specific native library switching
│   └── setPlugin.ts             # Configures Lua.runtime.plugin and related settings
│
├── plugin/                       # Bundled plugin and library definitions
│   ├── plugin.lua               # Lua Language Server plugin for Cfx-specific preprocessing
│   ├── config.json              # Default Lua Language Server addon configuration
│   └── library/
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
- Check that `cfxlua.game` is set to a valid value (`"gtav"` or `"rdr3"`).
- Open the Command Palette and run **Developer: Reload Window** to re-trigger activation.

### Natives from the old Overextended extension are duplicating

This extension includes migration logic that automatically removes library paths from the original `overextended.cfxlua-vscode` extension. If you still see duplicates, manually check your `Lua.workspace.library` setting and remove any paths containing `overextended.cfxlua-vscode`.

### Diagnostics appear in `fxmanifest.lua`

The extension's plugin suppresses `undefined-global` warnings in manifest files. If you're still seeing them, verify that `Lua.runtime.plugin` points to the correct `plugin.lua` path in your settings.

### Safe navigation (`?.`) shows errors

The plugin rewrites safe navigation syntax to prevent parse errors. If it's not working, ensure the plugin is correctly loaded by checking `Lua.runtime.plugin` in your settings.

### Extension settings aren't applying

The extension applies settings at the workspace level if a `.code-workspace` file is open, otherwise at the user (global) level. Check the appropriate settings scope for your configuration.

---

## Contributing

1. Clone the repository:
   ```bash
   git clone https://github.com/ihyajb/cfxlua-vscode.git
   ```
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

### Linting & Formatting

```bash
pnpm biome lint --write
pnpm biome format --write
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
