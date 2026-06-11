import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { LogTransaksi } from "../config/mongo";
import { uploadExcelToS3 } from "../utils/s3";
import * as xlsx from "xlsx";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const getPagination = (page?: string, limit?: string) => {
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 10;
    const skip = (pageNumber - 1) * limitNumber;
    return { skip, take: limitNumber, pageNumber, limitNumber };
};

// 1. API GET: Ambil Data Pelamar untuk Tabel Master
export const getPelamarPaginated = async (req: Request, res: Response) => {
    try {
        const { skip, take, pageNumber, limitNumber } = getPagination(req.query.page as string, req.query.limit as string);
        const search = req.query.search as string;
        const filterKluster = req.query.status_kluster as string;

        const whereClause: any = {};

        if (search) {
            whereClause.OR = [
                { kode_pendaftar: { contains: search } },
                { nama: { contains: search } }
            ];
        }

        if (filterKluster) {
            whereClause.status_kluster = filterKluster;
        }

        const [data, totalItems] = await prisma.$transaction([
            prisma.pelamar.findMany({
                where: whereClause,
                skip,
                take,
                // Blok "include" dihapus agar tidak bentrok dengan nama relasi di schema.prisma
                orderBy: { nama: "asc" },
            }),
            prisma.pelamar.count({ where: whereClause }),
        ]);

        res.json({
            success: true,
            data,
            meta: {
                totalItems,
                currentPage: pageNumber,
                itemsPerPage: limitNumber,
                totalPages: Math.ceil(totalItems / limitNumber),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. API POST: Import Excel dengan Validasi Skip Duplikat
export const importExcelPelamar = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        const user = (req as any).user;

        if (!file) {
            return res.status(400).json({ success: false, message: "File Excel tidak ditemukan" });
        }

        const workbook = xlsx.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

        if (sheetData.length === 0) {
            return res.status(400).json({ success: false, message: "File Excel kosong" });
        }

        const idTrx = uuidv4();
        let totalBerhasil = 0;
        let totalDuplikat = 0;

        await prisma.$transaction(async (tx) => {
            for (const row of sheetData) {
                if (!row.kode_pendaftar) continue;

                // VALIDASI: Cek apakah kode_pendaftar sudah ada di database
                const existingPelamar = await tx.pelamar.findUnique({
                    where: { kode_pendaftar: String(row.kode_pendaftar) },
                });

                // Jika sudah ada, skip baris ini dan naikkan counter duplikat
                if (existingPelamar) {
                    totalDuplikat++;
                    continue;
                }

                // Jika lolos validasi, lakukan operasi insert
                const pelamar = await tx.pelamar.create({
                    data: {
                        kode_pendaftar: String(row.kode_pendaftar),
                        nama: String(row.nama),
                        status_kluster: row.status_kluster,
                        nilai_wawancara: Number(row.nilai_wawancara) || 0,
                        nilai_tes_akademik: Number(row.nilai_tes_akademik) || 0,
                        nilai_rapor: Number(row.nilai_rapor) || 0,
                        id_penghasilan_ortu: String(row.penghasilan_ortu),
                        status_kelulusan: 'Diproses'
                    },
                });

                const pilihanProdiData = [];
                for (let i = 1; i <= 42; i++) {
                    const idProdi = row[`pilihan_${i}`];
                    if (idProdi) {
                        pilihanProdiData.push({
                            id_pelamar: pelamar.id,
                            id_prodi: String(idProdi),
                            prioritas: i,
                        });
                    }
                }

                if (pilihanProdiData.length > 0) {
                    await tx.pelamarPilihan.createMany({
                        data: pilihanProdiData,
                    });
                }

                totalBerhasil++;
            }
        });

        // Upload ke S3
        const s3Path = await uploadExcelToS3(file.buffer, file.originalname);

        let namaUserAktif = "SYSTEM";
        if (user?.id) {
            const akun = await prisma.user.findUnique({ where: { id: user.id } });
            if (akun) namaUserAktif = akun.name;
        }

        const payloadLog = {
            action: "IMPORT_EXCEL",
            id_trx: idTrx,
            datetime: new Date().toISOString(),
            user_id: user?.id || "SYSTEM",
            nama_user: namaUserAktif, // <-- Diperbarui menggunakan query database
            nama_file_import: file.originalname,
            s3_path: s3Path,
            total_data_berhasil: totalBerhasil,
            total_data_duplikat_dilewati: totalDuplikat,
        };

        await LogTransaksi.create({
            id_trx: idTrx,
            payload: payloadLog,
        });

        res.status(200).json({
            success: true,
            message: `Proses selesai. ${totalBerhasil} pelamar baru ditambahkan, ${totalDuplikat} data duplikat dilewati.`,
            data: { id_trx: idTrx, s3_path: s3Path, totalBerhasil, totalDuplikat }
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: "Terjadi kesalahan sistem", error: error.message });
    }
};

export const updatePelamar = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const data = req.body;
        const user = (req as any).user;
        const idTrx = uuidv4();

        // Ambil data lama untuk snapshot history
        const dataLama = await prisma.pelamar.findUnique({ where: { id } });
        if (!dataLama) {
            return res.status(404).json({ success: false, message: "Pelamar tidak ditemukan" });
        }

        // Eksekusi update ke MySQL
        const updatedPelamar = await prisma.pelamar.update({
            where: { id },
            data: {
                nama: data.nama,
                status_kluster: data.status_kluster,
                nilai_rapor: Number(data.nilai_rapor),
                nilai_tes_akademik: Number(data.nilai_tes_akademik),
                nilai_wawancara: Number(data.nilai_wawancara),
            },
        });

        // AMBIL NAMA USER ASLI DARI DATABASE BERDASARKAN ID TOKEN
        let namaUserAktif = "SYSTEM";
        if (user?.id) {
            const akun = await prisma.user.findUnique({ where: { id: user.id } });
            if (akun) namaUserAktif = akun.name;
        }

        // Catat Log ke MongoDB dengan nama user yang akurat
        await LogTransaksi.create({
            id_trx: idTrx,
            payload: {
                action: "UPDATE_PELAMAR",
                id_trx: idTrx,
                datetime: new Date().toISOString(),
                user_id: user?.id || "SYSTEM",
                nama_user: namaUserAktif, // <-- Menggunakan nama asli dari database
                target_kode_pendaftar: updatedPelamar.kode_pendaftar,
                data_sebelum: {
                    nama: dataLama.nama,
                    status_kluster: dataLama.status_kluster,
                    nilai_rapor: dataLama.nilai_rapor,
                    nilai_tes_akademik: dataLama.nilai_tes_akademik,
                    nilai_wawancara: dataLama.nilai_wawancara,
                },
                data_sesudah: {
                    nama: updatedPelamar.nama,
                    status_kluster: updatedPelamar.status_kluster,
                    nilai_rapor: updatedPelamar.nilai_rapor,
                    nilai_tes_akademik: updatedPelamar.nilai_tes_akademik,
                    nilai_wawancara: updatedPelamar.nilai_wawancara,
                }
            },
        });

        res.status(200).json({
            success: true,
            message: "Data pelamar berhasil diperbarui",
            data: updatedPelamar,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Gagal memperbarui data", error: error.message });
    }
};


export const deletePelamar = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const user = (req as any).user;
        const idTrx = uuidv4();

        const pelamar = await prisma.pelamar.findUnique({ where: { id } });
        if (!pelamar) return res.status(404).json({ success: false, message: "Pelamar tidak ditemukan" });

        await prisma.pelamar.delete({ where: { id } });

        // AMBIL NAMA USER ASLI DARI DATABASE BERDASARKAN ID TOKEN
        let namaUserAktif = "SYSTEM";
        if (user?.id) {
            const akun = await prisma.user.findUnique({ where: { id: user.id } });
            if (akun) namaUserAktif = akun.name;
        }

        await LogTransaksi.create({
            id_trx: idTrx,
            payload: {
                action: "DELETE_PELAMAR",
                id_trx: idTrx,
                datetime: new Date().toISOString(),
                user_id: user?.id || "SYSTEM",
                nama_user: namaUserAktif, // <-- Menggunakan nama asli dari database
                target_kode_pendaftar: pelamar.kode_pendaftar,
                nama_pelamar_terhapus: pelamar.nama,
            },
        });

        res.status(200).json({ success: true, message: "Data pelamar berhasil dihapus" });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Gagal menghapus data", error: error.message });
    }
};