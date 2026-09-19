/**
 * Data awal aplikasi: identitas merek, pilar, pengaturan, status provider.
 *
 * Dipakai hampir semua fitur, jadi di-cache lebih lama dari bawaan — isinya
 * jarang berubah dan pemanggilannya termasuk yang paling lambat.
 */
import { useQuery } from '@tanstack/react-query';
import { getBootstrap, getLogo, toBrand } from '@/api';
import type { Brand } from '@/types/brand';

export const BOOTSTRAP_KEY = ['bootstrap'] as const;
export const LOGO_KEY = ['logo'] as const;

export function useBootstrap() {
  return useQuery({
    queryKey: BOOTSTRAP_KEY,
    queryFn: getBootstrap,
    staleTime: 5 * 60_000,
  });
}

/**
 * Identitas merek dalam bentuk yang siap dipakai renderer.
 *
 * Logo diambil terpisah dari bootstrap: isinya data URL yang bisa ratusan
 * kilobyte, sementara bootstrap dipanggil di setiap pemuatan halaman. Ia baru
 * diminta kalau merek memang punya logo, dan hasilnya di-cache lama karena
 * praktis tidak pernah berubah.
 */
export function useBrand(): Brand {
  const { data } = useBootstrap();
  const brand = data ? toBrand(data.brand) : {};

  const logo = useQuery({
    queryKey: LOGO_KEY,
    queryFn: getLogo,
    enabled: Boolean(brand.logoDriveId),
    staleTime: 30 * 60_000,
  });

  return logo.data?.dataUrl ? { ...brand, logoDataUrl: logo.data.dataUrl } : brand;
}
