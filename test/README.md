# Test Documentation

This directory contains test utilities and fixtures for the Sonic Pi MCP server.

## Directory Structure

```
test/
├── fixtures/           # Test data files
│   ├── v3-server-output.log   # Sample Sonic Pi v3 log
│   └── v4-spider.log           # Sample Sonic Pi v4 log
└── helpers/            # Test utilities
    ├── mock-sonic-pi-server.js  # Mock OSC server
    └── test-config.js           # Test configuration utilities
```

## Mock vs Real Testing

Tests can run in two modes:

### Mock Mode (Default)
- Uses `MockSonicPiServer` to simulate Sonic Pi
- Creates temporary fake log files
- Fast and doesn't require Sonic Pi to be running
- Set with: `USE_MOCK_SONIC_PI=true` (default)

### Real Mode
- Tests against actual Sonic Pi installation
- Requires Sonic Pi to be running
- Useful for integration testing
- Set with: `USE_MOCK_SONIC_PI=false`

## Mock Sonic Pi Server

The `MockSonicPiServer` class (`helpers/mock-sonic-pi-server.js`) provides:

- OSC server that listens for `/run-code` and `/stop-all-jobs` messages
- Message recording for test assertions
- Support for both v3.x and v4.x protocols
- Dynamic port allocation to avoid conflicts

### Example Usage

```javascript
import { MockSonicPiServer } from '../test/helpers/mock-sonic-pi-server.js';

const server = new MockSonicPiServer(3); // v3.x server
const port = await server.start();

// ... send OSC messages ...

const messages = server.getMessagesByAddress('/run-code');
expect(messages.length).toBeGreaterThan(0);

server.stop();
```

## Test Configuration Utilities

The `test-config.js` module provides helpers for conditional test execution:

- `useMockSonicPi()` - Check if running in mock mode
- `skipIfReal(testFn)` - Skip test when running against real Sonic Pi
- `skipIfMock(testFn)` - Skip test when running with mock server
- `getTestMode()` - Get string descriptor for current mode

## Writing New Tests

When adding new tests:

1. Use `beforeEach` / `afterEach` to clean up test state
2. Mock `os.homedir()` to point to test fixtures directory
3. Use the mock server for OSC communication tests
4. Check `useMockSonicPi()` for mode-specific behavior
5. Clean up temporary files and close connections

### Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMockSonicPi } from '../test/helpers/test-config.js';
import { MockSonicPiServer } from '../test/helpers/mock-sonic-pi-server.js';

describe('my feature', () => {
  let mockServer;

  beforeEach(async () => {
    if (useMockSonicPi()) {
      mockServer = new MockSonicPiServer(3);
      await mockServer.start();
    }
  });

  afterEach(() => {
    if (mockServer) {
      mockServer.stop();
    }
  });

  it('should do something', () => {
    // Test code here
  });
});
```

## Known Limitations

1. If Sonic Pi is installed on the test machine, some log-parser tests may find real logs
2. Real mode tests require Sonic Pi to be running before test execution
3. Port conflicts can occur if multiple test runs happen simultaneously
4. V4.x real testing requires authentication token from actual Sonic Pi instance
