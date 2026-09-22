module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ['eslint:recommended', 'plugin:n/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  plugins: ['n'],
  ignorePatterns: ['node_modules', 'migrations'],
  rules: {
    // Mismo criterio que client/.eslintrc.cjs: un argumento sin usar con nombre "_" es
    // intencional (p. ej. callbacks de Express con (err, req, res, next) donde no todos
    // se usan siempre), así que solo avisa (warn), no rompe el lint.
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Este servidor nunca se publica en npm (se despliega como función de Vercel a partir
    // de server/api/index.js) -- la distinción de plugin:n/recommended entre dependencies/
    // devDependencies "publicadas" no aplica aquí y solo generaría ruido en cada test que
    // requiere supertest (que sí está declarado, en devDependencies).
    'n/no-unpublished-require': 'off',
  },
  overrides: [
    {
      // Los tests son CommonJS igual que el resto, pero requieren explícitamente
      // describe/test/it/beforeEach/afterEach/mock de 'node:test' -- no hace falta ningún
      // entorno especial de ESLint para ellos, a diferencia de Vitest en el cliente.
      files: ['**/*.test.js'],
      env: { node: true },
    },
  ],
};
