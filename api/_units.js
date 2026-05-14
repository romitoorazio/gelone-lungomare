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
  icalPath: "/api/ical/lunarossa1.ics",
};

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
    active: raw.active ?? fallback.active ?? true,
    publicVisible: raw.publicVisible ?? fallback.publicVisible ?? false,
    welcomateEnabled: raw.welcomateEnabled ?? fallback.welcomateEnabled ?? false,
    notificationEmail: String(raw.notificationEmail ?? fallback.notificationEmail ?? "info@gelone.it").trim(),
    icalPath: String(raw.icalPath || fallback.icalPath || `/api/ical/${id}.ics`).trim(),
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
