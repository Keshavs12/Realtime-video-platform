import { Router } from "express";
import { authenticate } from "../auth/auth.middleware";
import {
    createMeeting,
    getMeetings,
    deleteMeeting,
    sendReminders,
} from "./schedule.controller";
import { validate } from "../../middleware/validate";
import { createMeetingSchema } from "./schedule.validator";

const scheduleRouter = Router();

scheduleRouter.use(authenticate);

scheduleRouter.post("/", validate(createMeetingSchema), createMeeting);
scheduleRouter.get("/", getMeetings);
scheduleRouter.delete("/:id", deleteMeeting);
scheduleRouter.post("/:id/reminders", sendReminders);

export default scheduleRouter;
