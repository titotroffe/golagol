import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { equiposApi } from '../api';
import styles from './Auth.module.css';

export default function Registro() {
  const { register, handleSubmit, formState: { errors }, watch } = useForm();
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const { data: equipos } = useQuery({
    queryKey: ['equipos'],
    queryFn: equiposApi.listar,
  });

  const mutation = useMutation({
    mutationFn: authApi.registro,
    onSuccess: (data) => {
      login(data.usuario, data.token);
      navigate('/');
    },
  });

  function onSubmit(data) {
    mutation.mutate(data);
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.titulo}>Liga Nicoleña</h1>
          <p className={styles.subtitulo}>Crear cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label>Nombre</label>
              <input
                {...register('nombre', { required: 'Requerido' })}
                placeholder="Juan"
                className={errors.nombre ? styles.inputError : ''}
              />
              {errors.nombre && <span className={styles.error}>{errors.nombre.message}</span>}
            </div>
            <div className={styles.field}>
              <label>Apellido</label>
              <input
                {...register('apellido', { required: 'Requerido' })}
                placeholder="Pérez"
                className={errors.apellido ? styles.inputError : ''}
              />
              {errors.apellido && <span className={styles.error}>{errors.apellido.message}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              {...register('email', { required: 'Requerido' })}
              placeholder="juan@ejemplo.com"
              className={errors.email ? styles.inputError : ''}
            />
            {errors.email && <span className={styles.error}>{errors.email.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Nombre de usuario</label>
            <input
              {...register('usuario', { required: 'Requerido', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
              placeholder="juanperez99"
              className={errors.usuario ? styles.inputError : ''}
            />
            {errors.usuario && <span className={styles.error}>{errors.usuario.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Contraseña</label>
            <input
              type="password"
              {...register('password', { required: 'Requerido', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
              placeholder="••••••"
              autoComplete="new-password"
              className={errors.password ? styles.inputError : ''}
            />
            {errors.password && <span className={styles.error}>{errors.password.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Confirmar contraseña</label>
            <input
              type="password"
              {...register('confirmar_password', {
                required: 'Requerido',
                validate: (val) =>
                  val === watch('password') || 'Las contraseñas no coinciden',
              })}
              placeholder="••••••"
              autoComplete="new-password"
              className={errors.confirmar_password ? styles.inputError : ''}
            />
            {errors.confirmar_password && <span className={styles.error}>{errors.confirmar_password.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              {...register('fecha_nacimiento', { required: 'Requerido' })}
              className={errors.fecha_nacimiento ? styles.inputError : ''}
            />
            {errors.fecha_nacimiento && <span className={styles.error}>{errors.fecha_nacimiento.message}</span>}
          </div>

          <div className={styles.field}>
            <label>Hincha de...</label>
            <select {...register('equipo_id')}>
              <option value="">-- Seleccioná tu club --</option>
              {equipos?.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {mutation.isError && (
            <div className={styles.errorBox}>{mutation.error.message}</div>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Registrando...' : 'Crear cuenta'}
          </button>

          <p className={styles.linkText}>
            ¿Ya tenés cuenta? <Link to="/login" className={styles.link}>Iniciar sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
