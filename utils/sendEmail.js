import { transporter } from "../config/nodemailer.js";

/**
 * Utility to send email from anywhere in backend
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `"Plains Motor" <fastigopvtltd@gmail.com>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    return { success: false, error };
  }
};
