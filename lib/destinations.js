// Suggested destinations pinned on the globe. `landmark` is a Wikipedia title
// (its lead photo becomes the card image).
export const DESTINATIONS = [
  {
    id: "london", name: "London", region: "United Kingdom", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276,
    landmark: "Palace of Westminster",
    labelSide: "left",
    prompt: "Plan a 4-day trip to London with neighborhood walks, great local food, a little history, and a relaxed pace.",
    note: "Old-world corners, markets & riverside walks",
  },
  {
    id: "paris", name: "Paris", region: "France", country: "France", latitude: 48.8566, longitude: 2.3522,
    landmark: "Eiffel Tower",
    prompt: "Plan a 3-day weekend in Paris with art, cafe stops, beautiful walks, and time to explore at an unhurried pace.",
    note: "A weekend of art, cafés & hidden streets",
  },
  {
    id: "goa", name: "Goa", region: "India", country: "India", latitude: 15.0086, longitude: 74.0237,
    landmark: "Palolem Beach",
    prompt: "Plan a relaxed 5-day Goa trip with beach days in the south, Old Goa's churches, a Fontainhas walk, a spice plantation visit and seafood shacks at sunset.",
    note: "Palm beaches, Portuguese lanes & seafood shacks",
  },
  {
    id: "rome", name: "Rome", region: "Italy", country: "Italy", latitude: 41.8902, longitude: 12.4922,
    landmark: "Colosseum",
    labelSide: "left",
    prompt: "Plan a 4-day trip to Rome covering the Colosseum, the Vatican and Trastevere, with long lunches and evening strolls.",
    note: "Ancient ruins, piazzas & proper carbonara",
  },
  {
    id: "santorini", name: "Santorini", region: "Greece", country: "Greece", latitude: 36.4618, longitude: 25.3753,
    landmark: "Oia, Greece",
    labelSide: "left",
    prompt: "Plan a relaxed 4-day Santorini getaway with caldera views, beach time, wine tasting and a sunset in Oia.",
    note: "Whitewashed cliffs & caldera sunsets",
  },
  {
    id: "istanbul", name: "Istanbul", region: "Türkiye", country: "Türkiye", latitude: 41.0086, longitude: 28.9802,
    landmark: "Hagia Sophia",
    prompt: "Plan a 4-day trip to Istanbul with Hagia Sophia, the bazaars, a Bosphorus cruise and plenty of street food.",
    note: "Where two continents share a skyline",
  },
  {
    id: "iceland", name: "Iceland", region: "South Coast", country: "Iceland", latitude: 63.5321, longitude: -19.5114,
    landmark: "Skógafoss",
    labelSide: "left",
    prompt: "Plan a 6-day Iceland road trip along the Ring Road's south coast with waterfalls, black-sand beaches, glaciers and hot springs.",
    note: "Waterfalls, glaciers & black-sand beaches",
  },
  {
    id: "giza", name: "Cairo", region: "Egypt", country: "Egypt", latitude: 29.9792, longitude: 31.1342,
    landmark: "Giza pyramid complex",
    labelSide: "left",
    prompt: "Plan a 5-day trip to Cairo and Giza with the Pyramids, the Egyptian Museum, Islamic Cairo and a Nile felucca ride.",
    note: "The Pyramids, the Nile & old Cairo",
  },
  {
    id: "dubai", name: "Dubai", region: "United Arab Emirates", country: "UAE", latitude: 25.1972, longitude: 55.2744,
    landmark: "Burj Khalifa",
    prompt: "Plan a 4-day Dubai trip mixing the Burj Khalifa, old Dubai souks, a desert evening and beach downtime.",
    note: "Skyscrapers, souks & desert dunes",
  },
  {
    id: "cape-town", name: "Cape Town", region: "South Africa", country: "South Africa", latitude: -33.9628, longitude: 18.4098,
    landmark: "Table Mountain",
    prompt: "Plan a 5-day Cape Town trip with Table Mountain, the Cape Peninsula drive, Boulders Beach penguins and a winelands day.",
    note: "Table Mountain, penguins & winelands",
  },
  {
    id: "kyoto", name: "Kyoto", region: "Japan", country: "Japan", latitude: 34.9671, longitude: 135.7727,
    landmark: "Fushimi Inari-taisha",
    prompt: "Plan a 4-day trip to Kyoto with temples and shrines, Gion in the evening, Arashiyama and a day trip to Nara.",
    note: "Torii gates, temples & quiet gardens",
  },
  {
    id: "bali", name: "Bali", region: "Indonesia", country: "Indonesia", latitude: -8.6212, longitude: 115.0868,
    landmark: "Tanah Lot",
    prompt: "Plan a 6-day Bali trip balancing Ubud's rice terraces and temples with beach days and a sunset at Tanah Lot.",
    note: "Sea temples, rice terraces & surf",
  },
  {
    id: "sydney", name: "Sydney", region: "Australia", country: "Australia", latitude: -33.8568, longitude: 151.2153,
    landmark: "Sydney Opera House",
    prompt: "Plan a 5-day Sydney trip with the Opera House, harbour ferries, the Bondi to Coogee walk and a Blue Mountains day.",
    note: "Harbour ferries & coastal walks",
  },
  {
    id: "new-york", name: "New York", region: "United States", country: "USA", latitude: 40.6892, longitude: -74.0445,
    landmark: "Statue of Liberty",
    prompt: "Plan a 5-day first trip to New York City with classic sights, Central Park, great neighborhoods to walk and iconic food.",
    note: "Skyline views, parks & every cuisine",
  },
  {
    id: "san-francisco", name: "San Francisco", region: "California", country: "USA", latitude: 37.8199, longitude: -122.4783,
    landmark: "Golden Gate Bridge",
    labelSide: "left",
    prompt: "Plan a 4-day San Francisco trip with the Golden Gate Bridge, Alcatraz, hilly neighborhoods and a day in wine country.",
    note: "Fog, cable cars & the Golden Gate",
  },
  {
    id: "banff", name: "Banff", region: "Canada", country: "Canada", latitude: 51.3217, longitude: -116.1860,
    landmark: "Moraine Lake",
    prompt: "Plan a 5-day Banff trip with Lake Louise, Moraine Lake, scenic hikes, the Icefields Parkway and a hot springs soak.",
    note: "Turquoise lakes & Rocky Mountain trails",
  },
  {
    id: "chichen-itza", name: "Yucatán", region: "Mexico", country: "Mexico", latitude: 20.6843, longitude: -88.5678,
    landmark: "Chichen Itza",
    prompt: "Plan a 6-day Yucatán trip with Chichén Itzá, cenote swims, colonial Mérida and time on the Caribbean coast.",
    note: "Maya ruins, cenotes & Caribbean beaches",
  },
  {
    id: "machu-picchu", name: "Machu Picchu", region: "Peru", country: "Peru", latitude: -13.1631, longitude: -72.5450,
    landmark: "Machu Picchu",
    prompt: "Plan a 6-day Peru trip from Cusco through the Sacred Valley to Machu Picchu, pacing it for the altitude.",
    note: "Inca citadel above the clouds",
  },
  {
    id: "rio", name: "Rio de Janeiro", region: "Brazil", country: "Brazil", latitude: -22.9519, longitude: -43.2105,
    landmark: "Christ the Redeemer (statue)",
    prompt: "Plan a 5-day Rio de Janeiro trip with Christ the Redeemer, Sugarloaf, Copacabana and Ipanema, and Santa Teresa's streets.",
    note: "Sugarloaf, samba & Copacabana",
  },
];

// Flight paths drawn between destinations, as [from id, to id].
const ROUTES = [
  ["london", "new-york"],
  ["paris", "goa"],
  ["goa", "bali"],
  ["rome", "giza"],
  ["istanbul", "dubai"],
  ["dubai", "cape-town"],
  ["kyoto", "sydney"],
  ["san-francisco", "kyoto"],
  ["iceland", "banff"],
  ["new-york", "rio"],
  ["chichen-itza", "machu-picchu"],
];

const byId = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));
const point = (d) => ({ lat: d.latitude, lon: d.longitude });
export const FLIGHT_ROUTES = ROUTES.map(([from, to]) => ({ from: point(byId[from]), to: point(byId[to]) }));
