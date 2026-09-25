// Globales del navegador que se confunden con una variable propia. Es la lista del paquete
// confusing-browser-globals, la que usa Create React App; va copiada para no añadir una dependencia.
// Si falta la variable `status` o `name`, el código lee window.status o window.name sin ningún
// error: pasó con un mutante en la tarea 4 (docs/tarea4-diseno.md, sección 11). Para usar uno de
// verdad, se escribe window.<nombre>.
const GLOBALES_CONFUSOS = [
  'addEventListener', 'blur', 'close', 'closed', 'confirm', 'defaultStatus', 'defaultstatus', 'event',
  'external', 'find', 'focus', 'frameElement', 'frames', 'history', 'innerHeight', 'innerWidth',
  'length', 'location', 'locationbar', 'menubar', 'moveBy', 'moveTo', 'name', 'onblur', 'onerror',
  'onfocus', 'onload', 'onresize', 'onunload', 'open', 'opener', 'opera', 'outerHeight', 'outerWidth',
  'pageXOffset', 'pageYOffset', 'parent', 'print', 'removeEventListener', 'resizeBy', 'resizeTo',
  'screen', 'screenLeft', 'screenTop', 'screenX', 'screenY', 'scroll', 'scrollbars', 'scrollBy',
  'scrollTo', 'scrollX', 'scrollY', 'self', 'status', 'statusbar', 'stop', 'toolbar', 'top',
];

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
    'no-restricted-globals': ['error', ...GLOBALES_CONFUSOS],
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
