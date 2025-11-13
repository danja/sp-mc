import osc from 'osc';

/**
 * Mock Sonic Pi OSC server for testing
 * Simulates both v3.x and v4.x Sonic Pi servers
 */
export class MockSonicPiServer {
  constructor(version = 3) {
    this.version = version;
    this.port = null;
    this.udpPort = null;
    this.receivedMessages = [];
    this.isRunning = false;
  }

  /**
   * Start the mock server
   * @returns {Promise<number>} The port number the server is listening on
   */
  async start() {
    return new Promise((resolve, reject) => {
      // Use a fixed high port for testing to avoid conflicts
      // Start at 54320 and try up to 100 ports if needed
      const basePort = 54320;
      let attempts = 0;
      const maxAttempts = 100;

      const tryPort = (portToTry) => {
        this.udpPort = new osc.UDPPort({
          localAddress: '127.0.0.1',
          localPort: portToTry,
          metadata: true
        });

        this.udpPort.on('ready', () => {
          this.port = portToTry;
          this.isRunning = true;
          resolve(this.port);
        });

        this.udpPort.on('error', (error) => {
          if (error.code === 'EADDRINUSE' && attempts < maxAttempts) {
            attempts++;
            setTimeout(() => tryPort(basePort + attempts), 10);
          } else {
            reject(error);
          }
        });

        this.udpPort.on('message', (oscMsg) => {
          this.receivedMessages.push({
            address: oscMsg.address,
            args: oscMsg.args,
            timestamp: Date.now()
          });
        });

        this.udpPort.open();
      };

      tryPort(basePort);
    });
  }

  /**
   * Old start method - kept for reference
   */
  async _startOld() {
    return new Promise((resolve, reject) => {
      this.udpPort = new osc.UDPPort({
        localAddress: '127.0.0.1',
        localPort: 0, // Let OS assign a port
        metadata: true
      });

      this.udpPort.on('ready', () => {
        // Get the actual assigned port from the socket
        const socket = this.udpPort._udpPort?.socket || this.udpPort._socket;
        this.port = socket ? socket.address().port : this.udpPort.options.localPort;
        this.isRunning = true;
        resolve(this.port);
      });

      this.udpPort.on('error', (error) => {
        reject(error);
      });

      this.udpPort.on('message', (oscMsg) => {
        this.receivedMessages.push({
          address: oscMsg.address,
          args: oscMsg.args,
          timestamp: Date.now()
        });
      });

      this.udpPort.open();
    });
  }

  /**
   * Stop the mock server
   */
  stop() {
    if (this.udpPort) {
      this.udpPort.close();
      this.isRunning = false;
    }
  }

  /**
   * Get all received messages
   */
  getMessages() {
    return this.receivedMessages;
  }

  /**
   * Get messages by address
   */
  getMessagesByAddress(address) {
    return this.receivedMessages.filter(msg => msg.address === address);
  }

  /**
   * Clear received messages
   */
  clearMessages() {
    this.receivedMessages = [];
  }

  /**
   * Get the last received message
   */
  getLastMessage() {
    return this.receivedMessages[this.receivedMessages.length - 1];
  }

  /**
   * Wait for a message with a specific address
   * @param {string} address - OSC address to wait for
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} The received message
   */
  waitForMessage(address, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const message = this.receivedMessages.find(msg => msg.address === address);
        if (message) {
          clearInterval(checkInterval);
          resolve(message);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for message: ${address}`));
        }
      }, 10);
    });
  }

  /**
   * Get connection token (for v4.x)
   */
  getToken() {
    return -2005799440; // Fixed token for testing
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      version: this.version,
      port: this.port,
      token: this.version === 4 ? this.getToken() : null
    };
  }
}
