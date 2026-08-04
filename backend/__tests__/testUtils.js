const path = require('path');

const loadWithMocks = (modulePath, mocks = {}) => {
  const resolvedModule = require.resolve(modulePath);
  const injectedDeps = [];

  Object.entries(mocks).forEach(([request, mockExports]) => {
    const resolvedDep = require.resolve(request, {
      paths: [path.dirname(resolvedModule)]
    });

    injectedDeps.push({
      resolvedDep,
      previous: require.cache[resolvedDep]
    });

    require.cache[resolvedDep] = {
      id: resolvedDep,
      filename: resolvedDep,
      loaded: true,
      exports: mockExports
    };
  });

  const previousModule = require.cache[resolvedModule];
  delete require.cache[resolvedModule];
  const loaded = require(resolvedModule);

  const restore = () => {
    delete require.cache[resolvedModule];

    if (previousModule) {
      require.cache[resolvedModule] = previousModule;
    }

    injectedDeps.forEach(({ resolvedDep, previous }) => {
      if (previous) {
        require.cache[resolvedDep] = previous;
      } else {
        delete require.cache[resolvedDep];
      }
    });
  };

  return { loaded, restore };
};

module.exports = {
  loadWithMocks
};
