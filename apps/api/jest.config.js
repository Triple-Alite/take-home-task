module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }] },
  collectCoverageFrom: ['**/*.(t|j)s'],
  testEnvironment: 'node'
};
