import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createKriteria,
  getKriteria,
  updateKriteria,
  deleteKriteria,
} from "../controllers/kriteria.controller";

const router = Router();
const pathMenu = "/kriteria";

router.post("/", verifyToken, requirePermission(pathMenu, "CREATE"), createKriteria);
router.get("/", verifyToken, requirePermission(pathMenu, "READ"), getKriteria);
router.put("/:kode", verifyToken, requirePermission(pathMenu, "UPDATE"), updateKriteria);
router.delete("/:kode", verifyToken, requirePermission(pathMenu, "DELETE"), deleteKriteria);

export default router;