const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const {
  sendMessageToSocketId,
  broadcastToAllCaptains,
  broadcastToCaptainsByVehicleType,
} = require("../socket");
const rideModel = require("../models/ride.model");
const captainModel = require("../models/captain.model");

// controllers/ride.controller.js
module.exports.createRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { userId, pickup, destination, vehicleType } = req.body;

  try {
    // 1) Create ride
    const ride = await rideService.createRide({
      user: req.user._id,
      pickup,
      destination,
      vehicleType,
    });

    // 2) Prepare ride object for sending to captains
    ride.otp = "";

    const rideWithUser = await rideModel
      .findOne({ _id: ride._id })
      .populate("user");

    // 3) ✅ Broadcast to ALL online captains so they all see the ride popup
    // Whoever confirms first gets the ride
    console.log(
      "📢 Broadcasting new-ride to captains with vehicle type:",
      rideWithUser.vehicleType,
    );

    await broadcastToCaptainsByVehicleType(
      {
        event: "new-ride",
        data: rideWithUser,
      },
      rideWithUser.vehicleType,
    );

    // 6) ✅ Only one response to client
    return res.status(201).json(ride);
  } catch (err) {
    console.error("Error in createRide:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports.getFare = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pickup, destination } = req.query;
  try {
    const fare = await rideService.getFare(pickup, destination);
    return res.status(200).json(fare);
  } catch (err) {
    const message = err?.message || "Failed to calculate fare";
    const isMapLookupIssue =
      Boolean(err?.isMapLookupIssue) ||
      message.includes("Unable to fetch coordinates") ||
      message.includes("No routes found") ||
      message.includes("Origin and destination are required") ||
      message.includes("Address is required");

    return res.status(isMapLookupIssue ? 502 : 500).json({
      message: isMapLookupIssue
        ? message ||
          "Location services are temporarily busy. Please select from suggestions and retry."
        : "Failed to calculate fare",
    });
  }
};

module.exports.confirmRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const ride = await rideService.confirmRide({
      rideId,
      captain: req.captain,
    });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-confirmed",
      data: ride,
    });

    await broadcastToCaptainsByVehicleType(
      {
        event: "ride-accepted",
        data: {
          rideId: ride._id,
          captainId: req.captain._id,
          captainName: `${req.captain.fullname?.firstname} ${req.captain.fullname?.lastname}`,
        },
      },
      ride.vehicleType,
    );

    return res.status(200).json(ride);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports.startRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId, otp } = req.query;

  try {
    const ride = await rideService.startRide({
      rideId,
      otp,
      captain: req.captain,
    });

    console.log(ride);

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-started",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.endRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { rideId } = req.body;

  try {
    const ride = await rideService.endRide({ rideId, captain: req.captain });

    sendMessageToSocketId(ride.user.socketId, {
      event: "ride-ended",
      data: ride,
    });

    return res.status(200).json(ride);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
