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
import Home from './pages/Home'; // <-- Se mantiene fuera del lazy-loading: es la página de aterrizaje
import ScrollToTop from './components/ScrollToTop';

// Carga perezosa (code-splitting): el resto de páginas solo se descargan cuando el
// visitante realmente navega a ellas, en vez de venir todas en el paquete inicial.
// Admin.jsx en particular es un archivo grande que solo necesita quien administra la
// tienda -- no tiene sentido que lo descargue alguien que solo mira el catálogo.
const Catalog = lazy(() => import('./pages/Catalog'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Sustainability = lazy(() => import('./pages/Sustainability'));
const Contact = lazy(() => import('./pages/Contact'));
const Legal = lazy(() => import('./pages/Legal'));
const CheckoutExito = lazy(() => import('./pages/CheckoutExito'));
const CheckoutCancelado = lazy(() => import('./pages/CheckoutCancelado'));

// Indicador mínimo mientras se descarga una página (solo se ve una fracción de segundo,
// habitualmente ni llega a mostrarse gracias a la caché del navegador).
const CargandoPagina = () => <div className="page-loading" aria-hidden="true" />;

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <BrowserRouter>
              <ScrollToTop />
              <div className="app-container">
                <Header />
                <Suspense fallback={<CargandoPagina />}>
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

                    <Route path="/checkout/exito" element={<CheckoutExito />} />
                    <Route path="/checkout/cancelado" element={<CheckoutCancelado />} />

                    {/* Para entrar aquí SÍ hace falta ser administrador obligatoriamente */}
                    <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
                <Footer />
                <CartDrawer />
              </div>
            </BrowserRouter>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;