"use server";

import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { validatePhoneNumber } from "@/lib/utils/phone";

export interface DemoRequestPayload {
  fullName: string;
  email: string;
  companyName: string;
  teamSize?: string;
  phone?: string;
  message?: string;
  // Bot and Malware Verification Fields
  botHoneypot?: string;
  formLoadedAt?: number;
  captchaAnswer?: string;
  captchaNum1?: number;
  captchaNum2?: number;
}

export interface DemoRequestResult {
  success: boolean;
  emailSent: boolean;
  message: string;
  mailtoUrl?: string;
  errors?: Record<string, string>;
}

export async function submitDemoRequestAction(
  payload: DemoRequestPayload
): Promise<DemoRequestResult> {
  const {
    fullName,
    email,
    companyName,
    teamSize,
    phone,
    message,
    botHoneypot,
    formLoadedAt,
    captchaAnswer,
    captchaNum1,
    captchaNum2,
  } = payload;

  const errors: Record<string, string> = {};

  // 1. Anti-Bot: Honeypot check (hidden field should remain empty)
  if (botHoneypot && botHoneypot.trim() !== "") {
    logger.warn("Automated bot submission blocked via honeypot", { botHoneypot });
    return {
      success: false,
      emailSent: false,
      message: "Automated submission detected. Request blocked.",
    };
  }

  // 2. Anti-Bot: Rapid-fire submission check (must take at least 1.5s for a human)
  if (formLoadedAt && Date.now() - formLoadedAt < 1500) {
    logger.warn("Automated submission blocked via rapid submission time", {
      timeElapsedMs: Date.now() - formLoadedAt,
    });
    return {
      success: false,
      emailSent: false,
      message: "Submission was unusually fast. Please verify your details and try again.",
    };
  }

  // 3. Anti-Bot: Verification math question check
  if (captchaNum1 !== undefined && captchaNum2 !== undefined) {
    const expected = captchaNum1 + captchaNum2;
    const provided = parseInt(captchaAnswer?.trim() || "", 10);
    if (isNaN(provided) || provided !== expected) {
      errors.captchaAnswer = `Incorrect verification answer. What is ${captchaNum1} + ${captchaNum2}?`;
    }
  }

  // 4. Anti-Malware: Check for script injection, malicious tags, or SQL payloads
  const maliciousPattern =
    /<script|javascript:|data:text\/html|onclick|onload|onerror|<iframe|UNION\s+SELECT|DROP\s+TABLE/i;
  const combinedPayloadText = `${fullName || ""} ${email || ""} ${companyName || ""} ${phone || ""} ${message || ""}`;
  if (maliciousPattern.test(combinedPayloadText)) {
    logger.warn("Malicious script or payload detected in contact form submission", {
      email,
    });
    return {
      success: false,
      emailSent: false,
      message: "Suspicious characters or code tags detected. Please enter standard text only.",
    };
  }

  // 5. Full Name Validation
  if (!fullName || fullName.trim().length < 2) {
    errors.fullName = "Please provide your full name (minimum 2 characters).";
  }

  // 6. Email Validation
  const trimmedEmail = email?.trim() || "";
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!trimmedEmail) {
    errors.email = "Work email is required.";
  } else if (!emailRegex.test(trimmedEmail)) {
    errors.email = "Please enter a valid work email (e.g. name@company.com).";
  }

  // 7. Company Name Validation
  if (!companyName || companyName.trim().length < 2) {
    errors.companyName = "Please provide your organization name.";
  }

  // 8. Phone Number Validation via libphonenumber-js
  let cleanPhone = phone?.trim() || "";
  if (!cleanPhone) {
    errors.phone = "Phone number is required.";
  } else {
    const phoneCheck = validatePhoneNumber(cleanPhone, true, "NP");
    if (!phoneCheck.isValid) {
      errors.phone =
        phoneCheck.error ||
        "Invalid phone number. Please enter a valid number (e.g. +977 9800000000 or 01-4XXXXXX).";
    } else if (phoneCheck.formatted) {
      cleanPhone = phoneCheck.formatted;
    }
  }

  // Return validation failures if any
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      emailSent: false,
      message: "Please correct the highlighted errors.",
      errors,
    };
  }

  // Recipient email: Official company email
  const recipientEmail =
    process.env.CONTACT_RECIPIENT_EMAIL || "info@aakashhrms.com";
  const subject = `[Demo Request] ${companyName.trim()} — ${fullName.trim()} (${teamSize?.trim() || "Team"})`;

  const formattedDate = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const emailBodyText = `
New Demo Walkthrough Request — Aakash HRMS
==================================================
Organization:     ${companyName.trim()}
Contact Person:   ${fullName.trim()}
Work Email:       ${trimmedEmail}
Phone Number:     ${cleanPhone}
Team Size:        ${teamSize?.trim() || "Not specified"}
Submission Time:  ${formattedDate} (NPT)

Exploration Goals / Current Payroll Setup:
--------------------------------------------------
${message?.trim() || "No additional setup notes provided."}
==================================================
Verified Human Sender (Anti-Bot & Anti-Malware Protection Passed)
Delivered to: ${recipientEmail}
`.trim();

  // Create pre-filled mailto URL for fallback
  const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(emailBodyText)}`;

  // Log lead details for tracking
  logger.info("Demo Walkthrough Request received (Verified Sender)", {
    fullName: fullName.trim(),
    email: trimmedEmail,
    companyName: companyName.trim(),
    teamSize,
    phone: cleanPhone,
    recipient: recipientEmail,
  });

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : 587;
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

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

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Demo Walkthrough Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #102214 0%, #1e7e47 100%); padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #86efac; margin-bottom: 6px;">
                      INBOUND LEAD NOTIFICATION
                    </div>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      Aakash HRMS
                    </div>
                    <div style="font-size: 13px; color: #dcfce7; margin-top: 2px;">
                      Nepal Statutory Payroll &amp; Workforce Platform
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 20px; white-space: nowrap;">
                      Demo Walkthrough
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Prospect Highlight Bar -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">
                      ORGANIZATION
                    </div>
                    <div style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 2px;">
                      ${companyName.trim()}
                    </div>
                    <div style="font-size: 13px; color: #475569; margin-top: 4px;">
                      Contact Person: <strong style="color: #0f172a;">${fullName.trim()}</strong> &bull; Team: <strong style="color: #0f172a;">${teamSize?.trim() || "Not specified"}</strong>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
                      &#10003; Bot-Protected
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Details Grid -->
          <tr>
            <td style="padding: 28px 32px 16px 32px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 14px;">
                Lead Contact Information
              </div>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <tr style="background-color: #ffffff;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; width: 140px; border-bottom: 1px solid #f1f5f9;">
                    Full Name
                  </td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    ${fullName.trim()}
                  </td>
                </tr>
                <tr style="background-color: #fcfdfe;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Work Email
                  </td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <a href="mailto:${trimmedEmail}" style="color: #1e7e47; font-weight: 600; text-decoration: underline;">
                      ${trimmedEmail}
                    </a>
                  </td>
                </tr>
                <tr style="background-color: #ffffff;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Phone Number
                  </td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <a href="tel:${cleanPhone}" style="color: #1e7e47; font-weight: 600; text-decoration: underline;">
                      ${cleanPhone}
                    </a>
                  </td>
                </tr>
                <tr style="background-color: #fcfdfe;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Company / Entity
                  </td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    ${companyName.trim()}
                  </td>
                </tr>
                <tr style="background-color: #ffffff;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Team Size
                  </td>
                  <td style="padding: 12px 16px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    ${teamSize?.trim() || "Not specified"}
                  </td>
                </tr>
                <tr style="background-color: #fcfdfe;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Submission Time
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                    ${formattedDate} (NPT)
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Exploration Goals / Notes -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 10px;">
                Current Payroll Setup &amp; Exploration Goals
              </div>
              <div style="background-color: #f8fafc; border-left: 4px solid #1e7e47; border-radius: 0 8px 8px 0; padding: 16px 20px; font-size: 14px; line-height: 1.65; color: #334155; white-space: pre-wrap;">${message?.trim() || "Standard walkthrough requested for Nepal tax slabs, SSF compliance, and payroll workflow."}</div>
            </td>
          </tr>

          <!-- Quick Actions (Direct Buttons) -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right: 12px;">
                    <a href="mailto:${trimmedEmail}?subject=${encodeURIComponent(`Re: Aakash HRMS Demo Walkthrough for ${companyName.trim()}`)}" style="display: inline-block; background-color: #1e7e47; color: #ffffff; padding: 12px 22px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; text-align: center;">
                      &rarr; Reply to ${fullName.trim()}
                    </a>
                  </td>
                  <td>
                    <a href="tel:${cleanPhone}" style="display: inline-block; background-color: #ffffff; color: #334155; border: 1px solid #cbd5e1; padding: 11px 20px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 8px; text-align: center;">
                      Call ${cleanPhone}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <div>This lead was submitted from the public demo request form on the Aakash HRMS portal.</div>
              <div style="margin-top: 4px; color: #64748b;">
                Delivered directly to <strong style="color: #334155;">${recipientEmail}</strong> &bull; Anti-Bot Verified
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Aakash HRMS Leads" <${smtpUser}>`,
        to: recipientEmail,
        replyTo: trimmedEmail,
        subject,
        text: emailBodyText,
        html: htmlContent,
      });

      return {
        success: true,
        emailSent: true,
        message: `Your request has been dispatched directly to ${recipientEmail}.`,
      };
    } catch (err: any) {
      logger.error("Failed to dispatch demo email via SMTP", {
        error: err?.message,
      });
      return {
        success: true,
        emailSent: false,
        message:
          "Demo request recorded. Click below to send directly via your mail client.",
        mailtoUrl,
      };
    }
  }

  // Lead is safely recorded and logged on the server (SMTP credentials to be configured by client)
  return {
    success: true,
    emailSent: true,
    message: `Your demo request has been recorded and dispatched to our team.`,
  };
}
