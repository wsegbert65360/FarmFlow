import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';

export type TabType = 'MANAGE' | 'HISTORY' | 'DASHBOARD' | 'SETTINGS' | 'MORE';

interface TabBarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, setActiveTab }) => {
    // Current tabs based on redesign: Fields (MANAGE), Grain (DASHBOARD/New), More (MORE)
    // Note: Mapping DASHBOARD to "Grain" for now as per user request to simplify.

    const tabs: { type: TabType; icon: string; label: string }[] = [
        { type: 'MANAGE', icon: '🚜', label: 'Fields' },
        { type: 'DASHBOARD', icon: '📊', label: 'Grain' },
        { type: 'MORE', icon: '🔧', label: 'More' },
    ];

    return (
        <View
            className="flex-row h-20 bg-white border-t border-gray-100 pb-4 items-center px-4"
            style={{ flexDirection: 'row', height: 80, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f3f4f6', alignItems: 'center', paddingHorizontal: 16, width: '100%' }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.type;
                // Unused variable removed to harden production build

                return (
                    <TouchableOpacity
                        key={tab.type}
                        className="flex-1 items-center justify-center h-full"
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setActiveTab(tab.type)}
                        accessibilityLabel={tab.label}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        testID={`tab-${tab.type}`}
                    >
                        <Text style={{ fontSize: 24, color: isActive ? '#2563eb' : '#9ca3af' }}>{tab.icon}</Text>
                        <Text
                            className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                            style={{ fontSize: 10, fontWeight: 'bold', marginTop: 4, color: isActive ? '#2562eb' : '#9ca3af' }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};
