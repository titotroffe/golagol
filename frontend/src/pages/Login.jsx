import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Auth.module.css';

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login(data.usuario, data.token);
      navigate('/');
    },
  });

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.titulo}>Liga Nicoleña</h1>
          <p className={styles.subtitulo}>Iniciar sesión</p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className={styles.form}>
          <div className={styles.field}>
            <label>Usuario</label>
            <input
              {...register('usuario', { required: 'Campo requerido' })}
              placeholder="tu_usuario"
              autoComplete="username"
              className={errors.usuario ? styles.inputError : ''}
            />
            {errors.usuario && <span className={styles.error}>{errors.usuario.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Contraseña</label>
            <input
              type="password"
              {...register('password', { required: 'Campo requerido' })}
              placeholder="••••••"
              autoComplete="current-password"
              className={errors.password ? styles.inputError : ''}
            />
            {errors.password && <span className={styles.error}>{errors.password.message}</span>}
          </div>

          {mutation.isError && (
            <div className={styles.errorBox}>{mutation.error.message}</div>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Entrando...' : 'Entrar'}
          </button>

          <p className={styles.linkText}>
            ¿No tenés cuenta? <Link to="/registro" className={styles.link}>Registrarse</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
