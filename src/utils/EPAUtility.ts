export interface ChemicalSafety {
    productName: string;
    epaNumber: string;
    phi: number; // Days
    rei: number; // Hours
}

const EPA_DICTIONARY: Record<string, ChemicalSafety> = {
    '524445': { productName: 'Roundup Ultra', epaNumber: '524-445', phi: 7, rei: 4 },
    '524549': { productName: 'Roundup PowerMax', epaNumber: '524-549', phi: 7, rei: 4 },
    '524608': { productName: 'Roundup PowerMax 3', epaNumber: '524-608', phi: 7, rei: 4 },
    '7969447': { productName: 'Liberty (Glufosinate)', epaNumber: '7969-447', phi: 70, rei: 12 },
    '7969345': { productName: 'Engenia (Dicamba)', epaNumber: '7969-345', phi: 0, rei: 24 },
    '524617': { productName: 'XtendiMax', epaNumber: '524-617', phi: 0, rei: 24 },
    '62719623': { productName: 'Enlist One', epaNumber: '62719-623', phi: 30, rei: 48 },
    '62719639': { productName: 'Enlist Duo', epaNumber: '62719-639', phi: 30, rei: 48 },
    '100817': { productName: 'Atrazine 4L', epaNumber: '100-817', phi: 60, rei: 12 },
    '1001162': { productName: 'Dual II Magnum', epaNumber: '100-1162', phi: 60, rei: 24 },
    '1001431': { productName: 'Flexstar', epaNumber: '100-1431', phi: 45, rei: 24 },
    '7969262': { productName: 'Sharpen', epaNumber: '7969-262', phi: 0, rei: 12 },
    '352844': { productName: 'Corvus', epaNumber: '352-844', phi: 80, rei: 12 },
    '22172': { productName: '2,4-D Amine', epaNumber: '2217-2', phi: 0, rei: 48 },
    '7173242': { productName: 'Rozol', epaNumber: '7173-242', phi: 0, rei: 0 },
    '59639150': { productName: 'Valor SX', epaNumber: '59639-150', phi: 30, rei: 12 },
    '2793426': { productName: 'Authority First', epaNumber: '279-3426', phi: 65, rei: 12 }
};

/**
 * Looks up chemical safety info by EPA number.
 * Normalizes by stripping dashes and handling potential distributor parts (3rd part).
 */
export const lookupEPA = (epa: string): ChemicalSafety | null => {
    // Standardize to digits and dashes only, then split by dash
    const parts = epa.replace(/[^0-9-]/g, '').split('-');

    // If there are at least two parts (Company-Product), try to match the base registration
    if (parts.length >= 2) {
        const baseKey = parts[0] + parts[1];
        const result = EPA_DICTIONARY[baseKey];
        if (result) {
            return result;
        }
    }

    // Fallback: if no base registration match, or if input didn't have two parts,
    // try matching the full number with all non-digits removed.
    const cleanEPA = epa.replace(/[^0-9]/g, '').trim();
    return EPA_DICTIONARY[cleanEPA] || null;
};

/**
 * Calculates the most restrictive PHI and REI for a set of EPA numbers.
 */
export const calculateMaxRestrictions = (epaNumbers: string[]): { phi: number, rei: number } => {
    let maxPhi = 0;
    let maxRei = 0;

    epaNumbers.forEach(epa => {
        const info = lookupEPA(epa);
        if (info) {
            maxPhi = Math.max(maxPhi, info.phi);
            maxRei = Math.max(maxRei, info.rei);
        }
    });

    return { phi: maxPhi, rei: maxRei };
};
