import { db } from '../db/powersync';
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateDiagnosticReport = async () => {
    const stats: Record<string, number> = {};
    const tables = ['fields', 'grain_logs', 'spray_logs', 'inventory', 'bins', 'landlords', 'landlord_shares', 'audit_logs', 'attachments'];

    for (const table of tables) {
        try {
            const result = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = result.rows?._array[0]?.count || 0;
        } catch (e) {
            stats[table] = -1; // Error or table doesn't exist
        }
    }

    const status = db.currentStatus;

    const html = `
    <html>
    <head>
        <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { color: #D32F2F; }
            .stat-box { padding: 10px; border: 1px solid #ddd; margin-bottom: 10px; border-radius: 5px; }
            .active { color: green; font-weight: bold; }
            .inactive { color: red; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>FarmFlow Diagnostic Bundle</h1>
        <p><strong>Captured:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Platform:</strong> ${Platform.OS} ${Platform.Version || ''}</p>
        
        <div class="stat-box">
            <h3>Sync Status</h3>
            <p>Connected: <span class="${status?.connected ? 'active' : 'inactive'}">${status?.connected ? 'YES' : 'NO'}</span></p>
            <p>Last Synced: ${status?.lastSyncedAt?.toLocaleString() || 'Never'}</p>
        </div>

        <div class="stat-box">
            <h3>Database Health</h3>
            ${Object.entries(stats).map(([table, count]) => `
                <p><strong>${table}:</strong> ${count === -1 ? 'ERROR' : count} records</p>
            `).join('')}
        </div>

        <div class="stat-box">
            <h3>Outbox State</h3>
            <p>Pending Uploads: ${stats['attachments'] || 0}</p>
        </div>

        <p style="font-size: 10px; color: #666; margin-top: 20px;">
            This report contains structural metadata only. No PII or crop totals are exported in diagnostics.
        </p>
    </body>
    </html>
    `;

    try {
        if (Platform.OS === 'web') {
            console.log('[DiagnosticUtility] Executing manual web print via iframe...');
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(html);
                doc.close();
                iframe.contentWindow?.focus();
                setTimeout(() => {
                    iframe.contentWindow?.print();
                    document.body.removeChild(iframe);
                }, 500);
            }
        } else {
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Export Diagnostic Bundle' });
        }
    } catch (e) {
        console.error('Failed to export diagnostics', e);
        throw e;
    }
};
