import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CRUD Standar Menu (Tanpa logic permissionId lagi)
export const createMenu = async (req: Request, res: Response) => {
  try {
    const { title, path, icon, order, parentId } = req.body;
    const menu = await prisma.menu.create({
      data: { title, path, icon, order, parentId },
    });
    res.status(201).json({ message: "Menu berhasil dibuat", data: menu });
  } catch (error: any) {
    res
      .status(400)
      .json({ message: "Gagal membuat menu", error: error.message });
  }
};

export const getMenus = async (req: Request, res: Response) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    res.json({ data: menus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getListMenus = async (req: Request, res: Response) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    res.json({ data: menus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMenuById = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const menu = await prisma.menu.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!menu) return res.status(404).json({ message: "Menu tidak ditemukan" });
    res.json({ data: menu });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMenu = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { title, path, icon, order, parentId } = req.body;
    const menu = await prisma.menu.update({
      where: { id },
      data: { title, path, icon, order, parentId },
    });
    res.json({ message: "Menu diperbarui", data: menu });
  } catch (error: any) {
    res
      .status(400)
      .json({ message: "Gagal memperbarui", error: error.message });
  }
};

export const deleteMenu = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    await prisma.menu.delete({ where: { id } });
    res.json({ message: "Menu dihapus" });
  } catch (error: any) {
    res.status(400).json({ message: "Gagal menghapus", error: error.message });
  }
};

// ==========================================
// GET MY MENUS (LOGIC VISIBILITAS READ PADA SIDEBAR)
// ==========================================
export const getMyMenus = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1. Ambil User dengan semua Role, MenuAccess, dan Permission-nya
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                menuAccess: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    const isSuperAdmin = user.roles.some((ur) => ur.role.name === "SUPERADMIN");

    // 2. Buat Map untuk menampung gabungan permission per Menu ID
    // Format: { "menu-uuid-1": Set(["READ", "CREATE"]), "menu-uuid-2": Set(["READ"]) }
    const menuPermissionsMap = new Map<string, Set<string>>();

    user.roles.forEach((ur) => {
      ur.role.menuAccess.forEach((access) => {
        if (!menuPermissionsMap.has(access.menuId)) {
          menuPermissionsMap.set(access.menuId, new Set());
        }
        menuPermissionsMap
          .get(access.menuId)
          ?.add(access.permission.name.toUpperCase());
      });
    });

    // 3. Ambil semua struktur menu dari Database
    const menus = await prisma.menu.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { order: "asc" },
          include: { children: true }, // Support hingga beberapa level jika diperlukan
        },
      },
      orderBy: { order: "asc" },
    });

    // 4. Fungsi Rekursif untuk Filter Menu dan Menempelkan Permissions
    const processMenus = (menuList: any[]): any[] => {
      return menuList
        .map((menu) => {
          // Ambil permission dari Map, jika SuperAdmin berikan semua akses standar
          let myPermissions: string[] = [];

          if (isSuperAdmin) {
            myPermissions = ["READ", "CREATE", "UPDATE", "DELETE"];
          } else {
            const permsSet = menuPermissionsMap.get(menu.id);
            myPermissions = permsSet ? Array.from(permsSet) : [];
          }

          // Proses anak menu terlebih dahulu (bottom-up check)
          const children =
            menu.children && menu.children.length > 0
              ? processMenus(menu.children)
              : [];

          // Logika visibilitas:
          // Menu muncul jika: User punya akses "READ", ATAU menu tersebut punya anak (submenu) yang bisa diakses
          const hasReadAccess =
            myPermissions.includes("VISIBILITY") || myPermissions.includes("V");
          const isVisible =
            isSuperAdmin || hasReadAccess || children.length > 0;

          if (!isVisible) return null;

          return {
            id: menu.id,
            title: menu.title,
            path: menu.path,
            icon: menu.icon,
            order: menu.order,
            parentId: menu.parentId,
            permissions: myPermissions, // Menempelkan list akses (e.g. ["READ", "CREATE"])
            children: children,
          };
        })
        .filter((m) => m !== null); // Hapus menu yang tidak boleh diakses
    };

    const finalMenuStructure = processMenus(menus);

    res.json({
      success: true,
      data: finalMenuStructure,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
