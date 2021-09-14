const dav3 = require("autodesk.forge.designautomation");
const { Utils } = require("../utils");

const createActivity = async (req, res) => {
  const activitySpecs = req.body;

  // basic input validation
  const zipFileName = activitySpecs.zipFileName;
  const engineName = activitySpecs.engine;

  // standard name for this sample
  const appBundleName = zipFileName + "AppBundle";
  const activityName = zipFileName + "Activity";

  // get defined activities
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
  const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
  if (!activities.data.includes(qualifiedActivityId)) {
    // define the activity
    // ToDo: parametrize for different engines...
    const engineAttributes = Utils.EngineAttributes(engineName);
    const commandLine = engineAttributes.commandLine.replace(
      "{0}",
      appBundleName
    );
    const activitySpec = {
      id: activityName,
      appbundles: [`${Utils.NickName}.${appBundleName}+${Utils.Alias}`],
      commandLine: [commandLine],
      engine: engineName,
      parameters: {
        inputFile: {
          description: "input file",
          localName: "$(inputFile)",
          ondemand: false,
          required: true,
          verb: dav3.Verb.get,
          zip: false,
        },
        inputJson: {
          description: "input json",
          localName: "params.json",
          ondemand: false,
          required: false,
          verb: dav3.Verb.get,
          zip: false,
        },
        outputFile: {
          description: "output file",
          localName: "outputFile." + engineAttributes.extension,
          ondemand: false,
          required: true,
          verb: dav3.Verb.put,
          zip: false,
        },
      },
      settings: {
        script: {
          value: engineAttributes.script,
        },
      },
    };
    try {
      const newActivity = await api.createActivity(activitySpec);
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create new activity",
      });
    }
    // specify the alias for this Activity
    const aliasSpec = {
      id: Utils.Alias,
      version: 1,
    };
    try {
      const newAlias = await api.createActivityAlias(activityName, aliasSpec);
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create new alias for activity",
      });
    }
    res.status(200).json({
      activity: qualifiedActivityId,
    });
    return;
  }

  res.status(200).json({
    activity: "Activity already defined",
  });
};

module.exports = { createActivity };
