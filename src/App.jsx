import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const LOGO_HEADER = "/images/logo-gelone-header-senza-qrcode.png";
const LOGO_EMBLEMA = "/images/logo-gelone-emblema-senza-qrcode.png";
const HERO_FUSA = "/images/hero-gelone-fusa.png";
const HERO_VIDEO = "/images/hero-gelone-video.mp4";
const HERO_POSTER = "/images/hero-gelone-poster.jpg";
const FOTO_MARE = "/images/vista-mare-gelone.jpg";
const FOTO_TERRAZZA = "/images/terrazza-gelone.jpg";
const FOTO_INTERNI = "/images/interni-gelone.jpg";

const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const whatsappUrl = "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const CIN = "IT085007C2TUGEP2SD";
const CIR = "19085007C264694";
const UNIT_ID = "lunarossa1";

const defaultPricing = {
  nightlyRate: 70,
  cleaningFee: 0,
  minimumNights: 1,
  depositPercent: 30,
  directRateText: "Miglior tariffa prenotando dal sito",
};

const gallery = [FOTO_TERRAZZA, FOTO_MARE, FOTO_INTERNI, FOTO_TERRAZZA, FOTO_MARE];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateInput(dateIso) {
  if (!dateIso) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDateInput(d);
}

function addDaysIso(dateIso, days) {
  const d = parseDateInput(dateIso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return formatDateInput(d);
}

function getNightDates(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return [];
  const nights = [];
  const cursor = parseDateInput(checkIn);
  const end = parseDateInput(checkOut);

  if (!cursor || !end) return [];

  while (cursor < end) {
    nights.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return nights;
}

function getCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  const mondayBasedDay = (firstOfMonth.getDay() + 6) % 7;
  start.setDate(firstOfMonth.getDate() - mondayBasedDay);

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);

    return {
      iso: formatDateInput(d),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === monthDate.getMonth(),
      isPast: formatDateInput(d) < todayIso(),
    };
  });
}

function getMonthLabel(monthDate) {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  })
    .format(monthDate)
    .toUpperCase();
}

function getCalendarStatusLabel(status) {
  if (!status) return "Disponibile";
  if (status === "blocked") return "Bloccata";
  if (["pending_direct", "pending"].includes(status)) return "Richiesta";
  return "Occupata";
}

function formatEuro(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(number);
}

function SectionTitle({ children }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      <span />
    </div>
  );
}

export default function App() {
  const minCheckIn = useMemo(() => todayIso(), []);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [requestStatus, setRequestStatus] = useState(null);
  const [pricing, setPricing] = useState(defaultPricing);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarStatusByDate, setCalendarStatusByDate] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadPricing() {
      try {
        const snapshot = await getDoc(doc(db, "settings", "pms"));
        if (!mounted || !snapshot.exists()) return;

        const data = snapshot.data();
        setPricing({
          nightlyRate: Number(data.nightlyRate || defaultPricing.nightlyRate),
          cleaningFee: Number(data.cleaningFee || defaultPricing.cleaningFee),
          minimumNights: Number(data.minimumNights || defaultPricing.minimumNights),
          depositPercent: Number(data.depositPercent || defaultPricing.depositPercent),
          directRateText: data.directRateText || defaultPricing.directRateText,
        });
      } catch (error) {
        console.warn("Tariffe non caricate, uso valori predefiniti:", error);
      }
    }

    loadPricing();
    return () => { mounted = false; };
  }, []);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    let mounted = true;

    async function loadCalendarAvailability() {
      setCalendarLoading(true);

      try {
        const start = calendarDays[0]?.iso;
        const end = calendarDays[calendarDays.length - 1]?.iso;

        if (!start || !end) return;

        const response = await fetch(
          `/api/public-calendar?unitId=${encodeURIComponent(UNIT_ID)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Calendario non disponibile");
        }

        if (!mounted) return;

        const nextStatusByDate = {};

        (data.days || []).forEach((day) => {
          if (day?.date && day?.status && day.status !== "cancelled") {
            nextStatusByDate[day.date] = day.status;
          }
        });

        setCalendarStatusByDate(nextStatusByDate);
      } catch (error) {
        console.warn("Calendario disponibilità non caricato:", error);
        if (mounted) setCalendarStatusByDate({});
      } finally {
        if (mounted) setCalendarLoading(false);
      }
    }

    loadCalendarAvailability();

    return () => {
      mounted = false;
    };
  }, [calendarDays, calendarRefreshKey]);

  const selectedNights = useMemo(() => getNightDates(checkIn, checkOut), [checkIn, checkOut]);
  const priceEstimate = useMemo(() => {
    const nights = selectedNights.length;
    const nightlyRate = Number(pricing.nightlyRate || 0);
    const cleaningFee = Number(pricing.cleaningFee || 0);
    const subtotal = nights * nightlyRate;
    const total = nights > 0 ? subtotal + cleaningFee : 0;
    const depositAmount = total > 0 ? Math.round((total * Number(pricing.depositPercent || 0)) / 100) : 0;

    return { nights, nightlyRate, cleaningFee, subtotal, total, depositAmount };
  }, [selectedNights, pricing]);

  const checkAvailability = async (event) => {
    event?.preventDefault();
    setAvailability(null);
    setRequestStatus(null);

    if (!checkIn || !checkOut) {
      setAvailability({ ok: false, message: "Seleziona check-in e check-out." });
      return;
    }

    if (checkOut <= checkIn) {
      setAvailability({ ok: false, message: "Il check-out deve essere dopo il check-in." });
      return;
    }

    if (priceEstimate.nights < Number(pricing.minimumNights || 1)) {
      setAvailability({
        ok: false,
        message: `Soggiorno minimo: ${pricing.minimumNights} notte${Number(pricing.minimumNights) > 1 ? "i" : ""}.`,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: UNIT_ID, checkIn, checkOut, guests: Number(guests) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Errore verifica disponibilità");

      const available = data.available !== false;
      setAvailability({
        ok: available,
        message: available
          ? "Periodo disponibile. Puoi inviare la richiesta diretta."
          : "Periodo non disponibile. Prova altre date oppure contattaci su WhatsApp.",
      });
    } catch (error) {
      setAvailability({ ok: false, message: error.message || "Errore durante la verifica." });
    } finally {
      setLoading(false);
    }
  };

  const createBookingRequest = async (event) => {
    event.preventDefault();
    setRequestStatus(null);

    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
      setRequestStatus({ ok: false, message: "Compila nome, email e telefono." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: UNIT_ID,
          checkIn,
          checkOut,
          guests: Number(guests),
          guestName,
          guestEmail,
          guestPhone,
          notes: `Richiesta inviata dal sito Gelone Lungomare. Totale stimato: ${formatEuro(priceEstimate.total)} per ${priceEstimate.nights} notte${priceEstimate.nights === 1 ? "" : "i"}.`,
          totalPrice: priceEstimate.total,
          nightlyRate: priceEstimate.nightlyRate,
          cleaningFee: priceEstimate.cleaningFee,
          nightsCount: priceEstimate.nights,
          depositAmount: priceEstimate.depositAmount,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Errore invio richiesta");
      setRequestStatus({ ok: true, message: "Richiesta inviata. Ti contatteremo per confermare." });
      setCalendarRefreshKey((value) => value + 1);
    } catch (error) {
      setRequestStatus({ ok: false, message: error.message || "Errore durante l'invio." });
    } finally {
      setLoading(false);
    }
  };

  function changeCalendarMonth(direction) {
    setCalendarMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + direction);
      next.setDate(1);
      return next;
    });
  }

  function selectCalendarDate(dateIso) {
    if (!dateIso || dateIso < minCheckIn) return;

    setAvailability(null);
    setRequestStatus(null);

    if (!checkIn || checkOut || dateIso <= checkIn) {
      setCheckIn(dateIso);
      setCheckOut(addDaysIso(dateIso, 1));
      return;
    }

    setCheckOut(dateIso);
  }

  return (
    <main className="site-shell">
      <style>{css}</style>

      <header className="topbar">
        <a href="#home" className="brand" aria-label="Gelone Lungomare home">
          <img src={LOGO_HEADER} alt="Gelone Lungomare" />
        </a>

        <nav className="navlinks" aria-label="Navigazione principale">
          <a className="active" href="#home">Home</a>
          <a href="#alloggio">Alloggio</a>
          <a href="#foto">Foto</a>
          <a href="#disponibilita">Disponibilità</a>
          <a href="#contatti">Contatti</a>
        </nav>

        <a className="top-cta" href="#disponibilita">Prenota diretto <span>▣</span></a>
      </header>

      <section id="home" className="hero">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="hero-readable" />
        <div className="hero-bottom-fade" />

        <div className="hero-content">
          <p className="legal-line">CIN: {CIN} <span>|</span> CIR: {CIR}</p>
          <h1>Vista mare, terrazza e comfort a due passi dal lungomare di Gela</h1>
          <div className="gold-rule" />
          <p className="hero-copy">
            Appartamento accogliente e riservato con ampia terrazza vista mare, ideale per coppie e soggiorni di relax in Sicilia.
          </p>
        </div>
      </section>

      <section className="booking-cards" aria-label="Opzioni di prenotazione">
        <a className="booking-card direct" href="#disponibilita">
          <img src={LOGO_EMBLEMA} alt="" />
          <span>
            <strong>PRENOTA DAL SITO</strong>
            <b>DA {formatEuro(pricing.nightlyRate)} / NOTTE</b>
            <em>{pricing.directRateText}</em>
          </span>
        </a>
        <a className="booking-card portal" href={bookingUrl} target="_blank" rel="noreferrer">
          <strong className="booking-b">B.</strong>
          <span>Booking.com</span>
        </a>
        <a className="booking-card portal" href={airbnbUrl} target="_blank" rel="noreferrer">
          <strong className="airbnb-mark">⌂</strong>
          <span>Airbnb</span>
        </a>
        <a className="booking-card portal" href={whatsappUrl} target="_blank" rel="noreferrer">
          <strong className="whatsapp-mark">●</strong>
          <span>WhatsApp</span>
        </a>
      </section>

      <section id="alloggio" className="amenities">
        <div><span>♙</span><strong>2 OSPITI</strong></div>
        <div><span>▭</span><strong>1 CAMERA</strong></div>
        <div><span>♨</span><strong>1 BAGNO</strong></div>
        <div><span>◴</span><strong>CUCINA</strong></div>
        <div><span>≋</span><strong>TERRAZZA VISTA MARE</strong></div>
      </section>

      <section className="why">
        <SectionTitle>PERCHÉ SCEGLIERE GELONE LUNGOMARE</SectionTitle>
        <div className="why-grid">
          <article>
            <i>●</i>
            <h3>POSIZIONE VICINO AL MARE</h3>
            <p>A pochi passi dal lungomare di Gela, per passeggiate e momenti indimenticabili.</p>
          </article>
          <article>
            <i>☂</i>
            <h3>TERRAZZA PRIVATA</h3>
            <p>Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax.</p>
          </article>
          <article>
            <i>◆</i>
            <h3>CHECK-IN SEMPLICE</h3>
            <p>Accesso comodo e supporto dedicato per un soggiorno senza pensieri.</p>
          </article>
          <article>
            <i>♥</i>
            <h3>PER COPPIE E VIAGGIATORI</h3>
            <p>Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere.</p>
          </article>
        </div>
      </section>

      <section id="foto" className="gallery-section">
        <SectionTitle>GALLERIA</SectionTitle>
        <div className="gallery-row">
          {gallery.map((src, index) => (
            <button key={`${src}-${index}`} type="button" className="gallery-thumb">
              <img src={src} alt={`Foto Gelone Lungomare ${index + 1}`} />
            </button>
          ))}
        </div>
        <a className="photo-button" href="#foto">VEDI TUTTE LE FOTO <span>▧</span></a>
      </section>

      <section id="disponibilita" className="availability">
        <div className="availability-card">
          <div className="availability-form-wrap">
            <SectionTitle>DISPONIBILITÀ E PRENOTAZIONE</SectionTitle>
            <form className="date-form" onSubmit={checkAvailability}>
              <label>
                <span>Check-in</span>
                <input min={minCheckIn} value={checkIn} onChange={(e) => {
                  setCheckIn(e.target.value);
                  setAvailability(null);
                  setRequestStatus(null);
                  if (!checkOut || checkOut <= e.target.value) setCheckOut(addDaysIso(e.target.value, 1));
                }} type="date" />
              </label>
              <label>
                <span>Check-out</span>
                <input min={checkIn ? addDaysIso(checkIn, 1) : minCheckIn} value={checkOut} onChange={(e) => {
                  setCheckOut(e.target.value);
                  setAvailability(null);
                  setRequestStatus(null);
                }} type="date" />
              </label>
              <label>
                <span>Ospiti</span>
                <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                  <option value="1">1 ospite</option>
                  <option value="2">2 ospiti</option>
                </select>
              </label>
              <button disabled={loading} type="submit">{loading ? "VERIFICA..." : "VERIFICA DISPONIBILITÀ"} <span>▣</span></button>
            </form>
            <div className="price-box">
              <div>
                <span>Tariffa diretta</span>
                <strong>da {formatEuro(pricing.nightlyRate)} / notte</strong>
                <small>Nessuna commissione portale. Su Booking è più alta.</small>
              </div>
              {priceEstimate.nights > 0 && (
                <div>
                  <span>Totale stimato</span>
                  <strong>{formatEuro(priceEstimate.total)}</strong>
                  <small>per {priceEstimate.nights} notte{priceEstimate.nights === 1 ? "" : "i"}{priceEstimate.cleaningFee > 0 ? `, pulizie incluse ${formatEuro(priceEstimate.cleaningFee)}` : ""}</small>
                </div>
              )}
              {priceEstimate.depositAmount > 0 && (
                <div>
                  <span>Caparra indicativa</span>
                  <strong>{formatEuro(priceEstimate.depositAmount)}</strong>
                  <small>{pricing.depositPercent}% per conferma, salvo accordi diretti.</small>
                </div>
              )}
            </div>
            <p className="best-rate">♡ {pricing.directRateText}</p>

            {availability && (
              <div className={availability.ok ? "notice ok" : "notice no"}>{availability.message}</div>
            )}

            {availability?.ok && (
              <form className="guest-form" onSubmit={createBookingRequest}>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome e cognome" />
                <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" type="email" />
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Telefono" />
                <button disabled={loading} type="submit">INVIA RICHIESTA DIRETTA</button>
              </form>
            )}

            {requestStatus && <div className={requestStatus.ok ? "notice ok" : "notice no"}>{requestStatus.message}</div>}
          </div>

          <div className="calendar-box">
            <div className="calendar-top">
              <button type="button" onClick={() => changeCalendarMonth(-1)} aria-label="Mese precedente">‹</button>
              <strong>{getMonthLabel(calendarMonth)}</strong>
              <button type="button" onClick={() => changeCalendarMonth(1)} aria-label="Mese successivo">›</button>
            </div>

            <div className="calendar-grid labels">
              {["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"].map((d) => <b key={d}>{d}</b>)}
            </div>

            <div className="calendar-grid calendar-days">
              {calendarDays.map((day) => {
                const status = calendarStatusByDate[day.iso];
                const isSelectedNight = selectedNights.includes(day.iso);
                const isCheckIn = checkIn === day.iso;
                const isCheckOut = checkOut === day.iso;
                const className = [
                  !day.inCurrentMonth ? "muted" : "",
                  day.isPast ? "past" : "",
                  status ? "busy" : "free",
                  status === "blocked" ? "blocked" : "",
                  ["pending_direct", "pending"].includes(status) ? "pending" : "",
                  isSelectedNight ? "selected" : "",
                  isCheckIn ? "edge" : "",
                  isCheckOut ? "checkout-edge" : "",
                ].filter(Boolean).join(" ");

                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={day.isPast || Boolean(status)}
                    onClick={() => selectCalendarDate(day.iso)}
                    className={className}
                    title={`${day.iso} - ${getCalendarStatusLabel(status)}`}
                  >
                    <span>{day.day}</span>
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend">
              <span><i className="free" /> Libero</span>
              <span><i className="busy" /> Occupato</span>
              <span><i className="blocked" /> Bloccato</span>
              <span><i className="selected" /> Selezionato</span>
            </div>

            <p className="calendar-note">
              {calendarLoading
                ? "Aggiornamento disponibilità..."
                : "Calendario collegato alle notti salvate nel PMS: prenotazioni, blocchi, Booking e Airbnb sincronizzati."}
            </p>
          </div>
        </div>
      </section>

      <section id="contatti" className="position">
        <SectionTitle>COME ARRIVARE / POSIZIONE</SectionTitle>
        <div className="position-card">
          <div className="position-text">
            <p className="address">📍 Via Pascoli 1, 93012 Gela (CL)</p>
            <ul>
              <li>Lungomare Federico II – 2 min a piedi</li>
              <li>Spiaggia di Gela – 5 min a piedi</li>
              <li>Centro Storico – 8 min in auto</li>
              <li>Stazione di Gela – 7 min in auto</li>
            </ul>
          </div>
          <a className="map-card" href="https://maps.app.goo.gl/JwYWW3RqFz5VdtCu6" target="_blank" rel="noreferrer">
            <div className="map-bg"><span>📍</span></div>
            <div className="map-label"><strong>Gelone Lungomare</strong><small>Via Pascoli 1, Gela (CL)</small></div>
          </a>
        </div>
      </section>

      <footer className="footer">
        <div>
          <img src={LOGO_HEADER} alt="Gelone Lungomare" />
          <p>CIN: {CIN} <span>|</span> CIR: {CIR}</p>
        </div>
        <div className="contacts">
          <h3>CONTATTI</h3>
          <a href="tel:+393476308456">☎ 3476308456</a>
          <a href="tel:+393479461999">☎ 3479461999</a>
          <a href="mailto:info@gelone.it">✉ info@gelone.it</a>
          <a href="https://www.gelone.it">◎ www.gelone.it</a>
        </div>
        <div>
          <h3>SEGUICI</h3>
          <div className="socials"><span>f</span><span>◎</span><span>☘</span></div>
        </div>
      </footer>
      <div className="copyright">© 2025 Gelone Lungomare – Locazione Turistica. Tutti i diritti riservati.</div>
    </main>
  );
}

const css = `
:root {
  --navy: #071f3d;
  --navy2: #0b294c;
  --gold: #b48616;
  --gold2: #d2ad5c;
  --cream: #fbf8ef;
  --paper: #fffdf7;
  --line: rgba(180, 134, 22, 0.25);
  --shadow: 0 16px 38px rgba(13, 25, 43, 0.13);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: #f4f1e9; color: var(--navy); font-family: Georgia, 'Times New Roman', serif; }
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; }

.site-shell { width: min(1280px, 100%); margin: 0 auto; background: var(--cream); box-shadow: 0 0 0 1px rgba(0,0,0,0.03); overflow: hidden; }

.topbar { height: 108px; display: grid; grid-template-columns: 250px 1fr 230px; align-items: center; gap: 22px; padding: 14px 58px; background: rgba(255, 253, 247, 0.98); border-bottom: 1px solid rgba(180, 134, 22, 0.18); position: relative; z-index: 5; }
.brand img { width: 205px; max-height: 82px; object-fit: contain; display: block; }
.navlinks { display: flex; align-items: center; justify-content: center; gap: 38px; font-weight: 700; font-size: 17px; letter-spacing: .01em; }
.navlinks a { position: relative; padding: 12px 0; }
.navlinks a.active::after, .navlinks a:hover::after { content: ''; position: absolute; left: 0; right: 0; bottom: 4px; height: 2px; background: var(--gold); }
.top-cta { justify-self: end; background: linear-gradient(180deg, #c29523, #a77a0e); color: #fff; border-radius: 5px; padding: 17px 24px; min-width: 205px; text-align: center; font-weight: 800; font-size: 17px; letter-spacing: .02em; box-shadow: 0 12px 24px rgba(130, 92, 5, .18); }
.top-cta span { margin-left: 8px; font-size: 15px; }

.hero { position: relative; min-height: 430px; overflow: hidden; isolation: isolate; background: #d7d4c7; }
.hero-video { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: cover; object-position: center center; transform: scale(1.006); }
.hero::after { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(251,248,239,.52) 0%, rgba(251,248,239,.32) 24%, rgba(251,248,239,.08) 47%, rgba(251,248,239,0) 66%); pointer-events: none; }
.hero-readable { position: absolute; left: 0; top: 0; bottom: 0; width: 45%; z-index: 2; background: linear-gradient(90deg, rgba(251,248,239,.18), rgba(251,248,239,.04), rgba(251,248,239,0)); pointer-events: none; }
.hero-bottom-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 104px; z-index: 3; background: linear-gradient(180deg, rgba(251,248,239,0), rgba(251,248,239,.72) 70%, var(--cream)); pointer-events: none; }
.hero-content { position: relative; z-index: 4; width: min(420px, 40%); padding: 22px 0 112px 64px; }
.legal-line { margin: 0 0 28px; font-size: 14px; font-weight: 800; letter-spacing: .07em; white-space: nowrap; text-shadow: 0 1px 12px rgba(255,255,255,.70); }
.legal-line span { color: var(--gold); margin: 0 18px; }
.hero h1 { margin: 0; max-width: 410px; font-size: clamp(27px, 2.35vw, 35px); line-height: 1.16; font-weight: 500; letter-spacing: .035em; text-wrap: balance; text-shadow: 0 2px 14px rgba(255,255,255,.65); }
.gold-rule { width: 200px; height: 1px; margin: 18px 0 18px; background: linear-gradient(90deg, var(--gold), rgba(180,134,22,0)); position: relative; }
.gold-rule::after { content: ''; position: absolute; top: -4px; left: 130px; width: 9px; height: 9px; background: var(--gold); transform: rotate(45deg); }
.hero-copy { margin: 0; max-width: 390px; font-size: 15px; line-height: 1.52; font-family: Georgia, 'Times New Roman', serif; color: rgba(7,31,61,.96); text-shadow: 0 1px 12px rgba(255,255,255,.72); }

.booking-cards { position: relative; z-index: 5; margin: -38px auto 0; width: min(900px, calc(100% - 170px)); display: grid; grid-template-columns: 1.08fr .92fr .92fr .92fr; gap: 16px; align-items: stretch; }
.booking-card { min-height: 58px; border-radius: 7px; display: flex; align-items: center; justify-content: center; box-shadow: 0 13px 30px rgba(13,25,43,.12); border: 1px solid rgba(140, 109, 50, .20); background: rgba(255,255,255,.94); backdrop-filter: blur(4px); }
.booking-card.direct { background: var(--navy); color: #fff; justify-content: flex-start; padding: 8px 14px; border: 2px solid var(--gold); gap: 13px; }
.booking-card.direct img { width: 42px; height: 36px; object-fit: contain; flex: 0 0 auto; opacity: .95; }
.booking-card.direct span { display: grid; gap: 2px; }
.booking-card.direct strong { font-size: 14px; letter-spacing: .08em; }
.booking-card.direct b { color: var(--gold2); font-size: 12.5px; letter-spacing: .14em; }
.booking-card.direct em { font-size: 11px; font-style: normal; }
.booking-card.portal { gap: 12px; font-size: 17px; font-weight: 800; letter-spacing: .015em; }
.booking-b { color: #0b5ea8; font-size: 28px; line-height: 1; }
.airbnb-mark { color: #e55b72; font-size: 32px; line-height: 1; font-family: Arial, sans-serif; font-weight: 400; }
.whatsapp-mark { color: #23bd60; font-size: 32px; line-height: .8; }

.amenities { margin: 34px auto 0; width: min(1050px, calc(100% - 120px)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: repeat(5, 1fr); }
.amenities div { min-height: 76px; display: flex; align-items: center; justify-content: center; gap: 16px; border-right: 1px solid var(--line); text-align: center; }
.amenities div:last-child { border-right: none; }
.amenities span { color: var(--gold); font-size: 27px; font-family: Georgia, serif; }
.amenities strong { font-size: 15px; letter-spacing: .11em; line-height: 1.25; }

.section-title { text-align: center; margin: 30px 0 22px; }
.section-title h2 { margin: 0; font-size: clamp(20px, 2.2vw, 28px); letter-spacing: .08em; font-weight: 700; }
.section-title span { display: block; width: 122px; height: 1px; margin: 13px auto 0; background: var(--gold); position: relative; }
.section-title span::after { content: ''; position: absolute; left: 50%; top: -4px; width: 9px; height: 9px; background: var(--gold); transform: translateX(-50%) rotate(45deg); }

.why, .gallery-section, .availability, .position { padding: 0 58px; }
.why-grid { width: min(1050px, 100%); margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.why-grid article { background: rgba(255,255,255,.45); border: 1px solid rgba(180,134,22,.22); border-radius: 7px; padding: 25px 28px 24px; text-align: center; min-height: 175px; }
.why-grid i { width: 58px; height: 58px; margin: 0 auto 14px; border-radius: 50%; background: rgba(180,134,22,.08); border: 1px solid rgba(180,134,22,.16); display: grid; place-items: center; color: var(--gold); font-style: normal; font-size: 22px; }
.why-grid h3 { margin: 0 0 10px; font-size: 16px; line-height: 1.18; letter-spacing: .05em; }
.why-grid p { margin: 0; font-size: 14px; line-height: 1.48; }

.gallery-section { padding-top: 4px; }
.gallery-row { width: min(1050px, 100%); margin: 0 auto; display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.gallery-thumb { border: 0; padding: 0; height: 112px; border-radius: 5px; overflow: hidden; background: #eee; cursor: pointer; box-shadow: 0 0 0 1px rgba(180,134,22,.22); }
.gallery-thumb img { width: 100%; height: 100%; display: block; object-fit: cover; }
.photo-button { width: 250px; height: 38px; margin: 12px auto 0; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--navy); color: #fff; border-radius: 4px; font-size: 14px; font-weight: 800; letter-spacing: .08em; }

.availability-card { width: min(1050px, 100%); margin: 28px auto 0; border: 1px solid rgba(180,134,22,.20); border-radius: 8px; display: grid; grid-template-columns: 1.25fr .9fr; overflow: hidden; background: rgba(255,255,255,.32); }
.availability-form-wrap { padding: 0 34px 28px; }
.date-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.date-form label { display: grid; gap: 7px; padding: 13px 14px; background: rgba(255,255,255,.55); border: 1px solid rgba(180,134,22,.18); border-radius: 6px; }
.date-form label span { font-size: 13px; font-weight: 800; }
.date-form input, .date-form select, .guest-form input { border: 0; background: transparent; color: var(--navy); min-width: 0; outline: none; font-family: Georgia, serif; }
.date-form button { grid-column: 1 / -1; height: 48px; border: 0; border-radius: 5px; background: linear-gradient(180deg, #c39726, #a5790e); color: #fff; font-weight: 800; letter-spacing: .07em; cursor: pointer; }
.price-box { margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.price-box div { background: rgba(255,255,255,.72); border: 1px solid rgba(180,134,22,.20); border-radius: 8px; padding: 13px 14px; display: grid; gap: 4px; }
.price-box span { font-size: 11px; font-weight: 800; letter-spacing: .12em; color: var(--gold); text-transform: uppercase; }
.price-box strong { font-size: 20px; color: var(--navy); }
.price-box small { font-size: 12px; line-height: 1.35; color: rgba(7,31,61,.72); }
.best-rate { text-align: center; margin: 13px 0 0; font-size: 15px; }
.notice { margin: 14px 0 0; padding: 12px 14px; border-radius: 6px; font-size: 14px; text-align: center; }
.notice.ok { background: rgba(47, 125, 78, .10); color: #1e623b; border: 1px solid rgba(47, 125, 78, .18); }
.notice.no { background: rgba(154, 72, 47, .10); color: #8a351e; border: 1px solid rgba(154, 72, 47, .18); }
.guest-form { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.guest-form input { background: rgba(255,255,255,.7); border: 1px solid rgba(180,134,22,.18); border-radius: 6px; padding: 12px; }
.guest-form button { grid-column: 1 / -1; border: 0; border-radius: 5px; background: var(--navy); color: #fff; padding: 13px; font-weight: 800; letter-spacing: .06em; cursor: pointer; }
.calendar-box { border-left: 1px solid rgba(180,134,22,.16); padding: 32px 42px; background: rgba(255,255,255,.32); }
.calendar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
.calendar-top strong { letter-spacing: .06em; text-align: center; }
.calendar-top button { width: 34px; height: 34px; border: 1px solid rgba(180,134,22,.25); border-radius: 999px; background: rgba(255,255,255,.72); color: var(--navy); font-size: 22px; cursor: pointer; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px 14px; text-align: center; font-size: 14px; }
.calendar-grid.labels { margin-bottom: 9px; font-size: 11px; color: rgba(7,31,61,.82); }
.calendar-days button { aspect-ratio: 1 / 1; border: 1px solid rgba(7,31,61,.08); border-radius: 999px; background: rgba(255,255,255,.62); color: var(--navy); font-family: Georgia, serif; cursor: pointer; transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.calendar-days button:not(:disabled):hover { transform: translateY(-1px); border-color: rgba(180,134,22,.48); background: rgba(255,255,255,.92); }
.calendar-days button.muted { opacity: .32; }
.calendar-days button.past { opacity: .24; cursor: not-allowed; }
.calendar-days button.busy { background: rgba(154,72,47,.14); border-color: rgba(154,72,47,.30); color: #7a2c18; cursor: not-allowed; text-decoration: line-through; }
.calendar-days button.blocked { background: rgba(7,31,61,.12); border-color: rgba(7,31,61,.28); color: var(--navy); }
.calendar-days button.pending { background: rgba(180,134,22,.16); border-color: rgba(180,134,22,.34); color: #8a640e; }
.calendar-days button.selected { background: rgba(180,134,22,.22); border-color: rgba(180,134,22,.70); box-shadow: inset 0 0 0 2px rgba(255,255,255,.65); }
.calendar-days button.edge { background: var(--gold); color: #fff; border-color: var(--gold); text-decoration: none; }
.calendar-days button.checkout-edge { border-color: var(--navy); box-shadow: inset 0 0 0 2px rgba(7,31,61,.16); }
.calendar-legend { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 12px; color: rgba(7,31,61,.78); }
.calendar-legend span { display: inline-flex; align-items: center; gap: 6px; }
.calendar-legend i { width: 11px; height: 11px; border-radius: 999px; border: 1px solid rgba(7,31,61,.12); background: rgba(255,255,255,.8); }
.calendar-legend i.busy { background: rgba(154,72,47,.20); border-color: rgba(154,72,47,.32); }
.calendar-legend i.blocked { background: rgba(7,31,61,.16); border-color: rgba(7,31,61,.30); }
.calendar-legend i.selected { background: rgba(180,134,22,.28); border-color: rgba(180,134,22,.70); }
.calendar-note { margin: 14px 0 0; font-size: 12px; line-height: 1.45; color: rgba(7,31,61,.70); }

.position-card { width: min(1050px, 100%); margin: 0 auto 28px; display: grid; grid-template-columns: .7fr 1.3fr; gap: 24px; border: 1px solid rgba(180,134,22,.20); border-radius: 8px; padding: 20px 26px; background: rgba(255,255,255,.28); }
.position-text { font-size: 15px; }
.position-text .address { font-weight: 800; margin: 6px 0 14px; }
.position-text li { margin: 7px 0; }
.map-card { min-height: 140px; display: grid; grid-template-columns: 1fr .55fr; border: 1px solid rgba(7,31,61,.10); border-radius: 7px; overflow: hidden; background: #fff; }
.map-bg { position: relative; background: linear-gradient(140deg, #f7f2e9 0 22%, #e8e0d3 22% 24%, #f7f2e9 24% 55%, #a9d9e8 55%); }
.map-bg::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(20deg, transparent 0 21px, rgba(7,31,61,.08) 22px, transparent 23px), repeating-linear-gradient(105deg, transparent 0 34px, rgba(180,134,22,.12) 35px, transparent 36px); opacity: .65; }
.map-bg span { position: absolute; top: 46%; left: 52%; transform: translate(-50%, -50%); font-size: 40px; z-index: 2; }
.map-label { display: grid; align-content: center; padding: 20px 24px; }
.map-label strong { font-size: 22px; margin-bottom: 7px; }
.map-label small { font-size: 15px; }

.footer { border-top: 1px solid rgba(180,134,22,.20); padding: 22px 72px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; align-items: center; background: rgba(255,253,247,.65); }
.footer img { width: 210px; display: block; }
.footer p { margin: 6px 0 0; font-size: 13px; letter-spacing: .07em; }
.footer h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: .08em; }
.contacts { display: grid; justify-content: center; gap: 4px; }
.contacts a { font-size: 14px; }
.socials { display: flex; gap: 16px; }
.socials span { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--navy); color: #fff; font-family: Arial, sans-serif; font-weight: 700; }
.copyright { background: var(--navy); color: #fff; text-align: center; padding: 13px; font-size: 13px; }

@media (max-width: 980px) {
  .topbar { grid-template-columns: 1fr auto; height: auto; padding: 14px 24px; }
  .navlinks { order: 3; grid-column: 1 / -1; gap: 18px; overflow-x: auto; justify-content: flex-start; padding-bottom: 4px; }
  .top-cta { min-width: auto; padding: 13px 15px; font-size: 15px; }
  .brand img { width: 170px; }
  .hero { min-height: 500px; }
  .hero-video { object-position: center center; }
  .hero::after { background: linear-gradient(180deg, rgba(251,248,239,.64), rgba(251,248,239,.20), rgba(251,248,239,0)); }
  .hero-readable { width: 100%; }
  .hero-content { width: 100%; padding: 20px 24px 185px; }
  .hero h1 { font-size: 34px; max-width: 430px; }
  .legal-line { font-size: 13px; margin-bottom: 26px; }
  .booking-cards { width: calc(100% - 32px); margin-top: -118px; grid-template-columns: 1fr 1fr; gap: 10px; }
  .booking-card { min-height: 70px; }
  .booking-card.portal { font-size: 18px; gap: 8px; }
  .booking-b { font-size: 35px; }
  .airbnb-mark { font-size: 31px; }
  .whatsapp-mark { font-size: 36px; }
  .booking-card.direct { padding: 11px 13px; gap: 11px; }
  .booking-card.direct img { width: 42px; }
  .booking-card.direct strong { font-size: 14px; }
  .booking-card.direct b { font-size: 13px; }
  .booking-card.direct em { font-size: 12px; }
  .amenities { width: calc(100% - 32px); grid-template-columns: 1fr; margin-top: 24px; }
  .amenities div { border-right: 0; border-bottom: 1px solid var(--line); min-height: 58px; }
  .why, .gallery-section, .availability, .position { padding: 0 16px; }
  .why-grid, .gallery-row, .availability-card, .position-card, .footer { grid-template-columns: 1fr; }
  .gallery-row { grid-template-columns: 1fr 1fr; }
  .gallery-thumb { height: 125px; }
  .calendar-box { border-left: 0; border-top: 1px solid rgba(180,134,22,.16); padding: 22px; }
  .date-form, .guest-form { grid-template-columns: 1fr; }
  .map-card { grid-template-columns: 1fr; }
  .map-bg { min-height: 145px; }
  .footer { padding: 22px 26px; text-align: center; }
  .footer img { margin: 0 auto; }
  .contacts { justify-content: center; }
  .socials { justify-content: center; }
}
`;
