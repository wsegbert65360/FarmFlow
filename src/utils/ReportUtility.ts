import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { showAlert } from './AlertUtility';
import { GrainLog } from '../hooks/useGrain';
import { Landlord, FieldSplit } from '../hooks/useLandlords';
import { Field } from '../hooks/useFields';

export interface ReportData {
    farmName: string;
    dateRange: string;
    logs: any[];
    type: 'EPA_SPRAY' | 'LANDLORD_HARVEST' | 'SEASON_PACKET';
}

export const generateReport = async (data: ReportData) => {
    console.log(`[ReportUtility] Generating ${data.type} report with ${data.logs.length} records...`);

    if (!data.logs || data.logs.length === 0) {
        showAlert('No Data', 'There are no records to include in this report for the selected period.');
        return;
    }

    const html = data.type === 'EPA_SPRAY' ? generateEPAHtml(data) :
        data.type === 'LANDLORD_HARVEST' ? generateLandlordHtml(data) :
            generateSeasonPacketHtml(data);

    try {
        if (Platform.OS === 'web') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                // Wait for styles/images if necessary
                printWindow.onload = () => {
                    printWindow.print();
                    // Optional: printWindow.close();
                };
                // Fallback if onload doesn't fire (sometimes happens if no external resources)
                setTimeout(() => {
                    if (printWindow) printWindow.print();
                }, 1000);
            } else {
                // If popup blocked, use the iframe method as fallback
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
            ${data.logs.map(log => {
    const items = log.items || [{ product_name: log.product_name, epa_number: log.epa_number, rate: log.rate_per_acre }];
    return items.map((item: any, index: number) => `
                <tr>
                    ${index === 0 ? `
                    <td rowspan="${items.length}">
                        ${log.start_time ? new Date(log.start_time).toLocaleDateString() : 'N/A'}<br/>
                        ${log.start_time ? new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} – ${log.end_time ? new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </td>
                    <td rowspan="${items.length}">
                        <strong>${log.field_name || 'N/A'}</strong><br/>
                        ${log.acres_treated || log.field_acreage || '?'} Treated Ac
                    </td>
                    <td rowspan="${items.length}">
                        ${log.target_crop || 'General'}<br/>
                        <span style="font-size: 8px;">Pest: ${log.target_pest || 'Broadleaf/Grass'}</span>
                    </td>
                    ` : ''}
                    <td>
                        <strong>${item.product_name || 'N/A'}</strong><br/>
                        EPA: ${item.epa_number || 'N/A'}
                    </td>
                    <td>
                        ${item.rate || '?'} ${item.unit || 'Gal'}/Ac<br/>
                        ${index === 0 ? `Total: ${log.total_product || '?'} Gal` : ''}
                    </td>
                    ${index === 0 ? `
                    <td rowspan="${items.length}">
                        ${log.weather_temp ?? '?'}°F | ${log.weather_wind_speed ?? '?'} mph<br/>
                        Dir: ${log.weather_wind_dir || '?'} | Hum: ${log.weather_humidity ?? '?'}%
                    </td>
                    <td rowspan="${items.length}">
                        <div style="color: #D32F2F; font-weight: bold;">
                            REI: ${log.rei_hours || 0}h → ${log.rei_hours && log.start_time ? new Date(new Date(log.start_time).getTime() + log.rei_hours * 3600000).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Immediate'}
                        </div>
                        <div style="color: #2E7D32; font-weight: bold; margin-top: 2px;">
                            PHI: ${log.phi_days || 0}d → ${log.phi_days && log.start_time ? new Date(new Date(log.start_time).getTime() + log.phi_days * 86400000).toLocaleDateString() : 'Immediate'}
                        </div>
                    </td>
                    <td rowspan="${items.length}">
                        ${log.applicator_name || 'System Operator'}<br/>
                        Cert: ${log.applicator_cert || 'N/A'}
                    </td>
                    ` : ''}
                </tr>
                `).join('');
}).join('')}
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
        th { background-color: #f2f2f2; }
        .summary { margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 5px; }
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
                    <td>${log.fieldName || 'Unknown'}</td>
                    <td>${Number(log.totalBushels || 0).toFixed(2)}</td>
                    <td>${(Number(log.sharePercentage || 0) * 100).toFixed(0)}%</td>
                    <td>${Number(log.landlordBushels || 0).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="summary">
        <h3>Total Settlement Summary</h3>
        <p><strong>Total Crop to Landlord:</strong> ${data.logs.reduce((s, l) => s + Number(l.landlordBushels || 0), 0).toFixed(2)} Bushels</p>
    </div>
</body>
</html>
`;

const generateSeasonPacketHtml = (data: ReportData) => {
    const planting = data.logs.filter(l => l.reportType === 'PLANTING');
    const spraying = data.logs.filter(l => l.reportType === 'SPRAYING');
    const harvest = data.logs.filter(l => l.reportType === 'HARVEST');

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        @page { size: portrait; margin: 40px; }
        body { font-family: sans-serif; color: #333; line-height: 1.4; }
        .page-header { border-bottom: 3px solid #2E7D32; padding-bottom: 10px; margin-bottom: 30px; }
        h1 { color: #2E7D32; margin: 0; }
        h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 30px; color: #1B5E20; }
        .summary-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
        th { background: #f2f2f2; font-weight: bold; }
        .footer { margin-top: 50px; font-size: 10px; color: #999; text-align: center; }
        .section-summary { font-weight: bold; margin-top: 10px; text-align: right; }
    </style>
</head>
<body>
    <div class="page-header">
        <h1>Annual Season Packet</h1>
        <p><strong>Farm:</strong> ${data.farmName} | <strong>Season:</strong> ${data.dateRange}</p>
    </div>

    <div class="summary-box">
        <p>This report contains a consolidated summary of all operational activities for the requested period, including planting records, chemical applications, and harvest results.</p>
    </div>

    <h2>1. Planting Summary</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Field</th>
                <th>Product / Variety</th>
                <th>Population</th>
            </tr>
        </thead>
        <tbody>
            ${planting.map(p => `
                <tr>
                    <td>${new Date(p.start_time).toLocaleDateString()}</td>
                    <td>${p.field_name}</td>
                    <td>${p.product_name}</td>
                    <td>${Number(p.rate_per_acre).toLocaleString()} ${p.unit}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>2. Spraying & Compliance</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Field</th>
                <th>Product / EPA #</th>
                <th>Rate</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${spraying.map(s => `
                <tr>
                    <td>${new Date(s.start_time).toLocaleDateString()}</td>
                    <td>${s.field_name}</td>
                    <td>${s.product_name}<br/><span style="font-size: 9px;">EPA: ${s.epa_number}</span></td>
                    <td>${s.rate_per_acre} Gal/Ac</td>
                    <td>${s.total_product} Gal</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>3. Harvest & Landlord Settlements</h2>
    <table>
        <thead>
            <tr>
                <th>Field</th>
                <th>Total Bushels</th>
                <th>LL Share</th>
                <th>LL Bushels</th>
            </tr>
        </thead>
        <tbody>
            ${harvest.map(h => `
                <tr>
                    <td>${h.fieldName}</td>
                    <td>${Number(h.totalBushels).toFixed(2)}</td>
                    <td>${(h.sharePercentage * 100).toFixed(0)}%</td>
                    <td>${Number(h.landlordBushels).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div class="section-summary">
        Total Landlord Settlement: ${harvest.reduce((sum, h) => sum + Number(h.landlordBushels), 0).toFixed(2)} Bushels
    </div>

    <div class="footer">
        Generated by FarmFlow Electronic Recordkeeping System<br/>
        Audit Reference: ${new Date().toISOString()}
    </div>
</body>
</html>
    `;
};
