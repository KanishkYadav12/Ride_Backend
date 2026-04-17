const http = require("http");
const app = require("./app");
const { initializeSocket } = require("./socket");
const connectToDb = require("./db/db");
const port = process.env.PORT || 3000;

const server = http.createServer(app);

async function startServer() {
  try {
    await connectToDb();
    initializeSocket(server);

    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
