import { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import roleRoutes from "./role.routes";
import permissionRoutes from "./permissions.routes";
import menuRoutes from "./menu.routes";
import ptRoutes from "./perguruanTinggi.routes";
import prodiRoutes from "./programStudi.routes";
import penghasilanRoutes from "./penghasilan.routes";
import kriteriaRoutes from "./kriteria.routes";
import pelamarRoutes from "./pelamar.routes";
// 1. Tambahkan import ranking routes
import rankingRoutes from "./ranking.routes"; 

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);
router.use("/menus", menuRoutes);
router.use("/perguruan-tinggi", ptRoutes);
router.use("/program-studi", prodiRoutes);
router.use("/kriteria", kriteriaRoutes);
router.use("/penghasilan-ortu", penghasilanRoutes);
router.use("/pelamar", pelamarRoutes);  
// 2. Daftarkan path ranking
router.use("/ranking", rankingRoutes);

export default router;