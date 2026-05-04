import { ToolDefinition, ToolResult } from "./types";

type WeatherData = {
  name?: string;
  weather?: { description?: string }[];
  main?: { temp?: number };
};

const openMeteoCodeToDesc: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function toCelsius(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  // If value looks like Fahrenheit (improbably high for Celsius), convert.
  if (value > 60) {
    return ((value - 32) * 5) / 9;
  }
  return value;
}

export const fetchWeatherTool: ToolDefinition<{ city: string }> = {
  name: "fetchWeather",
  description:
    "Get current weather for a city using OpenWeather (requires OPENWEATHER_API_KEY). Falls back to Open-Meteo (no key). Returns Celsius.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g., London" },
    },
    required: ["city"],
  },
  handler: async (args): Promise<ToolResult<{ summary: string }>> => {
    const providedCity = (args.city || "").trim();
    const defaultCity = (process.env.WEATHER_DEFAULT_CITY || "New York City").trim();
    const cityCandidates = [providedCity || defaultCity];
    if (providedCity && defaultCity && providedCity.toLowerCase() !== defaultCity.toLowerCase()) {
      cityCandidates.push(defaultCity);
    }

    const pickFirst = <T>(vals: T[]): T => vals[0];

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (apiKey) {
      for (const city of cityCandidates) {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          city
        )}&appid=${apiKey}&units=metric`;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = (await res.json()) as WeatherData;
          const desc = data.weather?.[0]?.description || "No description";
          const temp = toCelsius(data.main?.temp);
          const name = data.name || city;
          const tempText =
            temp !== undefined
              ? `${temp < 0 ? "minus " : ""}${Math.abs(temp).toFixed(1)} degrees Celsius`
              : null;
          const summary =
            temp !== undefined
              ? `${name}: ${desc}, ${tempText}`
              : `${name}: ${desc}`;
          return { ok: true, data: { summary } };
        } catch {
          // try next candidate
        }
      }
    }

    // Fallback to Open-Meteo (no key). Requires geocoding first.
    for (const city of cityCandidates) {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
        );
        if (!geoRes.ok) continue;
        const geo = await geoRes.json();
        const hit = geo?.results?.[0];
        if (!hit) continue;
        const { latitude, longitude, name } = hit;
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
        );
        if (!weatherRes.ok) continue;
        const weather = await weatherRes.json();
        const temp = toCelsius(weather?.current?.temperature_2m);
        const code = weather?.current?.weather_code;
        const desc =
          typeof code === "number"
            ? openMeteoCodeToDesc[code] || `Weather code ${code}`
            : "Weather unavailable";
        const tempText =
          temp !== undefined
            ? `${temp < 0 ? "minus " : ""}${Math.abs(temp).toFixed(1)} degrees Celsius`
            : null;
        const summary =
          temp !== undefined
            ? `${name || city}: ${desc}, ${tempText}`
            : `${name || city}: ${desc}`;
        return { ok: true, data: { summary } };
      } catch {
        // try next candidate
      }
    }

    return { ok: false, message: "Weather lookup failed for all candidates." };
  },
};
