const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');

const conTimeout = (promesa, ms = 2000) => {
  let timeoutId;
  const temporizador = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout tras ${ms}ms`));
    }, ms);
  });
  return Promise.race([promesa, temporizador]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const pingSupabase = async () => {
  try {
    const res = await conTimeout(
      supabase.from('muebles').select('id').limit(1),
      2000
    );
    if (res?.error) return 'fail';
    return 'ok';
  } catch {
    return 'fail';
  }
};

const pingStripe = async () => {
  try {
    const stripe = stripeUtil.getStripe();
    if (!stripe || !stripe.balance?.retrieve) return 'fail';
    await conTimeout(stripe.balance.retrieve(), 2000);
    return 'ok';
  } catch {
    return 'fail';
  }
};

const obtenerEstadoSalud = async (req, res) => {
  const [supabaseCheck, stripeCheck] = await Promise.all([
    pingSupabase(),
    pingStripe()
  ]);

  let status = 'ok';
  if (supabaseCheck === 'fail' && stripeCheck === 'fail') {
    status = 'down';
  } else if (supabaseCheck === 'fail' || stripeCheck === 'fail') {
    status = 'degraded';
  }

  const respuesta = {
    status,
    checks: {
      supabase: supabaseCheck,
      stripe: stripeCheck
    },
    timestamp: new Date().toISOString()
  };

  const codigo = status === 'down' ? 503 : 200;
  return res.status(codigo).json(respuesta);
};

module.exports = {
  obtenerEstadoSalud,
  pingSupabase,
  pingStripe
};
