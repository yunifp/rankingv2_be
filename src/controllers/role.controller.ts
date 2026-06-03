import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Constant ID Superadmin (Disimpan sebagai referensi jika dibutuhkan)
const SUPERADMIN_ID = "d85d5209-18d7-47d7-bf86-38b1545997df";

/**
 * Helper: Mengecek apakah user yang melakukan request adalah Superadmin
 * Membaca langsung dari token JWT agar lebih aman dan akurat
 */
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

// Helper function untuk paginasi
const getPagination = (page?: string, limit?: string) => {
  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;
  return { skip, take: limitNumber, pageNumber, limitNumber };
};

/**
 * 1. CREATE ROLE
 */
export const createRole = async (req: Request, res: Response) => {
  try {
    const { name, description, scope } = req.body;

    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        description,
        scope: scope || "GENERAL",
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

/**
 * 2A. GET ALL ROLES PAGINATED
 */
export const getRolesPaginated = async (req: any, res: Response) => {
  try {
    const { skip, take, pageNumber, limitNumber } = getPagination(
      req.query.page as string,
      req.query.limit as string,
    );

    // Cek apakah user yang login memiliki role SUPERADMIN
    const isRequesterSuperAdmin = checkIsSuperAdmin(req);

    // PENYESUAIAN: Jika bukan superadmin, sembunyikan role SUPERADMIN
    const whereClause = isRequesterSuperAdmin
      ? {}
      : { name: { not: "SUPERADMIN" } };

    const [data, totalItems] = await prisma.$transaction([
      prisma.role.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          menuAccess: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.role.count({
        where: whereClause,
      }),
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

/**
 * 2B. GET ALL ROLES (TANPA PAGINATION)
 * Digunakan untuk kebutuhan dropdown / list
 */
export const getRolesAll = async (req: any, res: Response) => {
  try {
    // Cek apakah user yang login memiliki role SUPERADMIN
    const isSuperAdmin = checkIsSuperAdmin(req);

    // PENYESUAIAN: Sembunyikan role SUPERADMIN jika yang request bukan Superadmin
    const whereClause = isSuperAdmin ? {} : { name: { not: "SUPERADMIN" } };

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        menuAccess: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. UPDATE ROLE
 */
export const updateRole = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, description, scope } = req.body;

    const targetRole = await prisma.role.findUnique({ where: { id } });
    if (!targetRole) {
      return res
        .status(404)
        .json({ success: false, message: "Role tidak ditemukan" });
    }

    // Proteksi: Admin biasa tidak boleh edit role Superadmin (Pengecekan menggunakan nama agar kebal terhadap UUID berubah)
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
        scope,
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

/**
 * 4. DELETE ROLE
 */
export const deleteRole = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;

    const targetRole = await prisma.role.findUnique({ where: { id } });
    if (!targetRole) {
      return res
        .status(404)
        .json({ success: false, message: "Role tidak ditemukan" });
    }

    // Proteksi: Role Superadmin bersifat abadi/tidak bisa dihapus oleh siapapun
    if (targetRole.name === "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Role SUPERADMIN adalah role sistem utama dan tidak dapat dihapus.",
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: "Role berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * 5. UPDATE ROLE ACCESS (Matriks Permission)
 */
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
