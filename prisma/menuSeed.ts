import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Mulai seeding data menu...');

  // Kita gunakan pendekatan "Nested Writes" (memasukkan child ke dalam parent).
  // ID, parentId, createdAt, dan updatedAt dihapus agar di-handle otomatis oleh database.
  const menus = [
    {
      title: 'Beranda',
      path: '/dashboard',
      icon: 'LayoutDashboard',
      order: 1,
    },
    {
      title: 'Partai Politik',
      path: '/parpol',
      icon: 'Database',
      order: 5,
    },
    {
      title: 'Surat Suara',
      path: '',
      icon: 'FileText',
      order: 6,
      // Ini adalah relasi ke tabel child. Pastikan nama 'children' 
      // sesuai dengan nama field relasi array di schema.prisma kamu.
      children: {
        create: [
          { title: 'Surat Suara DPR RI', path: '/surat-suara-dpr-ri', icon: '', order: 1 },
          { title: 'Surat Suara DPRD Provinsi', path: '/surat-suara-dprd-prov', icon: '', order: 2 },
          { title: 'Surat Suara Kota/Kab', path: '/surat-suara-dprd-kabkot', icon: '', order: 3 },
          { title: 'Surat Suara DPD RI', path: '/surat-suara-dpd-ri', icon: '', order: 5 },
        ],
      },
    },
    {
      title: 'Dapil',
      path: '',
      icon: 'Database',
      order: 3,
      children: {
        create: [
          { title: 'Dapil DPR RI', path: '/dapil-dpr-ri', icon: '', order: 1 },
          { title: 'Dapil DPRD PROVINSI', path: '/dapil-dprd-prov', icon: '', order: 2 },
          { title: 'Dapil DPRD KOTA/KAB', path: '/dapil-dprd-kabkot', icon: '', order: 3 },
          { title: 'Dapil DPD RI', path: '/dapil-dpd-ri', icon: '', order: 5 },
        ],
      },
    },
    {
      title: 'Calon',
      path: '',
      icon: 'Database',
      order: 4,
      children: {
        create: [
          { title: 'Calon DPR RI', path: '/calon-dpr-ri', icon: '', order: 1 },
          { title: 'Calon DPRD Provinsi', path: '/calon-dprd-prov', icon: '', order: 2 },
          { title: 'Calon DPRD Kota/Kab', path: '/calon-dprd-kabkot', icon: '', order: 3 },
          { title: 'Calon DPD RI', path: '/calon-dpd-ri', icon: '', order: 5 },
        ],
      },
    },
    {
      title: 'Setting',
      path: '',
      icon: 'Settings',
      order: 7,
      children: {
        create: [
          { title: 'Kelola Menu', path: '/menus', icon: null, order: 1 },
          { title: 'Kelola Pengguna', path: '/users', icon: null, order: 2 },
          { title: 'Kelola Role', path: '/roles', icon: null, order: 3 },
          { title: 'Kelola Permission', path: '/permissions', icon: null, order: 4 },
          { title: 'Pengaturan Pemilu', path: '/pengaturan-pemilu', icon: '', order: 5 },
          { title: 'Jenis Pemilihan', path: '/jenispemilihan', icon: 'Database', order: 6 },
        ],
      },
    },
  ];

  try {
    // Opsional: Hapus komentar di bawah jika ingin mereset/menghapus semua data menu sebelum dising 
    // await prisma.menu.deleteMany();
    // console.log('Data menu lama berhasil dihapus.');

    // createMany tidak mendukung nested writes, jadi kita gunakan perulangan
    for (const menu of menus) {
      await prisma.menu.create({
        data: menu,
      });
    }

    console.log('Seeding selesai dengan aman!');
  } catch (error) {
    console.error('Yah, terjadi error saat seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();