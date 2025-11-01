/**
 * Temperature utility functions for AI agent configuration
 * Maps preset temperature values to numeric values for API usage
 */

export type TemperaturePreset = 'Conservative' | 'Balanced' | 'Creative';

export const TEMPERATURE_MAP: Record<TemperaturePreset, number> = {
  Conservative: 0.3,
  Balanced: 0.5,
  Creative: 0.7,
};

/**
 * Converts a temperature preset string to its numeric value
 * @param preset - The temperature preset ('Conservative', 'Balanced', or 'Creative')
 * @param fallback - Fallback numeric value if preset is invalid (default: 0.5)
 * @returns Numeric temperature value
 */
export function getTemperatureValue(preset: string | null | undefined, fallback: number = 0.5): number {
  if (!preset) return fallback;
  
  const normalized = preset.trim() as TemperaturePreset;
  return TEMPERATURE_MAP[normalized] ?? fallback;
}

/**
 * Converts a numeric temperature value to its closest preset
 * @param value - Numeric temperature value
 * @returns Closest temperature preset
 */
export function getTemperaturePreset(value: number | null | undefined): TemperaturePreset {
  if (value === null || value === undefined) return 'Balanced';
  
  // Find the closest preset
  const differences = Object.entries(TEMPERATURE_MAP).map(([preset, temp]) => ({
    preset: preset as TemperaturePreset,
    diff: Math.abs(temp - value),
  }));
  
  differences.sort((a, b) => a.diff - b.diff);
  return differences[0].preset;
}

/**
 * Validates if a string is a valid temperature preset
 * @param value - String to validate
 * @returns True if valid preset
 */
export function isValidTemperaturePreset(value: string | null | undefined): value is TemperaturePreset {
  if (!value) return false;
  return Object.keys(TEMPERATURE_MAP).includes(value.trim());
}

