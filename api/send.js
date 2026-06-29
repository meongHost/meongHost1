import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// ── CONFIG ───────────────────────────────────────────────────────
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',      // ganti sesuai provider
  port: 587,
  secure: false,
  auth: {
    user: 'lihzzturu@gmail.com',   // ganti email kamu
    pass: 'tzmuduvqvlnlaqfm',     // ganti password / app password
  },
};

// Helper baca/tulis JSON
function readJSON(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}
function writeJSON(filePath, data) {
  const abs = path.resolve(process.cwd(), filePath);
  fs.writeFileSync(abs, JSON.stringify(data), 'utf-8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pesan, subjek } = req.body;
  if (!pesan || !subjek) {
    return res.status(400).json({ error: 'pesan dan subjek wajib diisi' });
  }

  // ── VISITOR TODAY ────────────────────────────────────────────────
  const visitorPath = 'system/visitor.json';
  const visitor = readJSON(visitorPath);
  visitor.today = (visitor.today || 0) + 1;

  // Reset jam 01:00
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  if (`${hh}:${mm}` === '01:00') {
    visitor.yesterday = visitor.today;
    visitor.today = 0;
  }

  visitor.total = (visitor.total || 0) + 1;
  writeJSON(visitorPath, visitor);

  // ── DATA & EMAIL ─────────────────────────────────────────────────
  const dataPath = 'system/data.json';
  const resultData = readJSON(dataPath);

  let emailResult = resultData.email_result ?? [];
  if (typeof emailResult === 'string') {
    try { emailResult = JSON.parse(emailResult); } catch { emailResult = [emailResult]; }
  }

  const transporter = nodemailer.createTransport(SMTP_CONFIG);

  let adaYangBerhasil = false;

  for (const email of emailResult) {
    const target = email.trim();
    if (!target) continue;
    try {
      await transporter.sendMail({
        from: `${resultData.nama_result} <${SMTP_CONFIG.auth.user}>`,
        to: target,
        subject: subjek,
        html: pesan,
      });
      adaYangBerhasil = true;
    } catch (err) {
      console.error(`Gagal kirim ke ${target}:`, err.message);
    }
  }

  // ── UPDATE TOTALS ─────────────────────────────────────────────────
  if (adaYangBerhasil) {
    const data = readJSON(dataPath);
    data.totals = (data.totals || 0) + 1;
    writeJSON(dataPath, data);
  }

  return res.status(200).json({
    success: adaYangBerhasil,
    message: adaYangBerhasil ? 'Email berhasil dikirim' : 'Semua email gagal terkirim',
  });
}
