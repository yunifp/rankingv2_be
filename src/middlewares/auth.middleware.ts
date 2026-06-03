import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 1. Extend interface
export interface AuthRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    permissions: {
      menuId: string;
      menuPath: string;
      action: string;
    }[];
  };
}

// 2. Middleware untuk Verifikasi Token JWT
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token || typeof token !== "string") {
      res.status(401).json({
        message: "Akses ditolak. Token tidak ditemukan atau tidak valid.",
      });
      return;
    }

    const secret = process.env.JWT_SECRET || "rahasia-negara";
    const decoded = jwt.verify(token, secret) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                menuAccess: {
                  include: {
                    menu: true,
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ message: "User tidak ditemukan di database." });
      return;
    }

    // PERBAIKAN 1: Pastikan Role selalu Uppercase dan tidak ada spasi liar
    const userRoles = user.roles.map((ur) => ur.role.name.toUpperCase().trim());

    // PERBAIKAN 2: Pastikan Action selalu Uppercase dan rapi
    const userPermissions = user.roles.flatMap((ur) =>
      ur.role.menuAccess.map((access) => ({
        menuId: access.menu.id,
        menuPath: access.menu.path,
        action: access.permission.name.toUpperCase().trim(),
      })),
    );

    req.user = {
      id: user.id,
      roles: userRoles,
      permissions: userPermissions,
    };

    next();
  } catch (error: any) {
    res.status(401).json({
      message: "Token tidak valid atau sudah kadaluarsa.",
      error: error.message,
    });
  }
};

// 3. Middleware RBAC
export const requirePermission = (
  targetMenuPath: string | string[],
  requiredAction: string,
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User data hilang." });
      return;
    }

    if (req.user.roles.includes("SUPERADMIN")) {
      return next();
    }

    // Normalisasi Input: Ubah menjadi array meskipun inputnya string tunggal
    const targetPaths = Array.isArray(targetMenuPath) ? targetMenuPath : [targetMenuPath];
    
    // Bersihkan semua path di dalam array
    const cleanTargetPaths = targetPaths.map(p => 
      p.replace(/^\/|\/$/g, "").toLowerCase().trim()
    );
    const cleanTargetAction = requiredAction.toUpperCase().trim();

    const hasAccess = req.user.permissions.some((p) => {
      const cleanDbPath = p.menuPath
        .replace(/^\/|\/$/g, "")
        .toLowerCase()
        .trim();

      // Cek apakah path dari DB ada di dalam daftar path yang diizinkan route ini
      return cleanTargetPaths.includes(cleanDbPath) && p.action === cleanTargetAction;
    });

    if (!hasAccess) {
      console.log(`[RBAC BLOCK] User ID: ${req.user.id}`);
      console.log(
        `- Mencari akses: [${cleanTargetAction}] pada salah satu path: [${cleanTargetPaths.join(', ')}]`,
      );

      res.status(403).json({
        message: `Forbidden: Anda tidak memiliki akses [${requiredAction}] untuk modul ini.`,
      });
      return;
    }

    next();
  };
};
