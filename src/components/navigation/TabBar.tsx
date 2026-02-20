import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';

export type TabType = 'LOG' | 'HISTORY' | 'DASHBOARD' | 'MANAGE' | 'SETTINGS';

interface TabBarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, setActiveTab }) => {
    const tabs: { type: TabType; icon: string; label: string }[] = [
        { type: 'LOG', icon: '➕', label: 'Log' },
        { type: 'HISTORY', icon: '🕒', label: 'History' },
        { type: 'DASHBOARD', icon: '📊', label: 'Dash' },
        { type: 'MANAGE', icon: '⚙️', label: 'Manage' },
        { type: 'SETTINGS', icon: '🔧', label: 'Settings' }, // Fixed missing label for Settings in original code
    ];

    return (
        <View style={styles.tabBar}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab.type}
                    style={[styles.tabItem, activeTab === tab.type && styles.activeTab]}
                    onPress={() => setActiveTab(tab.type)}
                    accessibilityLabel={tab.label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === tab.type }}
                >
                    <Text style={[styles.tabIcon, activeTab === tab.type && styles.activeTabText]}>{tab.icon}</Text>
                    <Text style={[styles.tabText, activeTab === tab.type && styles.activeTabText]}>{tab.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        height: 65,
        backgroundColor: Theme.colors.white,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
        paddingBottom: 5,
    },
    tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    activeTab: { borderTopWidth: 3, borderTopColor: Theme.colors.primary },
    tabIcon: { fontSize: 20, marginBottom: 2 },
    tabText: { ...Theme.typography.caption, fontWeight: 'bold' },
    activeTabText: { color: Theme.colors.primary },
});

