// api/god.js

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const subjek =
      String(req.body?.subjek || "").trim();

    const pesan =
      String(req.body?.pesan || "").trim();

    // VALIDASI WAJIB
    if (!subjek) {
      return res.status(400).json({
        success: false,
        message: "Subjek wajib diisi"
      });
    }

    if (!pesan) {
      return res.status(400).json({
        success: false,
        message: "Pesan wajib diisi"
      });
    }

    // PANJANG MINIMAL
    if (subjek.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Subjek minimal 3 karakter"
      });
    }

    if (pesan.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Pesan minimal 5 karakter"
      });
    }

    // PANJANG MAKSIMAL
    if (subjek.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Subjek terlalu panjang"
      });
    }

    if (pesan.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Pesan terlalu panjang"
      });
    }

    // ANTI SPAM KARAKTER BERULANG
    const spamPattern = /(.)\1{9,}/;

    if (
      spamPattern.test(subjek) ||
      spamPattern.test(pesan)
    ) {
      return res.status(403).json({
        success: false,
        message: "Spam terdeteksi"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Data diterima",
      data: {
        subjek,
        pesan
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
