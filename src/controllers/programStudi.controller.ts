import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getPagination = (page?: string, limit?: string) => {
  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;
  return { skip, take: limitNumber, pageNumber, limitNumber };
};

export const createProdi = async (req: Request, res: Response) => {
  try {
    const { id_pt, jenjang, nama_prodi, kuota, boleh_buta_warna } = req.body;

    // Validasi apakah Perguruan Tinggi exists
    const ptExists = await prisma.refPerguruanTinggi.findUnique({
      where: { id_pt },
    });

    if (!ptExists) {
      return res.status(404).json({ success: false, message: "Perguruan Tinggi tidak ditemukan." });
    }

    const prodi = await prisma.refProgramStudi.create({
      data: {
        id_pt,
        jenjang,
        nama_prodi,
        kuota: parseInt(kuota, 10), // Pastikan kuota masuk sebagai integer
        boleh_buta_warna: boleh_buta_warna ?? true,
      },
    });

    res.status(201).json({ success: true, message: "Program Studi berhasil ditambahkan", data: prodi });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menambahkan Program Studi", error: error.message });
  }
};

export const getProdiPaginated = async (req: Request, res: Response) => {
  try {
    const { skip, take, pageNumber, limitNumber } = getPagination(req.query.page as string, req.query.limit as string);
    const search = req.query.search as string;
    const filterPt = req.query.id_pt as string; // Opsi filter berdasarkan kampus

    const whereClause: any = {};
    
    if (search) {
      whereClause.nama_prodi = { contains: search };
    }
    
    if (filterPt) {
      whereClause.id_pt = filterPt;
    }

    const [data, totalItems] = await prisma.$transaction([
      prisma.refProgramStudi.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          pt: {
            select: { nama_pt: true, singkatan: true } // Menarik data nama kampus untuk ditampilkan di tabel frontend
          }
        },
        orderBy: [
          { pt: { nama_pt: 'asc' } },
          { nama_prodi: 'asc' }
        ],
      }),
      prisma.refProgramStudi.count({ where: whereClause }),
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

export const getProdiById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const prodi = await prisma.refProgramStudi.findUnique({
      where: { id_prodi: id },
      include: {
        pt: { select: { nama_pt: true, singkatan: true } }
      }
    });

    if (!prodi) return res.status(404).json({ success: false, message: "Program Studi tidak ditemukan" });
    
    res.json({ success: true, data: prodi });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateProdi = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { id_pt, jenjang, nama_prodi, kuota, boleh_buta_warna } = req.body;

    const dataToUpdate: any = {};
    if (id_pt !== undefined) dataToUpdate.id_pt = id_pt;
    if (jenjang !== undefined) dataToUpdate.jenjang = jenjang;
    if (nama_prodi !== undefined) dataToUpdate.nama_prodi = nama_prodi;
    if (kuota !== undefined) dataToUpdate.kuota = parseInt(kuota, 10);
    if (boleh_buta_warna !== undefined) dataToUpdate.boleh_buta_warna = boleh_buta_warna;

    const prodi = await prisma.refProgramStudi.update({
      where: { id_prodi: id },
      data: dataToUpdate,
    });

    res.json({ success: true, message: "Data Program Studi diperbarui", data: prodi });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal memperbarui", error: error.message });
  }
};

export const deleteProdi = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.refProgramStudi.delete({ where: { id_prodi: id } });
    
    res.json({ success: true, message: "Program Studi berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menghapus Program Studi", error: error.message });
  }
};