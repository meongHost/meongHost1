// api/god.js

module.exports = async (req, res) => {
  try {
    const subjek =
      req.body?.subjek || "";

    const pesan =
      req.body?.pesan || "";

    return res.status(200).json({
      success: true,
      subjek,
      pesan
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
