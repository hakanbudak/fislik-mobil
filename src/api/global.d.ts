// client.test.ts mocks `fetch` via the Node-test-runner convention of
// assigning to `global.fetch`. React Native/Hermes has no `global` ambient
// type declared by default, so this file adds just that one identifier.
//
// Deliberately NOT `"node"` in tsconfig.json's `types` array: that would
// pull in the full Node ambient surface (Buffer, process, fs, setImmediate,
// ...) everywhere in the app, and `tsc --noEmit` would happily accept
// Node-only APIs that don't exist on-device. This declares only `global`
// itself (typed as `typeof globalThis`, TypeScript's own built-in lib type —
// no @types/node needed) and nothing else Node-specific is introduced.
//
// Lives outside src/api/__tests__/ so Jest's default testMatch
// (**/__tests__/**/*.[jt]s?(x)) doesn't pick up this .d.ts as a test file.
declare const global: typeof globalThis;
