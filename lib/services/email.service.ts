import nodemailer from "nodemailer";

export interface SendEmployeeCredentialsParams {
  to: string;
  employeeName: string;
  companyName?: string;
  loginUrl?: string;
  tempPassword: string;
  isReset?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  deliveredVia: "smtp" | "console_mock";
  error?: string;
}

/**
 * Dispatches a high-craft corporate welcome email containing initial temporary login credentials
 * to the employee's designated corporate or personal email.
 *
 * If SMTP credentials are not configured in the environment (e.g. in local development),
 * a formatted preview box is logged to the console so workflows continue uninterrupted.
 */
export async function sendEmployeeCredentialsEmail(
  params: SendEmployeeCredentialsParams
): Promise<SendEmailResult> {
  const {
    to,
    employeeName,
    companyName = "Aakash HRMS",
    tempPassword,
    isReset = false,
  } = params;

  const defaultLoginUrl =
    params.loginUrl ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000/login";

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : 587;
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;
  const smtpFrom =
    process.env.SMTP_FROM ||
    `"${companyName} Security" <${smtpUser || "noreply@aakashhrms.com"}>`;

  const subject = isReset
    ? `Your New Login Credentials - ${companyName}`
    : `Welcome to ${companyName} - Your Self-Service Login Credentials`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);">
          
          <!-- Editorial Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #091a10 0%, #103b29 100%); padding: 32px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #86efac; margin-bottom: 6px;">
                      ${isReset ? "CREDENTIAL RESET NOTICE" : "EMPLOYEE ONBOARDING"}
                    </div>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      ${companyName}
                    </div>
                    <div style="font-size: 13px; color: #dcfce7; margin-top: 4px;">
                      Employee Self-Service (ESS) Portal
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #0f172a;">
                Namaste ${employeeName},
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #334155;">
                ${
                  isReset
                    ? "A temporary password reset has been issued for your self-service account. Use the credentials below to log in and set a new permanent password."
                    : "Your employee self-service login has been provisioned. Through this portal, you can view your monthly payslips, track leave balances, review tax calculations, and manage your official profile."
                }
              </p>

              <!-- Credentials Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #065f46; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                      Account Access Credentials
                    </div>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #64748b; width: 140px;">Portal Login URL:</td>
                        <td style="padding: 4px 0; font-size: 13px; font-weight: 600;">
                          <a href="${defaultLoginUrl}" style="color: #047857; text-decoration: none;">${defaultLoginUrl}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Username / Email:</td>
                        <td style="padding: 4px 0; font-size: 13px; font-weight: 600; font-family: monospace; color: #0f172a;">
                          ${to}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0 4px; font-size: 13px; color: #64748b; vertical-align: middle;">Temporary Password:</td>
                        <td style="padding: 8px 0 4px; vertical-align: middle;">
                          <span style="display: inline-block; background-color: #0f172a; color: #38bdf8; font-family: 'Consolas', 'Courier New', monospace; font-size: 15px; font-weight: 700; padding: 6px 12px; border-radius: 6px; letter-spacing: 1px;">
                            ${tempPassword}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${defaultLoginUrl}" style="display: inline-block; background-color: #064e3b; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 2px 4px rgba(6, 78, 59, 0.2);">
                      Sign In to Employee Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 2px;">
                      Security Policy Requirement:
                    </div>
                    <div style="font-size: 12px; color: #78350f; line-height: 1.5;">
                      This temporary password expires upon first use. You will be automatically required to set your own permanent, confidential password upon signing in.
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 28px 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If you have any difficulty accessing your account, please reach out to your HR administrator or IT support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 36px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${companyName}. Automated system notification — please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // 1. If SMTP is configured, attempt real email transmission
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`[EMAIL_SERVICE] Dispatched credentials email via SMTP to: ${to}`);
      return { success: true, deliveredVia: "smtp" };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "SMTP delivery failed";
      console.error(`[EMAIL_SERVICE] SMTP delivery error to ${to}:`, errMsg);
      return { success: false, deliveredVia: "smtp", error: errMsg };
    }
  }

  // 2. Development / Fallback mode: Print formatted preview box to terminal
  console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│ [AAKASH HRMS] EMPLOYEE CREDENTIALS EMAIL (DEV CONSOLE PREVIEW)         │
├────────────────────────────────────────────────────────────────────────┤
│ To:           ${to}
│ Employee:     ${employeeName}
│ Subject:      ${subject}
│ Portal URL:   ${defaultLoginUrl}
│ Temp Password: ${tempPassword}
│ Notice:       Single-use temporary credential requiring password change
└────────────────────────────────────────────────────────────────────────┘
  `);

  return { success: true, deliveredVia: "console_mock" };
}
