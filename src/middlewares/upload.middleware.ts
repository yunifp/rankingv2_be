import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/parpol';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadLogo = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan!'));
  }
});

const storageHeader = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/templates'; // Memisahkan folder untuk header/template
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'header-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadHeader = multer({ 
  storage: storageHeader,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan!'));
  }
});

const storageCalon = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/calon';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'calon-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadFotoCalon = multer({ 
  storage: storageCalon,
  limits: { fileSize: 2 * 1024 * 1024 }
});