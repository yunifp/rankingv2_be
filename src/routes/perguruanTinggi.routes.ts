import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createPT,
  getPTPaginated,
  getPTById,
  updatePT,
  deletePT,
} from "../controllers/perguruanTinggi.controller";

const router = Router();
const pathMenu = "/perguruan-tinggi"; 

router.post("/", verifyToken, requirePermission(pathMenu, "CREATE"), createPT);
router.get("/", verifyToken, requirePermission(pathMenu, "READ"), getPTPaginated);
router.get("/:id", verifyToken, requirePermission(pathMenu, "READ"), getPTById);
router.put("/:id", verifyToken, requirePermission(pathMenu, "UPDATE"), updatePT);
router.delete("/:id", verifyToken, requirePermission(pathMenu, "DELETE"), deletePT);

export default router;