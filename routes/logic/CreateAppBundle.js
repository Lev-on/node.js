const _path = require("path");
const dav3 = require("autodesk.forge.designautomation");
const { Utils } = require("../utils");
// const { getAviEngine } = require("./logic/GetAvailableEngines");
// const { createAppBundle } = require("./CreateAppBundle");

const createAppBundle = async (req, res) => {
  const appBundleSpecs = req.body;

  const zipFileName = appBundleSpecs.zipFileName;
  const engineName = appBundleSpecs.engine;

  const appBundleName = zipFileName + "AppBundle";

  const packageZipPath = _path.join(
    Utils.LocalBundlesFolder,
    zipFileName + ".zip"
  );

  // get defined app bundles
  const api = await Utils.dav3API(req.oauth_token);
  let appBundles = null;
  try {
    appBundles = await api.getAppBundles();
  } catch (ex) {
    console.error(ex);
    return res.status(500).json({
      diagnostic: "Failed to get the Bundle list",
    });
  }

  // check if app bundle is already define
  let newAppVersion = null;
  const qualifiedAppBundleId = `${Utils.NickName}.${appBundleName}+${Utils.Alias}`;
  if (!appBundles.data.includes(qualifiedAppBundleId)) {
    const appBundleSpec = dav3.AppBundle.constructFromObject({
      package: appBundleName,
      engine: engineName,
      id: appBundleName,
      description: `Description for ${appBundleName}`,
    });
    try {
      newAppVersion = await api.createAppBundle(appBundleSpec);
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Cannot create new app",
      });
    }

    const aliasSpec = {
      id: Utils.Alias,
      version: 1,
    };
    try {
      const newAlias = await api.createAppBundleAlias(appBundleName, aliasSpec);
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create an alias",
      });
    }
  } else {
    // create new version
    const appBundleSpec = {
      engine: engineName,
      description: appBundleName,
    };
    try {
      newAppVersion = await api.createAppBundleVersion(
        appBundleName,
        appBundleSpec
      );
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Cannot create new version",
      });
    }

    const aliasSpec = {
      version: newAppVersion.version,
    };
    try {
      const newAlias = await api.modifyAppBundleAlias(
        appBundleName,
        Utils.Alias,
        aliasSpec
      );
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create an alias",
      });
    }
  }

  try {
    await Utils.uploadFormDataWithFile(
      packageZipPath,
      newAppVersion.uploadParameters.endpointURL,
      newAppVersion.uploadParameters.formData
    );
  } catch (ex) {
    console.error(ex);
    return res.status(500).json({
      diagnostic: "Failed to upload bundle on s3",
    });
  }

  return res.status(200).json({
    appBundle: qualifiedAppBundleId,
    version: newAppVersion.version,
  });
};

module.exports = { createAppBundle };
