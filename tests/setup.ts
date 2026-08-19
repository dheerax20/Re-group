/**
 * Suite-wide setup.
 *
 * Intentionally minimal: the tests here are unit tests over pure logic and
 * middleware, so there is no database, no Auth0, and nothing to tear down.
 * `vitest.config.mts` pins the env vars that modules read at import time.
 */
export {};
