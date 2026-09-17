/**
 * --------------------------------------------------------------------------
 * Rooms Controller
 * --------------------------------------------------------------------------
 *
 * Handles incoming room requests. Extracts request data, calls the rooms
 * service, and returns the HTTP response.
 * --------------------------------------------------------------------------
 */
import * as roomsService from "./rooms.service";
import { asyncHandler } from "../../utils/asyncHandler";

export const createRoom = asyncHandler(async (req, res) => {
    const room = await roomsService.createRoom(req.user!.userId);

    res.status(201).json({
        success: true,
        message: "Room created successfully.",
        data: room,
    });
});

export const checkRoomExists = asyncHandler(async (req, res) => {
    const room = await roomsService.checkRoomExists(String(req.params.code));

    res.status(200).json({
        success: true,
        data: room,
    });
});

export const getRoomHistory = asyncHandler(async (req, res) => {
    const history = await roomsService.getRoomHistory(req.user!.userId);

    res.status(200).json({
        success: true,
        data: history,
    });
});

export const getDashboardStats = asyncHandler(async (req, res) => {
    const stats = await roomsService.getDashboardStats(req.user!.userId);

    res.status(200).json({
        success: true,
        data: stats,
    });
});
