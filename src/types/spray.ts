export interface RecipeItem {
    id: string;
    recipe_id: string;
    product_name: string;
    epa_number: string;
    rate: number;
    unit: string;
}

export interface Recipe {
    id: string;
    name: string;
    water_rate_per_acre: number;
    phi_days: number;
    rei_hours: number;
    items?: RecipeItem[];
    // Legacy support fields for backward compatibility
    product_name?: string;
    rate_per_acre?: number;
    epa_number?: string;
}

export interface SprayLog {
    id: string;
    field_id: string;
    recipe_id: string;
    sprayed_at: string;
    weather_source: 'AUTO' | 'MANUAL';
    voided_at: string | null;
    void_reason: string | null;
    replaces_log_id: string | null;
    total_gallons: number | null;
    total_product: number | null;
    weather_temp: number | null;
    weather_wind_speed: number | null;
    weather_wind_dir: string | null;
    weather_humidity: number | null;
    target_crop: string | null;
    target_pest: string | null;
    applicator_name: string | null;
    applicator_cert: string | null;
    acres_treated: number | null;
    phi_days: number | null;
    rei_hours: number | null;
    notes: string | null;
    items?: SprayLogItem[];
}

export interface SprayLogItem {
    id: string;
    spray_log_id: string;
    product_name: string;
    epa_number: string;
    rate: number;
    unit: string;
    total_amount: number;
    total_unit: string;
}
