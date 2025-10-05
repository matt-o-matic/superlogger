const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  rootDir: '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2019',
        module: 'ESNext',
        moduleResolution: 'node16',
        lib: ['DOM', 'DOM.Iterable', 'ES2020'],
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        skipLibCheck: true,
        resolveJsonModule: false,
        verbatimModuleSyntax: false,
        rootDir: '.',
        outDir: '.ts-jest'
      }
    }]
  }
};

module.exports = config;
