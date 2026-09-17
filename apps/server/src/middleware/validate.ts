import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

export const validate =
    (schema: ZodType) =>
    (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
console.log("Validation middleware hit");
console.log(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error.issues[0]?.message ?? "Invalid request data",
            });
        }

        req.body = result.data;
        next();
    };
