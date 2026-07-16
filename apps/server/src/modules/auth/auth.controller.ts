/**
 * --------------------------------------------------------------------------
 * Auth Controller
 * --------------------------------------------------------------------------
 *
 * The controller acts as the bridge between incoming HTTP requests
 * and the authentication service.
 *
 * Responsibilities:
 * - Receive HTTP requests.
 * - Extract request data.
 * - Call the appropriate service methods.
 * - Return HTTP responses.
 * - Handle request/response flow.
 *
 * Note:
 * Do NOT write businesauthRouter.post("/login", login);
s logic here.
 * Keep the controller lightweight.
 * --------------------------------------------------------------------------
 */

/**
 * --------------------------------------------------------------------------
 * Auth Controller
 * --------------------------------------------------------------------------
 *
 * Handles incoming authentication requests.
 * Receives request data, calls the service,
 * and returns the HTTP response.
 */

import { Request, Response } from "express";
import * as authService from "./auth.service";

export const signup = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = await authService.signup(req.body);
        console.log(user, 'user')
        res.status(201).json({
            success: true,
            message: "User registered successfully.",
            data: user,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error instanceof Error ? error.message : "Something went wrong",
        });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const user = await authService.login(email, password);

        res.status(200).json({
            success: true,
            message: "User logged in successfully.",
            data: user,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error instanceof Error ? error.message : "Something went wrong",
        });
    }
};          