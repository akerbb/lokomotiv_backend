require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Resend } = require("resend");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

const JWT_SECRET =
process.env.JWT_SECRET || "change-this";

const usersFile =
path.join(__dirname,"users.json");

const eventsFile =
path.join(__dirname,"events.json");

const messagesFile =
path.join(__dirname,"messages.json");

app.use(cors({

origin:[
"https://lokomotivstad.se",
"https://www.lokomotivstad.se",
  
"https://sensational-pastelito-e0a6c8.netlify.app",
  
"http://localhost:5500",
"http://127.0.0.1:5500"
],

credentials:true

}));

app.use(express.json());

app.use(cookieParser());

function readJson(file){

return JSON.parse(
fs.readFileSync(file,"utf8")
);

}

function saveJson(file,data){

fs.writeFileSync(
file,
JSON.stringify(data,null,2)
);

}

function getUsers(){

return readJson(usersFile);

}

function checkAuth(req,res,next){

const token =
req.cookies.token;

if(!token){

return res.status(401)
.json({
message:"Inte inloggad"
});

}

try{

req.user=
jwt.verify(
token,
JWT_SECRET
);

next();

}catch{

return res.status(401)
.json({
message:"Ogiltig session"
});

}

}

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

function niceLabel(label) {
  if (!label) return "-";

  return label
    .trim()
    .replace(/^antal fönster$/i, "Antal fönster")
    .replace(/^beskrivning$/i, "Beskrivning")
    .replace(/^yta$/i, "Yta")
    .replace(/^adress$/i, "Adress")
    .replace(/^datum$/i, "Datum")
    .replace(/^övrigt$/i, "Övrigt")
    .replace(/^./, char => char.toUpperCase());
}

function formatSummaryHtml(summary) {
  const lines = String(summary || "")
    .split("\n")
    .map(line => line.trim());

  let html = "";
  let currentSection = "";

  lines.forEach(line => {
    if (!line) return;

    if (
      line === "================================" ||
      line === "--------------------------------" ||
      line === "Ny offertförfrågan från hemsidan" ||
      line === "Skickat från lokomotivstad.se"
    ) {
      return;
    }

    if (line === "KUNDUPPGIFTER") {
      currentSection = "KUNDUPPGIFTER";
      html += `<h2 style="font-size:22px; font-weight:800; color:#9c2324; margin:8px 0 10px;">Kunduppgifter</h2>`;
      return;
    }

    if (line === "VALDA TJÄNSTER") {
      currentSection = "VALDA TJÄNSTER";
      html += `<h2 style="font-size:22px; font-weight:800; color:#9c2324; margin:22px 0 10px;">Valda tjänster</h2>`;
      return;
    }

    if (line === "TJÄNSTEDETALJER") {
      currentSection = "TJÄNSTEDETALJER";
      html += `<h2 style="font-size:22px; font-weight:800; color:#9c2324; margin:22px 0 12px;">Tjänstedetaljer</h2>`;
      return;
    }

    if (line === "MEDDELANDE") {
      currentSection = "MEDDELANDE";
      html += `<h2 style="font-size:22px; font-weight:800; color:#9c2324; margin:22px 0 10px;">Övrigt tillägg</h2>`;
      return;
    }

    if (line === "SAMTYCKE") {
      currentSection = "SAMTYCKE";
      html += `<h2 style="font-size:22px; font-weight:800; color:#9c2324; margin:22px 0 10px;">Samtycke</h2>`;
      return;
    }

    if (line.startsWith("[[BILDER_")) {
      html += line;
      return;
    }

    if (line.startsWith("Bilder bifogade för")) {
      return;
    }

    if (currentSection === "TJÄNSTEDETALJER") {
      const bulletMatch = line.match(/^•\s*(.*?)\s*-\s*(.*?):\s*(.*)$/);

      if (bulletMatch) {
        const label = niceLabel(bulletMatch[2]);
        const value = bulletMatch[3];

        html += `
          <div style="margin:7px 0; font-size:16px; line-height:1.55;">
            <strong style="color:#111827;">• ${escapeHtml(label)}:</strong>
            <span style="color:#374151;">${escapeHtml(value)}</span>
          </div>
        `;
        return;
      }

      html += `
        <h3 style="font-size:26px; font-weight:900; color:#111827; margin:24px 0 8px;">
          ${escapeHtml(line)}
        </h3>
      `;
      return;
    }

    html += `
      <div style="font-size:16px; line-height:1.55; margin:5px 0; color:#374151;">
        ${escapeHtml(line)}
      </div>
    `;
  });

  return html;
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
    <div style="margin:12px 0 18px;">
      <p style="margin:0 0 8px; font-weight:700; font-size:15px; color:#111827;">
        ${index + 1}. ${escapeHtml(file.originalname)}
      </p>
      <img src="cid:${cid}" style="max-width:520px; width:100%; border-radius:10px; border:1px solid #ddd;">
    </div>
  `;
}

app.get("/", (req, res) => {
  res.send("Lokomotiv backend fungerar");
});

app.post("/login",

async(req,res)=>{

const {
username,
password
}=req.body;

const users=
getUsers();

const user=
users.find(
u=>u.username===username
);

if(!user){

return res.status(401)
.json({
message:"Fel login"
});

}

const valid=
await bcrypt.compare(
password,
user.passwordHash
);

if(!valid){

return res.status(401)
.json({
message:"Fel login"
});

}

const token=
jwt.sign({

id:user.id,
username:user.username,
name:user.name,
role:user.role

},

JWT_SECRET,

{

expiresIn:"8h"

});

res.cookie(

"token",
token,

{

httpOnly:true,
secure:true,
sameSite:"none",
maxAge:
8*60*60*1000

}

);

res.json({

message:"Inloggad",

user:{

name:user.name,
role:user.role

}

});

});

app.post("/logout",(req,res)=>{

res.clearCookie(
"token",
{
httpOnly:true,
secure:true,
sameSite:"none"
}
);

res.json({
message:"Utloggad"
});

});


app.get(
"/me",
checkAuth,

(req,res)=>{

res.json({
loggedIn:true,
user:req.user
});

});
app.get("/api/events", checkAuth, (req, res) => {
  res.json(readJson(eventsFile));
});


app.post("/api/events", checkAuth, (req, res) => {
  const events = readJson(eventsFile);

  const event = {
    id: Date.now().toString(),
    title: req.body.title,
    date: req.body.date,
    time: req.body.time || "",
    description: req.body.description || "",
    comments: []
  };

  events.push(event);

  saveJson(eventsFile, events);

  res.json(event);
});


app.delete("/api/events/:id", checkAuth, (req, res) => {
  const events = readJson(eventsFile);

  const filteredEvents = events.filter(event => {
    return event.id !== req.params.id;
  });

  saveJson(eventsFile, filteredEvents);

  res.json({
    message: "Event borttaget"
  });
});


app.post("/api/events/:id/comments", checkAuth, (req, res) => {
  const events = readJson(eventsFile);

  const event = events.find(event => {
    return event.id === req.params.id;
  });

  if (!event) {
    return res.status(404).json({
      message: "Event hittades inte"
    });
  }

  if (!Array.isArray(event.comments)) {
    event.comments = [];
  }

  event.comments.push({
    id: Date.now().toString(),
    sender: req.user.name,
    text: req.body.text,
    createdAt: new Date().toLocaleString("sv-SE")
  });

  saveJson(eventsFile, events);

  res.json(event);
});


app.get("/api/messages", checkAuth, (req, res) => {
  res.json(readJson(messagesFile));
});


app.post("/api/messages", checkAuth, (req, res) => {
  const messages = readJson(messagesFile);

  const message = {
    id: Date.now().toString(),
    sender: req.user.name,
    text: req.body.text,
    createdAt: new Date().toLocaleString("sv-SE")
  };

  messages.push(message);

  saveJson(messagesFile, messages);

  res.json(message);
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

    let summaryHtml = formatSummaryHtml(
      req.body.Sammanfattning || "Ny offertförfrågan"
    );

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
          <div style="margin:14px 0 22px;">
            <p style="font-size:17px; font-weight:800; color:#111827; margin:0 0 10px;">
              Bilder bifogade för ${escapeHtml(service.serviceName)}:
            </p>
            ${serviceImagesHtml}
          </div>
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
        <div style="margin:0; padding:24px; background:#f3f4f6; font-family:Arial, sans-serif; color:#222; line-height:1.55;">
          <div style="max-width:760px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb;">

            <div style="background:#9c2324; color:#ffffff; padding:28px 30px;">
              <div style="font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:8px;">
                Lokomotiv Städ
              </div>
              <h1 style="margin:0; font-size:32px; line-height:1.2;">
                Ny offertförfrågan
              </h1>
            </div>

            <div style="padding:28px 30px;">
              <div style="padding:22px; background:#f9fafb; border-radius:14px; border:1px solid #e5e7eb; font-size:16px; line-height:1.65;">
                ${summaryHtml}
              </div>

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
