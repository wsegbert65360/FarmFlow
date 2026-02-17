import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { GrainLog } from '../hooks/useGrain';
import { Landlord, LandlordShare } from '../hooks/useLandlords';
import { Field } from '../hooks/useFields';

export interface ReportData {
    farmName: string;
    dateRange: string;
    logs: any[];
    type: 'EPA_SPRAY' | 'LANDLORD_HARVEST';
}

export const generateReport = async (data: ReportData) => {
    console.log(`[ReportUtility] Generating ${data.type} report with ${data.logs.length} records...`);

    if (!data.logs || data.logs.length === 0) {
        Alert.alert('No Data', 'There are no records to include in this report for the selected period.');
        return;
    }

    const html = data.type === 'EPA_SPRAY' ? generateEPAHtml(data) : generateLandlordHtml(data);

    try {
        if (Platform.OS === 'web') {
            console.log('[ReportUtility] Executing manual web print via iframe...');

            // 1. Create hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // 2. Write content
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(html);
                doc.close();

                // 3. Wait for content to load, then print
                iframe.contentWindow?.focus();
                // Short timeout to allow CSS to apply
                setTimeout(() => {
                    iframe.contentWindow?.print();
                    // 4. Cleanup
                    document.body.removeChild(iframe);
                }, 500);
            }
        } else {
            const { uri } = await Print.printToFileAsync({ html });
            console.log('PDF generated at:', uri);
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
    } catch (e) {
        console.error('Failed to generate/share PDF', e);
        throw e;
    }
};

const generateEPAHtml = (data: ReportData) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        @page { size: landscape; margin: 20px; }
        body { font-family: sans-serif; padding: 10px; font-size: 10px; }
        h1 { color: #2E7D32; margin: 0; padding: 0; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; }
        th, td { border: 1px solid #000; padding: 4px; text-align: left; word-wrap: break-word; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .header { border-bottom: 2px solid #2E7D32; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
        .farm-info { flex: 1; }
        .audit-safe { color: #D32F2F; font-weight: bold; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="farm-info">
            <h1>EPA Spray Application Log</h1>
            <p style="margin: 2px 0;"><strong>Farm:</strong> ${data.farmName} | <strong>Period:</strong> ${data.dateRange}</p>
        </div>
        <div class="audit-safe">STATE COMPLIANT AUDIT LOG</div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width: 70px;">Date/Time</th>
                <th style="width: 80px;">Field/Acres</th>
                <th style="width: 70px;">Crop/Pest</th>
                <th style="width: 120px;">Product / EPA #</th>
                <th style="width: 80px;">Rate / Total</th>
                <th style="width: 100px;">Weather (T/W/D/H)</th>
                <th style="width: 120px;">Safety Windows</th>
                <th>Applicator / Cert #</th>
            </tr>
        </thead>
        <tbody>
            ${data.logs.map(log => `
                <tr>
                    <td>
                        ${new Date(log.start_time).toLocaleDateString()}<br/>
                        ${new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                        <strong>${log.field_name || 'N/A'}</strong><br/>
                        ${log.acres_treated || log.field_acreage || '?'} Treated Ac
                    </td>
                    <td>
                        ${log.target_crop || 'General'}<br/>
                        <span style="font-size: 8px;">Pest: ${log.target_pest || 'Broadleaf/Grass'}</span>
                    </td>
                    <td>
                        <strong>${log.product_name || log.recipe_name || 'N/A'}</strong><br/>
                        EPA: ${log.epa_number || 'N/A'}
                    </td>
                    <td>
                        ${log.rate_per_acre || '?'} Gal/Ac<br/>
                        Total: ${log.total_product || '?'} Gal
                    </td>
                    <td>
                        ${log.weather_temp || '?'}°F | ${log.weather_wind_speed || '?'} mph<br/>
                        Dir: ${log.weather_wind_dir || '?'} | Hum: ${log.weather_humidity || '?'}%
                    </td>
                    <td>
                        <div style="color: #D32F2F; font-weight: bold;">
                            REI: ${log.rei_hours || 0}h → ${log.rei_hours ? new Date(new Date(log.start_time).getTime() + log.rei_hours * 3600000).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Immediate'}
                        </div>
                        <div style="color: #2E7D32; font-weight: bold; margin-top: 2px;">
                            PHI: ${log.phi_days || 0}d → ${log.phi_days ? new Date(new Date(log.start_time).getTime() + log.phi_days * 86400000).toLocaleDateString() : 'Immediate'}
                        </div>
                    </td>
                    <td>
                        ${log.applicator_name || 'System Operator'}<br/>
                        Cert: ${log.applicator_cert || 'N/A'}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div style="margin-top: 20px; font-size: 8px; color: #666; display: flex; justify-content: space-between;">
        <span>Generated by FarmFlow Electronic Recordkeeping System</span>
        <span>Audit Verification Date: ${new Date().toLocaleString()}</span>
    </div>
</body>
</html>
`;

const generateLandlordHtml = (data: ReportData) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        h1 { color: #1976D2; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { backgroundColor: #f2f2f2; }
        .summary { margin-top: 20px; padding: 15px; backgroundColor: #e3f2fd; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Landlord Crop Settlement Report</h1>
    <p><strong>Farm:</strong> ${data.farmName}</p>
    <p><strong>Reporting Period:</strong> ${data.dateRange}</p>

    <table>
        <thead>
            <tr>
                <th>Field</th>
                <th>Total Bushels</th>
                <th>Landlord Share %</th>
                <th>Landlord Bushels</th>
            </tr>
        </thead>
        <tbody>
            ${data.logs.map(log => `
                <tr>
                    <td>${log.fieldName}</td>
                    <td>${log.totalBushels.toFixed(2)}</td>
                    <td>${(log.sharePercentage * 100).toFixed(0)}%</td>
                    <td>${log.landlordBushels.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="summary">
        <h3>Total Settlement Summary</h3>
        <p><strong>Total Crop to Landlord:</strong> ${data.logs.reduce((s, l) => s + l.landlordBushels, 0).toFixed(2)} Bushels</p>
    </div>
</body>
</html>
`;
