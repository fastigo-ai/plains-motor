import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vermasanjeet240@gmail.com",
    pass: "jube oblg ojll tole",
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
