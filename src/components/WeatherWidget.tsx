import React from 'react';
import { View, Text } from 'react-native';
import { Sun, Wind, Droplets } from 'lucide-react-native';

export const WeatherWidget = () => {
    // Mock weather data for now - could be hooked up to an API later
    const weather = {
        temp: 72,
        condition: 'Clear Sky',
        humidity: 45,
        windSpeed: 8,
        windDir: 'NW',
    };

    const isGoodToSpray = weather.windSpeed >= 3 && weather.windSpeed <= 10;

    return (
        <View
            className="bg-blue-600 rounded-3xl p-6 mx-4 my-2 shadow-lg"
            style={{ backgroundColor: '#2563eb', borderRadius: 24, padding: 24, marginHorizontal: 16, marginVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 }}
            testID="weather-widget"
        >
            <View
                className="flex-row justify-between items-center"
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <View className="flex-row items-center" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Sun color="white" size={40} style={{ marginRight: 12 }} />
                    <View>
                        <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold' }}>{weather.temp}°F</Text>
                        <Text style={{ color: '#dbeafe', fontSize: 14, fontWeight: '500' }}>
                            {weather.condition} • Hum {weather.humidity}%
                        </Text>
                    </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <View className="flex-row items-center mb-1" style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Wind color="white" size={20} style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{weather.windSpeed} mph</Text>
                    </View>
                    <Text style={{ color: '#dbeafe', fontSize: 12, textAlign: 'right', lineHeight: 16 }}>
                        {weather.windDir} Wind • {isGoodToSpray ? 'Good to\nSpray' : 'Poor Spray\nConditions'}
                    </Text>
                </View>
            </View>
        </View>
    );
};
