require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Resend } = require("resend");

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
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

function fieldCard(label, value) {
  return `
    <div style="padding:16px 18px; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px;">
      <div style="font-size:13px; color:#6b7280; font-weight:700; text-transform:uppercase; margin-bottom:6px;">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:22px; color:#111827; font-weight:800;">
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function section(title, content) {
  return `
    <div style="margin-top:24px;">
      <h2 style="font-size:20px; margin:0 0 12px; color:#9c2324;">
        ${escapeHtml(title)}
      </h2>
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:16px; padding:18px;">
        ${content}
      </div>
    </div>
  `;
}

const serviceFileFields = [
  { serviceName: "Fönsterputsning", fieldName: "fonsterputsning_bilder" },
  { serviceName: "Städning", fieldName: "stadning_bilder" },
  { serviceName: "Ultrarent vatten", fieldName: "ultrarent_bilder" },
  { serviceName: "Golvvård", fieldName: "golvvard_bilder" },
  { serviceName: "Skyltputs", fieldName: "skyltputs_bilder" },
  { serviceName: "Fasadtvätt", fieldName: "fasadtvatt_bilder" }
];

function makeImageHtml(file, cid, index) {
  return `
    <div style="margin: 14px 0 22px;">
      <p style="margin: 0 0 8px; font-weight: 700;">
        ${index + 1}. ${escapeHtml(file.originalname)}
      </p>
      <img src="cid:${cid}" style="max-width: 520px; width: 100%; border-radius: 10px; border: 1px solid #ddd;">
    </div>
  `;
}

app.get("/", (req, res) => {
  res.send("Lokomotiv backend fungerar");
});

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
    const customerHtml = `
  <div style="display:grid; gap:12px;">
    ${fieldCard("Namn", req.body.Namn)}
    ${fieldCard("E-post", req.body["E-post"])}
    ${fieldCard("Telefon", req.body.Telefonnummer)}
  </div>
`;

    let summaryHtml = escapeHtml(req.body.Sammanfattning || "Ny offertförfrågan")
  .replaceAll("Ny offertförfrågan från hemsidan", "")
  .replaceAll("KUNDUPPGIFTER", "")
  .replaceAll("Namn:", "")
  .replaceAll("E-post:", "")
  .replaceAll("Telefon:", "")
  .replaceAll("================================", "")
  .replaceAll("--------------------------------", "")
  .replaceAll("\n\n", "<br><br>")
  .replaceAll("\n", "<br>");

    serviceFileFields.forEach(service => {
      const files = filesByField[service.fieldName] || [];

      if (files.length === 0) return;

      let serviceImagesHtml = "";

      files.forEach((file, index) => {
        const cid = `image-${cidCounter}`;

        attachments.push({
          filename: file.originalname,
          content: file.buffer.toString("base64"),
          contentType: file.mimetype,
          contentId: cid
        });

        serviceImagesHtml += makeImageHtml(file, cid, index);
        cidCounter++;
      });

      const marker = `[[BILDER_${service.fieldName}]]`;

      summaryHtml = summaryHtml.replace(
        marker,
        `
          <p style="font-weight:700; margin:18px 0 10px;">
            Bilder bifogade för ${escapeHtml(service.serviceName)}:
          </p>
          ${serviceImagesHtml}
        `
      );
    });

    summaryHtml = summaryHtml.replace(/\[\[BILDER_[^\]]+\]\]/g, "");

    const { data, error } = await resend.emails.send({
      from: "Lokomotiv Städ <onboarding@resend.dev>",
      to: [process.env.EMAIL_TO],
      subject: "Ny offertförfrågan från hemsidan",
      text: req.body.Sammanfattning || "Ny offertförfrågan",
      html: `
  <div style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, sans-serif; color:#1f2937;">
    <div style="max-width:760px; margin:0 auto; padding:28px 16px;">

      <div style="background:#9c2324; color:#ffffff; padding:28px 30px; border-radius:18px 18px 0 0;">
        <p style="margin:0 0 8px; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
          Lokomotiv Städ
        </p>
        <h1 style="margin:0; font-size:32px; line-height:1.2;">
          Ny offertförfrågan
        </h1>
      </div>

      <div style="background:#ffffff; padding:30px; border-radius:0 0 18px 18px; border:1px solid #e5e7eb; border-top:none;">

        ${section("Viktig kundinfo", customerHtml)}

        ${section("Offertförfrågan", `
          <div style="font-size:16px; line-height:1.75; color:#374151;">
            ${summaryHtml}
          </div>
        `)}

        <p style="margin:24px 0 0; color:#6b7280; font-size:13px;">
          Skickat automatiskt från lokomotivstad.se
        </p>

      </div>
    </div>
  </div>
`,
      attachments
    });

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
