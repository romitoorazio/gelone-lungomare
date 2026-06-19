export const DEFAULT_UNIT_ID = "lunarossa1";
export const DEFAULT_UNIT = {
  id: DEFAULT_UNIT_ID,
  name: "Lunarossa 1",
  publicName: "Gelone Lungomare",
  maxGuests: 2,
  cin: "IT085007C2TUGEP2SD",
  cir: "19085007C264694",
  active: true,
  publicVisible: true,
  welcomateEnabled: true,
  notificationEmail: "info@gelone.it",
  icalPath: "/api/ical/lunarossa1",
  photos: [],
};

function normalizePhotos(value) {
  if (!Array.isArray(value)) return [];

  const cleaned = value
    .filter((photo) => photo && typeof photo === "object" && photo.url)
    .map((photo, index) => ({
      id: String(photo.id || photo.assetId || photo.publicId || photo.path || `photo-${index + 1}`),
      url: String(photo.url || photo.secureUrl || "").trim(),
      secureUrl: String(photo.secureUrl || photo.url || "").trim(),
      path: String(photo.path || "").trim(),
      publicId: String(photo.publicId || "").trim(),
      assetId: String(photo.assetId || "").trim(),
      source: String(photo.source || (photo.publicId ? "cloudinary" : "external")).trim(),
      name: String(photo.name || photo.displayName || `Foto ${index + 1}`).trim(),
      displayName: String(photo.displayName || photo.name || `Foto ${index + 1}`).trim(),
      caption: String(photo.caption || "").trim(),
      room: String(photo.room || "").trim(),
      width: Number(photo.width || 0),
      height: Number(photo.height || 0),
      format: String(photo.format || "").trim(),
      bytes: Number(photo.bytes || 0),
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

  return {
    ...fallback,
    ...raw,
    id,
    name: String(raw.name || fallback.name || id).trim(),
    publicName: String(raw.publicName || fallback.publicName || raw.name || fallback.name || id).trim(),
    maxGuests: Number.isFinite(maxGuests) && maxGuests > 0 ? maxGuests : 2,
    cin: String(raw.cin ?? fallback.cin ?? "").trim(),
    cir: String(raw.cir ?? fallback.cir ?? "").trim(),
    bookingUrl: String(raw.bookingUrl ?? fallback.bookingUrl ?? "").trim(),
    airbnbUrl: String(raw.airbnbUrl ?? fallback.airbnbUrl ?? "").trim(),
    active: raw.active ?? fallback.active ?? true,
    publicVisible: raw.publicVisible ?? fallback.publicVisible ?? false,
    welcomateEnabled: raw.welcomateEnabled ?? fallback.welcomateEnabled ?? false,
    notificationEmail: String(raw.notificationEmail ?? fallback.notificationEmail ?? "info@gelone.it").trim(),
    icalPath: String(raw.icalPath || fallback.icalPath || `/api/ical/${id}`).trim(),
    photos: normalizePhotos(raw.photos ?? fallback.photos ?? []),
  };
}

export async function getUnitConfig(adminDb, requestedUnitId = DEFAULT_UNIT_ID) {
  const unitId = sanitizeUnitId(requestedUnitId) || DEFAULT_UNIT_ID;

  try {
    const registrySnapshot = await adminDb.collection("settings").doc("units").get();
    const items = Array.isArray(registrySnapshot.data()?.items)
      ? registrySnapshot.data().items
      : [];
    const registryUnit = items
      .map((item) => normalizeUnit(item))
      .find((unit) => unit.id === unitId);

    if (registryUnit) {
      return registryUnit;
    }
  } catch (error) {
    console.warn("Registro unità non caricato da settings/units:", error);
  }

  try {
    // Compatibilità futura: se un domani si passa alla collection units,
    // le API la leggono già senza rompere la struttura attuale.
    const snapshot = await adminDb.collection("units").doc(unitId).get();
    if (snapshot.exists) {
      return normalizeUnit({ id: snapshot.id, ...snapshot.data() });
    }
  } catch (error) {
    console.warn("Unità non caricata da collection units, uso fallback:", error);
  }

  if (unitId === DEFAULT_UNIT_ID) {
    return normalizeUnit(DEFAULT_UNIT);
  }

  return null;
}

export async function getPublicUnitConfig(adminDb, requestedUnitId = DEFAULT_UNIT_ID) {
  const unit = await getUnitConfig(adminDb, requestedUnitId);
  if (!unit) return null;

  if (unit.id === DEFAULT_UNIT_ID) {
    return unit;
  }

  if (unit.active && unit.publicVisible) {
    return unit;
  }

  return null;
}

export function bookingUnitId(data) {
  // Compatibilità: le vecchie prenotazioni senza unitId appartengono a Lunarossa 1.
  return sanitizeUnitId(data?.unitId || DEFAULT_UNIT_ID) || DEFAULT_UNIT_ID;
}
