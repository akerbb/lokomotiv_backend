require("dotenv").config();

const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  family: 4,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function escapeHtml(value) {
  return String(value || "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const serviceFileFields = [
  {
    serviceName: "Fönsterputsning",
    fieldName: "fonsterputsning_bilder"
  },
  {
    serviceName: "Städning",
    fieldName: "stadning_bilder"
  },
  {
    serviceName: "Ultrarent vatten",
    fieldName: "ultrarent_bilder"
  },
  {
    serviceName: "Golvvård",
    fieldName: "golvvard_bilder"
  },
  {
    serviceName: "Skyltputs",
    fieldName: "skyltputs_bilder"
  },
  {
    serviceName: "Fasadtvätt",
    fieldName: "fasadtvatt_bilder"
  }
];

function makeImageHtml(file, cid, index) {
  return `
    <div style="
      margin: 18px 0 30px;
      padding: 12px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 12px;
    ">
      <div style="
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 15px;
      ">
        Bild ${index + 1}: ${escapeHtml(file.originalname)}
      </div>

      <img 
        src="cid:${cid}" 
        style="
          width: 100%;
          max-width: 520px;
          border-radius: 10px;
          display: block;
        "
      >
    </div>
  `;
}

app.post("/send-email", upload.fields([
  { name: "fonsterputsning_bilder", maxCount: 10 },
  { name: "stadning_bilder", maxCount: 10 },
  { name: "ultrarent_bilder", maxCount: 10 },
  { name: "golvvard_bilder", maxCount: 10 },
  { name: "skyltputs_bilder", maxCount: 10 },
  { name: "fasadtvatt_bilder", maxCount: 10 }
]), async (req, res) => {
  try {
    const filesByField = req.files || {};
    const attachments = [];
    let cidCounter = 0;

    let summaryHtml = escapeHtml(req.body.Sammanfattning || "Ny offertförfrågan")
  .replaceAll("\n", "<br>")
  .replace(/KUNDUPPGIFTER/g, "<strong style='font-size:18px;'>KUNDUPPGIFTER</strong>")
  .replace(/VALDA TJÄNSTER/g, "<strong style='font-size:18px;'>VALDA TJÄNSTER</strong>")
  .replace(/TJÄNSTEDETALJER/g, "<strong style='font-size:18px;'>TJÄNSTEDETALJER</strong>")
  .replace(/MEDDELANDE/g, "<strong style='font-size:18px;'>MEDDELANDE</strong>")
  .replace(/SAMTYCKE/g, "<strong style='font-size:18px;'>SAMTYCKE</strong>")
  .replace(/================================/g, "<hr style='margin:20px 0;border:none;border-top:1px solid #ddd;'>")
  .replace(/--------------------------------/g, "<hr style='margin:12px 0;border:none;border-top:1px dashed #ccc;'>");

    serviceFileFields.forEach(service => {
      const files = filesByField[service.fieldName] || [];
      const marker = `[[BILDER_${service.fieldName}]]`;

      if (files.length === 0) {
        summaryHtml = summaryHtml.replace(marker, "");
        return;
      }

      let imagesHtml = "";

      files.forEach((file, index) => {
        const cid = `image-${cidCounter}`;

        attachments.push({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
          cid
        });

        imagesHtml += makeImageHtml(file, cid, index);
        cidCounter++;
      });

      summaryHtml = summaryHtml.replace(marker, imagesHtml);
    });

    summaryHtml = summaryHtml.replace(/\[\[BILDER_[^\]]+\]\]/g, "");

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "Ny offertförfrågan från hemsidan",
      text: req.body.Sammanfattning || "Ny offertförfrågan",
      html: `
        <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">
          <h2>Ny offertförfrågan från hemsidan</h2>
          <div style="padding: 18px; background: #f7f7f7; border-radius: 10px;">
            ${summaryHtml}
          </div>
        </div>
      `,
      attachments
    });

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
