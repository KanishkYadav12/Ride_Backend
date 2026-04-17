const captainModel = require("../models/captain.model");
const mongoose = require("mongoose");
const rideModel = require("../models/ride.model");
const mapService = require("./maps.service");

const shouldBackfillMetrics = (ride) => {
  const distance = Number(ride?.distance || 0);
  const duration = Number(ride?.duration || 0);
  return distance <= 0 || duration <= 0;
};

const backfillCompletedRideMetrics = async (captainObjectId) => {
  const ridesMissingMetrics = await rideModel
    .find({
      captain: captainObjectId,
      status: "completed",
      $or: [
        { distance: { $exists: false } },
        { duration: { $exists: false } },
        { distance: { $lte: 0 } },
        { duration: { $lte: 0 } },
      ],
    })
    .select("_id pickup destination distance duration")
    .lean();

  if (ridesMissingMetrics.length === 0) {
    return;
  }

  for (const ride of ridesMissingMetrics) {
    if (!ride.pickup || !ride.destination || !shouldBackfillMetrics(ride)) {
      continue;
    }

    try {
      const distanceTime = await mapService.getDistanceTime(
        ride.pickup,
        ride.destination,
      );

      await rideModel.updateOne(
        { _id: ride._id },
        {
          $set: {
            distance: distanceTime?.distance?.value || 0,
            duration: distanceTime?.duration?.value || 0,
          },
        },
      );
    } catch (error) {
      console.warn(
        `Failed to backfill distance/duration for ride ${ride._id}:`,
        error.message,
      );
    }
  }
};

module.exports.createCaptain = async ({
  firstname,
  lastname,
  email,
  password,
  color,
  plate,
  capacity,
  vehicleType,
}) => {
  if (
    !firstname ||
    !email ||
    !password ||
    !color ||
    !plate ||
    !capacity ||
    !vehicleType
  ) {
    throw new Error("All fields are required");
  }
  const captain = await captainModel.create({
    fullname: {
      firstname,
      lastname,
    },
    email,
    password,
    vehicle: {
      color,
      plate,
      capacity,
      vehicleType,
    },
  });

  return captain;
};

const formatDashboardStats = (rides) => {
  const summary = rides.reduce(
    (accumulator, ride) => {
      const fare = Number(ride.fare || 0);
      const distance = Number(ride.distance || 0);
      const duration = Number(ride.duration || 0);

      accumulator.completedRides += 1;
      accumulator.totalEarnings += fare;
      accumulator.totalDistanceKm += distance > 0 ? distance / 1000 : 0;
      accumulator.totalDurationHours += duration > 0 ? duration / 3600 : 0;

      return accumulator;
    },
    {
      completedRides: 0,
      totalEarnings: 0,
      totalDistanceKm: 0,
      totalDurationHours: 0,
    },
  );

  const averageFare =
    summary.completedRides > 0
      ? summary.totalEarnings / summary.completedRides
      : 0;

  const averageSpeedKmph =
    summary.totalDurationHours > 0
      ? summary.totalDistanceKm / summary.totalDurationHours
      : 0;

  return {
    ...summary,
    averageFare,
    averageSpeedKmph,
    totalDistanceKm: Number(summary.totalDistanceKm.toFixed(2)),
    totalEarnings: Number(summary.totalEarnings.toFixed(2)),
    averageFare: Number(averageFare.toFixed(2)),
    averageSpeedKmph: Number(averageSpeedKmph.toFixed(2)),
  };
};

module.exports.getDashboardStats = async (captainId) => {
  if (!captainId) {
    throw new Error("Captain id is required");
  }

  const captainObjectId = new mongoose.Types.ObjectId(captainId);

  await backfillCompletedRideMetrics(captainObjectId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const completedRidesMatch = {
    captain: captainObjectId,
    status: "completed",
  };

  const allTimeRides = await rideModel
    .find(completedRidesMatch)
    .populate("user", "fullname email")
    .sort({ completedAt: -1, updatedAt: -1 })
    .lean();

  const todayRides = allTimeRides.filter((ride) => {
    const effectiveCompletedAt = new Date(
      ride.completedAt || ride.updatedAt || ride.createdAt,
    );

    return (
      effectiveCompletedAt >= todayStart && effectiveCompletedAt < tomorrowStart
    );
  });

  const mapRide = (ride) => ({
    id: ride._id,
    pickup: ride.pickup,
    destination: ride.destination,
    fare: ride.fare,
    completedAt: ride.completedAt || ride.updatedAt || ride.createdAt,
    passengerName:
      `${ride.user?.fullname?.firstname || ""} ${ride.user?.fullname?.lastname || ""}`.trim(),
  });

  return {
    today: {
      summary: formatDashboardStats(todayRides),
      rides: todayRides.map(mapRide),
    },
    allTime: {
      summary: formatDashboardStats(allTimeRides),
      rides: allTimeRides.slice(0, 10).map(mapRide),
    },
  };
};
