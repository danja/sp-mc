# Sonic Pi MCP Server (Node.js)

A Model Context Protocol (MCP) server for controlling [Sonic Pi](https://sonic-pi.net/) via OSC (Open Sound Control).

This is a Node.js port of the Python `mcp-sonic-pi` server, with direct OSC communication instead of using the psonic library.

## Features

- **No external dependencies** (beyond npm packages) - communicates directly with Sonic Pi via OSC
- **Supports both Sonic Pi v3.x and v4.x** - automatically detects version and uses appropriate protocol
- **Configurable port** - works with non-standard OSC ports
- **Beat patterns** - includes pre-built patterns for blues, rock, hip-hop, and electronic music
- **MCP protocol** - integrates with Claude Code and other MCP clients

## Installation

```bash
cd /home/danny/github/sp
npm install
```

## Usage with Claude Code

### 1. Update your Claude Code configuration

Edit `~/.claude.json` and update the Sonic Pi MCP server configuration:

```json
{
  "projects": {
    "/home/danny/github/sp": {
      "mcpServers": {
        "sonic-pi": {
          "type": "stdio",
          "command": "node",
          "args": [
            "/path/to/sonic-pi-mcp/mcp/server.js"
          ],
          "env": {}
        }
      }
    }
  }
}
```

### 2. Restart Claude Code

After updating the configuration, restart Claude Code for the changes to take effect.

### 3. Use the tools

The server provides four tools:

- `initialize_sonic_pi()` - Initialize connection to Sonic Pi
- `play_music(code)` - Execute Sonic Pi code
- `stop_music()` - Stop all playback
- `get_beat_pattern(style)` - Get beat patterns (blues, rock, hiphop, electronic)

## How It Works

### Sonic Pi Communication

Sonic Pi uses OSC (Open Sound Control) for external communication. The server:

1. **Reads log files** to discover connection parameters:
   - v3.x: Reads `~/.sonic-pi/log/server-output.log` for listen port
   - v4.x: Reads `~/.sonic-pi/log/spider.log` for server port and authentication token

2. **Sends OSC messages** to control Sonic Pi:
   - v3.x: Uses client ID for identification
   - v4.x: Uses token-based authentication

### OSC Messages

**Sonic Pi v3.x format:**
```
/run-code [client_id (string), code (string)]
/stop-all-jobs [client_id (string)]
```

**Sonic Pi v4.x format:**
```
/run-code [token (integer), code (string)]
/stop-all-jobs [token (integer)]
```

## Troubleshooting

### "Sonic Pi does not appear to be running"

Make sure Sonic Pi is running before using the MCP server. The server checks for the existence of `~/.sonic-pi/log/` directory.

### "Could not parse Sonic Pi log files"

This usually means:
1. Sonic Pi hasn't fully started yet - wait a few seconds and try again
2. The log files are in an unexpected format - check `~/.sonic-pi/log/server-output.log`

### Port Issues

If Sonic Pi is using a non-standard port:
1. Check Sonic Pi preferences for the OSC port
2. The server automatically reads the correct port from the log files
3. No manual configuration needed!

### No sound when playing code

1. Check the Sonic Pi GUI for error messages
2. Verify your code syntax is correct
3. Make sure your system audio is working
4. Try running the code directly in Sonic Pi first

## Development

### File Structure

- `server.js` - Main MCP server implementation
- `sonic-pi-client.js` - OSC communication layer
- `log-parser.js` - Sonic Pi log file parser
- `../package.json` - Dependencies and metadata (at repository root)

### Testing

You can test the OSC communication directly:

```javascript
import { SonicPiClient } from './sonic-pi-client.js';

const client = new SonicPiClient();
await client.initialize();
await client.runCode('play 60');
await client.stop();
```

## Differences from Python Version

1. **No psonic dependency** - uses direct OSC communication
2. **Automatic version detection** - supports both v3.x and v4.x
3. **Better error messages** - more detailed connection information
4. **ES modules** - uses modern JavaScript module syntax

## License

MIT

## Credits

Based on the Python [mcp-sonic-pi](https://github.com/anthropics/mcp-sonic-pi) server.
