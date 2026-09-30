import { Router } from "express";
import authRouter from "../modules/auth/auth.routes";
import roomsRouter from "../modules/rooms/rooms.routes";
import scheduleRouter from "../modules/schedule/schedule.routes";

const router = Router();

router.get("/health", (req, res) => {
    res.status(200).json({ success: true, status: "ok" });
});

router.use("/auth", authRouter);
router.use("/rooms", roomsRouter);
router.use("/schedule", scheduleRouter);

export default router;