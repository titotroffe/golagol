import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosApi } from '../api';
import { useAuthStore } from '../store';
import styles from './Perfil.module.css';

export default function Perfil() {
  const queryClient = useQueryClient();
  const updateAuthUser = useAuthStore(s => s.updateUsuario);
  
  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil'],
    queryFn: usuariosApi.perfil
  });

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    fecha_nacimiento: ''
  });

  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (perfil) {
      setForm({
        nombre: perfil.nombre || '',
        apellido: perfil.apellido || '',
        email: perfil.email || '',
        fecha_nacimiento: perfil.fecha_nacimiento || ''
      });
    }
  }, [perfil]);

  const updatePerfil = useMutation({
    mutationFn: usuariosApi.actualizarPerfil,
    onSuccess: () => {
      setMensaje('Perfil actualizado correctamente');
      setError(null);
      queryClient.invalidateQueries(['perfil']);
      // Actualizar el estado global con los nuevos nombres
      updateAuthUser({
        nombre: form.nombre,
        apellido: form.apellido,
      });
      setTimeout(() => setMensaje(null), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setMensaje(null);
      setTimeout(() => setError(null), 3000);
    }
  });

  const updatePassword = useMutation({
    mutationFn: usuariosApi.cambiarPassword,
    onSuccess: () => {
      setMensaje('Contraseña actualizada correctamente');
      setError(null);
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMensaje(null), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setMensaje(null);
      setTimeout(() => setError(null), 3000);
    }
  });

  const uploadAvatar = useMutation({
    mutationFn: usuariosApi.subirAvatar,
    onSuccess: (data) => {
      setMensaje('Foto de perfil actualizada');
      setError(null);
      queryClient.invalidateQueries(['perfil']);
      updateAuthUser({
        avatar_url: data.avatar_url
      });
      setTimeout(() => setMensaje(null), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setMensaje(null);
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    updatePerfil.mutate(form);
  };

  const handlePassSubmit = (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      setTimeout(() => setError(null), 3000);
      return;
    }
    updatePassword.mutate({
      currentPassword: passForm.currentPassword,
      newPassword: passForm.newPassword
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);
      uploadAvatar.mutate(formData);
    }
  };

  if (isLoading) return <p className={styles.msg}>Cargando perfil...</p>;
  if (!perfil) return <p className={styles.msg}>Error al cargar el perfil.</p>;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mi Perfil</h1>
        <p className={styles.subtitle}>Gestiona tu información personal y foto de perfil</p>
      </header>

      {mensaje && <div className={styles.successMsg}>{mensaje}</div>}
      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.grid}>
        
        {/* AVATAR SECTION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Foto de Perfil</h2>
          <div className={styles.avatarSection}>
            <div className={styles.avatarPreview}>
              {perfil.avatar_url ? (
                <img src={`http://localhost:3001${perfil.avatar_url}`} alt="Avatar" />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {perfil.nombre[0]}{perfil.apellido[0]}
                </div>
              )}
            </div>
            <div className={styles.avatarActions}>
              <label className={styles.btnSubir}>
                Subir nueva foto
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  onChange={handleAvatarChange} 
                  style={{ display: 'none' }} 
                />
              </label>
              <p className={styles.avatarHint}>Recomendado: 200x200px, máx 5MB.</p>
            </div>
          </div>
        </section>

        {/* INFO SECTION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Información Personal</h2>
          <form className={styles.form} onSubmit={handleInfoSubmit}>
            <div className={styles.formGroup}>
              <label>Usuario</label>
              <input type="text" value={perfil.usuario} disabled className={styles.inputDisabled} />
            </div>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Nombre</label>
                <input 
                  type="text" 
                  value={form.nombre} 
                  onChange={e => setForm({...form, nombre: e.target.value})} 
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Apellido</label>
                <input 
                  type="text" 
                  value={form.apellido} 
                  onChange={e => setForm({...form, apellido: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Email</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                required 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fecha de Nacimiento</label>
              <input 
                type="date" 
                value={form.fecha_nacimiento} 
                onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} 
                required 
              />
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={updatePerfil.isLoading}>
              Guardar Cambios
            </button>
          </form>
        </section>

        {/* PASSWORD SECTION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Cambiar Contraseña</h2>
          <form className={styles.form} onSubmit={handlePassSubmit}>
            <div className={styles.formGroup}>
              <label>Contraseña Actual</label>
              <input 
                type="password" 
                value={passForm.currentPassword} 
                onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} 
                required 
              />
            </div>
            <div className={styles.formGroup}>
              <label>Nueva Contraseña</label>
              <input 
                type="password" 
                value={passForm.newPassword} 
                onChange={e => setPassForm({...passForm, newPassword: e.target.value})} 
                required 
                minLength="6"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Confirmar Nueva Contraseña</label>
              <input 
                type="password" 
                value={passForm.confirmPassword} 
                onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} 
                required 
                minLength="6"
              />
            </div>
            <button type="submit" className={styles.btnDanger} disabled={updatePassword.isLoading}>
              Actualizar Contraseña
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
