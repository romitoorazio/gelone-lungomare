export const DEFAULT_UNIT_ID = "lunarossa1";
export const DEFAULT_UNIT_NAME = "Lunarossa 1";
export const DEFAULT_PUBLIC_UNIT_NAME = "Gelone Lungomare";

export const DEFAULT_UNIT = {
  id: DEFAULT_UNIT_ID,
  name: DEFAULT_UNIT_NAME,
  publicName: DEFAULT_PUBLIC_UNIT_NAME,
  description: "Unità attuale Gelone Lungomare",
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  hasKitchen: true,
  cin: "IT085007C2TUGEP2SD",
  cir: "19085007C264694",
  active: true,
  publicVisible: true,
  welcomateEnabled: true,
  bookingUrl: "https://www.booking.com/hotel/it/gelone-lungomare.html",
  airbnbUrl: "https://www.airbnb.it/rooms/1267419022190887817",
  icalPath: "/api/ical/lunarossa1.ics",
  sortOrder: 1,
  photos: [],
};

export const DEFAULT_UNITS = [DEFAULT_UNIT];

function normalizePhotos(value) {
  if (!Array.isArray(value)) return [];

  const cleaned = value
    .filter((photo) => photo && typeof photo === "object" && photo.url)
    .map((photo, index) => ({
      id: String(photo.id || photo.path || `photo-${index + 1}`),
      url: String(photo.url || "").trim(),
      path: String(photo.path || "").trim(),
      name: String(photo.name || `Foto ${index + 1}`).trim(),
      cover: Boolean(photo.cover),
      order: Number.isFinite(Number(photo.order)) ? Number(photo.order) : index + 1,
      uploadedAt: photo.uploadedAt || "",
    }))
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  if (!cleaned.some((photo) => photo.cover) && cleaned.length > 0) {
    cleaned[0].cover = true;
  }

  return cleaned.map((photo, index) => ({
    ...photo,
    order: index + 1,
  }));
}

export function sanitizeUnitId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function normalizeUnit(raw = {}, fallback = DEFAULT_UNIT) {
  const id = sanitizeUnitId(raw.id || fallback.id || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
  const maxGuests = Number(raw.maxGuests ?? fallback.maxGuests ?? 2);
  const bedrooms = Number(raw.bedrooms ?? fallback.bedrooms ?? 1);
  const bathrooms = Number(raw.bathrooms ?? fallback.bathrooms ?? 1);

  return {
    ...fallback,
    ...raw,
    id,
    name: String(raw.name || fallback.name || id).trim(),
    publicName: String(raw.publicName || fallback.publicName || raw.name || fallback.name || id).trim(),
    description: String(raw.description ?? fallback.description ?? "").trim(),
    maxGuests: Number.isFinite(maxGuests) && maxGuests > 0 ? maxGuests : 2,
    bedrooms: Number.isFinite(bedrooms) && bedrooms >= 0 ? bedrooms : 1,
    bathrooms: Number.isFinite(bathrooms) && bathrooms >= 0 ? bathrooms : 1,
    hasKitchen: raw.hasKitchen ?? fallback.hasKitchen ?? true,
    // Importante: stringa vuota deve restare vuota per le unità future.
    cin: String(raw.cin ?? fallback.cin ?? "").trim(),
    cir: String(raw.cir ?? fallback.cir ?? "").trim(),
    bookingUrl: String(raw.bookingUrl ?? fallback.bookingUrl ?? "").trim(),
    airbnbUrl: String(raw.airbnbUrl ?? fallback.airbnbUrl ?? "").trim(),
    active: raw.active ?? fallback.active ?? true,
    publicVisible: raw.publicVisible ?? fallback.publicVisible ?? false,
    welcomateEnabled: raw.welcomateEnabled ?? fallback.welcomateEnabled ?? false,
    icalPath: String(raw.icalPath || fallback.icalPath || `/api/ical/${id}.ics`).trim(),
    sortOrder: Number(raw.sortOrder ?? fallback.sortOrder ?? 999),
    photos: normalizePhotos(raw.photos ?? fallback.photos ?? []),
  };
}
