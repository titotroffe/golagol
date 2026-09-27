import React from 'react';
import { useToastStore } from '../../store';
import styles from './Toast.module.css';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast} onClick={() => removeToast(t.id)}>
          {t.mensaje}
        </div>
      ))}
    </div>
  );
}
