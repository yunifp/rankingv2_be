import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { LogTransaksi } from "../config/mongo";

const prisma = new PrismaClient();

export const runRankingAndMatchmaking = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const idTrx = uuidv4();

    const pelamarDiproses = await prisma.pelamar.findMany({
      where: { status_kelulusan: "Diproses" },
      include: {
        penghasilan_ortu: true,
        pilihan_prodi: {
          orderBy: { prioritas: "asc" }
        }
      }
    });

    if (pelamarDiproses.length === 0) {
      return res.status(400).json({ success: false, message: "Tidak ada pelamar dengan status 'Diproses' untuk diranking." });
    }

    const prodis = await prisma.refProgramStudi.findMany();
    const kriteria = await prisma.refKriteria.findMany();

    const getBobot = (kode: string) => Number(kriteria.find(k => k.kode_kriteria === kode)?.bobot || 0);

    let maxRap = 0, maxWaw = 0, maxAka = 0, maxInc = 0;
    pelamarDiproses.forEach(p => {
      if (p.nilai_rapor > maxRap) maxRap = p.nilai_rapor;
      if (p.nilai_wawancara > maxWaw) maxWaw = p.nilai_wawancara;
      if (p.nilai_tes_akademik > maxAka) maxAka = p.nilai_tes_akademik;
      if (p.penghasilan_ortu && p.penghasilan_ortu.poin > maxInc) maxInc = p.penghasilan_ortu.poin;
    });

    maxRap = maxRap || 1; maxWaw = maxWaw || 1; maxAka = maxAka || 1; maxInc = maxInc || 1;

    const calculatedPelamar = pelamarDiproses.map(p => {
      const poinInc = p.penghasilan_ortu?.poin || 0;

      const normRap = p.nilai_rapor / maxRap;
      const normWaw = p.nilai_wawancara / maxWaw;
      const normAka = p.nilai_tes_akademik / maxAka;
      const normInc = poinInc / maxInc;

      let skorAfirmasi = 0;
      if (p.status_kluster === "Afirmasi") {
        skorAfirmasi = (normRap * getBobot("A-RAP")) + (normWaw * getBobot("A-WAW")) + (normInc * getBobot("A-INC"));
      }

      const skorReguler = (normAka * getBobot("R-AKA")) + (normRap * getBobot("R-RAP")) + (normWaw * getBobot("R-WAW")) + (normInc * getBobot("R-INC"));

      return { ...p, skorAfirmasi, skorReguler };
    });

    let kuotaProdi: Record<string, { afirmasi: number, reguler: number }> = {};
    prodis.forEach(prodi => {
      const kAfirmasi = Math.round(prodi.kuota * 0.3);
      kuotaProdi[prodi.id_prodi] = {
        afirmasi: kAfirmasi,
        reguler: prodi.kuota - kAfirmasi
      };
    });

    let finalResults: any[] = [];
    let unallocatedAfirmasi: typeof calculatedPelamar = [];


    let afirmasiPool = calculatedPelamar
      .filter(p => p.status_kluster === "Afirmasi")
      .sort((a, b) => b.skorAfirmasi - a.skorAfirmasi);

    afirmasiPool.forEach(pelamar => {
      let isAllocated = false;

      for (const pilihan of pelamar.pilihan_prodi) {
        const prodi = prodis.find(pr => pr.id_prodi === pilihan.id_prodi);

        if (prodi && !prodi.boleh_buta_warna && pelamar.is_buta_warna) continue;

        if (kuotaProdi[pilihan.id_prodi] && kuotaProdi[pilihan.id_prodi].afirmasi > 0) {
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
          break;
        }
      }

      if (!isAllocated) {
        unallocatedAfirmasi.push(pelamar);
      }
    });

    let regulerOriginalPool = calculatedPelamar.filter(p => p.status_kluster === "Reguler");

    let regulerPool = [...regulerOriginalPool, ...unallocatedAfirmasi]
      .sort((a, b) => b.skorReguler - a.skorReguler);

    regulerPool.forEach(pelamar => {
      let isAllocated = false;

      for (const pilihan of pelamar.pilihan_prodi) {
        const prodi = prodis.find(pr => pr.id_prodi === pilihan.id_prodi);

        if (prodi && !prodi.boleh_buta_warna && pelamar.is_buta_warna) continue;

        if (kuotaProdi[pilihan.id_prodi] && kuotaProdi[pilihan.id_prodi].reguler > 0) {
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


export const getRankingResults = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search as string;
    const filterPt = req.query.id_pt as string;
    const filterProdi = req.query.id_prodi as string;
    const filterKluster = req.query.status_kluster as string;

    const whereClause: any = {
      status_kelulusan: { in: ["Diterima", "Ditolak", "Mengundurkan_Diri"] }
    };

    // Filter Pencarian (Nama / Kode)
    if (search) {
      whereClause.OR = [
        { kode_pendaftar: { contains: search } },
        { nama: { contains: search } }
      ];
    }

    // Filter Jalur Masuk / Kluster
    if (filterKluster) {
      whereClause.status_kluster = filterKluster;
    }

    // Filter Program Studi & Perguruan Tinggi
    if (filterProdi) {
      whereClause.id_prodi_diterima = filterProdi;
    } else if (filterPt) {
      // Filter relasional Prisma: Cari pelamar yang prodi-nya milik PT tertentu
      whereClause.prodi_diterima = {
        id_pt: filterPt
      };
    }

    const [results, totalItems] = await prisma.$transaction([
      prisma.pelamar.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          prodi_diterima: {
            include: { pt: true } // Tarik juga nama PT-nya
          },
          ranking: true,
          // PERUBAHAN ADA DI SINI: Fetch beruntun untuk prodi & pt di dalam pilihan_prodi
          pilihan_prodi: {
            orderBy: { prioritas: 'asc' },
            include: {
              prodi: {
                include: { pt: true }
              }
            }
          }
        },
        orderBy: [
          { status_kelulusan: 'asc' },
          { ranking: { skor_reguler: 'desc' } }
        ]
      }),
      prisma.pelamar.count({ where: whereClause })
    ]);

    res.status(200).json({
      success: true,
      data: results,
      meta: {
        totalItems,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// API POST: Set Mundur (Resign) Pelamar
export const setMundurPelamar = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = (req as any).user;
    const idTrx = uuidv4();

    const pelamar = await prisma.pelamar.findUnique({ where: { id } });
    if (!pelamar || pelamar.status_kelulusan !== "Diterima") {
      return res.status(400).json({ success: false, message: "Pelamar tidak valid atau belum diterima." });
    }

    // Ubah status dan kosongkan prodi
    await prisma.pelamar.update({
      where: { id },
      data: { status_kelulusan: "Mengundurkan_Diri", id_prodi_diterima: null }
    });

    let namaUserAktif = "SYSTEM";
    if (user?.id) {
      const akun = await prisma.user.findUnique({ where: { id: user.id } });
      if (akun) namaUserAktif = akun.name;
    }

    await LogTransaksi.create({
      id_trx: idTrx,
      payload: {
        action: "SET_MUNDUR",
        id_trx: idTrx,
        datetime: new Date().toISOString(),
        user_id: user?.id || "SYSTEM",
        nama_user: namaUserAktif,
        target_kode_pendaftar: pelamar.kode_pendaftar,
        nama_pelamar: pelamar.nama
      }
    });

    res.status(200).json({ success: true, message: "Pelamar berhasil di-set mundur." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const resetRanking = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const idTrx = uuidv4();

    // 1. Kosongkan tabel RankDatabase (Hapus semua skor)
    await prisma.rankDatabase.deleteMany({});

    // 2. Kembalikan status semua pelamar menjadi "Diproses"
    const result = await prisma.pelamar.updateMany({
      where: {
        status_kelulusan: { in: ["Diterima", "Ditolak", "Mengundurkan_Diri"] }
      },
      data: {
        status_kelulusan: "Diproses",
        id_prodi_diterima: null,
        fase_diterima: null
      }
    });

    // 3. Catat Log ke MongoDB
    let namaUserAktif = "SYSTEM";
    if (user?.id) {
      const akun = await prisma.user.findUnique({ where: { id: user.id } });
      if (akun) namaUserAktif = akun.name;
    }

    await LogTransaksi.create({
      id_trx: idTrx,
      payload: {
        action: "RESET_RANKING",
        id_trx: idTrx,
        datetime: new Date().toISOString(),
        user_id: user?.id || "SYSTEM",
        nama_user: namaUserAktif,
        total_data_direset: result.count
      }
    });

    res.status(200).json({ success: true, message: `Berhasil mereset ${result.count} data pelamar kembali ke status Diproses.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const getRankingExportData = async (req: Request, res: Response) => {
  try {
    const results = await prisma.pelamar.findMany({
      where: {
        status_kelulusan: { in: ["Diterima", "Ditolak", "Mengundurkan_Diri"] }
      },
      include: {
        prodi_diterima: {
          include: { pt: true }
        },
        ranking: true
      },
      orderBy: [
        { status_kelulusan: 'asc' },
        { ranking: { skor_reguler: 'desc' } }
      ]
    });

    res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};