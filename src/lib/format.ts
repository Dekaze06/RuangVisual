export function formatRupiah(amount: number | null | undefined): string {
  const num = Number(amount ?? 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split(' ')[0];
  const d = new Date(parts + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const PROJECT_STAGES = [
  { key: 'BOOKED', label: 'Booking & DP Terkunci', short: 'Booking' },
  { key: 'BRIEF_READY', label: 'Brief & Penugasan Kru', short: 'Brief & Kru' },
  { key: 'SHOOTING_DONE', label: 'Liputan Hari-H Selesai', short: 'Liputan' },
  { key: 'RAW_VERIFIED', label: 'Backup & Verifikasi RAW', short: 'Backup RAW' },
  { key: 'CLIENT_PROOFING', label: 'Seleksi Foto Klien (Proofing)', short: 'Pilih Foto' },
  { key: 'POST_PRODUCTION', label: 'Editing Foto & Video Paralel', short: 'Editing' },
  { key: 'CLIENT_REVIEW', label: 'Review Hasil & Approval Layout', short: 'Review' },
  { key: 'PRINTING', label: 'Produksi Percetakan & QC Fisik', short: 'Percetakan' },
  { key: 'READY_DELIVERY', label: 'Siap Diambil / Dikirim Kurir', short: 'Pengiriman' },
  { key: 'COMPLETED', label: 'Selesai & Serah Terima Penuh', short: 'Selesai' },
] as const;

export function getStageIndex(status: string): number {
  const idx = PROJECT_STAGES.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export const PRINT_STATUS_LABELS: Record<string, { label: string; step: number }> = {
  WAITING_SELECTION: { label: '1. Menunggu Pilih Foto', step: 1 },
  LAYOUTING: { label: '2. Penyusunan Layout', step: 2 },
  WAITING_CLIENT_APPROVAL: { label: '3. Menunggu Approval Klien', step: 3 },
  READY_TO_PRINT: { label: '4. Siap Naik Cetak', step: 4 },
  SENT_TO_VENDOR: { label: '5. Dikirim ke Lab Cetak', step: 5 },
  IN_PRODUCTION: { label: '6. Diproduksi Percetakan', step: 6 },
  ARRIVED_QC: { label: '7. Tiba di Studio (QC Fisik)', step: 7 },
  REPRINT_COMPLAINT: { label: '7B. Komplain / Cetak Ulang Lab', step: 7 },
  READY_FOR_HANDOVER: { label: '8A. Lolos QC — Siap Serah Terima', step: 8 },
  SHIPPED: { label: '8B. Dikirim Ekspedisi (Ber-Resi)', step: 8 },
  DELIVERED: { label: '8C. Diterima Klien (Selesai)', step: 8 },
};

export const PHOTO_TASK_LABELS: Record<string, string> = {
  WAITING_RAW: 'Menunggu RAW Kru',
  CULLING_PREVIEW: 'Sortir & Upload Preview',
  WAITING_CLIENT_SELECTION: 'Menunggu Klien Pilih Foto (SLA Pause)',
  EDITING_RETOUCH: 'Color Grading & Retouching',
  ALBUM_LAYOUTING: 'Desain Layout Album',
  CLIENT_REVIEW: 'Menunggu Review Klien (SLA Pause)',
  REVISION: 'Pengerjaan Revisi Foto/Layout',
  FINALIZED: 'Selesai Final & Siap Cetak',
};

export const VIDEO_TASK_LABELS: Record<string, string> = {
  WAITING_FOOTAGE: 'Menunggu Footage Kru',
  INGEST_SYNC: 'Backup & Sync Audio',
  ROUGH_CUT: 'Rough Cut Storytelling',
  COLOR_AUDIO: 'Color Grading & Sound Design',
  CLIENT_PREVIEW: 'Preview Dikirim ke Klien',
  REVISION: 'Pengerjaan Revisi Timestamp',
  FINALIZED: 'Render Master 4K Selesai',
};

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}
