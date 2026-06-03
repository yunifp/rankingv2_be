import { Router } from "express";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware";
import {
  createUser,
  getUsers,
  getProfile,
  updateProfile,
  updateUser,
  deleteUser,
  requestEmailOtp
} from "../controllers/user.controller";

const router = Router();
const pathMenu = "/users";


router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.post("/request-email-otp", verifyToken, requestEmailOtp);

router.post(
  "/",
  verifyToken,
  requirePermission("/users", "CREATE"),
  createUser,
);
router.get("/", verifyToken, requirePermission("/users", "READ"), getUsers);
router.put(
  "/:id",
  verifyToken,
  requirePermission("/users", "UPDATE"),
  updateUser,
);

router.delete(
  "/:id",
  verifyToken,
  requirePermission("/users", "DELETE"),
  deleteUser,
);



export default router;
