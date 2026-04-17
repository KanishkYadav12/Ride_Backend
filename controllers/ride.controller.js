const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const { sendMessageToSocketId } = require("../socket");
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

    // 2) Get pickup coordinates
    const pickupCoordinates = await mapService.getAddressCoordinate(pickup);

    // 3) Get captains around with a widening search radius.
    const searchRadii = [2, 5, 10, 20];
    let captainsInRadius = [];

    for (const radius of searchRadii) {
      captainsInRadius = await mapService.getCaptainsInTheRadius(
        pickupCoordinates.lat,
        pickupCoordinates.lng,
        radius,
      );

      console.log(
        `🚗 captainsInRadius (${radius}km):`,
        captainsInRadius.map((c) => ({
          id: c._id,
          socketId: c.socketId,
          location: c.location,
          status: c.status,
        })),
      );

      if (captainsInRadius.length > 0) {
        break;
      }
    }

    if (captainsInRadius.length === 0) {
      captainsInRadius = await captainModel.find({
        socketId: { $exists: true, $ne: null },
      });

      console.log(
        "🚨 No captains found in radius, falling back to all connected captains:",
        captainsInRadius.map((c) => ({
          id: c._id,
          socketId: c.socketId,
          location: c.location,
          status: c.status,
        })),
      );
    }

    // 4) Prepare ride object for sending to captains
    ride.otp = "";

    const rideWithUser = await rideModel
      .findOne({ _id: ride._id })
      .populate("user");

    // 5) Notify captains via socket
    captainsInRadius.forEach((captain) => {
      if (!captain.socketId) {
        console.log("⚠️ Captain has no socketId, skipping:", captain._id);
        return;
      }

      console.log("📨 Sending new-ride to captain socket:", captain.socketId);

      sendMessageToSocketId(captain.socketId, {
        event: "new-ride",
        data: rideWithUser,
      });
    });

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
    return res.status(500).json({ message: err.message });
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
