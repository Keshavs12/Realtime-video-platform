/**
 * --------------------------------------------------------------------------
 * Rooms Routes
 * --------------------------------------------------------------------------
 *
 * Maps HTTP routes to room controller methods.
 *
 * Routes:
 * - POST /api/v1/rooms              Create a new room, returns its code
 * - GET  /api/v1/rooms/history      Call history for the current user
 * - GET  /api/v1/rooms/stats        Dashboard stats for the current user
 * - GET  /api/v1/rooms/:code/exists Check whether a room code exists
 * --------------------------------------------------------------------------
 */
import { Router } from "express";
import { createRoom, checkRoomExists, getRoomHistory, getDashboardStats } from "./rooms.controller";
import { authenticate } from "../auth/auth.middleware";

const roomsRouter = Router();

roomsRouter.use(authenticate);

roomsRouter.post("/", createRoom);
roomsRouter.get("/history", getRoomHistory);
roomsRouter.get("/stats", getDashboardStats);
roomsRouter.get("/:code/exists", checkRoomExists);

export default roomsRouter;
