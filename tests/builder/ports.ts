/* Ports for the isolated browser suite. Override both when 4322/4323 are busy on a machine. */
export const BUILDER_TEST_PORT = Number(process.env.BUILDER_TEST_PORT || 4322);
export const COMPANION_TEST_PORT = Number(
  process.env.BUILDER_COMPANION_TEST_PORT || 4323,
);
export const BUILDER_TEST_ORIGIN = `http://127.0.0.1:${BUILDER_TEST_PORT}`;
export const COMPANION_TEST_ORIGIN = `http://127.0.0.1:${COMPANION_TEST_PORT}`;
