import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

const checkIsSuperAdmin = (req: Request | any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;

  const token = authHeader.split(" ")[1];
  if (!token) return false;

  try {
    const decoded: any = jwt.decode(token);
    if (!decoded || !decoded.roles) return false;

    return decoded.roles.some(
      (role: any) => role === "SUPERADMIN" || role?.name === "SUPERADMIN",
    );
  } catch (error) {
    return false;
  }
};

const getPagination = (page?: string, limit?: string) => {
  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;
  return { skip, take: limitNumber, pageNumber, limitNumber };
};

export const createRole = async (req: Request, res: Response) => {
  try {
    // BERSIH DARI SCOPE
    const { name, description } = req.body;

    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        description,
      },
    });

    res.status(201).json({
      success: true,
      message: "Role berhasil dibuat",
      data: role,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: "Gagal membuat role",
      error: error.message,
    });
  }
};

export const getRolesPaginated = async (req: any, res: Response) => {
  try {
    const { skip, take, pageNumber, limitNumber } = getPagination(
      req.query.page as string,
      req.query.limit as string,
    );

    const isRequesterSuperAdmin = checkIsSuperAdmin(req);
    const whereClause = isRequesterSuperAdmin
      ? {}
      : { name: { not: "SUPERADMIN" } };

    const [data, totalItems] = await prisma.$transaction([
      prisma.role.findMany({
        where: whereClause,
        skip,
        take,
        include: { menuAccess: true },
        orderBy: { name: "asc" },
      }),
      prisma.role.count({ where: whereClause }),
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

export const getRolesAll = async (req: any, res: Response) => {
  try {
    const isSuperAdmin = checkIsSuperAdmin(req);
    const whereClause = isSuperAdmin ? {} : { name: { not: "SUPERADMIN" } };

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: { menuAccess: true },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateRole = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;
    // BERSIH DARI SCOPE
    const { name, description } = req.body;

    const targetRole = await prisma.role.findUnique({ where: { id } });
    if (!targetRole) {
      return res.status(404).json({ success: false, message: "Role tidak ditemukan" });
    }

    if (targetRole.name === "SUPERADMIN") {
      const isSuperAdmin = checkIsSuperAdmin(req);
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: "Anda tidak memiliki otoritas untuk mengubah Role ini.",
        });
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: name?.toUpperCase(),
        description,
      },
    });

    res.json({
      success: true,
      message: "Informasi role diperbarui",
      data: role,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteRole = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;

    const targetRole = await prisma.role.findUnique({ where: { id } });
    if (!targetRole) {
      return res.status(404).json({ success: false, message: "Role tidak ditemukan" });
    }

    if (targetRole.name === "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        message: "Role SUPERADMIN adalah role sistem utama dan tidak dapat dihapus.",
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: "Role berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const updateRoleAccess = async (req: any, res: Response) => {
  try {
    const roleId = req.params.id as string;
    const { accessData } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.roleMenuAccess.deleteMany({ where: { roleId } });

      const newAccessRecords = accessData.flatMap((item: any) =>
        item.permissionIds.map((permId: string) => ({
          roleId,
          menuId: item.menuId,
          permissionId: permId,
        })),
      );

      if (newAccessRecords.length > 0) {
        await tx.roleMenuAccess.createMany({
          data: newAccessRecords,
          skipDuplicates: true,
        });
      }
    });

    res.json({
      success: true,
      message: "Konfigurasi matriks akses role berhasil diperbarui",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: "Gagal memperbarui hak akses",
      error: error.message,
    });
  }
};