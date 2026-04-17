const socketIo = require("socket.io");
const userModel = require("./models/user.model");
const captainModel = require("./models/captain.model");

let io;

function initializeSocket(server) {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://ride-handling.vercel.app",
    "https://ride-frontend-self.vercel.app",
    "https://ride-frontend-kanishk-yadavs-projects.vercel.app",
  ];

  const normalizeOrigin = (origin) => origin?.replace(/\/+$/, "").toLowerCase();

  const isVercelPreview = (origin) => {
    if (!origin) return false;

    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      return hostname.endsWith(".vercel.app");
    } catch {
      return false;
    }
  };

  const isAllowedOrigin = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);

    return (
      !normalizedOrigin ||
      allowedOrigins.some(
        (allowed) => normalizeOrigin(allowed) === normalizedOrigin,
      ) ||
      isVercelPreview(normalizedOrigin)
    );
  };

  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          console.warn(`Blocked socket by CORS: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join", async (data) => {
      const { userId, userType } = data;

      try {
        if (userType === "user") {
          await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
          console.log(`User ${userId} joined with socket ${socket.id}`);
        } else if (userType === "captain") {
          await captainModel.findByIdAndUpdate(userId, { socketId: socket.id });
          console.log(`Captain ${userId} joined with socket ${socket.id}`);
        }
      } catch (error) {
        console.error("Error in join event:", error);
        socket.emit("error", { message: "Failed to join" });
      }
    });

    socket.on("update-location-captain", async (data) => {
      const { userId, location } = data;

      if (!location || !location.lat || !location.lng) {
        return socket.emit("error", { message: "Invalid location data" });
      }

      try {
        const captain = await captainModel.findByIdAndUpdate(userId, {
          location: {
            type: "Point",
            coordinates: [location.lng, location.lat], // [lng, lat]
          },
        });

        if (!captain) {
          return socket.emit("error", { message: "Captain not found" });
        }

        console.log(
          `Captain ${userId} location updated: ${location.lat}, ${location.lng}`,
        );
      } catch (error) {
        console.error("Error updating captain location:", error);
        socket.emit("error", { message: "Failed to update location" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

const sendMessageToSocketId = (socketId, messageObject) => {
  console.log("Sending message to socket:", socketId, messageObject);

  if (io) {
    io.to(socketId).emit(messageObject.event, messageObject.data);
  } else {
    console.log("Socket.io not initialized.");
  }
};

const broadcastToAllCaptains = (messageObject) => {
  console.log(
    "Broadcasting to all captains:",
    messageObject.event,
    messageObject.data,
  );

  if (io) {
    io.emit(messageObject.event, messageObject.data);
  } else {
    console.log("Socket.io not initialized.");
  }
};

module.exports = {
  initializeSocket,
  sendMessageToSocketId,
  broadcastToAllCaptains,
};
