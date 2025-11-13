# sonic-pi-mcp

This connects any MCP client with [Sonic Pi](https://sonic-pi.net/) enabling you to create music with English.

## Sonic Pi MCP Server

*I wanted to use [mcp-sonic-pi](https://github.com/vinayak-mehta/mcp-sonic-pi) but had version issues on my system so ported it to Node*

So far only tested on a Linux system with Claude Code.

### Features
- Direct OSC communication with Sonic Pi (no psonic dependency)
- Supports both Sonic Pi v3.x and v4.x
- Automatic port detection from Sonic Pi log files

### Prerequisites

* Sonic Pi
* Node

### Setup

#### Installation

```sh
git clone https://github.com/danja/sonic-pi-mcp.git
cd sonic-pi-mcp
npm install
```

#### Configure MCP Connection

eg. in `~/.claude.json`:
```json
   "sonic-pi": {
     "type": "stdio",
     "command": "node",
     "args": ["/path/to/sonic-pi-mcp/mcp/server.js"],
     "env": {}
   }
```

3. Restart Claude Code

### Running in VS Code

There is a VS Code extension [vscode-sonic-pi](https://marketplace.visualstudio.com/items?itemName=jakearl.vscode-sonic-pi) which provides syntax highlighting for Sonic Pi code. With Claude Code running in a VS Code terminal you can build up songs in the editor and manage them on the file system. 

### Port Configuration Note
The MCP server automatically detects the correct port from Sonic Pi's log files. If Sonic Pi is running on a non-standard OSC port (e.g., 4560 instead of the default 4557), the server will find and use the correct port automatically by parsing `~/.sonic-pi/log/server-output.log`.

### Testing

This project includes comprehensive test coverage with vitest. Tests can run against either a mock Sonic Pi server or a real Sonic Pi installation.

**Run tests (mock mode by default):**
```bash
npm test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run tests with mock Sonic Pi server:**
```bash
npm run test:mock
```

**Run tests with real Sonic Pi (requires Sonic Pi to be running):**
```bash
npm run test:real
```

**Test Structure:**
- `mcp/log-parser.test.js` - Tests for Sonic Pi log file parsing
- `mcp/sonic-pi-client.test.js` - Tests for OSC communication with Sonic Pi
- `mcp/server.test.js` - Tests for MCP server beat patterns and validation
- `test/helpers/` - Mock Sonic Pi server and test utilities
- `test/fixtures/` - Sample log files for testing

**Note:** If you have Sonic Pi installed, some tests may use your real Sonic Pi logs for integration testing. To run pure unit tests, temporarily move `~/.sonic-pi/log/` or use Docker/CI environments.

### Documentation
See `/mcp/README.md` for detailed documentation.
