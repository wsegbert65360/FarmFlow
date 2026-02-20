/**
 * Sanitizes a string input by removing commas and then parses it as a float.
 * Returns 0 if the input is empty or invalid.
 */
export const parseNumericInput = (value: string | number | undefined | null): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return value;

    // Remove commas and parse
    const sanitized = value.toString().replace(/,/g, '');
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Sanitizes a string input by removing commas and then parses it as an integer.
 * Returns 0 if the input is empty or invalid.
 */
export const parseIntegerInput = (value: string | number | undefined | null): number => {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return Math.floor(value);

    const sanitized = value.toString().replace(/,/g, '');
    const parsed = parseInt(sanitized, 10);
    return isNaN(parsed) ? 0 : parsed;
};
