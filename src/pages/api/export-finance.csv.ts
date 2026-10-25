import type { APIRoute } from 'astro';
import { getFullStudioSnapshot } from '../../lib/analytics';

export const GET: APIRoute = async () => {
  const snap = await getFullStudioSnapshot();

  const lines: string[] = [
    'LAPORAN BUKU BESAR & PROFITABILITAS PROJECT RUANG VISUAL',
    `Diekspor pada,${new Date().toLocaleString('id-ID')}`,
    '',
    'RINGKASAN REKENING KAS & BANK',
    'Kode Akun,Nama Rekening,Tipe,Saldo (IDR)',
    ...snap.accounts.map((a) => `${a.code},"${a.name}",${a.accountType},${a.balance}`),
    '',
    'PROFITABILITAS PER PROJECT (JOB COSTING)',
    'Kode Booking,Klien,Kategori,Nilai Kontrak,Sudah Dibayar,Sisa Piutang,Biaya Crew Freelance,Insentif Editor Foto+Video,HPP Percetakan,Biaya MDR,Laba Kotor Project,Margin (%)',
    ...snap.jobCostings.map(
      (jc) =>
        `${jc.booking.bookingCode},"${jc.booking.clientName}",${jc.booking.categorySlug},${jc.booking.grandTotal},${jc.booking.paidAmount},${jc.outstandingAr},${jc.crewCost},${jc.editorCost},${jc.printHpp},${jc.gatewayMdr},${jc.grossProfit},${jc.marginPercent}%`
    ),
    '',
    'JURNAL TRANSAKSI BUKU BESAR (LEDGER)',
    'Tanggal,Kode TRX,Arah,Kategori,Nominal (IDR),Ref Dokumen,Booking ID,Deskripsi',
    ...snap.ledger.map(
      (tx) =>
        `${tx.txDate},${tx.txCode},${tx.direction},${tx.category},${tx.amount},"${tx.referenceDoc}",${tx.bookingId},"${tx.description.replace(/"/g, '""')}"`
    ),
  ];

  // UTF-8 BOM so Microsoft Excel opens columns and Indonesian text cleanly
  const csvContent = '\uFEFF' + lines.join('\r\n');

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Laporan-Keuangan-Ruang-Visual-2026.csv"',
    },
  });
};
