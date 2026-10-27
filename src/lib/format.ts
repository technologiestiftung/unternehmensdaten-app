const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("de-DE");
const day = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export const formatEuro = (value: number | null) => (value == null ? "–" : euro.format(value));
export const formatNumber = (value: number | null) => (value == null ? "–" : number.format(value));
export const formatDate = (value: string | null) => (value ? day.format(new Date(value)) : "–");
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_COMMENT_LENGTH = 5000; // same limit as the CHECK on company_comments.body
