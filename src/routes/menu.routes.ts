import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createMenu,
  getMenus,
  getListMenus,
  getMenuById,
  updateMenu,
  deleteMenu,
  getMyMenus,
} from "../controllers/menu.controller";

const router = Router();
const pathMenu = "/menus";

router.get("/my-menus", verifyToken, getMyMenus);
router.post(
  "/",
  verifyToken,
  requirePermission("/menus", "CREATE"),
  createMenu,
);
router.get(
  "/all",
  verifyToken,
  requirePermission("/menus", "READ"),
  getListMenus,
);
router.get(
  "/",
  verifyToken,
  requirePermission("/menus", "READ"),
  getMenus,
);
router.get(
  "/:id",
  verifyToken,
  requirePermission("/menus", "READ"),
  getMenuById,
);
router.put(
  "/:id",
  verifyToken,
  requirePermission("/menus", "UPDATE"),
  updateMenu,
);
router.delete(
  "/:id",
  verifyToken,
  requirePermission("/menus", "DELETE"),
  deleteMenu,
);


export default router;