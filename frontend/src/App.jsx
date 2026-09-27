import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ui/ProtectedRoute';

import Login from './pages/Login';
import Registro from './pages/Registro';
import RecuperarPassword from './pages/RecuperarPassword';
import Tabla from './pages/Tabla';
import Fixture from './pages/Fixture';
import Prode from './pages/Prode';
import Admin from './pages/Admin';
import Equipos from './pages/Equipos';
import GolAGol from './pages/GolAGol';

import Estadisticas from './pages/Estadisticas';
import Sancionados from './pages/Sancionados';
import Simular from './pages/Simular';
import Perfil from './pages/Perfil';
import Inicio from './pages/Inicio';
import AdminSanciones from './pages/AdminSanciones';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          {/* Rutas con Layout */}
          <Route element={<Layout />}>
            {/* Rutas Públicas */}
            <Route path="/login"       element={<Login />} />
            <Route path="/registro"    element={<Registro />} />
            <Route path="/recuperar"   element={<RecuperarPassword />} />
            <Route path="/"            element={<Inicio />} />
            <Route path="/tabla"       element={<Tabla />} />
            <Route path="/equipos"     element={<Equipos />} />
            <Route path="/fixture"     element={<Fixture />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/sancionados" element={<Sancionados />} />
            <Route path="/simular"     element={<Simular />} />

            {/* Rutas Protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/prode"       element={<Prode />} />
              <Route path="/perfil"      element={<Perfil />} />
              <Route path="/admin"       element={<Admin />} />
              <Route path="/admin/sanciones" element={<AdminSanciones />} />
            </Route>
          </Route>

          {/* Vistas públicas a PANTALLA COMPLETA (sin Sidebar) */}
          <Route path="/partido/:id" element={<GolAGol />} />

          {/* Vistas protegidas a PANTALLA COMPLETA (sin Sidebar) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin/partido/:id" element={<GolAGol />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
