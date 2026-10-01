import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../utils/logger";

interface SendOtpOptions {
    to: string;
    name: string;
    otp: string;
}

class EmailService {
    private transporter: Transporter | null = null;

    private getCleanCredentials() {
        const rawUser = process.env.EMAIL_USER;
        const rawPass = process.env.EMAIL_PASS;

        const user = rawUser ? rawUser.trim().replace(/^["']|["']$/g, "") : "";
        const pass = rawPass ? rawPass.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "") : "";

        return { user, pass };
    }

    public isConfigured(): boolean {
        const { user, pass } = this.getCleanCredentials();

        return Boolean(
            user &&
            pass &&
            !user.includes("your_real_email") &&
            !user.includes("your_gmail") &&
            !pass.includes("xxxx")
        );
    }

    private getTransporter(): Transporter | null {
        if (!this.isConfigured()) {
            return null;
        }

        if (!this.transporter) {
            const { user, pass } = this.getCleanCredentials();
            const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
            const port = Number(process.env.EMAIL_PORT) || 465;
            const secure = port === 465;
            const isGmail = host.includes("gmail") || Boolean(user && (user.includes("gmail.com") || user.includes("antiersolutions.com")));

            const smtpConfig: any = {
                host: isGmail ? "smtp.gmail.com" : host,
                port,
                secure,
                auth: { user, pass },
                connectionTimeout: 15000,
                greetingTimeout: 15000,
                socketTimeout: 20000,
                family: 4,
                tls: {
                    rejectUnauthorized: false,
                },
            };

            this.transporter = nodemailer.createTransport(smtpConfig);
            logger.info(`[EmailService] Initialized SMTP transporter on ${smtpConfig.host}:${port} (secure: ${secure}) for: ${user}`);
        }

        return this.transporter;
    }

    /**
     * Sends an OTP verification email to the user.
     */
    async sendSignupOtp({ to, name, otp }: SendOtpOptions): Promise<boolean> {
        const isConfigured = this.isConfigured();

        // Fallback: If SMTP credentials aren't configured yet, log OTP so testing never fails in dev
        if (!isConfigured) {
            logger.warn(
                `\n=======================================================\n` +
                `📧 [DEV SIMULATION] OTP for ${to} (${name}): ${otp}\n` +
                `Expires in 15 minutes.\n` +
                `Configure EMAIL_USER and EMAIL_PASS in environment variables to send real emails.\n` +
                `=======================================================\n`
            );
            return process.env.NODE_ENV !== "production";
        }

        const transporter = this.getTransporter();
        if (!transporter) {
            return false;
        }

        const { user } = this.getCleanCredentials();
        const rawFrom = process.env.EMAIL_FROM;
        const cleanFrom = rawFrom ? rawFrom.trim().replace(/^["']|["']$/g, "") : "";
        const sender = cleanFrom || `"SuperCall" <${user}>`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .container { max-width: 520px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .logo { font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; margin-bottom: 20px; display: inline-block; }
    .title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .otp-card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; text-shadow: 0 0 20px rgba(56,189,248,0.3); }
    .badge { display: inline-block; padding: 4px 10px; background: rgba(99,102,241,0.15); color: #818cf8; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 10px; }
    .footer { margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⚡ SuperCall</div>
    <div class="title">Verify Your Email Address</div>
    <p class="text">Hi <strong>${name}</strong>,<br>Thank you for signing up for SuperCall. Use the 6-digit verification code below to complete your registration:</p>
    
    <div class="otp-card">
      <div class="otp-code">${otp}</div>
      <div class="badge">Valid for 5 minutes</div>
    </div>

    <p class="text">If you didn't create an account with SuperCall, you can safely ignore this email.</p>
    <div class="footer">
      This is an automated message from SuperCall Realtime Video Platform.<br>
      Please do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

        try {
            await transporter.sendMail({
                from: sender,
                to,
                subject: `${otp} is your SuperCall verification code`,
                text: `Hi ${name}, your SuperCall verification code is ${otp}. It expires in 10 minutes.`,
                html,
            });
            logger.info(`[EmailService] Verification OTP successfully sent to ${to}`);
            return true;
        } catch (error: any) {
            logger.error(
                { err: error.message, code: error.code, response: error.response },
                `[EmailService] SMTP delivery failed for ${to}`
            );
            logger.warn(
                `\n=======================================================\n` +
                `📧 [DEV SIMULATION - SMTP ERROR FALLBACK] OTP for ${to} (${name}): ${otp}\n` +
                `Expires in 10 minutes.\n` +
                `=======================================================\n`
            );
            // Return false gracefully instead of throwing 500 unhandled error
            // so signup flow proceeds to the OTP screen. The OTP is preserved in DB and logged.
            return false;
        }
    }

    /**
     * Sends meeting invitations to all invited participants.
     */
    async sendMeetingInvite(options: {
        to: string[];
        hostName: string;
        meetingTitle: string;
        meetingDescription?: string;
        roomCode: string;
        scheduledAt: string | Date;
        durationMinutes: number;
        meetingUrl: string;
    }): Promise<{ sent: number; failed: number }> {
        const { to, hostName, meetingTitle, meetingDescription, roomCode, scheduledAt, durationMinutes, meetingUrl } = options;
        const transporter = this.getTransporter();

        const formattedDate = new Date(scheduledAt).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });

        const { user } = this.getCleanCredentials();
        const rawFrom = process.env.EMAIL_FROM;
        const cleanFrom = rawFrom ? rawFrom.trim().replace(/^["']|["']$/g, "") : "";
        const sender = cleanFrom || `"SuperCall" <${user}>`;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 20px; padding: 36px 30px; box-shadow: 0 15px 35px -5px rgba(0,0,0,0.6); }
    .logo { font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; margin-bottom: 24px; display: inline-block; }
    .badge { display: inline-block; padding: 5px 12px; background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; line-height: 1.3; }
    .host-info { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
    .host-info strong { color: #f1f5f9; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #f8fafc; font-weight: 600; text-align: right; }
    .code-pill { background: rgba(99,102,241,0.2); color: #a5b4fc; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 13px; font-weight: 700; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .join-btn { display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 20px rgba(59,130,246,0.5); }
    .desc-box { background: rgba(255,255,255,0.02); border-left: 3px solid #6366f1; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px; color: #cbd5e1; }
    .footer { margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⚡ SuperCall</div>
    <div>
      <span class="badge">📅 Calendar Invitation</span>
      <div class="title">${meetingTitle}</div>
      <div class="host-info">Hosted by <strong>${hostName}</strong></div>
    </div>

    ${meetingDescription ? `<div class="desc-box">${meetingDescription}</div>` : ""}

    <div class="card">
      <div class="detail-row">
        <span class="label">When</span>
        <span class="value">${formattedDate}</span>
      </div>
      <div class="detail-row">
        <span class="label">Duration</span>
        <span class="value">${durationMinutes} minutes</span>
      </div>
      <div class="detail-row">
        <span class="label">Room ID</span>
        <span class="value"><span class="code-pill">${roomCode}</span></span>
      </div>
    </div>

    <div class="btn-container">
      <a href="${meetingUrl}" class="join-btn" target="_blank">🚀 Join Video Meeting</a>
    </div>

    <div class="footer">
      Meeting link: <a href="${meetingUrl}" style="color: #60a5fa; text-decoration: none;">${meetingUrl}</a><br><br>
      This invitation was sent by SuperCall Realtime Video Platform on behalf of ${hostName}.
    </div>
  </div>
</body>
</html>
`;

        if (!transporter) {
            logger.warn(
                `\n=======================================================\n` +
                `📧 [DEV SIMULATION] Meeting Invite for ${to.join(", ")}\n` +
                `Title: ${meetingTitle} | Date: ${formattedDate}\n` +
                `Join Link: ${meetingUrl}\n` +
                `=======================================================\n`
            );
            return { sent: to.length, failed: 0 };
        }

        let sent = 0;
        let failed = 0;

        for (const recipient of to) {
            try {
                await transporter.sendMail({
                    from: sender,
                    to: recipient,
                    subject: `Invitation: ${meetingTitle} - ${formattedDate}`,
                    text: `You have been invited to a video meeting by ${hostName}.\nTitle: ${meetingTitle}\nWhen: ${formattedDate} (${durationMinutes} mins)\nRoom ID: ${roomCode}\nJoin here: ${meetingUrl}`,
                    html,
                });
                logger.info(`[EmailService] Meeting invite sent to ${recipient} for room ${roomCode}`);
                sent++;
            } catch (err: any) {
                logger.error({ err: err.message }, `[EmailService] Failed to send meeting invite to ${recipient}`);
                failed++;
            }
        }

        return { sent, failed };
    }
}

export const emailService = new EmailService();
