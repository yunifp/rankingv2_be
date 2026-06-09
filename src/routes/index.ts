import { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import roleRoutes from "./role.routes";
import permissionRoutes from "./permissions.routes";
import menuRoutes from "./menu.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/menus", menuRoutes);

export default router;
