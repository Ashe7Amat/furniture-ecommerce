module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // El proyecto no usa PropTypes -- lo desactivamos en vez de dejar que ensucie el lint
    // con avisos que nadie va a arreglar.
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Los archivos de test usan describe/it/expect/vi de Vitest (importados, pero
      // ESLint necesita saber que el entorno es de test para reglas como no-undef en
      // casos donde no se importan explícitamente).
      files: ['**/*.test.{js,jsx}', 'src/setupTests.js'],
      env: { 'jest': true, node: true },
    },
    {
      // Los archivos de contexto exportan el Context además del Provider a propósito
      // (otros componentes hacen useContext(XContext) directamente) -- eso es justo lo
      // que react-refresh/only-export-components avisa, pero aquí es intencional y no
      // rompe el fast refresh en la práctica.
      files: ['src/context/*.jsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
