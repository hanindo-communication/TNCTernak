/** Nilai base pay tetap untuk form Submit Targets (rupiah, tanpa desimal). */
export const BASE_PAY_PRESET_VALUES = [785_000, 1_570_000, 2_350_000] as const;

export type BasePayPreset = (typeof BASE_PAY_PRESET_VALUES)[number];

const idFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatBasePayLabel(amount: number): string {
  return idFmt.format(amount);
}

export function defaultBasePayPreset(): BasePayPreset {
  return BASE_PAY_PRESET_VALUES[0];
}
