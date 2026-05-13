import React, { useMemo, useState } from "react";

const LOGO_URL = "/images/logo-gelone-header-senza-qrcode.png";
const COMPACT_LOGO_URL = "/images/logo-gelone-emblema-senza-qrcode.png";
const FALLBACK_LOGO_URL = "/favicon.svg";
const VISTA_MARE = "/images/vista-mare-gelone.jpg";
const TERRAZZA = "/images/terrazza-gelone.jpg";
const INTERNI = "/images/interni-gelone.jpg";

const CIN = "IT084001B4D36830";
const CIR = "190840010022";
const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.it.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const whatsappUrl = "https://wa.me/393476308456";
const mapsUrl = "https://maps.app.goo.gl/JwYWW3RqFz5VdtCu6";

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function BrandLogo({ className = "", compact = false }) {
  const [src, setSrc] = useState(compact ? COMPACT_LOGO_URL : LOGO_URL);
  return (
    <div className={`brand-logo ${className}`}>
      <img
        src={src}
        alt="Gelone Lungomare"
        onError={() => {
          if (src !== FALLBACK_LOGO_URL) setSrc(FALLBACK_LOGO_URL);
        }}
      />
      {compact ? null : (
        <div className="brand-fallback-text" aria-hidden="true">
          <strong>GELONE</strong>
          <span>LUNGOMARE</span>
          <small>LOCAZIONE TURISTICA</small>
        </div>
      )}
    </div>
  );
}

function Icon({ children }) {
  return <span className="icon-gold" aria-hidden="true">{children}</span>;
}

function BookingCard({ type, href, title, subtitle, small, children }) {
  return (
    <a className={`booking-card ${type || ""}`} href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="booking-text">
        <strong>{title}</strong>
        {subtitle ? <em>{subtitle}</em> : null}
        {small ? <small>{small}</small> : null}
      </span>
    </a>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <article className="feature-card">
      <div className="round-icon"><Icon>{icon}</Icon></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Amenity({ icon, label }) {
  return (
    <div className="amenity">
      <Icon>{icon}</Icon>
      <span>{label}</span>
    </div>
  );
}

function CalendarMock() {
  const rows = [
    [26, 27, 28, 29, 30, 31, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 1, 2, 3, 4, 5, 6],
  ];
  return (
    <div className="calendar-card" aria-label="Calendario disponibilità">
      <div className="calendar-head"><span>‹</span><strong>GIUGNO 2025</strong><span>›</span></div>
      <div className="calendar-grid days">
        {['LUN','MAR','MER','GIO','VEN','SAB','DOM'].map((d) => <b key={d}>{d}</b>)}
      </div>
      {rows.map((row, i) => (
        <div className="calendar-grid" key={i}>
          {row.map((d, j) => <span key={`${i}-${j}`}>{d}</span>)}
        </div>
      ))}
    </div>
  );
}

function AvailabilityForm() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [requestStatus, setRequestStatus] = useState(null);

  async function checkAvailability(e) {
    e.preventDefault();
    setAvailability(null);
    setRequestStatus(null);

    if (!checkIn || !checkOut) {
      setAvailability({ ok: false, message: "Seleziona check-in e check-out." });
      return;
    }

    if (checkOut <= checkIn) {
      setAvailability({ ok: false, message: "Il check-out deve essere successivo al check-in." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guests: Number(guests) }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || data?.message || "Errore verifica disponibilità.");

      if (data.available) {
        setAvailability({ ok: true, message: "Periodo disponibile. Puoi inviare una richiesta diretta." });
      } else {
        setAvailability({ ok: false, message: "Periodo non disponibile. Prova altre date o contattaci su WhatsApp." });
      }
    } catch (err) {
      setAvailability({ ok: false, message: err.message || "Impossibile verificare la disponibilità adesso." });
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(e) {
    e.preventDefault();
    setRequestStatus(null);

    if (!guestName || !guestPhone) {
      setRequestStatus({ ok: false, message: "Inserisci almeno nome e telefono." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          checkIn,
          checkOut,
          guests: Number(guests),
          notes,
          source: "direct_site",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Errore invio richiesta.");
      setRequestStatus({ ok: true, message: "Richiesta inviata. Ti contatteremo per confermare la prenotazione." });
    } catch (err) {
      setRequestStatus({ ok: false, message: err.message || "Impossibile inviare la richiesta adesso." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="availability-layout">
      <div className="booking-form-card">
        <form onSubmit={checkAvailability}>
          <div className="form-row">
            <label>
              <span>Check-in</span>
              <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </label>
            <label>
              <span>Check-out</span>
              <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </label>
            <label>
              <span>Ospiti</span>
              <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                <option value="1">1 ospite</option>
                <option value="2">2 ospiti</option>
              </select>
            </label>
          </div>
          <button className="gold-button wide" type="submit" disabled={loading}>
            {loading ? "CONTROLLO..." : "VERIFICA DISPONIBILITÀ"} <span>▣</span>
          </button>
          <p className="guarantee">♢ Miglior tariffa garantita prenotando dal sito</p>
        </form>

        {availability ? (
          <div className={`notice ${availability.ok ? "ok" : "no"}`}>{availability.message}</div>
        ) : null}

        {availability?.ok ? (
          <form className="request-form" onSubmit={sendRequest}>
            <div className="form-row two">
              <label>
                <span>Nome</span>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome e cognome" />
              </label>
              <label>
                <span>Telefono</span>
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Telefono" />
              </label>
            </div>
            <label>
              <span>Email</span>
              <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" />
            </label>
            <label>
              <span>Note</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Eventuali richieste" rows="3" />
            </label>
            <button className="navy-button" type="submit" disabled={loading}>INVIA RICHIESTA DIRETTA</button>
          </form>
        ) : null}

        {requestStatus ? <div className={`notice ${requestStatus.ok ? "ok" : "no"}`}>{requestStatus.message}</div> : null}
      </div>
      <CalendarMock />
    </div>
  );
}

export default function App() {
  return (
    <main className="gelone-page">
      <style>{styles}</style>

      <div className="site-shell">
        <header className="topbar">
          <a href="#home" className="logo-link" aria-label="Gelone Lungomare home">
            <BrandLogo />
          </a>
          <nav className="nav-links" aria-label="Navigazione principale">
            <button onClick={() => scrollToId("home")}>Home</button>
            <button onClick={() => scrollToId("alloggio")}>Alloggio</button>
            <button onClick={() => scrollToId("gallery")}>Foto</button>
            <button onClick={() => scrollToId("availability")}>Disponibilità</button>
            <button onClick={() => scrollToId("contacts")}>Contatti</button>
          </nav>
          <button className="gold-button top" onClick={() => scrollToId("availability")}>Prenota diretto <span>▣</span></button>
        </header>

        <section id="home" className="hero-section">
          <div className="legal-line">CIN: {CIN} <span>|</span> CIR: {CIR}</div>
          <div className="hero-photo" aria-label="Terrazza vista mare Gelone Lungomare">
            <div className="hero-sea" />
            <div className="hero-terrace" />
            <div className="hero-soft-left" />
            <div className="hero-content">
              <h1>Vista mare, terrazza e comfort a due passi dal lungomare di Gela</h1>
              <div className="ornament" />
              <p>Appartamento accogliente e riservato con ampia terrazza vista mare, ideale per coppie e viaggiatori di relax in Sicilia.</p>
            </div>
          </div>

          <div className="portal-row">
            <BookingCard type="direct" href="#availability" title="PRENOTA DAL SITO" subtitle="MIGLIOR TARIFFA" small="Risparmia prenotando diretto">
              <BrandLogo compact className="mini-logo" />
            </BookingCard>
            <BookingCard href={bookingUrl} title="Booking.com">
              <span className="booking-b">B.</span>
            </BookingCard>
            <BookingCard href={airbnbUrl} title="Airbnb">
              <span className="airbnb-symbol">⌂</span>
            </BookingCard>
            <BookingCard href={whatsappUrl} title="WhatsApp">
              <span className="whatsapp-symbol">●</span>
            </BookingCard>
          </div>
        </section>

        <section id="alloggio" className="amenities-row" aria-label="Caratteristiche alloggio">
          <Amenity icon="♙" label="2 OSPITI" />
          <Amenity icon="▱" label="1 CAMERA" />
          <Amenity icon="♨" label="1 BAGNO" />
          <Amenity icon="◴" label="CUCINA" />
          <Amenity icon="≋" label="TERRAZZA VISTA MARE" />
        </section>

        <section className="why-section">
          <h2>PERCHÉ SCEGLIERE GELONE LUNGOMARE</h2>
          <div className="ornament center" />
          <div className="features-grid">
            <FeatureCard icon="●" title="POSIZIONE VICINO AL MARE" text="A pochi passi dal lungomare di Gela, per passeggiate e momenti indimenticabili." />
            <FeatureCard icon="☂" title="TERRAZZA PRIVATA" text="Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax." />
            <FeatureCard icon="◆" title="CHECK-IN SEMPLICE" text="Accesso comodo e supporto dedicato per un soggiorno senza pensieri." />
            <FeatureCard icon="♥" title="PER COPPIE E VIAGGIATORI" text="Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere." />
          </div>
        </section>

        <section id="gallery" className="gallery-section">
          <h2>GALLERIA</h2>
          <div className="ornament center" />
          <div className="gallery-grid">
            <img src={TERRAZZA} alt="Terrazza Gelone Lungomare" />
            <img src={VISTA_MARE} alt="Vista mare Gelone Lungomare" />
            <img src={INTERNI} alt="Interni Gelone Lungomare" />
            <img src={TERRAZZA} alt="Terrazza attrezzata" />
            <img src={VISTA_MARE} alt="Tramonto vista mare" />
          </div>
          <button className="navy-button gallery-btn" type="button">VEDI TUTTE LE FOTO ▧</button>
        </section>

        <section id="availability" className="availability-section">
          <h2>DISPONIBILITÀ E PRENOTAZIONE</h2>
          <AvailabilityForm />
        </section>

        <section className="location-section">
          <div className="location-copy">
            <h2>COME ARRIVARE / POSIZIONE</h2>
            <p><strong>Gelone Lungomare – Locazione Turistica</strong><br />Via Pascoli, 1 – 93012 Gela (CL), Sicilia</p>
            <p>A due passi dal lungomare e dalle spiagge di Gela, in una zona tranquilla e ben servita.</p>
            <p className="parking">▣ Parcheggio gratuito disponibile in zona.</p>
          </div>
          <a className="map-card" href={mapsUrl} target="_blank" rel="noreferrer" aria-label="Apri posizione su Google Maps">
            <div className="fake-map">
              <span className="map-water" />
              <span className="map-pin">●</span>
              <div className="map-line one" />
              <div className="map-line two" />
              <div className="map-line three" />
              <div className="map-line four" />
            </div>
          </a>
        </section>

        <footer id="contacts" className="footer">
          <div><BrandLogo /></div>
          <div className="footer-contacts">
            <p>☎ 347 630 8456</p>
            <p>☎ 347 946 1999</p>
            <p>✉ info@gelone.it</p>
            <p>◎ www.gelone.it</p>
          </div>
          <div className="footer-legal">
            <p>CIN: {CIN}</p>
            <p>CIR: {CIR}</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

const styles = `
:root {
  --gelone-navy: #071a36;
  --gelone-blue: #0b274b;
  --gelone-gold: #b78312;
  --gelone-soft-gold: #d9b96d;
  --gelone-cream: #fbf7ee;
  --gelone-card: #fffdf7;
  --gelone-line: rgba(183, 131, 18, 0.28);
  --gelone-text: #091d38;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: #f5f2ea; color: var(--gelone-text); }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }
.gelone-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f9f6ee 0%, #f1eee5 100%);
  font-family: "Georgia", "Times New Roman", serif;
  color: var(--gelone-navy);
}
.site-shell {
  width: min(100%, 1086px);
  margin: 0 auto;
  background: var(--gelone-cream);
  box-shadow: 0 20px 70px rgba(7, 26, 54, 0.08);
  overflow: hidden;
}
.topbar {
  height: 95px;
  display: grid;
  grid-template-columns: 260px 1fr 170px;
  align-items: center;
  gap: 22px;
  padding: 14px 42px 10px;
  background: rgba(253, 250, 242, 0.96);
  border-top: 2px solid rgba(183, 131, 18, 0.15);
  border-bottom: 1px solid var(--gelone-line);
}
.logo-link { text-decoration: none; color: inherit; }
.brand-logo { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-logo img { width: 245px; max-width: 100%; height: 72px; object-fit: contain; object-position: left center; display: block; }
.brand-logo.compact img, .mini-logo img { width: 48px; height: 48px; object-fit: contain; }
.brand-fallback-text { display: none; line-height: 1; letter-spacing: 0.22em; color: var(--gelone-navy); }
.brand-logo img[src$="favicon.svg"] + .brand-fallback-text { display: grid; }
.brand-fallback-text strong { font-size: 26px; }
.brand-fallback-text span { font-size: 14px; letter-spacing: 0.35em; }
.brand-fallback-text small { font-size: 8px; letter-spacing: 0.28em; }
.nav-links { display: flex; align-items: center; justify-content: center; gap: 28px; }
.nav-links button {
  border: 0;
  background: transparent;
  color: var(--gelone-navy);
  font-family: Georgia, serif;
  font-size: 15px;
  padding: 8px 0;
  position: relative;
}
.nav-links button:first-child::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--gelone-gold);
}
.gold-button, .navy-button {
  border: 0;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: .06em;
  min-height: 45px;
  padding: 0 22px;
  font-family: Georgia, serif;
  text-transform: uppercase;
}
.gold-button {
  color: #fffdf7;
  background: linear-gradient(180deg, #be8d20 0%, #a87405 100%);
  box-shadow: 0 5px 14px rgba(116, 75, 2, .18);
}
.gold-button.top { text-transform: none; white-space: nowrap; }
.navy-button {
  color: #fff;
  background: var(--gelone-navy);
  box-shadow: 0 5px 14px rgba(7, 26, 54, .18);
}
.hero-section { position: relative; }
.legal-line {
  position: absolute;
  z-index: 5;
  left: 42px;
  top: 9px;
  font-size: 13px;
  letter-spacing: .08em;
  font-weight: 700;
}
.legal-line span { color: var(--gelone-gold); padding: 0 16px; }
.hero-photo {
  position: relative;
  height: 355px;
  overflow: hidden;
  background: #e9dfcf;
}
.hero-sea, .hero-terrace, .hero-soft-left { position: absolute; inset: 0; }
.hero-sea {
  background-image: url("/images/vista-mare-gelone.jpg");
  background-size: cover;
  background-position: center 45%;
  filter: saturate(1.06) contrast(1.02) brightness(1.08);
}
.hero-terrace {
  left: 48%;
  background-image: linear-gradient(90deg, rgba(251,247,238,0) 0%, rgba(251,247,238,.05) 10%, rgba(0,0,0,0) 24%), url("/images/terrazza-gelone.jpg");
  background-size: cover;
  background-position: center center;
  opacity: .93;
  -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.68) 17%, rgba(0,0,0,1) 40%);
  mask-image: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.68) 17%, rgba(0,0,0,1) 40%);
}
.hero-soft-left {
  background: linear-gradient(90deg, rgba(251,247,238,.98) 0%, rgba(251,247,238,.93) 29%, rgba(251,247,238,.45) 45%, rgba(251,247,238,0) 62%);
}
.hero-content {
  position: relative;
  z-index: 2;
  width: 435px;
  padding: 65px 0 0 48px;
}
.hero-content h1 {
  margin: 0;
  max-width: 380px;
  font-size: clamp(34px, 4.4vw, 44px);
  line-height: 1.18;
  letter-spacing: .045em;
  font-weight: 500;
}
.ornament {
  width: 165px;
  height: 1px;
  background: var(--gelone-soft-gold);
  margin: 24px 0 20px;
  position: relative;
}
.ornament::after {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  background: var(--gelone-gold);
  transform: translateX(-50%) rotate(45deg);
}
.ornament.center { margin: 10px auto 18px; width: 95px; }
.hero-content p {
  margin: 0;
  max-width: 350px;
  font-size: 15px;
  line-height: 1.65;
  font-family: Georgia, serif;
}
.portal-row {
  width: calc(100% - 120px);
  margin: -45px auto 0;
  position: relative;
  z-index: 6;
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr 1fr;
  gap: 12px;
}
.booking-card {
  min-height: 84px;
  border-radius: 6px;
  border: 1px solid rgba(7, 26, 54, .12);
  background: rgba(255,255,255,.96);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-decoration: none;
  color: var(--gelone-navy);
  box-shadow: 0 8px 22px rgba(7, 26, 54, .12);
  overflow: hidden;
}
.booking-card.direct {
  background: var(--gelone-navy);
  color: #fff;
  border: 2px solid var(--gelone-gold);
  justify-content: flex-start;
  padding-left: 24px;
}
.booking-card.direct .booking-text strong { color: #fff; }
.booking-card.direct .booking-text em { color: var(--gelone-soft-gold); }
.booking-text { display: grid; line-height: 1.1; }
.booking-text strong { font-size: 20px; letter-spacing: .04em; }
.booking-text em { font-style: normal; margin-top: 3px; color: var(--gelone-gold); font-size: 16px; font-weight: 700; letter-spacing: .13em; }
.booking-text small { margin-top: 5px; font-size: 12px; color: currentColor; letter-spacing: 0; opacity: .95; }
.booking-b { font: 700 43px Arial, sans-serif; color: #0b55a0; }
.airbnb-symbol { color: #e44d67; font-size: 38px; line-height: 1; }
.whatsapp-symbol { width: 38px; height: 38px; border-radius: 50%; background: #23c465; display: inline-grid; place-items: center; color: #23c465; }
.amenities-row {
  margin: 28px 60px 0;
  padding: 18px 0;
  border-top: 1px solid var(--gelone-line);
  border-bottom: 1px solid var(--gelone-line);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
}
.amenity {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  border-right: 1px solid var(--gelone-line);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: .08em;
  text-align: left;
}
.amenity:last-child { border-right: 0; }
.icon-gold { color: var(--gelone-gold); font-size: 26px; font-weight: 400; }
.why-section, .gallery-section, .availability-section, .location-section { padding: 0 44px; }
.why-section { padding-top: 10px; }
h2 {
  margin: 0;
  color: var(--gelone-blue);
  text-align: center;
  font-size: 22px;
  letter-spacing: .07em;
  font-weight: 600;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.feature-card {
  min-height: 150px;
  padding: 18px 18px 16px;
  text-align: center;
  border: 1px solid rgba(183,131,18,.2);
  border-radius: 6px;
  background: rgba(255,253,247,.8);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.5);
}
.round-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 9px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle, rgba(217,185,109,.23), rgba(255,255,255,0));
  border: 1px solid rgba(183,131,18,.14);
}
.round-icon .icon-gold { font-size: 28px; }
.feature-card h3 {
  margin: 0 0 7px;
  font-size: 15px;
  letter-spacing: .05em;
  line-height: 1.15;
}
.feature-card p {
  margin: 0 auto;
  max-width: 175px;
  font-size: 13px;
  line-height: 1.45;
}
.gallery-section { padding-top: 18px; text-align: center; }
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 13px;
  margin-top: 12px;
}
.gallery-grid img {
  width: 100%;
  height: 96px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid rgba(183,131,18,.16);
  box-shadow: 0 5px 14px rgba(7,26,54,.08);
}
.gallery-btn {
  margin-top: 14px;
  min-height: 34px;
  padding: 0 26px;
  font-size: 13px;
}
.availability-section { padding-top: 22px; }
.availability-layout {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1.18fr .82fr;
  gap: 18px;
  align-items: start;
}
.booking-form-card, .calendar-card, .location-copy, .map-card {
  border: 1px solid rgba(183,131,18,.2);
  border-radius: 6px;
  background: rgba(255,253,247,.76);
  box-shadow: 0 8px 22px rgba(7,26,54,.05);
}
.booking-form-card { padding: 22px; }
.form-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.form-row.two { grid-template-columns: repeat(2, 1fr); }
label { display: grid; gap: 6px; color: var(--gelone-navy); font-size: 13px; text-align: left; }
label span { font-weight: 700; }
input, select, textarea {
  width: 100%;
  border: 1px solid rgba(7,26,54,.14);
  border-radius: 5px;
  background: #fffdf8;
  min-height: 44px;
  padding: 10px 12px;
  color: var(--gelone-navy);
  outline: none;
}
textarea { resize: vertical; min-height: 76px; }
.gold-button.wide { width: 100%; margin-top: 14px; }
.guarantee { margin: 12px 0 0; text-align: center; font-size: 15px; }
.notice { margin-top: 14px; padding: 12px 14px; border-radius: 5px; font-size: 14px; line-height: 1.4; text-align: left; }
.notice.ok { color: #0f5132; background: #eaf6ef; border: 1px solid #b7e2c3; }
.notice.no { color: #7a1a1a; background: #fff0ee; border: 1px solid #efc4bd; }
.request-form { display: grid; gap: 10px; margin-top: 14px; }
.request-form .navy-button { width: 100%; }
.calendar-card { padding: 18px 24px 20px; }
.calendar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: var(--gelone-blue); }
.calendar-head strong { letter-spacing: .07em; }
.calendar-head span { font-size: 22px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; gap: 8px; font-size: 13px; color: var(--gelone-blue); }
.calendar-grid.days { font-size: 10px; font-weight: 700; margin-bottom: 8px; opacity: .75; }
.calendar-grid span { padding: 3px 0; }
.location-section {
  padding-top: 22px;
  padding-bottom: 24px;
  display: grid;
  grid-template-columns: .86fr 1.14fr;
  gap: 16px;
}
.location-copy { padding: 22px; }
.location-copy h2 { text-align: left; margin-bottom: 12px; }
.location-copy p { margin: 0 0 12px; line-height: 1.55; font-size: 15px; }
.parking { color: var(--gelone-gold); font-weight: 700; }
.map-card { min-height: 188px; overflow: hidden; position: relative; text-decoration: none; }
.fake-map { position: absolute; inset: 0; background: #e7dfd0; overflow: hidden; }
.map-water { position: absolute; inset: 52% -8% -25% -5%; transform: rotate(-7deg); background: #b9dcea; }
.map-pin { position: absolute; left: 47%; top: 43%; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--gelone-blue); color: transparent; box-shadow: 0 3px 9px rgba(0,0,0,.18); }
.map-pin::after { content: ""; position: absolute; inset: 9px; border-radius: 50%; background: var(--gelone-soft-gold); }
.map-line { position: absolute; height: 1px; background: rgba(7,26,54,.16); transform-origin: left center; }
.map-line.one { width: 90%; left: 8%; top: 30%; transform: rotate(-5deg); }
.map-line.two { width: 80%; left: 4%; top: 41%; transform: rotate(8deg); }
.map-line.three { width: 85%; left: 10%; top: 54%; transform: rotate(-12deg); }
.map-line.four { width: 70%; left: 22%; top: 24%; transform: rotate(84deg); }
.footer {
  border-top: 1px solid var(--gelone-line);
  padding: 22px 44px;
  display: grid;
  grid-template-columns: 1fr .85fr .85fr;
  gap: 28px;
  align-items: center;
  background: rgba(255,253,247,.76);
}
.footer .brand-logo img { width: 230px; height: 68px; }
.footer-contacts, .footer-legal { border-left: 1px solid var(--gelone-line); padding-left: 28px; }
.footer p { margin: 4px 0; font-size: 15px; }
.footer-legal { font-weight: 700; letter-spacing: .06em; }
@media (max-width: 900px) {
  .site-shell { width: 100%; }
  .topbar { height: auto; grid-template-columns: 1fr; justify-items: center; padding: 14px 18px; gap: 10px; }
  .brand-logo img { width: 235px; }
  .nav-links { gap: 15px; flex-wrap: wrap; }
  .gold-button.top { min-height: 39px; }
  .legal-line { position: relative; left: auto; top: auto; padding: 8px 18px; text-align: center; }
  .hero-photo { height: 430px; }
  .hero-terrace { left: 35%; }
  .hero-soft-left { background: linear-gradient(180deg, rgba(251,247,238,.98) 0%, rgba(251,247,238,.90) 46%, rgba(251,247,238,.1) 72%, rgba(251,247,238,0) 100%); }
  .hero-content { width: auto; padding: 38px 28px 0; }
  .hero-content h1 { max-width: 420px; font-size: 33px; }
  .portal-row { width: calc(100% - 32px); grid-template-columns: 1fr 1fr; margin-top: -38px; }
  .amenities-row { margin: 22px 18px 0; grid-template-columns: 1fr 1fr; }
  .amenity:nth-child(2n) { border-right: 0; }
  .why-section, .gallery-section, .availability-section, .location-section { padding-left: 18px; padding-right: 18px; }
  .features-grid { grid-template-columns: 1fr 1fr; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
  .gallery-grid img { height: 120px; }
  .availability-layout, .location-section, .footer { grid-template-columns: 1fr; }
  .form-row, .form-row.two { grid-template-columns: 1fr; }
  .footer-contacts, .footer-legal { border-left: 0; padding-left: 0; }
}
@media (max-width: 520px) {
  .nav-links { font-size: 13px; gap: 10px; }
  .nav-links button { font-size: 13px; }
  .hero-photo { height: 460px; }
  .hero-terrace { left: 20%; opacity: .72; }
  .hero-content h1 { font-size: 28px; line-height: 1.22; }
  .portal-row { grid-template-columns: 1fr; }
  .booking-card { min-height: 72px; }
  .amenities-row, .features-grid, .gallery-grid { grid-template-columns: 1fr; }
  .amenity { border-right: 0; border-bottom: 1px solid var(--gelone-line); }
  .amenity:last-child { border-bottom: 0; }
  h2 { font-size: 19px; }
}
`;
