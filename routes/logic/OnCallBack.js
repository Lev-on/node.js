const http = require("https");
const ForgeAPI = require("forge-apis");
const { Utils } = require("../utils");
const fetch = require("node-fetch");
const fs = require("fs");
const Downloader = require("nodejs-file-downloader");
const zl = require("zip-lib");

const onCallback = async (req, res) => {
  res.status(200).end();

  const delete_file = async (file_name) => {
    return await fs.unlink(`./dow/${file_name}`, (err) => {
      if (err) console.log(err);

      console.log("file Deleted");
    });
  };

  const outputFileName_dow = req.query.outputFileName;

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

        const downloader = new Downloader({
          url: signedUrl.body.signedUrl,
          directory: "./dow",
        });

        try {
          await downloader
            .download()
            .then(() => {
              zl.archiveFile(
                `./dow/${req.query.outputFileName}`,
                `./zip/${req.query.outputFileName}.zip`
              );
            })
            .then(
              async function () {
                console.log("done");
              },
              function (err) {
                console.log(err);
              }
            );
          console.log("All done");
        } catch (error) {
          console.log("Download failed", error);
        }

        socketIO
          .to(req.query.id)
          .emit("downloadResult", signedUrl.body.signedUrl);

        socketIO
          .to(req.query.id)
          .emit(
            "downloadResultZip",
            `http://localhost:3004/api/zipdownload/${req.query.outputFileName}.zip`
          );
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
    // await fs.promises.unlink(`./dow/${req.query.outputFileName}`, (err) => {
    //   if (err) throw err;

    //   console.log("file Deleted");
    // });

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
