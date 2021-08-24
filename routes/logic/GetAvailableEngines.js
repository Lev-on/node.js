const { Utils } = require("../utils");

const getAviEngine = async (req, res) => {
  let that = this;
  let Allengines = [];
  let paginationToken = null;
  try {
    const api = await Utils.dav3API(req.oauth_token);
    while (true) {
      let engines = await api.getEngines({ page: paginationToken });
      Allengines = Allengines.concat(engines.data);
      if (engines.paginationToken == null) break;
      paginationToken = engines.paginationToken;
    }
    return res.json(Allengines.sort()); // return list of engines
  } catch (ex) {
    console.error(ex);
    return res.json([]);
  }
};
module.exports = { getAviEngine };
