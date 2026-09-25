import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
};

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
) => {
    if (err instanceof AppError) {
        logger.warn({ path: req.path, message: err.message }, "Handled request error");
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    logger.error({ path: req.path, err }, "Unhandled error");
    return res.status(500).json({
        success: false,
        message: "Something went wrong.",
    });
};
