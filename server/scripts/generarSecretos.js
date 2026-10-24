// scripts/generarSecretos.js
// Genera secretos criptográficamente seguros para el despliegue en Vercel / producción.
//
// USO:
//   npm run secrets:generate   (desde server/)
//   node scripts/generarSecretos.js

const crypto = require('node:crypto');

const generarSecretos = () => ({
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  REFRESH_TOKEN_HASH_SECRET: crypto.randomBytes(32).toString('hex'),
  EMAIL_TOKEN_HASH_SECRET: crypto.randomBytes(32).toString('hex')
});

const imprimirSecretos = (secretos = generarSecretos()) => {
  const lineas = [
    '# ====================================================================',
    '# Secretos criptográficos generados para despliegue (Vercel / Producción)',
    '# Guarda estos valores en Vercel > Settings > Environment Variables',
    '# NUNCA compartas ni subas estos valores a Git.',
    '#',
    '# ROTACIÓN CON PERIODO DE GRACIA (Cero downtime para usuarios activos):',
    '# 1. Renombra las variables actuales en Vercel:',
    '#    JWT_SECRET               -> JWT_SECRET_PREVIOUS',
    '#    REFRESH_TOKEN_HASH_SECRET -> REFRESH_TOKEN_HASH_SECRET_PREVIOUS',
    '#    EMAIL_TOKEN_HASH_SECRET  -> EMAIL_TOKEN_HASH_SECRET_PREVIOUS',
    '# 2. Asigna los nuevos valores generados abajo como las variables principales.',
    '# 3. Tras 24-48 horas, elimina las variables *_PREVIOUS.',
    '# ====================================================================',
    '',
    `JWT_SECRET=${secretos.JWT_SECRET}`,
    `REFRESH_TOKEN_HASH_SECRET=${secretos.REFRESH_TOKEN_HASH_SECRET}`,
    `EMAIL_TOKEN_HASH_SECRET=${secretos.EMAIL_TOKEN_HASH_SECRET}`,
    ''
  ];
  return lineas.join('\n');
};

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(imprimirSecretos());
}

module.exports = {
  generarSecretos,
  imprimirSecretos
};
