import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPermission = async (req: Request, res: Response) => {
  try {
    const { name } = req.body; // Cukup name saja, misal: "READ"
    const permission = await prisma.permission.create({
      data: { name },
    });
    res.status(201).json({ message: "Permission dibuat", data: permission });
  } catch (error: any) {
    res
      .status(400)
      .json({ message: "Gagal membuat permission", error: error.message });
  }
};

export const getPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany();
    res.json({ data: permissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getListPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany();
    res.json({ data: permissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePermission = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.permission.delete({ where: { id } });
    res.json({ message: "Permission dihapus" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
