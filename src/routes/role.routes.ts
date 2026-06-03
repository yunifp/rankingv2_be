import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createRole,
  getRolesPaginated,
  getRolesAll,
  updateRole,
  deleteRole,
  updateRoleAccess,
} from "../controllers/role.controller";

const router = Router();
const pathMenu = "/roles";

router.post(
  "/",
  verifyToken,
  requirePermission(pathMenu, "CREATE"),
  createRole,
);

// Route untuk get dengan Paginasi
router.get(
  "/",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getRolesPaginated,
);

// Route untuk get ALL tanpa Paginasi (contoh: untuk dropdown filter)
router.get(
  "/all",
  verifyToken,
  requirePermission(pathMenu, "READ"),
  getRolesAll,
);

router.put(
  "/:id",
  verifyToken,
  requirePermission(pathMenu, "UPDATE"),
  updateRole,
);

router.delete(
  "/:id",
  verifyToken,
  requirePermission(pathMenu, "DELETE"),
  deleteRole,
);

router.put(
  "/:id/access",
  verifyToken,
  requirePermission(pathMenu, "UPDATE"),
  updateRoleAccess,
);

export default router;
