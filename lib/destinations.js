// Suggested destinations pinned on the home globe. `landmark` is the
// Wikipedia article whose lead photo illustrates the hover card.
export const DESTINATIONS = [
  {
    id: "london", name: "London", region: "United Kingdom", latitude: 51.5072, longitude: -0.1276,
    landmark: "Palace of Westminster",
    labelSide: "left", // Paris sits just below; keep the labels apart

    prompt: "Plan a 4-day trip to London with neighborhood walks, great local food, a little history, and a relaxed pace.",
    note: "Old-world corners, markets & riverside walks",
  },
  {
    id: "paris", name: "Paris", region: "France", latitude: 48.8566, longitude: 2.3522,
    landmark: "Eiffel Tower",
    prompt: "Plan a 3-day weekend in Paris with art, cafe stops, beautiful walks, and time to explore at an unhurried pace.",
    note: "A weekend of art, cafés & hidden streets",
  },
  {
    id: "india", name: "India", region: "Golden Triangle", latitude: 27.1751, longitude: 78.0421,
    landmark: "Taj Mahal",
    prompt: "Plan a 7-day first trip to India's Golden Triangle (Delhi, Agra, Jaipur) with a thoughtful mix of culture, food, and local experiences, at a comfortable pace.",
    note: "Palaces, spice markets & the Taj at dawn",
  },
];
