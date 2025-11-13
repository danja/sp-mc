# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a Node.js MCP (Model Context Protocol) server for controlling Sonic Pi via OSC (Open Sound Control). Sonic Pi is a live coding music synthesizer that uses Ruby syntax. This MCP server enables Claude Code to compose and play music through Sonic Pi programmatically.

## Architecture

### MCP Server (`/mcp/`)

The MCP server is built with three main components:

1. **server.js** - Main MCP server implementing the Model Context Protocol
   - Exports 4 tools: `initialize_sonic_pi`, `play_music`, `stop_music`, `get_beat_pattern`
   - Contains beat patterns for blues, rock, hiphop, and electronic styles
   - Handles tool calls and routes them to the Sonic Pi client

2. **sonic-pi-client.js** - OSC communication layer
   - Manages UDP OSC messages to Sonic Pi
   - Supports both Sonic Pi v3.x and v4.x with different authentication methods
   - v3.x: Uses client ID string for identification
   - v4.x: Uses integer token-based authentication

3. **log-parser.js** - Log file parser
   - Automatically detects Sonic Pi version by parsing `~/.sonic-pi/log/` files
   - v3.x: Reads `server-output.log` for listen port and OSC cues port
   - v4.x: Reads `spider.log` for server port and authentication token

### Examples (`/examples/`)

Contains example Sonic Pi Ruby code files (e.g., `hip.rb`) demonstrating:
- Live loops for drums, bass, and melody
- Synth usage with various parameters (release, cutoff, amp, attack)
- BPM settings and timing patterns

## Development Commands

### Setup
```bash
npm install
```

### Testing
```bash
npm test              # Run tests (mock mode)
npm run test:watch   # Run tests in watch mode
npm run test:mock    # Explicitly use mock Sonic Pi
npm run test:real    # Test against real Sonic Pi (requires Sonic Pi running)
```

Test files are located in `mcp/*.test.js` with helpers in `test/helpers/`. Tests can run against either a mock Sonic Pi server or a real installation via the `USE_MOCK_SONIC_PI` environment variable.

### Running the MCP Server
The server is designed to run via stdio transport (not directly):
```bash
node mcp/server.js
```

However, it's typically invoked by Claude Code via the MCP configuration in `~/.claude.json`:
```json
{
  "projects": {
    "/home/danny/github/sp": {
      "mcpServers": {
        "sonic-pi": {
          "type": "stdio",
          "command": "node",
          "args": ["/home/danny/github/sp/mcp/server.js"],
          "env": {}
        }
      }
    }
  }
}
```

## Sonic Pi Code Structure

When writing Sonic Pi code:

- **Use `live_loop`** for continuous patterns (drums, bass, melody)
- **Set BPM** with `use_bpm <value>` at the start
- **Each live loop runs independently** and must be balanced (sleep time should match the musical pattern)
- **Synths** are selected with `use_synth :name` and configured with `use_synth_defaults`
- **Timing is critical** - all sleep statements within a loop must add up to complete musical phrases

### Common Synths
- `:fm` - Good for bass
- `:prophet` - Atmospheric, pad-like sounds
- `:tb303` - Classic acid bass

### Common Samples
- `:drum_bass_hard`, `:drum_snare_hard` - Drum kit
- `:bd_haus` - House kick drum
- `:drum_cymbal_closed`, `:hat_tap` - Hi-hats

### Chord Format
Chords use the format: `chord(tonic, name)` or `play chord(tonic, name)`
- Example: `chord(:C, :major)`, `chord(:C, '7')`, `chord(:C, :m7)`
- See server.js:95-160 for complete chord name reference

## Key Technical Details

### OSC Message Formats

**Sonic Pi v3.x:**
- `/run-code` - args: [client_id (string), code (string)]
- `/stop-all-jobs` - args: [client_id (string)]

**Sonic Pi v4.x:**
- `/run-code` - args: [token (integer), code (string)]
- `/stop-all-jobs` - args: [token (integer)]

### Port Detection

The server automatically detects the correct OSC port from log files. No manual configuration needed even if Sonic Pi uses non-standard ports.

### Prerequisites

Sonic Pi must be running before using the MCP server. The server checks for `~/.sonic-pi/log/` directory existence.
