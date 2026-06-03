import { PrismaClient, RoleScope } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Memulai Seeding ---");

  // 0. PEMBERSIHAN DATA (Opsional - Agar tidak terjadi duplikasi menu saat seed ulang)
  await prisma.roleMenuAccess.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.permission.deleteMany({});
  console.log("🧹 Data menu dan akses lama telah dibersihkan.");

  // 1. BUAT MASTER PERMISSIONS (ACTION)
  const permissions = ["READ", "CREATE", "UPDATE", "DELETE", "VISIBILITY"];
  const permissionIds: Record<string, string> = {};

  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { name: p },
      update: {},
      create: { name: p },
    });
    permissionIds[p] = perm.id;
  }
  console.log("✅ Master Permissions berhasil dibuat.");

  const menuSettings = await prisma.menu.create({
    data: {
      title: "Setting",
      path: "",
      icon: "Settings",
      order: 2,
    },
  });

  // --- Sub Menus (Setting) ---
  const subUsers = await prisma.menu.create({
    data: {
      title: "Kelola Pengguna",
      path: "/users",
      parentId: menuSettings.id,
      order: 1,
    },
  });

  const subRole = await prisma.menu.create({
    data: {
      title: "Kelola Role",
      path: "/roles",
      parentId: menuSettings.id,
      order: 2,
    },
  });

  const subPerm = await prisma.menu.create({
    data: {
      title: "Kelola Permission",
      path: "/permissions",
      parentId: menuSettings.id,
      order: 3,
    },
  });

  const subMenus = await prisma.menu.create({
    data: {
      title: "Kelola Menu",
      path: "/menus",
      parentId: menuSettings.id,
      order: 4,
    },
  });

  console.log("✅ Struktur Menu (Parent & Submenu) berhasil dibuat.");

  // 3. BUAT ROLE SUPERADMIN
  const superadminRole = await prisma.role.upsert({
    where: { name: "SUPERADMIN" },
    update: {
      scope: RoleScope.GENERAL,
    },
    create: {
      name: "SUPERADMIN",
      description: "Akses penuh ke seluruh sistem tanpa batasan",
      scope: RoleScope.GENERAL,
    },
  });

  // 4. MAPPING AKSES PENUH (ALL ACCESS)
  const allMenus = [
    menuSettings,
    subUsers,
    subRole,
    subPerm,
    subMenus,
  ];

  console.log("⚙️ Mengonfigurasi hak akses penuh untuk SUPERADMIN...");

  for (const menu of allMenus) {
    for (const pName of permissions) {
      await prisma.roleMenuAccess.upsert({
        where: {
          roleId_menuId_permissionId: {
            roleId: superadminRole.id,
            menuId: menu.id,
            permissionId: permissionIds[pName],
          },
        },
        update: {},
        create: {
          roleId: superadminRole.id,
          menuId: menu.id,
          permissionId: permissionIds[pName],
        },
      });
    }
  }
  console.log(
    "✅ Matriks Akses SUPERADMIN: [READ, CREATE, UPDATE, DELETE] untuk semua menu.",
  );

  // 5. BUAT USER SUPERADMIN PERTAMA
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "superadmin@gmail.com" },
    update: {
      password: hashedPassword,
    },
    create: {
      name: "Superadmin",
      email: "admin@gmail.com",
      password: hashedPassword,
    },
  });

  // 6. HUBUNGKAN USER KE ROLE SUPERADMIN
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superadminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superadminRole.id,
    },
  });

  console.log("✅ Akun login siap: admin@gmail.com / admin123");
  console.log("--- Seeding Selesai Berhasil ---");
}

main()
  .catch((e) => {
    console.error("❌ Error Seeding:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
