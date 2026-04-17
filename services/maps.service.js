const axios = require("axios");
const captainModel = require("../models/captain.model");

const PHOTON_SEARCH_URL = "https://photon.komoot.io/api/";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const INDIA_BIAS = {
  lat: 20.5937,
  lon: 78.9629,
};
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;
const GEO_CACHE_MAX_ENTRIES = 500;
const coordinateCache = new Map();

const httpClient = axios.create({
  timeout: 7000,
  headers: {
    "User-Agent": "uber-clone-student-project",
    Accept: "application/json",
  },
});

const normalizeQuery = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,{2,}/g, ",")
    .replace(/^,|,$/g, "");

const getQueryVariants = (address) => {
  const normalized = normalizeQuery(address);
  const shortened = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");

  return [...new Set([address, normalized, shortened].filter(Boolean))];
};

const getCachedCoordinates = (key) => {
  const entry = coordinateCache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.createdAt > GEO_CACHE_TTL_MS) {
    coordinateCache.delete(key);
    return null;
  }

  return entry.value;
};

const setCachedCoordinates = (key, value) => {
  if (coordinateCache.size >= GEO_CACHE_MAX_ENTRIES) {
    const oldestKey = coordinateCache.keys().next().value;
    if (oldestKey) {
      coordinateCache.delete(oldestKey);
    }
  }

  coordinateCache.set(key, {
    value,
    createdAt: Date.now(),
  });
};

const haversineDistanceMeters = (origin, destination) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(destination.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const buildDistanceDurationResponse = (
  distanceMeters,
  durationSeconds,
  status,
) => ({
  distance: {
    text: `${(distanceMeters / 1000).toFixed(1)} km`,
    value: Math.round(distanceMeters),
  },
  duration: {
    text: `${Math.max(1, Math.round(durationSeconds / 60))} mins`,
    value: Math.round(durationSeconds),
  },
  status,
});

const withRetries = async (fn, retries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const status = error?.response?.status;
      const canRetry =
        !status || status >= 500 || error?.code === "ECONNABORTED";

      if (!canRetry || attempt === retries) {
        break;
      }
    }
  }

  throw lastError;
};

const getPhotonCoordinates = async (query) => {
  const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(
    query,
  )}&limit=5&lang=en&lat=${INDIA_BIAS.lat}&lon=${INDIA_BIAS.lon}`;

  const response = await withRetries(() => httpClient.get(url));
  const features = getIndiaFirstResults(response.data?.features || []);

  if (!features.length) {
    return null;
  }

  const [lng, lat] = features[0]?.geometry?.coordinates || [];

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  return null;
};

const getNominatimCoordinates = async (query) => {
  const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(
    query,
  )}&format=jsonv2&limit=1&countrycodes=in`;

  const response = await withRetries(() => httpClient.get(url));
  const row = Array.isArray(response.data) ? response.data[0] : null;

  if (!row) {
    return null;
  }

  const lat = Number(row.lat);
  const lng = Number(row.lon);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
};

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
  if (!address || !String(address).trim()) {
    const error = new Error("Address is required");
    error.isMapLookupIssue = true;
    throw error;
  }

  const cacheKey = normalizeQuery(address).toLowerCase();
  const cachedValue = getCachedCoordinates(cacheKey);

  if (cachedValue) {
    return cachedValue;
  }

  const queryVariants = getQueryVariants(address);

  try {
    for (const query of queryVariants) {
      const photonCoordinates = await getPhotonCoordinates(query);
      if (photonCoordinates) {
        setCachedCoordinates(cacheKey, photonCoordinates);
        return photonCoordinates;
      }
    }

    for (const query of queryVariants) {
      const nominatimCoordinates = await getNominatimCoordinates(query);
      if (nominatimCoordinates) {
        setCachedCoordinates(cacheKey, nominatimCoordinates);
        return nominatimCoordinates;
      }
    }

    const error = new Error(
      "Unable to fetch coordinates. Please select a location from suggestions.",
    );
    error.isMapLookupIssue = true;
    throw error;
  } catch (error) {
    error.isMapLookupIssue = true;
    console.error("ADDRESS LOOKUP ERROR:", error.message);
    throw error;
  }
};

// ✅ REPLACE: Google Distance Matrix API → OSRM
// Returns EXACT Google Distance Matrix format for frontend compatibility
module.exports.getDistanceTime = async (origin, destination) => {
  if (!origin || !destination) {
    const error = new Error("Origin and destination are required");
    error.isMapLookupIssue = true;
    throw error;
  }

  try {
    const [originCoords, destCoords] = await Promise.all([
      module.exports.getAddressCoordinate(origin),
      module.exports.getAddressCoordinate(destination),
    ]);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=false`;
      const response = await withRetries(() =>
        httpClient.get(url, {
          timeout: 8000,
        }),
      );

      if (
        response.data.code === "Ok" &&
        response.data.routes &&
        response.data.routes.length > 0
      ) {
        const route = response.data.routes[0];
        return buildDistanceDurationResponse(
          route.distance,
          route.duration,
          "OK",
        );
      }

      throw new Error("No routes found for selected locations");
    } catch (routeError) {
      // Fallback: estimate route if routing provider is down but coordinates are available.
      const crowDistanceMeters = haversineDistanceMeters(
        originCoords,
        destCoords,
      );
      const estimatedRoadDistanceMeters = Math.max(
        crowDistanceMeters * 1.35,
        1200,
      );
      const cityAverageSpeedMetersPerSec = 8.5;
      const estimatedDurationSeconds =
        estimatedRoadDistanceMeters / cityAverageSpeedMetersPerSec;

      console.warn(
        "OSRM route failed, using fallback estimate:",
        routeError.message,
      );

      return buildDistanceDurationResponse(
        estimatedRoadDistanceMeters,
        estimatedDurationSeconds,
        "ESTIMATED",
      );
    }
  } catch (err) {
    err.isMapLookupIssue = true;
    console.error("DISTANCE ROUTE ERROR:", err.message);
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
