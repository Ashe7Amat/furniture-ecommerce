import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home'; // <-- Importación alineada y corregida
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import About from './pages/About';
import Sustainability from './pages/Sustainability';
import Contact from './pages/Contact';
import Legal from './pages/Legal';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <BrowserRouter>
              <div className="app-container">
                <Header />
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

                  {/* Para entrar aquí SÍ hace falta ser administrador obligatoriamente */}
                  <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
                </Routes>
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