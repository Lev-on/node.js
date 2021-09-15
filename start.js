require("dotenv").config();

const app = require("./server");
const socetIO = require("./socket.io")(app);
const ngrok = require("ngrok");

let server = socetIO.http.listen(app.get("port"), () => {
  const Ngrok = async () => {
    const url = await ngrok.connect({ proto: "http", port: 3004 }).then((x) => {
      process.env["FORGE_WEBHOOK_URL"] = x;
    });
  };
  Ngrok();
  console.log(`Sever listening on port ${app.get("port")}`);
});

server.on("error", (err) => {
  if (err.errno === "EACESS") {
    console.error(`Port ${app.get("port")} already in use.\nExiting...`);
    process.exit(1);
  }
});
