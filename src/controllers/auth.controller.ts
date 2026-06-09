import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { transporter } from "../utils/mailer";

const prisma = new PrismaClient();

// Secret Keys
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "rahasia-negara";
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "rahasia-negara-refresh";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
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
      return res.status(401).json({ message: "Email atau Password salah." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Email atau Password salah." });
    }

    // Payload untuk token (BERSIH DARI WILAYAH)
    const tokenPayload = {
      id: user.id,
      email: user.email,
      roles: user.roles.map((ur: any) => ur.role.name),
    };

    const token = jwt.sign(tokenPayload, ACCESS_TOKEN_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(tokenPayload, REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
    });

    const menuMap = new Map<string, any>();

    user.roles.forEach((ur) => {
      ur.role.menuAccess.forEach((access) => {
        const menu = access.menu;
        const permissionName = access.permission.name;

        if (!menuMap.has(menu.id)) {
          menuMap.set(menu.id, {
            id: menu.id,
            title: menu.title,
            path: menu.path,
            icon: menu.icon,
            order: menu.order,
            parentId: menu.parentId,
            permissions: new Set<string>(),
          });
        }
        menuMap.get(menu.id).permissions.add(permissionName);
      });
    });

    const accessibleMenus = Array.from(menuMap.values())
      .map((menu) => ({
        ...menu,
        permissions: Array.from(menu.permissions),
      }))
      .sort((a, b) => a.order - b.order);

    // Object User yang dikirim ke Frontend (BERSIH DARI WILAYAH & SCOPE)
    const userDataResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.map((ur) => ({
        name: ur.role.name,
      })),
      menus: accessibleMenus,
    };

    res.json({
      message: "Login Berhasil",
      token,
      refreshToken,
      user: userDataResponse,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Terjadi kesalahan server", error: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token tidak disediakan." });
  }

  try {
    const decoded: any = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        roles: decoded.roles,
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    res.json({ token: newAccessToken });
  } catch (error: any) {
    res.status(403).json({
      message:
        "Refresh token tidak valid atau sudah kedaluwarsa. Silakan login kembali.",
    });
  }
};

export const checkToken = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      valid: false,
      message: "Token tidak disediakan atau format salah.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, ACCESS_TOKEN_SECRET);
    res.json({ valid: true, message: "Token masih aktif." });
  } catch (error: any) {
    res
      .status(401)
      .json({ valid: false, message: "Token kedaluwarsa atau tidak valid." });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email wajib diisi." });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: "Jika email terdaftar, kode OTP telah dikirim." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.otpLog.create({
      data: { email, otp, expiresAt, isUsed: false },
    });

    const mailOptions = {
      from: process.env.SMTP_EMAIL || "admin@sistem.com",
      to: email,
      subject: "Kode OTP Reset Password - SI-P3D",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Reset Password Anda</h2>
          <p>Halo ${user.name},</p>
          <p>Kami menerima permintaan untuk mereset password akun Anda. Berikut adalah kode OTP Anda:</p>
          <h1 style="color: #1e3a8a; letter-spacing: 5px; padding: 10px; background: #f1f5f9; display: inline-block; border-radius: 8px;">${otp}</h1>
          <p>Kode ini hanya berlaku selama 15 menit. Jangan berikan kode ini kepada siapapun.</p>
          <p>Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Jika email terdaftar, kode OTP telah dikirim." });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal memproses permintaan", error: error.message });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await prisma.otpLog.findFirst({
      where: {
        email,
        otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "OTP tidak valid atau sudah kedaluwarsa." });
    }

    res.json({ success: true, message: "OTP Valid. Silakan masukkan password baru." });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal memverifikasi OTP", error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, dan Password baru wajib diisi." });
    }

    const otpRecord = await prisma.otpLog.findFirst({
      where: {
        email,
        otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "OTP tidak valid atau sudah kedaluwarsa." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      }),
      prisma.otpLog.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      }),
    ]);

    res.json({ success: true, message: "Password berhasil diubah. Silakan login." });
  } catch (error: any) {
    res.status(500).json({ message: "Gagal mereset password", error: error.message });
  }
};