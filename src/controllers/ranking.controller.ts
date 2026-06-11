import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
// Asumsi model mongoose kamu ada di sini
import LogTransaksi from "../models/log.model";

const prisma = new PrismaClient();

export const runRankingAndMatchmaking = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const idTrx = uuidv4();

    // 1. AMBIL SEMUA DATA PELAMAR & REFERENSI
    const pelamarDiproses = await prisma.pelamar.findMany({
      where: { status_kelulusan: "Diproses" },
      include: {
        ref_penghasilan_ortu: true,
        pelamar_pilihan: {
          orderBy: { prioritas: "asc" } // Pilihan 1, 2, 3 urut
        }
      }
    });

    if (pelamarDiproses.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada pelamar dengan status 'Diproses' untuk diranking." });
    }

    const prodis = await prisma.refProgramStudi.findMany();
    const kriteria = await prisma.refKriteria.findMany();

    const getBobot = (kode: string) => Number(kriteria.find(k => k.kode_kriteria === kode)?.bobot || 0);

    // 2. HITUNG NILAI MAX UNTUK NORMALISASI BENEFIT
    let maxRap = 0, maxWaw = 0, maxAka = 0, maxInc = 0;
    pelamarDiproses.forEach(p => {
      if (p.nilai_rapor > maxRap) maxRap = p.nilai_rapor;
      if (p.nilai_wawancara > maxWaw) maxWaw = p.nilai_wawancara;
      if (p.nilai_tes_akademik > maxAka) maxAka = p.nilai_tes_akademik;
      if (p.ref_penghasilan_ortu && p.ref_penghasilan_ortu.poin > maxInc) maxInc = p.ref_penghasilan_ortu.poin;
    });

    // Mencegah pembagian dengan 0
    maxRap = maxRap || 1; maxWaw = maxWaw || 1; maxAka = maxAka || 1; maxInc = maxInc || 1;

    // 3. PROSES NORMALISASI & PERHITUNGAN SKOR SAW
    const calculatedPelamar = pelamarDiproses.map(p => {
      const poinInc = p.ref_penghasilan_ortu?.poin || 0;

      // Normalisasi
      const normRap = p.nilai_rapor / maxRap;
      const normWaw = p.nilai_wawancara / maxWaw;
      const normAka = p.nilai_tes_akademik / maxAka;
      const normInc = poinInc / maxInc;

      // Skor Afirmasi (Hanya dihitung jika dia aslinya Afirmasi)
      let skorAfirmasi = 0;
      if (p.status_kluster === "Afirmasi") {
        skorAfirmasi = (normRap * getBobot("A-RAP")) + (normWaw * getBobot("A-WAW")) + (normInc * getBobot("A-INC"));
      }

      // Skor Reguler (SEMUA PELAMAR dihitung skor regulernya karena afirmasi bisa limpahan)
      const skorReguler = (normAka * getBobot("R-AKA")) + (normRap * getBobot("R-RAP")) + (normWaw * getBobot("R-WAW")) + (normInc * getBobot("R-INC"));

      return { ...p, skorAfirmasi, skorReguler };
    });

    // 4. PERSIAPAN KUOTA 30% DAN 70%
    let kuotaProdi: Record<string, { afirmasi: number, reguler: number }> = {};
    prodis.forEach(prodi => {
      const kAfirmasi = Math.round(prodi.kuota * 0.3);
      kuotaProdi[prodi.id_prodi] = {
        afirmasi: kAfirmasi,
        reguler: prodi.kuota - kAfirmasi // Sisa 70%
      };
    });

    let finalResults: any[] = [];
    let unallocatedAfirmasi: typeof calculatedPelamar = [];

    // ==========================================
    // 5. MATCHMAKING FASE 1: JALUR AFIRMASI
    // ==========================================
    // Urutkan pelamar Afirmasi dari skor tertinggi ke terendah
    let afirmasiPool = calculatedPelamar
      .filter(p => p.status_kluster === "Afirmasi")
      .sort((a, b) => b.skorAfirmasi - a.skorAfirmasi);

    afirmasiPool.forEach(pelamar => {
      let isAllocated = false;

      // Cek Pilihan 1, 2, dst.
      for (const pilihan of pelamar.pelamar_pilihan) {
        const prodi = prodis.find(pr => pr.id_prodi === pilihan.id_prodi);
        
        // Pengecekan Syarat Khusus: Buta Warna
        if (prodi && !prodi.boleh_buta_warna && pelamar.is_buta_warna) continue;

        if (kuotaProdi[pilihan.id_prodi] && kuotaProdi[pilihan.id_prodi].afirmasi > 0) {
          // Diterima! Kurangi kuota afirmasi prodi tersebut
          kuotaProdi[pilihan.id_prodi].afirmasi -= 1;
          
          finalResults.push({
            id: pelamar.id,
            status_kelulusan: "Diterima",
            id_prodi_diterima: pilihan.id_prodi,
            fase_diterima: "Afirmasi",
            skor_afirmasi: pelamar.skorAfirmasi,
            skor_reguler: pelamar.skorReguler
          });
          
          isAllocated = true;
          break; // Stop mengecek pilihan selanjutnya
        }
      }

      // Jika kuota pilihan habis semua, jadikan limpahan ke Reguler
      if (!isAllocated) {
        unallocatedAfirmasi.push(pelamar);
      }
    });

    // ==========================================
    // 6. MATCHMAKING FASE 2: JALUR REGULER (+ Limpahan Afirmasi)
    // ==========================================
    let regulerOriginalPool = calculatedPelamar.filter(p => p.status_kluster === "Reguler");
    
    // Gabungkan Reguler murni dengan limpahan afirmasi, lalu urutkan pakai skor reguler
    let regulerPool = [...regulerOriginalPool, ...unallocatedAfirmasi]
      .sort((a, b) => b.skorReguler - a.skorReguler);

    regulerPool.forEach(pelamar => {
      let isAllocated = false;

      for (const pilihan of pelamar.pelamar_pilihan) {
        const prodi = prodis.find(pr => pr.id_prodi === pilihan.id_prodi);
        
        if (prodi && !prodi.boleh_buta_warna && pelamar.is_buta_warna) continue;

        if (kuotaProdi[pilihan.id_prodi] && kuotaProdi[pilihan.id_prodi].reguler > 0) {
          // Diterima!
          kuotaProdi[pilihan.id_prodi].reguler -= 1;
          
          finalResults.push({
            id: pelamar.id,
            status_kelulusan: "Diterima",
            id_prodi_diterima: pilihan.id_prodi,
            fase_diterima: "Reguler",
            skor_afirmasi: pelamar.skorAfirmasi,
            skor_reguler: pelamar.skorReguler
          });
          
          isAllocated = true;
          break;
        }
      }

      // Jika tetap gagal di Reguler, maka statusnya Ditolak
      if (!isAllocated) {
        finalResults.push({
          id: pelamar.id,
          status_kelulusan: "Ditolak",
          id_prodi_diterima: null,
          fase_diterima: null,
          skor_afirmasi: pelamar.skorAfirmasi,
          skor_reguler: pelamar.skorReguler
        });
      }
    });

    // 7. SIMPAN HASIL KE DATABASE MYSQL (BULK TRANSACTION)
    const updatePelamarQueries = finalResults.map(res => 
      prisma.pelamar.update({
        where: { id: res.id },
        data: {
          status_kelulusan: res.status_kelulusan,
          id_prodi_diterima: res.id_prodi_diterima,
          fase_diterima: res.fase_diterima
        }
      })
    );

    const upsertRankQueries = finalResults.map(res => 
      prisma.rankDatabase.upsert({
        where: { id_pelamar: res.id },
        create: {
          id_pelamar: res.id,
          skor_afirmasi: res.skor_afirmasi,
          skor_reguler: res.skor_reguler
        },
        update: {
          skor_afirmasi: res.skor_afirmasi,
          skor_reguler: res.skor_reguler
        }
      })
    );

    await prisma.$transaction([...updatePelamarQueries, ...upsertRankQueries]);

    // 8. LOGGING KE MONGODB
    let namaUserAktif = "SYSTEM";
    if (user?.id) {
      const akun = await prisma.user.findUnique({ where: { id: user.id } });
      if (akun) namaUserAktif = akun.name;
    }

    await LogTransaksi.create({
      id_trx: idTrx,
      payload: {
        action: "GENERATE_RANKING",
        id_trx: idTrx,
        datetime: new Date().toISOString(),
        user_id: user?.id || "SYSTEM",
        nama_user: namaUserAktif,
        total_pelamar_diproses: pelamarDiproses.length,
        total_diterima: finalResults.filter(r => r.status_kelulusan === "Diterima").length,
        total_ditolak: finalResults.filter(r => r.status_kelulusan === "Ditolak").length,
      }
    });

    res.status(200).json({ 
      success: true, 
      message: "Proses Perankingan & Alokasi Matchmaking selesai!" 
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: "Engine gagal dijalankan", error: error.message });
  }
};