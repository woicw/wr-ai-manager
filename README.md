# WR AI Manager

A desktop app for managing AI tool configs across your local library, config groups, marketplace installs, and GitHub sync sources.

English | [简体中文](./README.zh-CN.md)

## Overview

WR AI Manager centralizes `skills / mcp / commands` for tools like Claude Code, Codex, Cursor, Gemini CLI, Trae, and more. You can sync configs from local tools or GitHub, curate them in a local library, save group drafts, and only apply them to target tools when you explicitly choose to.

## Screenshots

### Dashboard

![Dashboard](./assets/dashboard-overview.png)

### Group Configuration

![Group Configuration](./assets/group-configuration.png)

### Marketplace and Sync

![Marketplace and Sync](./assets/marketplace-and-sync.png)

## Features

### 🎯 Core Features

- **Configuration Groups**: Save different config combinations for different working contexts
- **Draft First, Apply Later**: Changing switches saves the group draft first; actual links or copies are only created when you click apply
- **Quick Apply & Quick Switch**: Apply a group to all enabled tools, or switch to another saved group from the sidebar
- **Local Library**: Manage synced `skills / mcp / commands` in one place
- **Tool Detection**: Detect installed AI tools and their config directories automatically
- **GitHub Sync**: Pull configs from a GitHub repository, with a default source prefilled for first-time use
- **Marketplace**: Install community skills from official GitHub listings and searchable sources
- **Windows Fallback**: If symbolic links are unavailable on Windows, the app falls back to copy mode automatically

### 🛠️ Supported Configuration Types

- **Skills**
- **MCP**
- **Commands**

### 🌍 User Experience

- **Internationalization**: Full support for English and Chinese
- **Theme Support**: Light and dark mode with smooth transitions
- **Modern UI**: Clean, flat design with responsive layout
- **Type Safety**: Complete TypeScript type definitions throughout

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Desktop Framework**: Tauri 2.0
- **State Management**: Zustand
- **Routing**: React Router 7
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + Custom Components
- **Icons**: Heroicons
- **Internationalization**: i18next
- **Build Tool**: Vite 7

## Prerequisites

- Node.js 18+ and pnpm
- Rust 1.70+
- Platform-specific dependencies for Tauri:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **Linux**: See [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/woicw/wr-ai-manager.git
cd wr-ai-manager
```

2. Install dependencies:

```bash
pnpm install
```

3. Run in development mode:

```bash
pnpm tauri dev
```

4. Build for production:

```bash
pnpm tauri build
```

## Project Structure

```text
wr-ai-manager/
├── src/                      # Frontend source code
│   ├── components/          # React components
│   │   ├── Sidebar/        # Navigation sidebar
│   │   └── ui/             # Reusable UI components
│   ├── pages/              # Page components
│   │   ├── home/           # Home page
│   │   ├── groups/         # Configuration group pages
│   │   ├── library/        # Local library page
│   │   ├── marketplace/    # Marketplace page
│   │   ├── settings/       # Settings page
│   │   └── tools/          # AI tool detail pages
│   ├── stores/             # Zustand state management
│   ├── i18n/               # Internationalization resources
│   ├── lib/                # Utility functions
│   └── types/              # TypeScript type definitions
├── src-tauri/               # Tauri backend (Rust)
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── config_manager.rs    # Configuration management
│   │   ├── symlink_manager.rs   # Symlink operations
│   │   └── workspace_builder.rs # Workspace setup
│   └── icons/              # Application icons
└── public/                  # Static assets
```

## Configuration Storage

WR AI Manager stores all configurations in `~/.wr-ai-manager/`:

```text
~/.wr-ai-manager/
├── config.json             # Main configuration file
├── groups/                 # Configuration groups
│   └── [group-id]/
│       ├── skills/        # Claude Code skills
│       ├── mcp/           # MCP server configs
│       ├── rules/         # Cursor rules
│       └── ...
└── library/               # Local library cache
```

## Usage

### Creating and Editing a Group

1. Click "Add Group" in the sidebar
2. Enter a name and description
3. Toggle skills, MCP entries, or commands inside the group page
4. The selection is saved as a draft immediately

### Syncing Existing Configurations

1. Click "Sync" button
2. Select detected AI tools
3. Choose which configurations to import
4. Confirm to sync

The GitHub sync form is prefilled with:

- Repository: `https://github.com/woicw/ai-config`
- Relative path: `awesome-claude`

### Applying a Configuration Group

1. Select a configuration group
2. Click "Apply to All"
3. Configurations will be linked to the respective AI tool directories

On Windows, if directory symlinks are not allowed, WR AI Manager automatically falls back to copy mode and shows a notice.

### Installing from Marketplace

1. Navigate to Marketplace
2. Browse or search for configurations
3. Click "Install" on desired items
4. Configurations are added to your library

## Development

### Running Tests

```bash
pnpm test
```

### Type Checking

```bash
pnpm build  # Runs tsc before build
```

### Code Structure Guidelines

- Use TypeScript for type safety
- Follow React best practices and hooks patterns
- Use Zustand for global state management
- Implement proper error handling
- Write tests for critical functionality

## Platform Support

- ✅ Windows 10/11
- ✅ macOS 11+
- ✅ Linux (Ubuntu 20.04+, Fedora, Arch)

## Release Notes

- Windows builds include `NSIS (.exe)` and an installer zip that contains the setup executable
- Linux builds include `AppImage`
- macOS builds can be produced unsigned, but unsigned downloads may be blocked by Gatekeeper after download

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Buy Me a Coffee

If you find this project helpful, consider buying me a coffee! ☕

<div align="center">
  <img src="./public/sponsor-qrcode.png" alt="WeChat Sponsor QR Code" width="300" />
  <p><i>Scan with WeChat to support</i></p>
</div>

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Heroicons](https://heroicons.com/)
