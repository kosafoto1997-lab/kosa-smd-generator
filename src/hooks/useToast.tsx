/**
 * Pemberitahuan singkat di pojok layar.
 *
 * Sengaja sederhana: tidak ada antrean, pesan baru menggantikan yang lama.
 * Untuk aplikasi seukuran ini, antrean pesan hanya menambah rumit tanpa
 * manfaat nyata.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastKind = 'info' | 'ok' | 'warn' | 'error';

interface Toast {
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    window.clearTimeout(timer.current);
    setToast({ message, kind });
    // Pesan error dibiarkan lebih lama karena biasanya perlu dibaca utuh.
    timer.current = window.setTimeout(
      () => setToast(null),
      kind === 'error' ? 7000 : 4000,
    );
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider.');
  return ctx;
}
