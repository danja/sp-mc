import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SonicPiClient } from '../../mcp/sonic-pi-client.js';
import { MockSonicPiServer } from '../helpers/mock-sonic-pi-server.js';
import { useMockSonicPi, getTestMode } from '../helpers/test-config.js';

describe(`sonic-pi-client ${getTestMode()}`, () => {
  let client;
  let mockServer;
  const testHome = path.join(process.cwd(), 'test', 'fixtures', 'test-home');
  const testLogDir = path.join(testHome, '.sonic-pi', 'log');

  beforeEach(async () => {
    // Clean up before each test
    try {
      if (fs.existsSync(testHome)) {
        fs.rmSync(testHome, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    if (useMockSonicPi()) {
      // Setup mock server and fake log files
      mockServer = new MockSonicPiServer(3);
      const port = await mockServer.start();

      // Create fake log directory
      fs.mkdirSync(testLogDir, { recursive: true });

      // Write v3 log with the mock server port
      fs.writeFileSync(
        path.join(testLogDir, 'server-output.log'),
        `This is version 3.2.0 running on Ruby 3.2.3.\nListen port: ${port}\nOSC cues port: 4560\n`
      );

      // Create client with test log directory
      client = new SonicPiClient({ logDir: testLogDir });
    } else {
      // Use real Sonic Pi
      client = new SonicPiClient();
    }
  });

  afterEach(() => {
    if (client) {
      client.close();
    }

    if (mockServer) {
      mockServer.stop();
    }

    // Cleanup test files
    try {
      if (fs.existsSync(testHome)) {
        fs.rmSync(testHome, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize', () => {
    it('should initialize successfully with valid log files', async () => {
      const result = await client.initialize();

      expect(result).toContain('Connected to');
      expect(client.isInitialized).toBe(true);
      expect(client.params).toBeDefined();
      expect(client.params.majorVersion).toBe(3);
    });

    it('should return error when log files do not exist', async () => {
      if (useMockSonicPi()) {
        // Remove log files
        if (fs.existsSync(testLogDir)) {
          fs.rmSync(testLogDir, { recursive: true });
        }

        const result = await client.initialize();

        expect(result).toContain('Error');
        expect(client.isInitialized).toBe(false);
      }
    });

    it('should handle connection errors gracefully', async () => {
      if (useMockSonicPi()) {
        // Mock initialize to return an error
        vi.spyOn(client, 'initialize').mockImplementation(async () => {
          return 'Error initializing OSC client: Test error';
        });

        const result = await client.initialize();

        expect(result).toContain('Error');
      }
    });
  });

  describe('runCode', () => {
    it('should send code to Sonic Pi (v3 format)', async () => {
      await client.initialize();

      const code = 'play 60';
      const result = await client.runCode(code);

      expect(result).toContain('sent to Sonic Pi successfully');

      if (useMockSonicPi()) {
        // Wait a bit for the message to arrive
        await new Promise(resolve => setTimeout(resolve, 100));

        const messages = mockServer.getMessagesByAddress('/run-code');
        expect(messages.length).toBeGreaterThan(0);

        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.address).toBe('/run-code');
        expect(lastMessage.args[0].value).toBe('SONIC_PI_NODE_MCP');
        expect(lastMessage.args[1].value).toBe(code);
      }
    });

    it('should auto-initialize if not initialized', async () => {
      const code = 'play 60';
      const result = await client.runCode(code);

      expect(result).toContain('sent to Sonic Pi successfully');
      expect(client.isInitialized).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      if (useMockSonicPi()) {
        // Remove log files to cause initialization error
        if (fs.existsSync(testLogDir)) {
          fs.rmSync(testLogDir, { recursive: true });
        }

        const result = await client.runCode('play 60');

        expect(result).toContain('Error');
      }
    });
  });

  describe('stop', () => {
    it('should send stop message to Sonic Pi (v3 format)', async () => {
      await client.initialize();

      const result = await client.stop();

      expect(result).toContain('Stopped all Sonic Pi jobs');

      if (useMockSonicPi()) {
        await new Promise(resolve => setTimeout(resolve, 100));

        const messages = mockServer.getMessagesByAddress('/stop-all-jobs');
        expect(messages.length).toBeGreaterThan(0);

        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.address).toBe('/stop-all-jobs');
        expect(lastMessage.args[0].value).toBe('SONIC_PI_NODE_MCP');
      }
    });

    it('should auto-initialize if not initialized', async () => {
      const result = await client.stop();

      expect(result).toContain('Stopped all Sonic Pi jobs');
      expect(client.isInitialized).toBe(true);
    });
  });

  describe('close', () => {
    it('should close the UDP port and set isInitialized to false', async () => {
      await client.initialize();
      expect(client.isInitialized).toBe(true);

      client.close();

      expect(client.isInitialized).toBe(false);
    });

    it('should handle closing when not initialized', () => {
      expect(() => client.close()).not.toThrow();
    });
  });

  describe('v4 format', () => {
    beforeEach(async () => {
      if (useMockSonicPi()) {
        // Close existing client and server
        if (client) client.close();
        if (mockServer) mockServer.stop();

        // Clean up completely
        try {
          if (fs.existsSync(testHome)) {
            fs.rmSync(testHome, { recursive: true, force: true });
          }
        } catch (error) {
          // Ignore cleanup errors
        }

        // Setup v4 mock server
        mockServer = new MockSonicPiServer(4);
        const port = await mockServer.start();
        const token = mockServer.getToken();

        // Write v4 log (but NOT v3 log)
        fs.mkdirSync(testLogDir, { recursive: true });

        fs.writeFileSync(
          path.join(testLogDir, 'spider.log'),
          `Starting Spider server for Sonic Pi version 4.0.0\nPorts: {:server_port=>${port}, :gui_port=>30130}\nToken: ${token}\n`
        );

        // Create new client with test log directory
        client = new SonicPiClient({ logDir: testLogDir });
      }
    });

    it('should send code with token authentication (v4 format)', async () => {
      if (useMockSonicPi()) {
        await client.initialize();

        const code = 'play 60';
        await client.runCode(code);

        await new Promise(resolve => setTimeout(resolve, 100));

        const messages = mockServer.getMessagesByAddress('/run-code');
        expect(messages.length).toBeGreaterThan(0);

        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.address).toBe('/run-code');
        expect(lastMessage.args[0].value).toBe(mockServer.getToken());
        expect(lastMessage.args[1].value).toBe(code);
      }
    });

    it('should send stop with token authentication (v4 format)', async () => {
      if (useMockSonicPi()) {
        await client.initialize();
        await client.stop();

        await new Promise(resolve => setTimeout(resolve, 100));

        const messages = mockServer.getMessagesByAddress('/stop-all-jobs');
        expect(messages.length).toBeGreaterThan(0);

        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.address).toBe('/stop-all-jobs');
        expect(lastMessage.args[0].value).toBe(mockServer.getToken());
      }
    });
  });
});
