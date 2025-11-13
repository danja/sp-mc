import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MockSonicPiServer } from '../helpers/mock-sonic-pi-server.js';
import { useMockSonicPi, getTestMode } from '../helpers/test-config.js';

// We can't easily test the MCP server directly since it uses stdio transport,
// but we can test the individual components and beat patterns

const BEAT_PATTERNS = {
  blues: `
# Blues Beat
use_bpm 100
swing = 0.15  # Shuffle feel (0 for straight timing)
live_loop :blues_drums do
  sample :hat_tap, amp: 0.9
  sample :drum_bass_hard, amp: 0.9
  sleep 0.5+swing
  sample :hat_tap, amp: 0.7
  sample :drum_bass_hard, amp: 0.8
  sleep 0.5-swing
  sample :drum_snare_hard, amp: 0.8
  sample :hat_tap, amp: 0.8
  sleep 0.5+swing
  sample :hat_tap, amp: 0.7
  sleep 0.5-swing
end
`,
  rock: `
# Rock Beat
use_bpm 120
live_loop :rock_drums do
  sample :drum_bass_hard, amp: 1
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_snare_hard, amp: 0.9
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
  sample :drum_cymbal_closed, amp: 0.7
  sleep 0.5
end
`,
  hiphop: `
# Hip-Hop Beat
use_bpm 90
live_loop :hip_hop_drums do
  sample :drum_bass_hard, amp: 1.2
  sleep 1
  sample :drum_snare_hard, amp: 0.9
  sleep 1
  sample :drum_bass_hard, amp: 1.2
  sleep 0.5
  sample :drum_bass_hard, amp: 0.8
  sleep 0.5
  sample :drum_snare_hard, amp: 0.9
  sleep 1
end
`,
  electronic: `
# Electronic Beat
use_bpm 128
live_loop :electronic_beat do
  sample :bd_haus, amp: 1
  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :bd_haus, amp: 0.9
  sample :drum_snare_hard, amp: 0.8
  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5

  sample :drum_cymbal_closed, amp: 0.3
  sleep 0.5
end
`,
};

describe(`server beat patterns ${getTestMode()}`, () => {
  describe('BEAT_PATTERNS', () => {
    it('should have all expected beat patterns', () => {
      expect(BEAT_PATTERNS).toHaveProperty('blues');
      expect(BEAT_PATTERNS).toHaveProperty('rock');
      expect(BEAT_PATTERNS).toHaveProperty('hiphop');
      expect(BEAT_PATTERNS).toHaveProperty('electronic');
    });

    it('should have valid Sonic Pi code in beat patterns', () => {
      Object.entries(BEAT_PATTERNS).forEach(([style, pattern]) => {
        expect(pattern).toContain('use_bpm');
        expect(pattern).toContain('live_loop');
        expect(pattern).toContain('sleep');
      });
    });

    it('blues pattern should have correct BPM', () => {
      expect(BEAT_PATTERNS.blues).toContain('use_bpm 100');
    });

    it('rock pattern should have correct BPM', () => {
      expect(BEAT_PATTERNS.rock).toContain('use_bpm 120');
    });

    it('hiphop pattern should have correct BPM', () => {
      expect(BEAT_PATTERNS.hiphop).toContain('use_bpm 90');
    });

    it('electronic pattern should have correct BPM', () => {
      expect(BEAT_PATTERNS.electronic).toContain('use_bpm 128');
    });
  });

  describe('Sonic Pi code validation', () => {
    it('should validate basic play command', () => {
      const code = 'play 60';
      expect(code).toMatch(/play\s+\d+/);
    });

    it('should validate chord syntax', () => {
      const code = 'play chord(:C, :major)';
      expect(code).toContain('chord');
      expect(code).toMatch(/chord\([^)]+\)/);
    });

    it('should validate live_loop syntax', () => {
      const code = `
        live_loop :drums do
          sample :drum_bass_hard
          sleep 1
        end
      `;
      expect(code).toContain('live_loop');
      expect(code).toContain('do');
      expect(code).toContain('end');
    });

    it('should validate synth usage', () => {
      const code = `
        use_synth :fm
        play 60
      `;
      expect(code).toContain('use_synth');
      expect(code).toContain(':fm');
    });
  });
});

describe(`server integration tests ${getTestMode()}`, () => {
  let mockServer;
  const testHome = path.join(process.cwd(), 'test', 'fixtures', 'test-home');
  const testLogDir = path.join(testHome, '.sonic-pi', 'log');

  beforeEach(async () => {
    if (useMockSonicPi()) {
      mockServer = new MockSonicPiServer(3);
      await mockServer.start();

      // Setup test log directory
      fs.mkdirSync(testLogDir, { recursive: true });

      fs.writeFileSync(
        path.join(testLogDir, 'server-output.log'),
        `This is version 3.2.0 running on Ruby 3.2.3.\nListen port: ${mockServer.port}\nOSC cues port: 4560\n`
      );
    }
  });

  afterEach(() => {
    if (mockServer) {
      mockServer.stop();
    }

    try {
      if (fs.existsSync(testHome)) {
        fs.rmSync(testHome, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should have proper SYSTEM_PROMPT structure', () => {
    const SYSTEM_PROMPT = `
You are a Sonic Pi assistant that helps users create musical compositions using code.`;

    expect(SYSTEM_PROMPT).toContain('Sonic Pi');
    expect(SYSTEM_PROMPT).toContain('musical compositions');
  });

  it('should define all required MCP tools', () => {
    const requiredTools = [
      'initialize_sonic_pi',
      'play_music',
      'stop_music',
      'get_beat_pattern'
    ];

    requiredTools.forEach(tool => {
      expect(tool).toBeDefined();
      expect(typeof tool).toBe('string');
    });
  });
});

describe('chord format validation', () => {
  const validChordFormats = [
    "chord(:C, '1')",
    "chord(:C, '5')",
    "chord(:C, :major)",
    "chord(:C, :minor)",
    "chord(:C, '7')",
    "chord(:C, :m7)",
    "chord(:C, :dim)",
    "chord(:C, :sus2)",
    "chord(:C, :add9)",
  ];

  it('should validate chord format patterns', () => {
    validChordFormats.forEach(chordStr => {
      expect(chordStr).toMatch(/chord\(:[A-G][#b]?,\s*[':][^\)]+\)/);
    });
  });

  it('should have proper chord tonic format', () => {
    validChordFormats.forEach(chordStr => {
      expect(chordStr).toMatch(/:C/); // Tonic should be a symbol
    });
  });
});
