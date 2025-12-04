import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "plainsmotorinnn@gmail.com", // your Gmail
    pass: "cwst ooma hyxf oglj", // your App Password (e.g. gpjo zcjz ocpk ppkx)
  },
});

// Optional: check if transporter is working
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email config error:", error);
  } else {
    console.log("✅ Server is ready to send emails");
  }
});
