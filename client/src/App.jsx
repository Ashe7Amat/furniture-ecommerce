import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsent from './components/CookieConsent';
import Home from './pages/Home'; // Inmediato (landing)
import Catalog from './pages/Catalog'; // Inmediato (catálogo principal)
import PageLoader from './components/PageLoader';
import ScrollToTop from './components/ScrollToTop';

// Carga perezosa (code-splitting): el resto de páginas y utilidades secundarias solo se descargan cuando el
// visitante realmente navega a ellas, en vez de venir todas en el paquete inicial.
const MusicaDeFondo = lazy(() => import('./components/MusicaDeFondo'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Login = lazy(() => import('./pages/Login'));
// AdminRuta monta Admin.jsx con el ?editar={id} de la URL (ver AdminRuta.jsx).
const Admin = lazy(() => import('./pages/AdminRuta'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Sustainability = lazy(() => import('./pages/Sustainability'));
const Contact = lazy(() => import('./pages/Contact'));
const Legal = lazy(() => import('./pages/Legal'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const CheckoutExito = lazy(() => import('./pages/CheckoutExito'));
const CheckoutCancelado = lazy(() => import('./pages/CheckoutCancelado'));
const VerificarEmail = lazy(() => import('./pages/VerificarEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <BrowserRouter>
              <ScrollToTop />
              <div className="app-container">
                <a href="#contenido" className="skip-link saltar-al-contenido">Saltar al contenido</a>
                <Header />
                <main id="contenido" tabIndex={-1}>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Home />} />

                      {/* Para entrar aquí solo hace falta estar logueado (adminOnly es false por defecto) */}
                      <Route path="/cuenta" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                      <Route path="/catalogo" element={<Catalog />} />
                      <Route path="/mueble/:id" element={<ProductDetail />} />
                      <Route path="/producto/:id" element={<ProductDetail />} />
                      <Route path="/login" element={<Login />} />

                      <Route path="/sobre-nosotros" element={<About />} />
                      <Route path="/sostenibilidad" element={<Sustainability />} />
                      <Route path="/contacto" element={<Contact />} />
                      <Route path="/legal" element={<Legal />} />
                      <Route path="/privacidad" element={<PrivacyPolicy />} />
                      <Route path="/terminos" element={<Terms />} />

                      <Route path="/checkout/exito" element={<CheckoutExito />} />
                      <Route path="/checkout/cancelado" element={<CheckoutCancelado />} />
                      <Route path="/reservas/exito" element={<CheckoutExito />} />
                      <Route path="/reservas/cancelado" element={<CheckoutCancelado />} />

                      {/* H18: el enlace del correo para confirmar el email (no pide sesión) */}
                      <Route path="/verificar-email" element={<VerificarEmail />} />

                      {/* Recuperación de contraseña */}
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />

                      {/* Para entrar aquí SÍ hace falta ser administrador obligatoriamente */}
                      <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />

                      {/* Cualquier otra ruta: página 404 (siempre al final) */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
                <Footer />
                <CartDrawer />
                <Suspense fallback={null}>
                  <MusicaDeFondo />
                </Suspense>
                <CookieConsent />
              </div>
            </BrowserRouter>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;