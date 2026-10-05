import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../utils/logger";

interface SendOtpOptions {
    to: string;
    name: string;
    otp: string;
}

const sanitizeLog = (val: string): string => val.replace(/[\r\n\t]/g, "");

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/;

class EmailService {
    private transporter: Transporter | null = null;
    private lastErrorMessage: string | null = null;

    public getLastError(): string | null {
        return this.lastErrorMessage;
    }

    private getCleanCredentials() {
        const rawUser = process.env.EMAIL_USER;
        const rawPass = process.env.EMAIL_PASS;

        let user = "";
        if (rawUser) {
            // Extract pure email address even if user entered `"SuperCall" <keshav.sharma@antiersolutions.com>`
            const openAngle = rawUser.indexOf("<");
            const closeAngle = rawUser.indexOf(">", openAngle);
            const angleEmail = openAngle !== -1 && closeAngle > openAngle ? rawUser.slice(openAngle + 1, closeAngle).trim() : null;
            const emailMatch = EMAIL_REGEX.exec(rawUser);
            user = (angleEmail || (emailMatch ? emailMatch[0] : rawUser))
                .trim()
                .replace(/^["']|["']$/g, "");
        }

        const pass = rawPass ? rawPass.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "") : "";

        return { user, pass };
    }

    public isConfigured(): boolean {
        if (process.env.BREVO_API_KEY?.trim() || process.env.GMAIL_RELAY_URL?.trim() || process.env.RESEND_API_KEY?.trim()) {
            return true;
        }
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
        const { user, pass } = this.getCleanCredentials();
        if (!user || !pass) {
            return null;
        }

        if (!this.transporter) {
            const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
            const rawPort = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : null;
            // On cloud platforms (Render, AWS, DigitalOcean), port 587 is much more reliable than 465 (which is often blocked)
            const port = rawPort || 587;
            const secure = port === 465;
            const isGmail = host.includes("gmail") || Boolean(user && (user.includes("gmail.com") || user.includes("antiersolutions.com")));

            const smtpConfig: any = {
                host: isGmail ? "smtp.gmail.com" : host,
                port,
                secure,
                auth: { user, pass },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
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

    private buildOtpEmailHtml(name: string, otp: string): string {
        return `
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
    }

    private async sendOtpViaBrevo(to: string, name: string, otp: string, html: string, defaultUser: string): Promise<boolean> {
        const brevoApiKey = process.env.BREVO_API_KEY?.trim();
        if (!brevoApiKey) return false;

        try {
            const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || defaultUser || "support@supercall.com";
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": brevoApiKey,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    sender: { name: "SuperCall", email: brevoSenderEmail },
                    to: [{ email: to, name }],
                    subject: `${otp} is your SuperCall verification code`,
                    htmlContent: html,
                }),
            });

            if (response.ok) {
                logger.info(`[EmailService] Verification OTP successfully sent via Brevo API to ${to}`);
                return true;
            }
            const errBody = await response.text();
            logger.error({ err: errBody }, `[EmailService] Brevo API delivery failed for ${to}`);
            this.lastErrorMessage = `Brevo delivery failed: ${errBody}`;
            return false;
        } catch (err: any) {
            logger.error({ err: err.message }, `[EmailService] Brevo API request error for ${to}`);
            this.lastErrorMessage = `Brevo request error: ${err.message}`;
            return false;
        }
    }

    private async sendOtpViaGmailRelay(to: string, name: string, otp: string, html: string): Promise<boolean> {
        const gmailRelayUrl = process.env.GMAIL_RELAY_URL?.trim();
        if (!gmailRelayUrl) return false;

        const safeTo = sanitizeLog(to);
        try {
            const payload = JSON.stringify({
                to,
                subject: `${otp} is your SuperCall verification code`,
                text: `Hi ${name}, your SuperCall verification code is ${otp}. It expires in 10 minutes.`,
                html,
            });

            const initialResponse = await fetch(gmailRelayUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                redirect: "manual",
            });

            const isRedirect = initialResponse.status >= 300 && initialResponse.status < 400;
            const redirectUrl = isRedirect ? initialResponse.headers.get("location") : null;
            if (isRedirect && !redirectUrl) {
                throw new Error("Gmail Relay returned redirect but no Location header");
            }

            const finalResponse = redirectUrl
                ? await fetch(redirectUrl, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: payload,
                      redirect: "follow",
                  })
                : initialResponse;

            if (finalResponse.ok) {
                const respText = sanitizeLog(await finalResponse.text());
                logger.info(`[EmailService] Verification OTP successfully sent via Gmail Relay to ${safeTo}. Response: ${respText}`);
                return true;
            }
            const errBody = await finalResponse.text();
            logger.error({ err: errBody }, `[EmailService] Gmail Relay delivery failed for ${safeTo}`);
            this.lastErrorMessage = `Gmail Relay failed: ${errBody}`;
            return false;
        } catch (err: any) {
            logger.error({ err: err.message }, `[EmailService] Gmail Relay request error for ${safeTo}`);
            this.lastErrorMessage = `Gmail Relay error: ${err.message}`;
            return false;
        }
    }

    private parseErrorMessage(rawError: string): string {
        try {
            const parsed = JSON.parse(rawError);
            return parsed.message || rawError;
        } catch {
            return rawError;
        }
    }

    private async sendOtpViaResend(to: string, otp: string, html: string): Promise<boolean> {
        const resendApiKey = process.env.RESEND_API_KEY?.trim();
        if (!resendApiKey) return false;

        try {
            const resendFrom = process.env.RESEND_FROM?.trim() || "SuperCall <onboarding@resend.dev>";
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: resendFrom,
                    to: [to],
                    subject: `${otp} is your SuperCall verification code`,
                    html,
                }),
            });

            if (response.ok) {
                logger.info(`[EmailService] Verification OTP successfully sent via Resend API to ${to}`);
                return true;
            }
            const errBody = await response.text();
            logger.error({ err: errBody }, `[EmailService] Resend API delivery failed for ${to}`);
            if (!this.lastErrorMessage) {
                this.lastErrorMessage = this.parseErrorMessage(errBody);
            }
            return false;
        } catch (err: any) {
            logger.error({ err: err.message }, `[EmailService] Resend API request error for ${to}`);
            this.lastErrorMessage = `Resend error: ${err.message}`;
            return false;
        }
    }

    private async sendOtpViaSmtp(to: string, name: string, otp: string, html: string, sender: string): Promise<boolean> {
        const transporter = this.getTransporter();
        if (!transporter) return false;

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
            if (!this.lastErrorMessage) {
                this.lastErrorMessage = error.message || "SMTP connection failed";
            }
            logger.warn(
                `\n=======================================================\n` +
                `📧 [RENDER CLOUD SMTP NOTICE] OTP for ${to} (${name}): ${otp}\n` +
                `Render Free Tier blocks outbound SMTP ports 25, 465, and 587.\n` +
                `To send real emails on Render, add RESEND_API_KEY or BREVO_API_KEY to Render Environment Variables.\n` +
                `Expires in 10 minutes.\n` +
                `=======================================================\n`
            );
            return false;
        }
    }

    /**
     * Sends an OTP verification email to the user.
     */
    async sendSignupOtp({ to, name, otp }: SendOtpOptions): Promise<boolean> {
        this.lastErrorMessage = null;
        const { user } = this.getCleanCredentials();
        const rawFrom = process.env.EMAIL_FROM;
        const cleanFrom = rawFrom ? rawFrom.trim().replace(/^["']|["']$/g, "") : "";
        const sender = cleanFrom || `"SuperCall" <${user || "support@supercall.com"}>`;
        const html = this.buildOtpEmailHtml(name, otp);

        if (await this.sendOtpViaBrevo(to, name, otp, html, user)) return true;
        if (await this.sendOtpViaGmailRelay(to, name, otp, html)) return true;
        if (await this.sendOtpViaResend(to, otp, html)) return true;
        if (await this.sendOtpViaSmtp(to, name, otp, html, sender)) return true;

        // Fallback when neither Resend, Brevo, nor SMTP is configured
        this.lastErrorMessage = "No email provider configured (configure BREVO_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS).";
        logger.warn(
            `\n=======================================================\n` +
            `📧 [DEV SIMULATION] OTP for ${to} (${name}): ${otp}\n` +
            `Expires in 15 minutes.\n` +
            `Configure BREVO_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS to send real emails.\n` +
            `=======================================================\n`
        );
        return false;
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

        const brevoApiKey = process.env.BREVO_API_KEY?.trim();
        if (brevoApiKey) {
            let sent = 0;
            let failed = 0;
            const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || user || "support@supercall.com";
            await Promise.all(
                to.map(async (recipient) => {
                    try {
                        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                            method: "POST",
                            headers: {
                                "api-key": brevoApiKey,
                                "Content-Type": "application/json",
                                "Accept": "application/json",
                            },
                            body: JSON.stringify({
                                sender: { name: "SuperCall", email: brevoSenderEmail },
                                to: [{ email: recipient }],
                                subject: `Invitation: ${meetingTitle} - ${formattedDate}`,
                                htmlContent: html,
                            }),
                        });
                        if (response.ok) sent++;
                        else failed++;
                    } catch {
                        failed++;
                    }
                })
            );
            return { sent, failed };
        }

        const gmailRelayUrl = process.env.GMAIL_RELAY_URL?.trim();
        if (gmailRelayUrl) {
            let sent = 0;
            let failed = 0;
            await Promise.all(
                to.map(async (recipient) => {
                    try {
                        const payload = JSON.stringify({
                            to: recipient,
                            subject: `Invitation: ${meetingTitle} - ${formattedDate}`,
                            text: `You have been invited to a video meeting by ${hostName}.\nTitle: ${meetingTitle}\nWhen: ${formattedDate} (${durationMinutes} mins)\nRoom ID: ${roomCode}\nJoin here: ${meetingUrl}`,
                            html,
                        });

                        const initialResponse = await fetch(gmailRelayUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: payload,
                            redirect: "manual",
                        });

                        let finalResponse: Response;
                        if (initialResponse.status >= 300 && initialResponse.status < 400) {
                            const redirectUrl = initialResponse.headers.get("location");
                            if (redirectUrl) {
                                finalResponse = await fetch(redirectUrl, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: payload,
                                    redirect: "follow",
                                });
                            } else {
                                finalResponse = initialResponse;
                            }
                        } else {
                            finalResponse = initialResponse;
                        }

                        if (finalResponse.ok) sent++;
                        else failed++;
                    } catch {
                        failed++;
                    }
                })
            );
            return { sent, failed };
        }

        const resendApiKey = process.env.RESEND_API_KEY?.trim();
        if (resendApiKey) {
            let sent = 0;
            let failed = 0;
            const resendFrom = process.env.RESEND_FROM?.trim() || "SuperCall <onboarding@resend.dev>";
            await Promise.all(
                to.map(async (recipient) => {
                    try {
                        const response = await fetch("https://api.resend.com/emails", {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${resendApiKey}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                from: resendFrom,
                                to: [recipient],
                                subject: `Invitation: ${meetingTitle} - ${formattedDate}`,
                                html,
                            }),
                        });
                        if (response.ok) sent++;
                        else failed++;
                    } catch {
                        failed++;
                    }
                })
            );
            return { sent, failed };
        }

        if (!transporter) {
            const safeRecipients = to.map(sanitizeLog).join(", ");
            logger.warn(
                `\n=======================================================\n` +
                `📧 [DEV SIMULATION] Meeting Invite for ${safeRecipients}\n` +
                `Title: ${meetingTitle} | Date: ${formattedDate}\n` +
                `Join Link: ${meetingUrl}\n` +
                `=======================================================\n`
            );
            return { sent: to.length, failed: 0 };
        }

        let sent = 0;
        let failed = 0;

        await Promise.all(
            to.map(async (recipient) => {
                const safeRecipient = sanitizeLog(recipient);
                try {
                    await transporter.sendMail({
                        from: sender,
                        to: recipient,
                        subject: `Invitation: ${meetingTitle} - ${formattedDate}`,
                        text: `You have been invited to a video meeting by ${hostName}.\nTitle: ${meetingTitle}\nWhen: ${formattedDate} (${durationMinutes} mins)\nRoom ID: ${roomCode}\nJoin here: ${meetingUrl}`,
                        html,
                    });
                    logger.info(`[EmailService] Meeting invite sent to ${safeRecipient} for room ${roomCode}`);
                    sent++;
                } catch (err: any) {
                    logger.error({ err: err.message }, `[EmailService] Failed to send meeting invite to ${safeRecipient}`);
                    failed++;
                }
            })
        );

        return { sent, failed };
    }
}

export const emailService = new EmailService();
