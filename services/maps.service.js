const axios = require("axios");
const captainModel = require("../models/captain.model");

// ✅ REPLACE: Google Geocoding API → Nominatim
// Returns: { ltd: number, lng: number }
module.exports.getAddressCoordinate = async (address) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    address
  )}&format=json&limit=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "uber-clone-student-project", // Required by Nominatim
      },
    });

    if (response.data && response.data.length > 0) {
      const location = response.data[0];
      return {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon),
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

// ✅ REPLACE: Google Places Autocomplete API → Nominatim
// Returns: Array of address strings (exactly like Google Autocomplete)
module.exports.getAutoCompleteSuggestions = async (input) => {
  if (!input) {
    throw new Error("query is required");
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    input
  )}&format=json&addressdetails=1&limit=5`;

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "uber-clone-student-project", // Required by Nominatim
      },
    });

    console.log("AUTOCOMPLETE RAW RESPONSE:", response.data);

    if (response.data && response.data.length > 0) {
      // Return array of strings just like Google Places Autocomplete
      return response.data
        .map((place) => place.display_name)
        .filter((value) => value);
    } else {
      console.error("AUTOCOMPLETE: No results found");
      throw new Error("Unable to fetch suggestions");
    }
  } catch (err) {
    console.error("AUTOCOMPLETE ERROR:", err);
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
