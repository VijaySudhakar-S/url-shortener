require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const shortid = require("shortid");
const cors = require("cors");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());
app.use(cors());
npm run build

const dbURL = process.env.DATABASE_URL;
const baseURL = process.env.BASE_URL;

if (!dbURL) {
  console.error("DATABASE_URL is missing in .env file!");
  process.exit(1);
}

mongoose
  .connect(dbURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection failed:", err));

const urlSchema = new mongoose.Schema({
  fullUrl: String,
  shortCode: String,
  expiryDate: Date,
  qrCode: String,
});
const UrlModel = mongoose.model("Url", urlSchema);

app.post("/shorten", async (req, res) => {
  const { fullUrl, expiryTime } = req.body;

  if (!fullUrl) {
    return res.status(400).json({ error: "Full URL is required" });
  }

  const existingEntry = await UrlModel.findOne({ fullUrl });

  if (existingEntry) {
    return res.json(existingEntry);
  }

  const shortCode = shortid.generate();
  const shortUrl = `${baseURL}/${shortCode}`;
  const expiryDate = expiryTime
    ? new Date(Date.now() + expiryTime * 1000)
    : null;

  // Generate QR Code for the short URL
  const qrCode = await QRCode.toDataURL(shortUrl);

  const newEntry = new UrlModel({ fullUrl, shortCode, expiryDate, qrCode });
  await newEntry.save();

  res.json({
    fullUrl,
    shortCode,
    shortUrl,
    expiryDate,
    qrCode, 
  });
});

app.get("/:shortCode", async (req, res) => {
  const { shortCode } = req.params;
  const urlData = await UrlModel.findOne({ shortCode });

  if (!urlData) {
    return res.status(404).json({ error: "URL not found" });
  }

  if (urlData.expiryDate && new Date() > urlData.expiryDate) {
    await UrlModel.deleteOne({ shortCode });
    return res.status(410).json({ error: "URL has expired" });
  }

  let redirectUrl = urlData.fullUrl;
  if (
    !redirectUrl.startsWith("http://") &&
    !redirectUrl.startsWith("https://")
  ) {
    redirectUrl = "https://" + redirectUrl;
  }

  res.redirect(redirectUrl);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
