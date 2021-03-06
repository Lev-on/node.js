const _path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const router = express.Router();
const { getClient } = require("./common/oauth");
const { Utils } = require("./utils");
const { getAviEngine } = require("./logic/GetAvailableEngines");
const { createAppBundle } = require("./logic/CreateAppBundle");
const { createActivity } = require("./logic/CreateActivity");
const { getDefinedActivities } = require("./logic/GetDefinedActivities");
const { GetLocalBundles } = require("./logic/GetLocalBundles");
const { onCallback } = require("./logic/OnCallBack");
const { clearAccount } = require("./logic/ClearAccount");
const { startWorkitem } = require("./logic/StartWorkitem");

router.use(bodyParser.json());

// @ts-ignore
router.use(async (req, res, next) => {
  // @ts-ignore
  req.oauth_client = await getClient(/*config.scopes.internal*/);
  // @ts-ignore
  req.oauth_token = req.oauth_client.getCredentials();
  next();
});

// @ts-ignore
router.get("/appbundles", async (/*GetLocalBundles*/ req, res) => {
  let bundles = await Utils.findFiles(Utils.LocalBundlesFolder, ".zip");
  bundles = bundles.map((fn) => _path.basename(fn, ".zip"));
  res.json(bundles);
});

router.get("/forge/designautomation/engines", getAviEngine);

router.post("/forge/designautomation/appbundles", createAppBundle);

router.post("/forge/designautomation/activities", createActivity);

router.get("/forge/designautomation/activities", getDefinedActivities);

router.post(
  "/forge/designautomation/workitems",
  multer({
    dest: "uploads/",
  }).single("inputFile"),
  startWorkitem
);

router.post("/forge/callback/designautomation", onCallback);

router.delete("/forge/designautomation/account", clearAccount);

module.exports = router;
