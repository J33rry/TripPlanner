const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance between two { latitude, longitude } points. */
export function distanceKm(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const isMappable = (activity) => activity.latitude != null && activity.longitude != null;

/**
 * Flatten a trip into numbered map stops (1..N across all days, in itinerary
 * order), skipping activities without coordinates.
 */
export function getTripStops(trip) {
  const stops = [];
  for (const day of trip?.stops || []) {
    for (const activity of day.activities) {
      if (!isMappable(activity)) continue;
      stops.push({
        id: activity.id,
        dayId: day.id,
        day: day.day,
        number: stops.length + 1,
        title: activity.title,
        location: activity.location,
        time: activity.time,
        type: activity.type,
        lngLat: [activity.longitude, activity.latitude],
      });
    }
  }
  return stops;
}

/** Where to aim the camera for a trip: its destination, else its stops' centroid. */
export function getTripCenter(trip) {
  const destination = trip?.destination;
  if (destination?.latitude != null && destination?.longitude != null) {
    return { lat: destination.latitude, lng: destination.longitude };
  }
  const stops = getTripStops(trip);
  if (!stops.length) return null;
  const lng = stops.reduce((sum, stop) => sum + stop.lngLat[0], 0) / stops.length;
  const lat = stops.reduce((sum, stop) => sum + stop.lngLat[1], 0) / stops.length;
  return { lat, lng };
}

/** Straight-line length of a path of [lng, lat] points, in km. */
export function pathLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lng1, lat1] = points[i - 1];
    const [lng2, lat2] = points[i];
    total += distanceKm({ latitude: lat1, longitude: lng1 }, { latitude: lat2, longitude: lng2 });
  }
  return total;
}
