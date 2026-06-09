import { PrismaClient, TipeKriteria, StatusKluster } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Memulai proses seeding master data perankingan...');

  // ==========================================
  // 1. SEEDING MASTER DATA PERGURUAN TINGGI & PRODI
  // ==========================================

  const kampusId = 'PT-001';
  const kampus = await prisma.refPerguruanTinggi.upsert({
    where: { id_pt: kampusId },
    update: {},
    create: {
      id_pt: kampusId,
      nama_pt: 'Universitas Muhammadiyah Purwokerto',
      singkatan: 'UMP',
      kota: 'Purwokerto',
      status_aktif: true,
    },
  });

  await prisma.refProgramStudi.upsert({
    where: { id_prodi: 'PRODI-TI-001' },
    update: {},
    create: {
      id_prodi: 'PRODI-TI-001',
      id_pt: kampus.id_pt,
      jenjang: 'S1',
      nama_prodi: 'Teknik Informatika',
      kuota: 50,
      boleh_buta_warna: false,
    },
  });

  await prisma.refProgramStudi.upsert({
    where: { id_prodi: 'PRODI-SI-002' },
    update: {},
    create: {
      id_prodi: 'PRODI-SI-002',
      id_pt: kampus.id_pt,
      jenjang: 'S1',
      nama_prodi: 'Sistem Informasi',
      kuota: 40,
      boleh_buta_warna: true,
    },
  });

  // ==========================================
  // 2. SEEDING PENGHASILAN ORTU (SKALA POIN SPK)
  // ==========================================

  const skalaPenghasilan = [
    { id: 'INC-1', rentang_penghasilan: '< Rp 1.000.000', poin: 5 },
    { id: 'INC-2', rentang_penghasilan: 'Rp 1.000.000 - Rp 3.000.000', poin: 4 },
    { id: 'INC-3', rentang_penghasilan: 'Rp 3.000.000 - Rp 5.000.000', poin: 3 },
    { id: 'INC-4', rentang_penghasilan: 'Rp 5.000.000 - Rp 10.000.000', poin: 2 },
    { id: 'INC-5', rentang_penghasilan: '> Rp 10.000.000', poin: 1 },
  ];

  for (const item of skalaPenghasilan) {
    await prisma.refPenghasilanOrtu.upsert({
      where: { id: item.id },
      update: { rentang_penghasilan: item.rentang_penghasilan, poin: item.poin },
      create: item,
    });
  }

  // ==========================================
  // 3. SEEDING KRITERIA SAW (AFIRMASI & REGULER)
  // ==========================================

  const kriteriaData = [
    // --- KLUSTER AFIRMASI (Total Bobot = 1.0) ---
    {
      kode_kriteria: 'A-WAW',
      nama_kriteria: 'Nilai Wawancara',
      tipe: TipeKriteria.benefit,
      bobot: 0.30,
      kluster: StatusKluster.Afirmasi,
    },
    {
      kode_kriteria: 'A-RAP',
      nama_kriteria: 'Nilai Rapor',
      tipe: TipeKriteria.benefit,
      bobot: 0.40,
      kluster: StatusKluster.Afirmasi,
    },
    {
      kode_kriteria: 'A-INC',
      nama_kriteria: 'Penghasilan Ortu',
      tipe: TipeKriteria.benefit,
      bobot: 0.30,
      kluster: StatusKluster.Afirmasi,
    },

    // --- KLUSTER REGULER (Total Bobot = 1.0) ---
    {
      kode_kriteria: 'R-AKA',
      nama_kriteria: 'Nilai Tes Akademik',
      tipe: TipeKriteria.benefit,
      bobot: 0.40,
      kluster: StatusKluster.Reguler,
    },
    {
      kode_kriteria: 'R-WAW',
      nama_kriteria: 'Nilai Wawancara',
      tipe: TipeKriteria.benefit,
      bobot: 0.20,
      kluster: StatusKluster.Reguler,
    },
    {
      kode_kriteria: 'R-RAP',
      nama_kriteria: 'Nilai Rapor',
      tipe: TipeKriteria.benefit,
      bobot: 0.20,
      kluster: StatusKluster.Reguler,
    },
    {
      kode_kriteria: 'R-INC',
      nama_kriteria: 'Penghasilan Ortu',
      tipe: TipeKriteria.benefit,
      bobot: 0.20,
      kluster: StatusKluster.Reguler,
    },
  ];

  for (const kriteria of kriteriaData) {
    await prisma.refKriteria.upsert({
      where: { kode_kriteria: kriteria.kode_kriteria },
      update: { bobot: kriteria.bobot, tipe: kriteria.tipe },
      create: kriteria,
    });
  }

  console.log('Seeding data perankingan selesai!');
}

main()
  .catch((e) => {
    console.error('Error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });