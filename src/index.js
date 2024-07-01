const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // Adjust the limit based on your needs

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-email-password",
  },
});

app.post("/send-email", (req, res) => {
  const { email, pdfData } = req.body;

  const mailOptions = {
    from: "your-email@gmail.com",
    to: email,
    subject: "Chart PDF",
    text: "Please find the attached chart PDF.",
    attachments: [
      {
        filename: "chart.pdf",
        content: pdfData.split("base64,")[1],
        encoding: "base64",
      },
    ],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send(error.toString());
    }
    res.send("Email sent: " + info.response);
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
