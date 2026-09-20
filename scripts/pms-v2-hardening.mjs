import fs from "node:fs";

function patchText(text, before, after, label, { all = false } = {}) {
  if (text.includes(after)) return { text, count: 0 };
  if (!text.includes(before)) {
    console.warn(`[pms-v2] blocco non trovato: ${label}`);
    return { text, count: 0 };
  }

  if (all) {
    const parts = text.split(before);
    const count = parts.length - 1;
    console.log(`[pms-v2] applicato ${count}x: ${label}`);
    return { text: parts.join(after), count };
  }

  console.log(`[pms-v2] applicato: ${label}`);
  return { text: text.replace(before, after), count: 1 };
}

function patchFile(path, transformations) {
  let text = fs.readFileSync(path, "utf8");
  let total = 0;

  for (const transformation of transformations) {
    const result = patchText(
      text,
      transformation.before,
      transformation.after,
      transformation.label,
      { all: Boolean(transformation.all) }
    );
    text = result.text;
    total += result.count;
  }

  fs.writeFileSync(path, text, "utf8");
  console.log(`[pms-v2] ${path.pathname.split("/").pop()}: ${total} modifiche.`);
  return total;
}

const adminPath = new URL("../src/Admin.jsx", import.meta.url);
const appPath = new URL("../src/App.jsx", import.meta.url);
const bookingPath = new URL("../api/create-booking.js", import.meta.url);
const paymentPath = new URL("../api/create-payment-checkout.js", import.meta.url);

let changes = 0;

changes += patchFile(adminPath, [
  {
    before: '  wifiName: "lunarossa",\n  wifiPassword: "gelone123",',
    after: '  wifiName: "",\n  wifiPassword: "",',
    label: "rimozione credenziali Wi-Fi hardcoded",
  },
  {
    before: '  directRateText: "Miglior tariffa prenotando dal sito",\n  directPaymentEnabled: false,\n};',
    after: '  directRateText: "Miglior tariffa prenotando dal sito",\n  directPaymentEnabled: false,\n  weekendSurcharge: 0,\n  lastMinuteDays: 3,\n  lastMinuteDiscountPercent: 0,\n  highSeasonStart: "",\n  highSeasonEnd: "",\n  highSeasonNightlyRate: 0,\n  highSeasonMinimumNights: 0,\n};',
    label: "default revenue management",
  },
  {
    before: '        directRateText: settings.directRateText || defaultSettings.directRateText,\n\n        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\nwifiName: settings.wifiName || "",\n        wifiPassword: settings.wifiPassword || "",\n        unitId: selectedUnitId,',
    after: '        directRateText: settings.directRateText || defaultSettings.directRateText,\n        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\n        weekendSurcharge: Number(settings.weekendSurcharge || 0),\n        lastMinuteDays: Number(settings.lastMinuteDays ?? defaultSettings.lastMinuteDays),\n        lastMinuteDiscountPercent: Number(settings.lastMinuteDiscountPercent || 0),\n        highSeasonStart: settings.highSeasonStart || "",\n        highSeasonEnd: settings.highSeasonEnd || "",\n        highSeasonNightlyRate: Number(settings.highSeasonNightlyRate || 0),\n        highSeasonMinimumNights: Number(settings.highSeasonMinimumNights || 0),\n        unitId: selectedUnitId,',
    label: "revenue management pubblico senza Wi-Fi",
    all: true,
  },
  {
    before: '        directRateText: settings.directRateText || defaultSettings.directRateText,\n\n        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\n        unitId: selectedUnitId,',
    after: '        directRateText: settings.directRateText || defaultSettings.directRateText,\n        directPaymentEnabled: Boolean(settings.directPaymentEnabled),\n        weekendSurcharge: Number(settings.weekendSurcharge || 0),\n        lastMinuteDays: Number(settings.lastMinuteDays ?? defaultSettings.lastMinuteDays),\n        lastMinuteDiscountPercent: Number(settings.lastMinuteDiscountPercent || 0),\n        highSeasonStart: settings.highSeasonStart || "",\n        highSeasonEnd: settings.highSeasonEnd || "",\n        highSeasonNightlyRate: Number(settings.highSeasonNightlyRate || 0),\n        highSeasonMinimumNights: Number(settings.highSeasonMinimumNights || 0),\n        unitId: selectedUnitId,',
    label: "revenue management pubblico",
    all: true,
  },
  {
    before: '        notificationEmail: settings.notificationEmail || "info@gelone.it",\n        unitId: selectedUnitId,',
    after: '        notificationEmail: settings.notificationEmail || "info@gelone.it",\n        wifiName: settings.wifiName || "",\n        wifiPassword: settings.wifiPassword || "",\n        unitId: selectedUnitId,',
    label: "salvataggio Wi-Fi in privateSettings",
    all: true,
  },
  {
    before: 'onClick={() => openBookingFromDashboard(preparationStats.notReadyRows[0], "calendar")}',
    after: 'onClick={() => openBookingFromDashboard(booking, "calendar")}',
    label: "apertura corretta prenotazione dalla lista pulizie",
    all: true,
  },
  {
    before: 'Nessuna sincronizzazione automatica registrata ancora. Verrà compilata dopo il primo passaggio del cron Vercel.',
    after: 'Nessuna sincronizzazione automatica registrata ancora. Verrà compilata dopo il primo passaggio automatico GitHub Actions/Vercel.',
    label: "testo monitor sincronizzazione",
    all: true,
  },
  {
    before: `                    <FormField label="Pulizie finali (€)">\n                      <input\n                        type="number"\n                        min="0"\n                        step="1"\n                        value={settings.cleaningFee}\n                        onChange={(event) =>\n                          setSettings({ ...settings, cleaningFee: event.target.value })\n                        }\n                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"\n                      />\n                    </FormField>`,
    after: `                    <FormField label="Pulizie finali (€)">\n                      <input\n                        type="number"\n                        min="0"\n                        step="1"\n                        value={settings.cleaningFee}\n                        onChange={(event) =>\n                          setSettings({ ...settings, cleaningFee: event.target.value })\n                        }\n                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"\n                      />\n                    </FormField>\n\n                    <FormField label="Supplemento ven/sab (€)">\n                      <input type="number" min="0" step="1" value={settings.weekendSurcharge || 0} onChange={(event) => setSettings({ ...settings, weekendSurcharge: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Sconto last minute (%)">\n                      <input type="number" min="0" max="60" step="1" value={settings.lastMinuteDiscountPercent || 0} onChange={(event) => setSettings({ ...settings, lastMinuteDiscountPercent: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Last minute entro giorni">\n                      <input type="number" min="0" max="30" step="1" value={settings.lastMinuteDays ?? 3} onChange={(event) => setSettings({ ...settings, lastMinuteDays: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Alta stagione dal">\n                      <input type="date" value={settings.highSeasonStart || ""} onChange={(event) => setSettings({ ...settings, highSeasonStart: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Alta stagione al">\n                      <input type="date" value={settings.highSeasonEnd || ""} onChange={(event) => setSettings({ ...settings, highSeasonEnd: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Prezzo alta stagione/notte (€)">\n                      <input type="number" min="0" step="1" value={settings.highSeasonNightlyRate || 0} onChange={(event) => setSettings({ ...settings, highSeasonNightlyRate: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>\n\n                    <FormField label="Minimo notti alta stagione">\n                      <input type="number" min="0" step="1" value={settings.highSeasonMinimumNights || 0} onChange={(event) => setSettings({ ...settings, highSeasonMinimumNights: event.target.value })} className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4" />\n                    </FormField>`,
    label: "controlli revenue management",
  },
]);

changes += patchFile(appPath, [
  {
    before: '  directRateText: "Miglior tariffa prenotando dal sito",\n  directPaymentEnabled: false,\n};',
    after: '  directRateText: "Miglior tariffa prenotando dal sito",\n  directPaymentEnabled: false,\n  weekendSurcharge: 0,\n  lastMinuteDays: 3,\n  lastMinuteDiscountPercent: 0,\n  highSeasonStart: "",\n  highSeasonEnd: "",\n  highSeasonNightlyRate: 0,\n  highSeasonMinimumNights: 0,\n};',
    label: "pricing dinamico lato sito",
  },
  {
    before: `    const nights = selectedNights.length;\n    const nightlyRate = Number(pricing.nightlyRate || 0);\n    const cleaningFee = Number(pricing.cleaningFee || 0);\n    const subtotal = nights * nightlyRate;\n    const total = nights > 0 ? subtotal + cleaningFee : 0;\n    const depositAmount = total > 0 ? Math.round((total * Number(pricing.depositPercent || 0)) / 100) : 0;\n\n    return { nights, nightlyRate, cleaningFee, subtotal, total, depositAmount };`,
    after: `    const nights = selectedNights.length;\n    const baseNightlyRate = Number(pricing.nightlyRate || 0);\n    const cleaningFee = Number(pricing.cleaningFee || 0);\n    const weekendSurcharge = Number(pricing.weekendSurcharge || 0);\n    const lastMinuteDays = Number(pricing.lastMinuteDays ?? 3);\n    const lastMinuteDiscountPercent = Number(pricing.lastMinuteDiscountPercent || 0);\n    const highSeasonRate = Number(pricing.highSeasonNightlyRate || 0);\n    const today = parseDateInput(todayIso());\n    let touchesHighSeason = false;\n\n    const nightlyRates = selectedNights.map((dateIso) => {\n      const date = parseDateInput(dateIso);\n      const inHighSeason = Boolean(\n        pricing.highSeasonStart && pricing.highSeasonEnd &&\n        dateIso >= pricing.highSeasonStart && dateIso <= pricing.highSeasonEnd &&\n        highSeasonRate > 0\n      );\n      if (inHighSeason) touchesHighSeason = true;\n      let rate = inHighSeason ? highSeasonRate : baseNightlyRate;\n      const weekday = date ? date.getDay() : -1;\n      if ((weekday === 5 || weekday === 6) && weekendSurcharge > 0) rate += weekendSurcharge;\n      const daysAhead = date && today ? Math.floor((date.getTime() - today.getTime()) / 86400000) : 9999;\n      if (lastMinuteDiscountPercent > 0 && daysAhead >= 0 && daysAhead <= lastMinuteDays) {\n        rate *= 1 - lastMinuteDiscountPercent / 100;\n      }\n      return Math.round(rate * 100) / 100;\n    });\n\n    const subtotal = nightlyRates.reduce((sum, rate) => sum + rate, 0);\n    const nightlyRate = nights > 0 ? subtotal / nights : baseNightlyRate;\n    const total = nights > 0 ? subtotal + cleaningFee : 0;\n    const depositAmount = total > 0 ? Math.round((total * Number(pricing.depositPercent || 0)) / 100) : 0;\n    const minimumNights = touchesHighSeason && Number(pricing.highSeasonMinimumNights || 0) > 0\n      ? Math.max(Number(pricing.minimumNights || 1), Number(pricing.highSeasonMinimumNights || 0))\n      : Number(pricing.minimumNights || 1);\n\n    return { nights, nightlyRate, cleaningFee, subtotal, total, depositAmount, minimumNights };`,
    label: "calcolo prezzo dinamico nel preventivo pubblico",
  },
  {
    before: '    if (priceEstimate.nights < Number(pricing.minimumNights || 1)) {\n      setAvailability({\n        ok: false,\n        message: `Soggiorno minimo: ${formatNightsLabel(pricing.minimumNights)}.`,\n      });',
    after: '    if (priceEstimate.nights < Number(priceEstimate.minimumNights || pricing.minimumNights || 1)) {\n      setAvailability({\n        ok: false,\n        message: `Soggiorno minimo: ${formatNightsLabel(priceEstimate.minimumNights || pricing.minimumNights)}.`,\n      });',
    label: "minimo notti dinamico sito pubblico",
  },
]);

changes += patchFile(bookingPath, [
  {
    before: 'const serverPricing = await calculateServerBookingPricing(adminDb, unitId, nights.length);',
    after: 'const serverPricing = await calculateServerBookingPricing(adminDb, unitId, nights);',
    label: "prezzo server calcolato sulle date reali",
    all: true,
  },
]);

changes += patchFile(paymentPath, [
  {
    before: 'const serverPricing = await calculateServerBookingPricing(adminDb, unitId, nightsCount);',
    after: 'const serverPricing = await calculateServerBookingPricing(adminDb, unitId, booking);',
    label: "ricalcolo pagamento sulle date reali",
    all: true,
  },
]);

console.log(`[pms-v2] hardening complessivo: ${changes} modifiche.`);
