import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseSonicPiLog, logDirectoryExists } from '../../mcp/log-parser.js';

describe('log-parser', () => {
  const testHome = path.join(process.cwd(), 'test', 'fixtures', 'test-home');
  const testLogDir = path.join(testHome, '.sonic-pi', 'log');

  beforeEach(() => {
    // Clean up before each test
    try {
      if (fs.existsSync(testHome)) {
        fs.rmSync(testHome, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    // Clean up test directories
    try {
      if (fs.existsSync(testHome)) {
        fs.rmSync(testHome, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('parseV3Log', () => {
    it('should parse v3 server-output.log correctly', () => {
      // Create test log directory and file
      fs.mkdirSync(testLogDir, { recursive: true });

      const v3Log = fs.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'v3-server-output.log'), 'utf8');
      fs.writeFileSync(path.join(testLogDir, 'server-output.log'), v3Log);

      const result = parseSonicPiLog(testLogDir);

      expect(result).toBeDefined();
      expect(result.majorVersion).toBe(3);
      expect(result.version).toBe('3.2.0');
      expect(result.listenPort).toBe(51235);
      expect(result.oscCuesPort).toBe(4560);
    });

    it('should return null if v3 log file does not exist (no logs at all)', () => {
      // Don't create any logs
      const result = parseSonicPiLog(testLogDir);
      expect(result).toBeNull();
    });

    it('should use default oscCuesPort if not found in log', () => {
      fs.mkdirSync(testLogDir, { recursive: true });

      fs.writeFileSync(path.join(testLogDir, 'server-output.log'),
        'This is version 3.2.0 running on Ruby 3.2.3.\nListen port: 51235\n');

      const result = parseSonicPiLog(testLogDir);

      expect(result).toBeDefined();
      expect(result.oscCuesPort).toBe(4560); // default fallback
    });
  });

  describe('parseV4Log', () => {
    it('should parse v4 spider.log correctly', () => {
      fs.mkdirSync(testLogDir, { recursive: true });

      const v4Log = fs.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'v4-spider.log'), 'utf8');
      fs.writeFileSync(path.join(testLogDir, 'spider.log'), v4Log);

      const result = parseSonicPiLog(testLogDir);

      expect(result).toBeDefined();
      expect(result.majorVersion).toBe(4);
      expect(result.version).toBe('4.0.0');
      expect(result.serverPort).toBe(30129);
      expect(result.token).toBe(-2005799440);
    });

    it('should return null if no log files exist', () => {
      // Don't create any logs
      const result = parseSonicPiLog(testLogDir);
      expect(result).toBeNull();
    });

    it('should handle negative tokens correctly', () => {
      fs.mkdirSync(testLogDir, { recursive: true });

      fs.writeFileSync(path.join(testLogDir, 'spider.log'),
        'Ports: {:server_port=>30129, :gui_port=>30130}\nToken: -123456\n');

      const result = parseSonicPiLog(testLogDir);

      expect(result).toBeDefined();
      expect(result.token).toBe(-123456);
    });
  });

  describe('parseSonicPiLog', () => {
    it('should prioritize v4 over v3 when both logs exist', () => {
      fs.mkdirSync(testLogDir, { recursive: true });

      // Write both v3 and v4 logs
      const v3Log = fs.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'v3-server-output.log'), 'utf8');
      const v4Log = fs.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'v4-spider.log'), 'utf8');

      fs.writeFileSync(path.join(testLogDir, 'server-output.log'), v3Log);
      fs.writeFileSync(path.join(testLogDir, 'spider.log'), v4Log);

      const result = parseSonicPiLog(testLogDir);

      expect(result).toBeDefined();
      expect(result.majorVersion).toBe(4); // Should prefer v4
    });
  });

  describe('logDirectoryExists', () => {
    it('should return false when log directory does not exist', () => {
      // Don't create log directory
      expect(logDirectoryExists(testLogDir)).toBe(false);
    });

    it('should return true when log directory exists', () => {
      fs.mkdirSync(testLogDir, { recursive: true });

      expect(logDirectoryExists(testLogDir)).toBe(true);
    });
  });
});
