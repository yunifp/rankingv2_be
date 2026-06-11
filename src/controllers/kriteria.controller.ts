import { Request, Response } from "express";
import { PrismaClient, TipeKriteria, StatusKluster } from "@prisma/client";

const prisma = new PrismaClient();

export const createKriteria = async (req: Request, res: Response) => {
  try {
    const { kode_kriteria, nama_kriteria, tipe, bobot, kluster } = req.body;

    const existingKriteria = await prisma.refKriteria.findUnique({
      where: { kode_kriteria },
    });

    if (existingKriteria) {
      return res.status(400).json({ success: false, message: "Kode Kriteria sudah digunakan." });
    }

    const kriteria = await prisma.refKriteria.create({
      data: {
        kode_kriteria,
        nama_kriteria,
        tipe: tipe as TipeKriteria,
        bobot: parseFloat(bobot),
        kluster: kluster as StatusKluster,
      },
    });

    res.status(201).json({ success: true, message: "Kriteria berhasil ditambahkan", data: kriteria });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menambahkan Kriteria", error: error.message });
  }
};

export const getKriteria = async (req: Request, res: Response) => {
  try {
    const kriteria = await prisma.refKriteria.findMany({
      orderBy: [
        { kluster: 'asc' },
        { kode_kriteria: 'asc' }
      ]
    });
    res.json({ success: true, data: kriteria });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateKriteria = async (req: Request, res: Response) => {
  try {
    const kode = req.params.kode as string;
    const { nama_kriteria, tipe, bobot, kluster } = req.body;

    const kriteria = await prisma.refKriteria.update({
      where: { kode_kriteria: kode },
      data: {
        nama_kriteria,
        tipe: tipe as TipeKriteria,
        bobot: bobot !== undefined ? parseFloat(bobot) : undefined,
        kluster: kluster as StatusKluster,
      },
    });

    res.json({ success: true, message: "Data Kriteria diperbarui", data: kriteria });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal memperbarui", error: error.message });
  }
};

export const deleteKriteria = async (req: Request, res: Response) => {
  try {
    const kode = req.params.kode as string;
    await prisma.refKriteria.delete({ where: { kode_kriteria: kode } });
    
    res.json({ success: true, message: "Kriteria berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "Gagal menghapus Kriteria", error: error.message });
  }
};