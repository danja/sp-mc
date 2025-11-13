import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Parse Sonic Pi log files to extract connection parameters
 */

/**
 * Get the Sonic Pi log directory
 * @param {string} [customLogDir] - Optional custom log directory for testing
 * @returns {string} Path to log directory
 */
export function getSonicPiLogDir(customLogDir) {
  return customLogDir || path.join(os.homedir(), '.sonic-pi', 'log');
}

/**
 * Parse Sonic Pi v3.x server-output.log file
 * @param {string} [logDir] - Optional custom log directory
 * @returns {Object|null} { listenPort: number, oscCuesPort: number, version: string } or null
 */
function parseV3Log(logDir) {
  const SONIC_PI_LOG_DIR = getSonicPiLogDir(logDir);
  const logPath = path.join(SONIC_PI_LOG_DIR, 'server-output.log');

  if (!fs.existsSync(logPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');

    let listenPort = null;
    let oscCuesPort = null;
    let version = null;

    for (const line of lines) {
      // Extract version: "This is version 3.2.0 running on Ruby 3.2.3."
      const versionMatch = line.match(/This is version ([0-9.]+)/);
      if (versionMatch) {
        version = versionMatch[1];
      }

      // Extract listen port: "Listen port: 51235"
      const listenPortMatch = line.match(/^Listen port:\s*([0-9]+)/);
      if (listenPortMatch) {
        listenPort = parseInt(listenPortMatch[1], 10);
      }

      // Extract OSC cues port: "OSC cues port: 4560"
      const oscCuesMatch = line.match(/^OSC cues port:\s*([0-9]+)/);
      if (oscCuesMatch) {
        oscCuesPort = parseInt(oscCuesMatch[1], 10);
      }
    }

    if (listenPort !== null) {
      return {
        listenPort,
        oscCuesPort: oscCuesPort || 4560, // default fallback
        version: version || 'unknown',
        majorVersion: 3
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing v3 log:', error);
    return null;
  }
}

/**
 * Parse Sonic Pi v4+ spider.log file
 * @param {string} [logDir] - Optional custom log directory
 * @returns {Object|null} { serverPort: number, token: number, version: string } or null
 */
function parseV4Log(logDir) {
  const SONIC_PI_LOG_DIR = getSonicPiLogDir(logDir);
  const logPath = path.join(SONIC_PI_LOG_DIR, 'spider.log');

  if (!fs.existsSync(logPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');

    let serverPort = null;
    let token = null;
    let version = null;

    for (const line of lines) {
      // Extract ports: "Ports: {:server_port=>30129, :gui_port=>30130, ...}"
      const portsMatch = line.match(/:server_port=>([0-9]+)/);
      if (portsMatch) {
        serverPort = parseInt(portsMatch[1], 10);
      }

      // Extract token: "Token: -2005799440"
      const tokenMatch = line.match(/Token:\s*(-?[0-9]+)/);
      if (tokenMatch) {
        token = parseInt(tokenMatch[1], 10);
      }

      // Extract version if present
      const versionMatch = line.match(/version ([0-9.]+)/);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }

    if (serverPort !== null && token !== null) {
      return {
        serverPort,
        token,
        version: version || 'unknown',
        majorVersion: 4
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing v4 log:', error);
    return null;
  }
}

/**
 * Parse Sonic Pi logs and return connection parameters
 * Tries v4 first, falls back to v3
 * @param {string} [logDir] - Optional custom log directory for testing
 * @returns {Object|null} Connection parameters or null if parsing failed
 */
export function parseSonicPiLog(logDir) {
  // Try v4 first
  const v4Params = parseV4Log(logDir);
  if (v4Params) {
    return v4Params;
  }

  // Fall back to v3
  const v3Params = parseV3Log(logDir);
  if (v3Params) {
    return v3Params;
  }

  return null;
}

/**
 * Check if Sonic Pi log directory exists
 * @param {string} [logDir] - Optional custom log directory for testing
 * @returns {boolean}
 */
export function logDirectoryExists(logDir) {
  const SONIC_PI_LOG_DIR = getSonicPiLogDir(logDir);
  return fs.existsSync(SONIC_PI_LOG_DIR);
}
