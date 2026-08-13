/**
 * Canned step results for when the live S3 / DuckDB path fails (offline,
 * blocked, wasm trouble). Keyed by step shape, not id — live plans have
 * arbitrary ids. Numbers are realistic for the central Cần Thơ viewport.
 */

export interface CannedResult {
	rows: Record<string, unknown>[];
}

const CATEGORY_COUNTS: CannedResult = {
	rows: [
		{ basic_category: 'restaurant', n: 612 },
		{ basic_category: 'coffee_shop', n: 488 },
		{ basic_category: 'personal_or_beauty_service', n: 401 },
		{ basic_category: 'fashion_and_apparel_store', n: 262 },
		{ basic_category: 'hotel', n: 176 },
		{ basic_category: 'school', n: 121 },
		{ basic_category: 'pharmacy', n: 97 }
	]
};

/** A small spread of plausible points around central Cần Thơ. */
const SAMPLE_POINTS: CannedResult = {
	rows: [
		{ name: 'Khách sạn Tây Đô', basic_category: 'hotel', confidence: 0.93, lon: 105.783, lat: 10.034 },
		{ name: 'Nhà hàng Sông Hậu', basic_category: 'restaurant', confidence: 0.9, lon: 105.788, lat: 10.041 },
		{ name: 'Cà phê Ninh Kiều', basic_category: 'coffee_shop', confidence: 0.88, lon: 105.784, lat: 10.033 },
		{ name: 'Hotel Mekong View', basic_category: 'hotel', confidence: 0.86, lon: 105.779, lat: 10.028 },
		{ name: 'Quán ăn Cái Khế', basic_category: 'restaurant', confidence: 0.84, lon: 105.771, lat: 10.049 },
		{ name: 'Khách sạn Hoa Sen', basic_category: 'hotel', confidence: 0.83, lon: 105.786, lat: 10.037 },
		{ name: 'Bún riêu 36', basic_category: 'restaurant', confidence: 0.81, lon: 105.775, lat: 10.031 },
		{ name: 'Cà phê Xưa', basic_category: 'coffee_shop', confidence: 0.79, lon: 105.769, lat: 10.038 },
		{ name: 'Nhà nghỉ Bình Minh', basic_category: 'hotel', confidence: 0.72, lon: 105.792, lat: 10.045 },
		{ name: 'Hủ tiếu Mỹ Tho', basic_category: 'restaurant', confidence: 0.68, lon: 105.781, lat: 10.026 }
	]
};

/** Pick a canned result matching the step's SQL shape; null if none fits. */
export function cannedFallback(sql: string | undefined): CannedResult | null {
	if (!sql) return null;
	if (/group by/i.test(sql)) return CATEGORY_COUNTS;
	if (/as lon/i.test(sql)) return SAMPLE_POINTS;
	return null;
}
