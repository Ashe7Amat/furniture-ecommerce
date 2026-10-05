import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api');

// Login lee VITE_GOOGLE_CLIENT_ID al cargarse: cada test carga el módulo con la variable que
// necesita (y la api simulada de esa misma carga, para que sea la que usa la página).
const cargar = async ({ googleClientId = '' } = {}) => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', googleClientId);
  vi.resetModules();
  // Los contextos también se cargan de nuevo: tras resetModules, Login usa copias nuevas de ellos.
  const [{ default: Login }, api, { AuthContext }, { ToastContext }] = await Promise.all([
    import('./Login'),
    import('../services/api'),
    import('../context/AuthContext'),
    import('../context/ToastContext'),
  ]);
  const login = vi.fn();
  const showToast = vi.fn();
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={{ login }}>
        <ToastContext.Provider value={{ showToast }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<p>Página de inicio</p>} />
          </Routes>
        </ToastContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { api, login, showToast };
};

const escribir = (placeholder, valor) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: valor } });
const enviar = () =>
  act(async () => {
    fireEvent.submit(screen.getByPlaceholderText('Email').closest('form'));
  });
const USUARIO = { id: 'u1', nombre: 'Ana', email: 'ana@correo.es' };

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
  document.getElementById('google-identity-script')?.remove();
});

describe('Login — iniciar sesión', () => {
  it('el título de la página es su h1, también al pasar a "Crear una cuenta" (H43)', async () => {
    await cargar();
    expect(screen.getByRole('heading', { level: 1, name: 'Acceder a mi cuenta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Regístrate/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Crear una cuenta' })).toBeInTheDocument();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });

  it('sin email o contraseña avisa y no llama al servidor', async () => {
    const { api } = await cargar();
    escribir('Email', 'ana@correo.es');

    await enviar();

    expect(screen.getByText('Por favor, completa todos los campos.')).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
  });

  it('si va bien, abre la sesión con el access y el refresh token, saluda y lleva al inicio', async () => {
    const { api, login, showToast } = await cargar();
    api.loginUser.mockResolvedValue({ success: true, user: USUARIO, token: 'access', refreshToken: 'refresh' });
    escribir('Email', 'ana@correo.es');
    escribir('Contraseña', 'secreta');

    await enviar();

    expect(api.loginUser).toHaveBeenCalledWith('ana@correo.es', 'secreta');
    expect(login).toHaveBeenCalledWith(USUARIO, 'access', 'refresh');
    expect(showToast).toHaveBeenCalledWith('¡Hola de nuevo, Ana!', 'success');
    expect(screen.getByText('Página de inicio')).toBeInTheDocument();
  });

  it('si el servidor lo rechaza, enseña su motivo; sin motivo, "Credenciales incorrectas."', async () => {
    const { api, login } = await cargar();
    escribir('Email', 'ana@correo.es');
    escribir('Contraseña', 'mala');

    api.loginUser.mockResolvedValue({ error: 'Email o contraseña incorrectos.' });
    await enviar();
    expect(screen.getByText('Email o contraseña incorrectos.')).toBeInTheDocument();

    api.loginUser.mockResolvedValue({});
    await enviar();
    expect(screen.getByText('Credenciales incorrectas.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});

describe('Login — crear cuenta', () => {
  it('cambiar a "crear cuenta" vacía los campos y pide también el nombre', async () => {
    await cargar();
    escribir('Email', 'ana@correo.es');

    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate aquí' }));

    expect(screen.getByRole('heading', { name: 'Crear una cuenta' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toHaveValue('');
    expect(screen.getByPlaceholderText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrarme' })).toBeInTheDocument();
  });

  it('sin nombre avisa y no llama al servidor', async () => {
    const { api } = await cargar();
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate aquí' }));
    escribir('Email', 'ana@correo.es');
    escribir('Contraseña', 'secreta');

    await enviar();

    expect(screen.getByText('El nombre es obligatorio para registrarse.')).toBeInTheDocument();
    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it('si va bien, abre la sesión, da la bienvenida y lleva al inicio', async () => {
    const { api, login, showToast } = await cargar();
    api.registerUser.mockResolvedValue({ success: true, user: USUARIO, token: 'access', refreshToken: 'refresh' });
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate aquí' }));
    escribir('Nombre completo', 'Ana');
    escribir('Email', 'ana@correo.es');
    escribir('Contraseña', 'secreta');

    await enviar();

    expect(api.registerUser).toHaveBeenCalledWith({ nombre: 'Ana', email: 'ana@correo.es', password: 'secreta' });
    expect(login).toHaveBeenCalledWith(USUARIO, 'access', 'refresh');
    expect(showToast).toHaveBeenCalledWith('¡Cuenta creada con éxito! Bienvenido, Ana', 'success');
    expect(screen.getByText('Página de inicio')).toBeInTheDocument();
  });

  it('si el servidor lo rechaza, enseña su motivo; sin motivo, un mensaje por defecto', async () => {
    const { api } = await cargar();
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate aquí' }));
    escribir('Nombre completo', 'Ana');
    escribir('Email', 'ana@correo.es');
    escribir('Contraseña', 'secreta');

    api.registerUser.mockResolvedValue({ error: 'El correo electrónico ya está registrado.' });
    await enviar();
    expect(screen.getByText('El correo electrónico ya está registrado.')).toBeInTheDocument();

    api.registerUser.mockResolvedValue({});
    await enviar();
    expect(screen.getByText('Error al crear la cuenta.')).toBeInTheDocument();
  });

  it('y volver a "iniciar sesión"', async () => {
    await cargar();
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate aquí' }));
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión aquí' }));

    expect(screen.getByRole('heading', { name: 'Acceder a mi cuenta' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nombre completo')).not.toBeInTheDocument();
  });
});

describe('Login — Google', () => {
  // Simula la librería de Google Identity Services: guarda el callback para "iniciar sesión".
  const instalarGoogle = () => {
    const id = { initialize: vi.fn(), renderButton: vi.fn() };
    window.google = { accounts: { id } };
    // No se espera a la promesa del callback: si el servidor se deja pendiente, el test se colgaría.
    const entrar = (credential) =>
      act(async () => {
        id.initialize.mock.calls.at(-1)[0].callback({ credential });
      });
    return { id, entrar };
  };

  it('sin VITE_GOOGLE_CLIENT_ID, el botón sale desactivado y no se carga el script de Google', async () => {
    await cargar();

    expect(screen.getByRole('button', { name: 'Continuar con Google (no configurado)' })).toBeDisabled();
    expect(document.getElementById('google-identity-script')).toBeNull();
  });

  it('con el client ID, carga el script de Google una vez y, al cargar, pinta su botón', async () => {
    await cargar({ googleClientId: 'cliente.apps.googleusercontent.com' });
    const script = document.getElementById('google-identity-script');
    expect(script.src).toBe('https://accounts.google.com/gsi/client');

    const { id } = instalarGoogle();
    act(() => script.onload());

    expect(id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cliente.apps.googleusercontent.com' }));
    expect(id.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ locale: 'es', text: 'continue_with' }));
  });

  it('si el script ya estaba cargado (otra visita a /login), pinta el botón sin volver a cargarlo', async () => {
    const existente = document.createElement('script');
    existente.id = 'google-identity-script';
    document.body.appendChild(existente);
    const { id } = instalarGoogle();

    await cargar({ googleClientId: 'cliente.apps.googleusercontent.com' });

    expect(id.renderButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#google-identity-script')).toHaveLength(1);
  });

  it('al elegir cuenta en Google, manda la credencial al servidor y, si va bien, abre la sesión', async () => {
    const { id, entrar } = instalarGoogle();
    const { api, login, showToast } = await cargar({ googleClientId: 'cliente.apps.googleusercontent.com' });
    act(() => document.getElementById('google-identity-script').onload());
    expect(id.initialize).toHaveBeenCalled();
    api.loginConGoogle.mockResolvedValue({ success: true, user: USUARIO, token: 'access', refreshToken: 'refresh' });

    await entrar('credencial-de-google');

    expect(api.loginConGoogle).toHaveBeenCalledWith('credencial-de-google');
    expect(login).toHaveBeenCalledWith(USUARIO, 'access', 'refresh');
    expect(showToast).toHaveBeenCalledWith('¡Hola, Ana!', 'success');
    expect(screen.getByText('Página de inicio')).toBeInTheDocument();
  });

  it('si el servidor rechaza la cuenta de Google, avisa con su motivo (o uno por defecto)', async () => {
    const { entrar } = instalarGoogle();
    const { api, login, showToast } = await cargar({ googleClientId: 'cliente.apps.googleusercontent.com' });
    act(() => document.getElementById('google-identity-script').onload());

    api.loginConGoogle.mockResolvedValue({ error: 'No se pudo verificar la cuenta de Google.' });
    await entrar('credencial');
    expect(showToast).toHaveBeenLastCalledWith('No se pudo verificar la cuenta de Google.', 'error');

    api.loginConGoogle.mockResolvedValue(null);
    await entrar('credencial');
    expect(showToast).toHaveBeenLastCalledWith('No se pudo iniciar sesión con Google.', 'error');
    expect(login).not.toHaveBeenCalled();
  });

  it('mientras el servidor comprueba la cuenta, dice "Conectando con Google..."', async () => {
    const { entrar } = instalarGoogle();
    const { api } = await cargar({ googleClientId: 'cliente.apps.googleusercontent.com' });
    act(() => document.getElementById('google-identity-script').onload());
    let terminar;
    api.loginConGoogle.mockReturnValue(new Promise((resolve) => (terminar = resolve)));

    await entrar('credencial');
    expect(screen.getByText('Conectando con Google...')).toBeInTheDocument();

    await act(async () => terminar({ error: 'x' }));
    expect(screen.queryByText('Conectando con Google...')).not.toBeInTheDocument();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
