import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Auth.module.css';

export default function RecuperarPassword() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: authApi.recuperarPassword,
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    },
  });

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.titulo}>Recuperar Contraseña</h1>
          <p className={styles.subtitulo}>Ingresá tus datos para crear una nueva</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', color: '#3fb950', background: 'rgba(63, 185, 80, 0.1)', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px' }}>¡Contraseña actualizada!</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Serás redirigido al inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className={styles.form}>
            <div className={styles.field}>
              <label>Usuario</label>
              <input
                {...register('usuario', { required: 'Campo requerido' })}
                placeholder="Tu usuario"
                className={errors.usuario ? styles.inputError : ''}
              />
              {errors.usuario && <span className={styles.error}>{errors.usuario.message}</span>}
            </div>

            <div className={styles.field}>
              <label>Correo Electrónico</label>
              <input
                type="email"
                {...register('email', { required: 'Campo requerido' })}
                placeholder="tu@email.com"
                className={errors.email ? styles.inputError : ''}
              />
              {errors.email && <span className={styles.error}>{errors.email.message}</span>}
            </div>

            <div className={styles.field}>
              <label>Nueva Contraseña</label>
              <input
                type="password"
                {...register('newPassword', { required: 'Campo requerido', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                placeholder="••••••"
                className={errors.newPassword ? styles.inputError : ''}
              />
              {errors.newPassword && <span className={styles.error}>{errors.newPassword.message}</span>}
            </div>

            {mutation.isError && (
              <div className={styles.errorBox}>{mutation.error.message}</div>
            )}

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>

            <p className={styles.linkText} style={{ marginTop: '8px' }}>
              <Link to="/login" className={styles.link}>Volver al login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
