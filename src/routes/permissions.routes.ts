import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createPermission,
  getPermissions,
  getListPermissions,
  deletePermission,
} from "../controllers/permission.controller";

const router = Router();
const pathMenu = "/permissions";

router.post(
  "/",
  verifyToken,
  requirePermission("/permissions", "CREATE"),
  createPermission,
);
router.get(
  "/all",
  verifyToken,
  requirePermission("/permissions", "READ"),
  getListPermissions,
);
router.get(
  "/",
  verifyToken,
  requirePermission("/permissions", "READ"),
  getPermissions,
);
router.delete(
  "/:id",
  verifyToken,
  requirePermission("/permissions", "DELETE"),
  deletePermission,
);

export default router;
