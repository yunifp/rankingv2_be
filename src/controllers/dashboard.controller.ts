import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Dapatkan Total Seluruh Pelamar
        const totalPelamar = await prisma.pelamar.count();

        // 2. Dapatkan Statistik Berdasarkan Status Kelulusan
        const statusStatsRaw = await prisma.pelamar.groupBy({
            by: ['status_kelulusan'],
            _count: { id: true }
        });

        const statusStats = {
            Diproses: 0,
            Diterima: 0,
            Ditolak: 0,
            Mengundurkan_Diri: 0,
        };

        statusStatsRaw.forEach(stat => {
            if (stat.status_kelulusan in statusStats) {
                statusStats[stat.status_kelulusan as keyof typeof statusStats] = stat._count.id;
            }
        });

        // 3. Dapatkan Statistik Berdasarkan Kluster (Afirmasi vs Reguler)
        const klusterStatsRaw = await prisma.pelamar.groupBy({
            by: ['status_kluster', 'status_kelulusan'],
            _count: { id: true }
        });

        const klusterStats = {
            Afirmasi: { total: 0, diterima: 0 },
            Reguler: { total: 0, diterima: 0 }
        };

        klusterStatsRaw.forEach(stat => {
            const kluster = stat.status_kluster as keyof typeof klusterStats;
            klusterStats[kluster].total += stat._count.id;
            if (stat.status_kelulusan === 'Diterima') {
                klusterStats[kluster].diterima += stat._count.id;
            }
        });

        // 4. Statistik Program Studi (Keketatan & Pemenuhan Kuota)
        const prodiStatsRaw = await prisma.refProgramStudi.findMany({
            include: {
                pt: { select: { nama_pt: true, singkatan: true } },
                _count: { select: { pelamar_diterima: true } }
            }
        });

        const prodiStats = prodiStatsRaw.map(prodi => ({
            id_prodi: prodi.id_prodi,
            nama_prodi: prodi.nama_prodi,
            nama_pt: prodi.pt.singkatan || prodi.pt.nama_pt,
            kuota: prodi.kuota,
            terisi: prodi._count.pelamar_diterima,
            persentase_terisi: prodi.kuota > 0 ? Math.round((prodi._count.pelamar_diterima / prodi.kuota) * 100) : 0
        })).sort((a, b) => b.persentase_terisi - a.persentase_terisi); // Urutkan dari yang paling penuh

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    total: totalPelamar,
                    ...statusStats
                },
                kluster: klusterStats,
                prodi: prodiStats
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Gagal memuat statistik", error: error.message });
    }
};