const { Utils } = require("../utils");

const clearAccount = async (req, res) => {
  let api = await Utils.dav3API(req.oauth_token);
  await api.deleteForgeApp("me");
  res.status(200).end();
};

module.exports = { clearAccount };
