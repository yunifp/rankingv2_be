import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const formatWilayah = (item: any) => ({
  id: item.id,
  kode_pro: item.kode_pro,
  kode_kab: item.kode_kab,
  kode_kec: item.kode_kec,
  kode_kel: item.kode_kel,
  tingkat: item.tingkat,
  tingkat_label: item.tingkat_label,
  nama: item.nama,
});

export const getAllProvinsi = async (req: Request, res: Response) => {
  try {
    const rawData = await prisma.ref_Wilayah.findMany({
      where: { tingkat: 1 },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllKabupaten = async (req: Request, res: Response) => {
  try {
    const rawData = await prisma.ref_Wilayah.findMany({
      where: { tingkat: 2 },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllKecamatan = async (req: Request, res: Response) => {
  try {
    const rawData = await prisma.ref_Wilayah.findMany({
      where: { tingkat: 3 },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllKelurahan = async (req: Request, res: Response) => {
  try {
    const rawData = await prisma.ref_Wilayah.findMany({
      where: { tingkat: 4 },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKabupatenByProvinsi = async (req: Request, res: Response) => {
  try {
    const { kode_pro } = req.params;
    const rawData = await prisma.ref_Wilayah.findMany({
      where: {
        tingkat: 2,
        kode_pro: parseInt(String(kode_pro), 10),
      },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKecamatanByKabupaten = async (req: Request, res: Response) => {
  try {
    const { kode_kab } = req.params;
    const rawData = await prisma.ref_Wilayah.findMany({
      where: {
        tingkat: 3,
        kode_kab: parseInt(String(kode_kab), 10),
      },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKelurahanByKecamatan = async (req: Request, res: Response) => {
  try {
    const { kode_kec } = req.params;
    const rawData = await prisma.ref_Wilayah.findMany({
      where: {
        tingkat: 4,
        kode_kec: parseInt(String(kode_kec), 10),
      },
      orderBy: { nama: "asc" },
    });
    const data = rawData.map(formatWilayah);
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createWilayah = async (req: Request, res: Response) => {
  try {
    const {
      kode_pro,
      kode_kab,
      kode_kec,
      kode_kel,
      nama,
      tingkat,
      tingkat_label,
    } = req.body;

    const rawData = await prisma.ref_Wilayah.create({
      data: {
        kode_pro: kode_pro ? parseInt(String(kode_pro), 10) : null,
        kode_kab: kode_kab ? parseInt(String(kode_kab), 10) : null,
        kode_kec: kode_kec ? parseInt(String(kode_kec), 10) : null,
        kode_kel: kode_kel ? parseInt(String(kode_kel), 10) : null,
        nama,
        tingkat: tingkat ? parseInt(String(tingkat), 10) : null,
        tingkat_label,
      },
    });
    res.status(201).json({ data: formatWilayah(rawData) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateWilayah = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      kode_pro,
      kode_kab,
      kode_kec,
      kode_kel,
      nama,
      tingkat,
      tingkat_label,
    } = req.body;

    const rawData = await prisma.ref_Wilayah.update({
      where: { id: parseInt(String(id), 10) },
      data: {
        kode_pro: kode_pro ? parseInt(String(kode_pro), 10) : null,
        kode_kab: kode_kab ? parseInt(String(kode_kab), 10) : null,
        kode_kec: kode_kec ? parseInt(String(kode_kec), 10) : null,
        kode_kel: kode_kel ? parseInt(String(kode_kel), 10) : null,
        nama,
        tingkat: tingkat ? parseInt(String(tingkat), 10) : null,
        tingkat_label,
      },
    });
    res.json({ data: formatWilayah(rawData) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteWilayah = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.ref_Wilayah.delete({
      where: { id: parseInt(String(id), 10) },
    });
    res.json({ message: "Wilayah berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
