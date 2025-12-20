import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "plainsmotorinnn@gmail.com",
    pass: "yufc tqgk dlqt krnp",
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
