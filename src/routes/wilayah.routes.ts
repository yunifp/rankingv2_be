import { Router } from "express";
import {
  getAllProvinsi,
  getAllKabupaten,
  getAllKecamatan,
  getAllKelurahan,
  getKabupatenByProvinsi,
  getKecamatanByKabupaten,
  getKelurahanByKecamatan,
  createWilayah,
  updateWilayah,
  deleteWilayah,
} from "../controllers/wilayah.controller";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";

const router = Router();
const pathMenu = "/wilayah";

router.get(
  "/all/provinsi",
  verifyToken,
  getAllProvinsi,
);

router.get(
  "/all/kabupaten",
  verifyToken,
  getAllKabupaten,
);
router.get(
  "/all/kecamatan",
  verifyToken,
  getAllKecamatan,
);
router.get(
  "/all/kelurahan",
  verifyToken,
  getAllKelurahan,
);

router.get(
  "/all/kabupaten/:kode_pro",
  verifyToken,
  getKabupatenByProvinsi,
);
router.get(
  "/all/kecamatan/:kode_kab",
  verifyToken,
  getKecamatanByKabupaten,
);
router.get(
  "/all/kelurahan/:kode_kec",
  verifyToken,
  getKelurahanByKecamatan,
);




router.get(
  "/provinsi",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getAllProvinsi,
);
router.get(
  "/kabupaten",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getAllKabupaten,
);
router.get(
  "/kecamatan",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getAllKecamatan,
);
router.get(
  "/kelurahan",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getAllKelurahan,
);

router.get(
  "/kabupaten/:kode_pro",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getKabupatenByProvinsi,
);
router.get(
  "/kecamatan/:kode_kab",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getKecamatanByKabupaten,
);
router.get(
  "/kelurahan/:kode_kec",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getKelurahanByKecamatan,
);

router.post(
  "/",
  verifyToken,
  requirePermission(pathMenu, "CREATE"),
  createWilayah,
);
router.put(
  "/:id",
  verifyToken,
  requirePermission(pathMenu, "UPDATE"),
  updateWilayah,
);
router.delete(
  "/:id",
  verifyToken,
  requirePermission(pathMenu, "DELETE"),
  deleteWilayah,
);

export default router;
