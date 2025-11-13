import osc from 'osc';
import { parseSonicPiLog } from './log-parser.js';

/**
 * Client for communicating with Sonic Pi via OSC
 */
export class SonicPiClient {
  constructor(options = {}) {
    this.udpPort = null;
    this.params = null;
    this.isInitialized = false;
    this.clientId = 'SONIC_PI_NODE_MCP';
    this.logDir = options.logDir; // Optional log directory for testing
  }

  /**
   * Initialize connection to Sonic Pi
   * @returns {Promise<string>} Success message or error
   */
  async initialize() {
    // Parse log files to get connection parameters
    this.params = parseSonicPiLog(this.logDir);

    if (!this.params) {
      return 'Error: Could not parse Sonic Pi log files. Make sure Sonic Pi is running.';
    }

    try {
      // Create UDP port for sending OSC messages
      this.udpPort = new osc.UDPPort({
        localAddress: '0.0.0.0',
        localPort: 0, // Use any available port for sending
        metadata: true
      });

      // Open the port
      await new Promise((resolve, reject) => {
        this.udpPort.on('ready', resolve);
        this.udpPort.on('error', reject);
        this.udpPort.open();
      });

      this.isInitialized = true;

      const versionInfo = `Sonic Pi ${this.params.version} (v${this.params.majorVersion})`;
      if (this.params.majorVersion === 3) {
        return `Connected to ${versionInfo} on port ${this.params.listenPort}`;
      } else {
        return `Connected to ${versionInfo} on port ${this.params.serverPort} with token authentication`;
      }
    } catch (error) {
      return `Error initializing OSC client: ${error.message}`;
    }
  }

  /**
   * Send code to Sonic Pi for execution
   * @param {string} code - Sonic Pi Ruby code to execute
   * @returns {Promise<string>} Success message or error
   */
  async runCode(code) {
    if (!this.isInitialized) {
      const initResult = await this.initialize();
      if (initResult.startsWith('Error')) {
        return initResult;
      }
    }

    try {
      const targetPort = this.params.majorVersion === 3
        ? this.params.listenPort
        : this.params.serverPort;

      // Build OSC message based on version
      let oscMessage;

      if (this.params.majorVersion === 3) {
        // v3.x format: /run-code [client_id (string), code (string)]
        oscMessage = {
          address: '/run-code',
          args: [
            { type: 's', value: this.clientId },
            { type: 's', value: code }
          ]
        };
      } else {
        // v4.x format: /run-code [token (integer), code (string)]
        oscMessage = {
          address: '/run-code',
          args: [
            { type: 'i', value: this.params.token },
            { type: 's', value: code }
          ]
        };
      }

      // Send the message
      this.udpPort.send(oscMessage, '127.0.0.1', targetPort);

      return 'Code sent to Sonic Pi successfully. If you don\'t hear anything, check Sonic Pi for errors.';
    } catch (error) {
      return `Error sending code: ${error.message}`;
    }
  }

  /**
   * Stop all running jobs in Sonic Pi
   * @returns {Promise<string>} Success message or error
   */
  async stop() {
    if (!this.isInitialized) {
      const initResult = await this.initialize();
      if (initResult.startsWith('Error')) {
        return initResult;
      }
    }

    try {
      const targetPort = this.params.majorVersion === 3
        ? this.params.listenPort
        : this.params.serverPort;

      // Build OSC message based on version
      let oscMessage;

      if (this.params.majorVersion === 3) {
        // v3.x format: /stop-all-jobs [client_id (string)]
        oscMessage = {
          address: '/stop-all-jobs',
          args: [
            { type: 's', value: this.clientId }
          ]
        };
      } else {
        // v4.x format: /stop-all-jobs [token (integer)]
        oscMessage = {
          address: '/stop-all-jobs',
          args: [
            { type: 'i', value: this.params.token }
          ]
        };
      }

      // Send the message
      this.udpPort.send(oscMessage, '127.0.0.1', targetPort);

      return 'Stopped all Sonic Pi jobs';
    } catch (error) {
      return `Error stopping: ${error.message}`;
    }
  }

  /**
   * Close the UDP port
   */
  close() {
    if (this.udpPort) {
      try {
        this.udpPort.close();
      } catch (error) {
        // Ignore "Not running" errors - port is already closed
        if (error.message !== 'Not running') {
          throw error;
        }
      }
      this.isInitialized = false;
    }
  }
}
