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
