require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage with original file extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(cors());
app.use(express.json());

// Transcription API endpoint
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const filePath = req.file.path;

  try {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes("your_key_here")) {
      throw new Error("GROQ_API_KEY is not configured in .env file.");
    }

    const language = req.body.language || "id"; // Default to Indonesian ('id') or English ('en')

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
      language: language,
      response_format: "json",
      temperature: 0.0,
    });

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ text: transcription.text || "" });
  } catch (error) {
    console.error("Transcription error:", error);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      error: error.message || "Failed to transcribe audio.",
    });
  }
});

// Ping endpoint for frontend to check if backend is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", engine: "groq-whisper" });
});

// Serve main project directory (index.html, voice.html, style.css)
const projectRoot = path.join(__dirname, "..");
app.use(express.static(projectRoot, {
  dotfiles: "deny" // Prevents exposing .env, .git, etc.
}));

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Voice Server running at: http://localhost:${port}`);
  console.log(`🏠 Home:  http://localhost:${port}/index.html`);
  console.log(`🎤 Voice: http://localhost:${port}/voice.html`);
  console.log(`======================================================\n`);
});
