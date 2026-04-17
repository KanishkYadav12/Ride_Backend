const axios = require("axios");
const captainModel = require("../models/captain.model");

const PHOTON_SEARCH_URL = "https://photon.komoot.io/api/";
const INDIA_BIAS = {
  lat: 20.5937,
  lon: 78.9629,
};

const httpClient = axios.create({
  timeout: 7000,
  headers: {
    "User-Agent": "uber-clone-student-project",
  },
});

const buildDisplayName = (properties = {}) => {
  const addressParts = [
    properties.name,
    properties.housenumber && properties.street
      ? `${properties.housenumber} ${properties.street}`
      : properties.street,
    properties.suburb,
    properties.district,
    properties.city,
    properties.state,
    properties.postcode,
    properties.country,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  return addressParts.join(", ");
};

const getIndiaFirstResults = (features = []) => {
  const indiaResults = features.filter((feature) => {
    const country = feature?.properties?.country?.toLowerCase();
    return country === "india";
  });

  return indiaResults.length > 0 ? indiaResults : features;
};

// ✅ REPLACE: Google Geocoding API → Photon (India-biased, free)
// Returns: { ltd: number, lng: number }
module.exports.getAddressCoordinate = async (address) => {
  const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(
    address,
  )}&limit=1&lang=en&lat=${INDIA_BIAS.lat}&lon=${INDIA_BIAS.lon}`;

  try {
    const response = await httpClient.get(url);

    const features = getIndiaFirstResults(response.data?.features || []);

    if (features.length > 0) {
      const location = features[0];
      const [lng, lat] = location.geometry.coordinates;

      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };
    } else {
      throw new Error("Unable to fetch coordinates");
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// ✅ REPLACE: Google Distance Matrix API → OSRM
// Returns EXACT Google Distance Matrix format for frontend compatibility
module.exports.getDistanceTime = async (origin, destination) => {
  if (!origin || !destination) {
    throw new Error("Origin and destination are required");
  }

  try {
    // Step 1: Convert origin address to coordinates
    const originCoords = await module.exports.getAddressCoordinate(origin);

    // Step 2: Convert destination address to coordinates
    const destCoords = await module.exports.getAddressCoordinate(destination);

    // Step 3: Get route from OSRM
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=false`;
    // ✅ Changed all 'ltd' to 'lat'
    const response = await axios.get(url);

    if (
      response.data.code === "Ok" &&
      response.data.routes &&
      response.data.routes.length > 0
    ) {
      const route = response.data.routes[0];

      // ✅ RETURN IN EXACT GOOGLE FORMAT: response.data.rows[0].elements[0]
      // This matches what your frontend expects from Google Distance Matrix
      return {
        distance: {
          text: `${(route.distance / 1000).toFixed(1)} km`,
          value: Math.round(route.distance), // meters
        },
        duration: {
          text: `${Math.round(route.duration / 60)} mins`,
          value: Math.round(route.duration), // seconds
        },
        status: "OK",
      };
    } else {
      throw new Error("No routes found");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// ✅ REPLACE: Google Places Autocomplete API → Photon (India-biased, free)
// Returns: Array of address strings (exactly like Google Autocomplete)
module.exports.getAutoCompleteSuggestions = async (input) => {
  if (!input) {
    throw new Error("query is required");
  }

  const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(
    input.trim(),
  )}&limit=8&lang=en&lat=${INDIA_BIAS.lat}&lon=${INDIA_BIAS.lon}`;

  try {
    const response = await httpClient.get(url);
    const features = getIndiaFirstResults(response.data?.features || []);

    if (features.length > 0) {
      return features
        .map((feature) => buildDisplayName(feature.properties))
        .filter((value) => value && value.length > 0);
    } else {
      throw new Error("Unable to fetch suggestions");
    }
  } catch (err) {
    console.error("AUTOCOMPLETE ERROR:", err.message);
    throw err;
  }
};

// ✅ NO CHANGE NEEDED: MongoDB geospatial query (not Google-dependent)
module.exports.getCaptainsInTheRadius = async (lat, lng, radiusInKm) => {
  const radiusInMeters = radiusInKm * 1000;

  const captains = await captainModel.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat], // [lng, lat]
        },
        $maxDistance: radiusInMeters,
      },
    },
    // OPTIONAL: if you are using `status: 'active'`
    // status: "active",
  });

  return captains;
};
