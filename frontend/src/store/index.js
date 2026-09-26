import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Store de autenticación - persiste en localStorage
export const useAuthStore = create(
  persist(
    (set) => ({
      usuario: null,
      token: null,

      login: (usuario, token) => {
        localStorage.setItem('token', token);
        set({ usuario, token });
      },

      updateUsuario: (nuevosDatos) => {
        set((state) => ({ usuario: { ...state.usuario, ...nuevosDatos } }));
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ usuario: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ usuario: state.usuario, token: state.token }),
    }
  )
);

export const useTorneoStore = create((set) => ({
  torneoActivo: null,
  torneos: [],

  setTorneos: (torneos) => {
    set({ torneos });
    // Forzar siempre a mostrar el torneo activo (el que está en_curso)
    if (torneos.length > 0) {
      const enCurso = torneos.find((t) => t.estado === 'en_curso');
      set({ torneoActivo: enCurso || torneos[0] });
    }
  },
}));

// Store del WebSocket en tiempo real
export const useWsStore = create((set) => ({
  conectado: false,
  ultimoEvento: null,

  setConectado: (val) => set({ conectado: val }),
  setUltimoEvento: (evento) => set({ ultimoEvento: evento }),
}));
