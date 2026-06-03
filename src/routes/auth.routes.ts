import { Router } from "express";
import { login, refreshToken, checkToken, forgotPassword, verifyOtp, resetPassword } from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.post("/refresh", refreshToken);
router.get("/check", checkToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);



export default router;