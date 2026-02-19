import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    // 1. Get Headers
    const headers = Object.keys(data[0]);

    // 2. Map Rows
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] ?? '';
                // Escape commas and wrap in quotes if necessary
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return `"${stringValue.replace(/"/g, '""')}"`;
            }).join(',')
        )
    ].join('\n');

    if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // Mobile Implementation
        const fileUri = FileSystem.documentDirectory + `${filename}.csv`;
        FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 })
            .then(() => {
                Sharing.shareAsync(fileUri);
            })
            .catch(err => {
                console.error('Failed to export CSV on mobile', err);
            });
    }
};
