import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createPenghasilan,
  getPenghasilan,
  updatePenghasilan,
  deletePenghasilan,
} from "../controllers/penghasilan.controller";

const router = Router();
const pathMenu = "/penghasilan-ortu";

router.post("/", verifyToken, requirePermission(pathMenu, "CREATE"), createPenghasilan);
router.get("/", verifyToken, requirePermission(pathMenu, "READ"), getPenghasilan);
router.put("/:id", verifyToken, requirePermission(pathMenu, "UPDATE"), updatePenghasilan);
router.delete("/:id", verifyToken, requirePermission(pathMenu, "DELETE"), deletePenghasilan);

export default router;