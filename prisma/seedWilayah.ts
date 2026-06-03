import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("⏳ Memulai proses seeding data Ref_Wilayah...");

  // 1. Tentukan path ke file JSON
  const filePath = path.join(__dirname, "data", "ref_wilayah.json");

  // 2. Cek apakah file benar-benar ada
  if (!fs.existsSync(filePath)) {
    console.error("❌ File JSON tidak ditemukan di:", filePath);
    return;
  }

  // 3. Baca dan parse file JSON
  const fileData = fs.readFileSync(filePath, "utf-8");
  const jsonData = JSON.parse(fileData);
  const rows = jsonData.rows;

  if (!rows || rows.length === 0) {
    console.log('⚠️ Tidak ada data yang ditemukan di dalam array "rows" JSON.');
    return;
  }

  console.log(
    `📦 Ditemukan ${rows.length} baris data wilayah. Mempersiapkan insert...`,
  );

  // [OPSIONAL] Kosongkan tabel sebelum seeding ulang agar tidak numpuk
  // Hapus dua baris slash (//) di bawah jika Anda ingin me-reset tabel setiap kali di-seed
  await prisma.ref_Wilayah.deleteMany();
  console.log('🗑️ Tabel ref_wilayah berhasil dikosongkan.');

  // 4. Proses Insert menggunakan metode Chunk (Batch)
  // Memasukkan data per 5000 baris agar tidak membebani memori database
  const chunkSize = 5000;
  let insertedCount = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    await prisma.ref_Wilayah.createMany({
      data: chunk.map((row: any) => ({
        nama: row.nama,
        tingkat: row.tingkat,
        tingkat_label: row.tingkat_label,
        kode_pro: row.kode_pro,
        kode_kab: row.kode_kab,
        kode_kec: row.kode_kec,
        kode_kel: row.kode_kel,
      })),
      skipDuplicates: true, // Mencegah error duplikasi jika script dijalankan 2x
    });

    insertedCount += chunk.length;
    console.log(`✅ Berhasil insert ${insertedCount} / ${rows.length} data...`);
  }

  console.log("🎉 Seeding data Ref_Wilayah selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan fatal saat seeding:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
