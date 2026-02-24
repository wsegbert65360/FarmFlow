import * as Location from 'expo-location';
import { z } from 'zod';
// Platform import intentionally omitted (not required here).

export interface WeatherData {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    humidity: number;
}

const WeatherApiResponseSchema = z.object({
    current: z.object({
        temperature_2m: z.number(),
        wind_speed_10m: z.number(),
        wind_direction_10m: z.number(),
        relative_humidity_2m: z.number(),
    })
});

export const fetchCurrentWeather = async (): Promise<WeatherData | null> => {
    try {
        // Deterministic weather for Playwright / E2E runs (no geolocation permissions).
        if (typeof globalThis !== 'undefined' && (globalThis as any).E2E_TESTING) {
            return {
                temperature: 72,
                windSpeed: 8,
                windDirection: 'NW',
                humidity: 45,
            };
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;

        const weatherPromise = (async () => {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = location.coords;

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&temperature_unit=fahrenheit`;

            const response = await fetch(url);
            const rawData = await response.json();

            const result = WeatherApiResponseSchema.safeParse(rawData);
            if (!result.success) {
                console.error('[WeatherUtility] API schema mismatch:', result.error.format());
                return null;
            }

            const data = result.data;
            return {
                temperature: data.current.temperature_2m,
                windSpeed: data.current.wind_speed_10m,
                windDirection: degreeToDirection(data.current.wind_direction_10m),
                humidity: data.current.relative_humidity_2m,
            };
        })();

        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
                console.warn('[WeatherUtility] Weather fetch timed out');
                resolve(null);
            }, 5000)
        );

        return await Promise.race([weatherPromise, timeoutPromise]);
    } catch (error) {
        console.error('[WeatherUtility] Error fetching weather:', error);
        return null;
    }
};

function degreeToDirection(degree: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const normalizedDegree = ((degree % 360) + 360) % 360;
    const index = Math.round(normalizedDegree / 45) % 8;
    return directions[index];
}
