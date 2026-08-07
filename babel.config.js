module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Jest runs on CommonJS and has no native support for dynamic `import()`
    // outside of --experimental-vm-modules. Transform it to a Promise-wrapped
    // require() in the test env only; Metro handles dynamic import natively
    // for the app bundle, so this must not apply there.
    env: {
      test: {
        plugins: ["babel-plugin-dynamic-import-node"],
      },
    },
  };
};
