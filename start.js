const app = require("./server");
const socetIO = require("./socket.io")(app);

let server = socetIO.http.listen(app.get("port"), () => {
  console.log(`Sever listening on port ${app.get("port")}`);
});

server.on("error", (err) => {
  if (err.errno === "EACESS") {
    console.error(`Port ${app.get("port")} already in use.\nExiting...`);
    process.exit(1);
  }
});
