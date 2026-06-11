import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPenghasilan = async (req: Request, res: Response) => {
  try {
    const { rentang_penghasilan, poin, is_active } = req.body;

    const penghasilan = await prisma.refPenghasilanOrtu.create({
      data: {
        rentang_penghasilan,
        poin: parseInt(poin, 10),
        is_active: is_active ?? true,
      },
    });

    res.status(201).json({ success: true, message: "Skala penghasilan berhasil ditambahkan", data: penghasilan });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menambahkan skala penghasilan", error: error.message });
  }
};

export const getPenghasilan = async (req: Request, res: Response) => {
  try {
    const penghasilan = await prisma.refPenghasilanOrtu.findMany({
      orderBy: { poin: 'desc' } // Urutkan dari poin tertinggi
    });
    res.json({ success: true, data: penghasilan });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePenghasilan = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { rentang_penghasilan, poin, is_active } = req.body;

    const penghasilan = await prisma.refPenghasilanOrtu.update({
      where: { id },
      data: {
        rentang_penghasilan,
        poin: poin !== undefined ? parseInt(poin, 10) : undefined,
        is_active,
      },
    });

    res.json({ success: true, message: "Skala penghasilan diperbarui", data: penghasilan });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal memperbarui", error: error.message });
  }
};

export const deletePenghasilan = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.refPenghasilanOrtu.delete({ where: { id } });
    
    res.json({ success: true, message: "Skala penghasilan berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menghapus skala penghasilan", error: error.message });
  }
};