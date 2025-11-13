/**
 * Test configuration helpers
 */

/**
 * Check if tests should use mock Sonic Pi server
 * @returns {boolean}
 */
export function useMockSonicPi() {
  const envValue = process.env.USE_MOCK_SONIC_PI;
  return envValue === 'true' || envValue === '1' || envValue === undefined;
}

/**
 * Skip test if using real Sonic Pi
 */
export function skipIfReal(testFn) {
  return useMockSonicPi() ? testFn : testFn.skip;
}

/**
 * Skip test if using mock Sonic Pi
 */
export function skipIfMock(testFn) {
  return useMockSonicPi() ? testFn.skip : testFn;
}

/**
 * Get test description prefix based on mode
 */
export function getTestMode() {
  return useMockSonicPi() ? '[MOCK]' : '[REAL]';
}
