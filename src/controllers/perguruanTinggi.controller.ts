import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getPagination = (page?: string, limit?: string) => {
  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;
  return { skip, take: limitNumber, pageNumber, limitNumber };
};

export const createPT = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    // 1. Validasi ID PT (Cegah Duplikat ID)
    if (data.id_pt) {
      const existingId = await prisma.refPerguruanTinggi.findUnique({ where: { id_pt: data.id_pt } });
      if (existingId) return res.status(400).json({ success: false, message: "ID Perguruan Tinggi tersebut sudah digunakan!" });
    }

    // 2. Validasi Kode PT (Cegah Duplikat Kode Kampus)
    if (data.kode_pt) {
      const existingKode = await prisma.refPerguruanTinggi.findFirst({ where: { kode_pt: data.kode_pt } });
      if (existingKode) return res.status(400).json({ success: false, message: "Kode PT tersebut sudah terdaftar pada kampus lain!" });
    }

    const pt = await prisma.refPerguruanTinggi.create({
      data: {
        id_pt: data.id_pt || undefined, // Gunakan input user, jika kosong biarkan Prisma buatkan UUID
        nama_pt: data.nama_pt,
        nama_pt_odoo: data.nama_pt_odoo,
        kode_pt: data.kode_pt,
        singkatan: data.singkatan,
        jenis: data.jenis,
        alamat: data.alamat,
        kota: data.kota,
        kode_pos: data.kode_pos,
        no_telepon_pt: data.no_telepon_pt,
        email: data.email,
        website: data.website,
        nama_pimpinan: data.nama_pimpinan,
        status_aktif: data.status_aktif ?? true,
      },
    });

    res.status(201).json({ success: true, message: "Perguruan Tinggi berhasil ditambahkan", data: pt });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menambahkan Perguruan Tinggi", error: error.message });
  }
};

export const getPTPaginated = async (req: Request, res: Response) => {
  try {
    const { skip, take, pageNumber, limitNumber } = getPagination(req.query.page as string, req.query.limit as string);
    const search = req.query.search as string;

    const whereClause = search ? {
      OR: [
        { id_pt: { contains: search } }, 
        { nama_pt: { contains: search } },
        { singkatan: { contains: search } },
        { kode_pt: { contains: search } } // Sekalian kita tambahkan fitur cari berdasarkan kode PT
      ]
    } : {};

    const [data, totalItems] = await prisma.$transaction([
      prisma.refPerguruanTinggi.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { nama_pt: "asc" },
      }),
      prisma.refPerguruanTinggi.count({ where: whereClause }),
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

export const getPTById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const pt = await prisma.refPerguruanTinggi.findUnique({
      where: { id_pt: id },
      include: { prodi: true }
    });

    if (!pt) return res.status(404).json({ success: false, message: "Perguruan Tinggi tidak ditemukan" });
    
    res.json({ success: true, data: pt });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePT = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; // ID Lama dari URL parameter
    const data = req.body; 

    // 1. Validasi ID PT
    if (data.id_pt && data.id_pt !== id) {
       const existingId = await prisma.refPerguruanTinggi.findUnique({ where: { id_pt: data.id_pt } });
       if (existingId) return res.status(400).json({ success: false, message: "ID Perguruan Tinggi baru sudah digunakan oleh kampus lain!" });
    }

    // 2. Validasi Kode PT (Pastikan kode tidak dipakai kampus LAIN)
    if (data.kode_pt) {
      const existingKode = await prisma.refPerguruanTinggi.findFirst({ where: { kode_pt: data.kode_pt } });
      // Jika kode ditemukan DAN ID kampusnya berbeda dengan kampus yang sedang di-edit
      if (existingKode && existingKode.id_pt !== id) {
        return res.status(400).json({ success: false, message: "Kode PT tersebut sudah terdaftar pada kampus lain!" });
      }
    }

    const pt = await prisma.refPerguruanTinggi.update({
      where: { id_pt: id },
      data: {
        id_pt: data.id_pt, 
        nama_pt: data.nama_pt,
        nama_pt_odoo: data.nama_pt_odoo,
        kode_pt: data.kode_pt,
        singkatan: data.singkatan,
        jenis: data.jenis,
        alamat: data.alamat,
        kota: data.kota,
        kode_pos: data.kode_pos,
        no_telepon_pt: data.no_telepon_pt,
        email: data.email,
        website: data.website,
        nama_pimpinan: data.nama_pimpinan,
        status_aktif: data.status_aktif,
      },
    });

    res.json({ success: true, message: "Data Perguruan Tinggi diperbarui", data: pt });
  } catch (error: any) {
    if (error.code === 'P2014' || error.code === 'P2003') {
        return res.status(400).json({ success: false, message: "Tidak dapat mengubah ID PT karena kampus ini sudah terhubung dengan data Program Studi." });
    }
    res.status(400).json({ success: false, message: "Gagal memperbarui", error: error.message });
  }
};

export const deletePT = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.refPerguruanTinggi.delete({ where: { id_pt: id } });
    
    res.json({ success: true, message: "Perguruan Tinggi berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menghapus. Pastikan tidak ada Prodi yang terikat.", error: error.message });
  }
};