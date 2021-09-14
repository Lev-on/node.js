const { Utils } = require("../utils");

const getDefinedActivities = async (req, res) => {
  const api = await Utils.dav3API(req.oauth_token);

  let activities = null;
  try {
    activities = await api.getActivities();
  } catch (ex) {
    console.error(ex);
    return res.status(500).json({
      diagnostic: "Failed to get activity list",
    });
  }
  let definedActivities = [];
  for (let i = 0; i < activities.data.length; i++) {
    let activity = activities.data[i];
    if (
      activity.startsWith(Utils.NickName) &&
      activity.indexOf("$LATEST") === -1
    )
      definedActivities.push(activity.replace(Utils.NickName + ".", ""));
  }

  res.status(200).json(definedActivities);
};

module.exports = { getDefinedActivities };
