const _path = require("path");
const _fs = require("fs");
const express = require("express");
const http = require("https");
const bodyParser = require("body-parser");
const multer = require("multer");
const router = express.Router();
const { getClient } = require("./common/oauth");
const config = require("../config");
const dav3 = require("autodesk.forge.designautomation");
const ForgeAPI = require("forge-apis");
const { Utils } = require("./utils");
const { getAviEngine } = require("./logic/GetAvailableEngines");
const { createAppBundle } = require("./logic/CreateAppBundle");
// console.log(`Create - ${createAppBundle}`);
// console.log(`AviEng - ${getAviEngine}`);
// console.log(`Utils - ${Utils}`);

router.use(bodyParser.json());

router.use(async (req, res, next) => {
  req.oauth_client = await getClient(/*config.scopes.internal*/);
  req.oauth_token = req.oauth_client.getCredentials();
  next();
});

router.get("/appbundles", async (/*GetLocalBundles*/ req, res) => {
  let bundles = await Utils.findFiles(Utils.LocalBundlesFolder, ".zip");
  bundles = bundles.map((fn) => _path.basename(fn, ".zip"));
  res.json(bundles);
});

router.get("/forge/designautomation/engines", getAviEngine);

router.post("/forge/designautomation/appbundles", createAppBundle);

router.post(
  "/forge/designautomation/activities",
  async (/*CreateActivity*/ req, res) => {
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

    // as this activity points to a AppBundle "dev" alias (which points to the last version of the bundle),
    // there is no need to update it (for this sample), but this may be extended for different contexts
    res.status(200).json({
      activity: "Activity already defined",
    });
  }
);

router.get(
  "/forge/designautomation/activities",
  async (/*GetDefinedActivities*/ req, res) => {
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
  }
);

router.post(
  "/forge/designautomation/workitems",
  multer({
    dest: "uploads/",
  }).single("inputFile"),
  async (/*StartWorkitem*/ req, res) => {
    const input = req.body;

    // basic input validation
    const workItemData = JSON.parse(input.data);
    const widthParam = parseFloat(workItemData.width);
    const heigthParam = parseFloat(workItemData.height);
    const activityName = `${Utils.NickName}.${workItemData.activityName}`;
    const browerConnectionId = workItemData.browerConnectionId;

    // save the file on the server
    const ContentRootPath = _path.resolve(_path.join(__dirname, "../.."));
    const fileSavePath = _path.join(
      ContentRootPath,
      _path.basename(req.file.originalname)
    );

    // upload file to OSS Bucket
    const bucketKey = Utils.NickName.toLowerCase() + "-designautomation";
    try {
      let payload = new ForgeAPI.PostBucketsPayload();
      payload.bucketKey = bucketKey;
      payload.policyKey = "transient"; // expires in 24h
      await new ForgeAPI.BucketsApi().createBucket(
        payload,
        {},
        req.oauth_client,
        req.oauth_token
      );
    } catch (ex) {
      // in case bucket already exists
    }
    // 2. upload inputFile
    const inputFileNameOSS = `${new Date()
      .toISOString()
      .replace(/[-T:\.Z]/gm, "")
      .substring(0, 14)}_input_${_path.basename(req.file.originalname)}`; // avoid overriding
    try {
      let contentStream = _fs.createReadStream(req.file.path);
      await new ForgeAPI.ObjectsApi().uploadObject(
        bucketKey,
        inputFileNameOSS,
        req.file.size,
        contentStream,
        {},
        req.oauth_client,
        req.oauth_token
      );
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to upload file for workitem",
      });
    }

    // prepare workitem arguments
    // 1. input file
    const inputFileArgument = {
      url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${inputFileNameOSS}`,
      headers: {
        Authorization: `Bearer ${req.oauth_token.access_token}`,
      },
    };
    // 2. input json
    const inputJson = {
      width: widthParam,
      height: heigthParam,
    };
    const inputJsonArgument = {
      url:
        "data:application/json, " +
        JSON.stringify(inputJson).replace(/"/g, "'"),
    };

    // Better to use a presigned url to avoid the token to expire
    const outputFileNameOSS = `${new Date()
      .toISOString()
      .replace(/[-T:\.Z]/gm, "")
      .substring(0, 14)}_output_${_path.basename(req.file.originalname)}`; // avoid overriding
    let signedUrl = null;
    try {
      await new ForgeAPI.ObjectsApi().copyTo(
        bucketKey,
        inputFileNameOSS,
        outputFileNameOSS,
        req.oauth_client,
        req.oauth_token
      );
      signedUrl = await new ForgeAPI.ObjectsApi().createSignedResource(
        bucketKey,
        outputFileNameOSS,
        {
          minutesExpiration: 60,
          singleUse: true,
        },
        {
          access: "write",
        },
        req.oauth_client,
        req.oauth_token
      );
      signedUrl = signedUrl.body.signedUrl;
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create a signed URL for output file",
      });
    }
    const outputFileArgument = {
      url: signedUrl,
      headers: {
        Authorization: "",
        "Content-type": "application/octet-stream",
      },
      verb: dav3.Verb.put,
    };

    const callbackUrl = `${config.credentials.webhook_url}/api/forge/callback/designautomation?id=${browerConnectionId}&outputFileName=${outputFileNameOSS}&inputFileName=${inputFileNameOSS}`;
    const workItemSpec = {
      activityId: activityName,
      arguments: {
        inputFile: inputFileArgument,
        inputJson: inputJsonArgument,
        outputFile: outputFileArgument,
        onComplete: {
          verb: dav3.Verb.post,
          url: callbackUrl,
        },
      },
    };
    let workItemStatus = null;
    try {
      const api = await Utils.dav3API(req.oauth_token);
      workItemStatus = await api.createWorkItem(workItemSpec);
    } catch (ex) {
      console.error(ex);
      return res.status(500).json({
        diagnostic: "Failed to create a workitem",
      });
    }
    res.status(200).json({
      workItemId: workItemStatus.id,
    });
  }
);

router.post(
  "/forge/callback/designautomation",
  async (/*OnCallback*/ req, res) => {
    res.status(200).end();

    try {
      const socketIO = require("../server").io;

      const bodyJson = req.body;
      socketIO.to(req.query.id).emit("onComplete", bodyJson);

      http.get(bodyJson.reportUrl, (response) => {
        response.setEncoding("utf8");
        let rawData = "";
        response.on("data", (chunk) => {
          rawData += chunk;
        });
        response.on("end", () => {
          socketIO.to(req.query.id).emit("onComplete", rawData);
        });
      });

      const objectsApi = new ForgeAPI.ObjectsApi();
      const bucketKey = Utils.NickName.toLowerCase() + "-designautomation";
      if (bodyJson.status === "success") {
        try {
          const signedUrl = await objectsApi.createSignedResource(
            bucketKey,
            req.query.outputFileName,
            {
              minutesExpiration: 10,
              singleUse: false,
            },
            {
              access: "read",
            },
            req.oauth_client,
            req.oauth_token
          );
          socketIO
            .to(req.query.id)
            .emit("downloadResult", signedUrl.body.signedUrl);
        } catch (ex) {
          console.error(ex);
          socketIO
            .to(req.query.id)
            .emit(
              "onComplete",
              "Failed to create presigned URL for outputFile.\nYour outputFile is available in your OSS bucket."
            );
        }
      }

      // delete the input file (we do not need it anymore)
      try {
        objectsApi.deleteObject(
          bucketKey,
          req.query.inputFileName,
          req.oauth_client,
          req.oauth_token
        );
      } catch (ex) {
        console.error(ex);
      }
    } catch (ex) {
      console.error(ex);
    }
  }
);

router.delete(
  "/forge/designautomation/account",
  async (/*ClearAccount*/ req, res) => {
    let api = await Utils.dav3API(req.oauth_token);
    await api.deleteForgeApp("me");
    res.status(200).end();
  }
);

module.exports = router;
