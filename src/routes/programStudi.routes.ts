import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createProdi,
  getProdiPaginated,
  getProdiById,
  updateProdi,
  deleteProdi,
} from "../controllers/programStudi.controller";

const router = Router();
const pathMenu = "/program-studi"; // Pastikan path ini terdaftar di tabel Menu

router.post("/", verifyToken, requirePermission(pathMenu, "CREATE"), createProdi);
router.get("/", verifyToken, requirePermission(pathMenu, "READ"), getProdiPaginated);
router.get("/:id", verifyToken, requirePermission(pathMenu, "READ"), getProdiById);
router.put("/:id", verifyToken, requirePermission(pathMenu, "UPDATE"), updateProdi);
router.delete("/:id", verifyToken, requirePermission(pathMenu, "DELETE"), deleteProdi);

export default router;