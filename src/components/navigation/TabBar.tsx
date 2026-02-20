import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';

export type TabType = 'LOG' | 'HISTORY' | 'DASHBOARD' | 'MANAGE' | 'SETTINGS' | 'MORE';

interface TabBarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, setActiveTab }) => {
    // Determine if MORE should be highlighted (if we are in hidden sub-tabs)
    const isMoreActive = activeTab === 'MORE' || activeTab === 'MANAGE' || activeTab === 'SETTINGS';

    const tabs: { type: TabType; icon: string; label: string }[] = [
        { type: 'DASHBOARD', icon: '📊', label: 'Dash' },
        { type: 'LOG', icon: '➕', label: 'Log' },
        { type: 'HISTORY', icon: '🕒', label: 'History' },
        { type: 'MORE', icon: '☰', label: 'More' },
    ];

    return (
        <View style={styles.tabBar}>
            {tabs.map((tab) => {
                const isActive = tab.type === 'MORE' ? isMoreActive : activeTab === tab.type;
                return (
                    <TouchableOpacity
                        key={tab.type}
                        style={[styles.tabItem, isActive && styles.activeTab]}
                        onPress={() => setActiveTab(tab.type)}
                        accessibilityLabel={tab.label}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        testID={`tab-${tab.type}`}
                    >
                        <Text style={[styles.tabIcon, isActive && styles.activeTabText]}>{tab.icon}</Text>
                        <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
                    </TouchableOpacity>
                );
            })}
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

