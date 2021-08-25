const http = require("https");
const ForgeAPI = require("forge-apis");
const { Utils } = require("../utils");

const onCallback = async (req, res) => {
  res.status(200).end();

  try {
    const socketIO = require("../../server").io;

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
};

module.exports = { onCallback };
