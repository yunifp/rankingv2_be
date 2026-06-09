import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { transporter } from "../utils/mailer";

const prisma = new PrismaClient();
const SUPERADMIN_ROLE_ID = "d85d5209-18d7-47d7-bf86-38b1545997df";

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

export const createUser = async (req: any, res: Response) => {
  try {
    // BERSIH DARI WILAYAH
    const { name, email, password, roleIds } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email sudah terdaftar. Silakan gunakan email lain.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: {
          create: roleIds.map((id: string) => ({ roleId: id })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: { include: { role: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: "User berhasil didaftarkan",
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: "Gagal membuat user",
      error: error.message,
    });
  }
};

export const getUsers = async (req: any, res: Response) => {
  try {
    const isRequesterSuperAdmin = checkIsSuperAdmin(req);
    const { skip, take, pageNumber, limitNumber } = getPagination(
      req.query.page as string,
      req.query.limit as string,
    );

    const whereCondition: any = {};

    if (!isRequesterSuperAdmin) {
      whereCondition.roles = {
        none: { roleId: SUPERADMIN_ROLE_ID },
      };
    }

    const [users, totalItems] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          roles: { include: { role: true } }, // BERSIH DARI SELECT WILAYAH
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    res.json({
      success: true,
      data: users,
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

export const updateUser = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;
    // BERSIH DARI WILAYAH
    const { name, email, roleIds } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }

    if (email !== targetUser.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email sudah digunakan oleh pengguna lain. Silakan gunakan email lain.",
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      return await tx.user.update({
        where: { id },
        data: {
          name,
          email,
          roles: {
            create: roleIds.map((roleId: string) => ({ roleId })),
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          roles: { include: { role: true } },
        },
      });
    });

    res.json({
      success: true,
      message: "Data pengguna berhasil diperbarui",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: "Gagal memperbarui pengguna",
      error: error.message,
    });
  }
};

export const deleteUser = async (req: any, res: Response) => {
  try {
    const id = req.params.id as string;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Akses ditolak." });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "rahasia-negara");
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        roles: {
          include: { role: { select: { id: true, name: true } } }, // BERSIH DARI SCOPE
        },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: "Data profil tidak ditemukan." });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal mengambil profil.", error: error.message });
  }
};

export const requestEmailOtp = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Akses ditolak." });

    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success: false, message: "Email baru wajib diisi." });

    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) return res.status(400).json({ success: false, message: "Email sudah digunakan." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.otpLog.create({
      data: { email: newEmail, otp, expiresAt, isUsed: false },
    });

    const mailOptions = {
      from: process.env.SMTP_USER || "admin@sistem.com",
      to: newEmail,
      subject: "Verifikasi Perubahan Email - SI-P3D",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Verifikasi Email Baru</h2>
          <p>Kami menerima permintaan untuk mengubah alamat email akun Anda ke email ini.</p>
          <p>Masukkan kode OTP berikut untuk memverifikasi perubahan:</p>
          <h1 style="color: #1e3a8a; letter-spacing: 5px; padding: 10px; background: #f1f5f9; display: inline-block; border-radius: 8px;">${otp}</h1>
          <p>Kode ini hanya berlaku selama 15 menit.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP berhasil dikirim ke email baru." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal mengirim OTP.", error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Akses ditolak." });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "rahasia-negara");
    const { name, email, oldPassword, newPassword, confirmPassword, otp } = req.body;

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(404).json({ success: false, message: "User tidak ditemukan." });

    const updateData: any = {};

    if (name && name.trim() !== "") updateData.name = name;

    if (email && email !== user.email) {
      if (!otp) return res.status(400).json({ success: false, message: "Kode OTP wajib diisi." });

      const otpRecord = await prisma.otpLog.findFirst({
        where: { email, otp, isUsed: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });

      if (!otpRecord) return res.status(400).json({ success: false, message: "OTP tidak valid atau kedaluwarsa." });

      await prisma.otpLog.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });
      updateData.email = email;
    }

    if (oldPassword || newPassword || confirmPassword) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: "Isi semua kolom password." });
      }
      if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "Konfirmasi password tidak cocok." });
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) return res.status(400).json({ success: false, message: "Password lama salah." });

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true, // BERSIH DARI SELECT WILAYAH
      },
    });

    res.json({
      success: true,
      message: "Profil berhasil diperbarui.",
      data: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Gagal memperbarui profil.", error: error.message });
  }
};