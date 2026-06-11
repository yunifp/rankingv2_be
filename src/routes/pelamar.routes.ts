import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import { uploadExcel } from "../middlewares/upload.middleware";
import { importExcelPelamar, getPelamarPaginated, deletePelamar, updatePelamar } from "../controllers/pelamar.controller";

const router = Router();
const pathMenu = "/pelamar";

router.post("/import", verifyToken, requirePermission(pathMenu, "CREATE"), uploadExcel.single('file_excel'), importExcelPelamar);
router.get("/", verifyToken, requirePermission(pathMenu, "READ"), getPelamarPaginated);
router.put("/:id", verifyToken, requirePermission(pathMenu, "UPDATE"), updatePelamar);
router.delete("/:id", verifyToken, requirePermission(pathMenu, "DELETE"), deletePelamar);
export default router;