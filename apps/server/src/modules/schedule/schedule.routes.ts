import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
    createMeeting,
    getMeetings,
    deleteMeeting,
    sendReminders,
} from "./schedule.controller";

const scheduleRouter = Router();

scheduleRouter.use(authenticate);

scheduleRouter.post("/", createMeeting);
scheduleRouter.get("/", getMeetings);
scheduleRouter.delete("/:id", deleteMeeting);
scheduleRouter.post("/:id/reminders", sendReminders);

export default scheduleRouter;
