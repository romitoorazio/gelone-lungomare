import React, { useMemo, useState } from "react";

const LOGO_HEADER = "/images/logo-gelone-header-senza-qrcode.png";
const LOGO_EMBLEMA = "/images/logo-gelone-emblema-senza-qrcode.png";
const FOTO_MARE = "/images/vista-mare-gelone.jpg";
const FOTO_TERRAZZA = "/images/terrazza-gelone.jpg";
const FOTO_INTERNI = "/images/interni-gelone.jpg";

const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.it.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const whatsappUrl = "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const CIN = "IT084001B4D36830";
const CIR = "190840010022";

const gallery = [FOTO_TERRAZZA, FOTO_MARE, FOTO_INTERNI, FOTO_TERRAZZA, FOTO_MARE];

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(dateIso, days) {
  if (!dateIso) return "";
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

    setLoading(true);
    try {
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guests: Number(guests) }),
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
          checkIn,
          checkOut,
          guests: Number(guests),
          guestName,
          guestEmail,
          guestPhone,
          notes: "Richiesta inviata dal sito Gelone Lungomare",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Errore invio richiesta");
      setRequestStatus({ ok: true, message: "Richiesta inviata. Ti contatteremo per confermare." });
    } catch (error) {
      setRequestStatus({ ok: false, message: error.message || "Errore durante l'invio." });
    } finally {
      setLoading(false);
    }
  };

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
        <div className="hero-sea" />
        <div className="hero-terrace" />
        <div className="hero-soft-left" />
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
            <b>MIGLIOR TARIFFA</b>
            <em>Risparmia prenotando diretto</em>
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
                  if (!checkOut || checkOut <= e.target.value) setCheckOut(addDaysIso(e.target.value, 1));
                }} type="date" />
              </label>
              <label>
                <span>Check-out</span>
                <input min={checkIn ? addDaysIso(checkIn, 1) : minCheckIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} type="date" />
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
            <p className="best-rate">♡ Miglior tariffa garantita prenotando dal sito</p>

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

          <div className="calendar-box" aria-hidden="true">
            <div className="calendar-top"><span>‹</span><strong>GIUGNO 2025</strong><span>›</span></div>
            <div className="calendar-grid labels">
              {['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'].map((d) => <b key={d}>{d}</b>)}
            </div>
            <div className="calendar-grid">
              {[26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6].map((d, i) => <span key={`${d}-${i}`} className={i < 6 || i > 35 ? "muted" : ""}>{d}</span>)}
            </div>
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
.top-cta { justify-self: end; background: linear-gradient(180deg, #c29523, #a77a0e); color: #fff; border-radius: 5px; padding: 17px 24px; min-width: 205px; text-align: center; font-weight: 800; font-size: 19px; letter-spacing: .02em; box-shadow: 0 12px 24px rgba(130, 92, 5, .18); }
.top-cta span { margin-left: 8px; font-size: 15px; }

.hero { position: relative; min-height: 430px; overflow: hidden; isolation: isolate; }
.hero-sea, .hero-terrace { position: absolute; inset: 0; background-size: cover; background-position: center; z-index: 0; }
.hero-sea { right: 34%; background-image: url('${FOTO_MARE}'); background-position: center 47%; }
.hero-terrace { left: 45%; background-image: url('${FOTO_TERRAZZA}'); background-position: center 50%; }
.hero-soft-left { position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(251,248,239,.62) 0%, rgba(251,248,239,.38) 31%, rgba(251,248,239,.08) 51%, rgba(251,248,239,0) 74%); pointer-events: none; }
.hero-bottom-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 130px; z-index: 2; background: linear-gradient(180deg, rgba(251,248,239,0), rgba(251,248,239,.86) 72%, var(--cream)); pointer-events: none; }
.hero-content { position: relative; z-index: 3; width: min(520px, 46%); padding: 26px 0 115px 64px; }
.legal-line { margin: 0 0 38px; font-size: 16px; font-weight: 800; letter-spacing: .08em; white-space: nowrap; }
.legal-line span { color: var(--gold); margin: 0 20px; }
.hero h1 { margin: 0; max-width: 470px; font-size: clamp(30px, 3.2vw, 45px); line-height: 1.13; font-weight: 500; letter-spacing: .045em; text-wrap: balance; }
.gold-rule { width: 235px; height: 1px; margin: 23px 0 26px; background: linear-gradient(90deg, var(--gold), rgba(180,134,22,0)); position: relative; }
.gold-rule::after { content: ''; position: absolute; top: -4px; left: 138px; width: 9px; height: 9px; background: var(--gold); transform: rotate(45deg); }
.hero-copy { margin: 0; max-width: 420px; font-size: 16.5px; line-height: 1.58; font-family: Georgia, 'Times New Roman', serif; color: rgba(7,31,61,.95); }

.booking-cards { position: relative; z-index: 4; margin: -55px auto 0; width: min(1040px, calc(100% - 120px)); display: grid; grid-template-columns: 1.12fr 1fr 1fr 1fr; gap: 18px; align-items: stretch; }
.booking-card { min-height: 82px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); border: 1px solid rgba(140, 109, 50, .23); background: rgba(255,255,255,.92); backdrop-filter: blur(4px); }
.booking-card.direct { background: var(--navy); color: #fff; justify-content: flex-start; padding: 14px 20px; border: 2px solid var(--gold); gap: 18px; }
.booking-card.direct img { width: 58px; height: 48px; object-fit: contain; flex: 0 0 auto; opacity: .95; }
.booking-card.direct span { display: grid; gap: 2px; }
.booking-card.direct strong { font-size: 18px; letter-spacing: .08em; }
.booking-card.direct b { color: var(--gold2); font-size: 16px; letter-spacing: .16em; }
.booking-card.direct em { font-size: 13px; font-style: normal; }
.booking-card.portal { gap: 16px; font-size: 23px; font-weight: 800; letter-spacing: .015em; }
.booking-b { color: #0b5ea8; font-size: 47px; line-height: 1; }
.airbnb-mark { color: #e55b72; font-size: 42px; line-height: 1; font-family: Arial, sans-serif; font-weight: 400; }
.whatsapp-mark { color: #23bd60; font-size: 52px; line-height: .8; }

.amenities { margin: 38px auto 0; width: min(1050px, calc(100% - 120px)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: repeat(5, 1fr); }
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
.best-rate { text-align: center; margin: 13px 0 0; font-size: 15px; }
.notice { margin: 14px 0 0; padding: 12px 14px; border-radius: 6px; font-size: 14px; text-align: center; }
.notice.ok { background: rgba(47, 125, 78, .10); color: #1e623b; border: 1px solid rgba(47, 125, 78, .18); }
.notice.no { background: rgba(154, 72, 47, .10); color: #8a351e; border: 1px solid rgba(154, 72, 47, .18); }
.guest-form { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.guest-form input { background: rgba(255,255,255,.7); border: 1px solid rgba(180,134,22,.18); border-radius: 6px; padding: 12px; }
.guest-form button { grid-column: 1 / -1; border: 0; border-radius: 5px; background: var(--navy); color: #fff; padding: 13px; font-weight: 800; letter-spacing: .06em; cursor: pointer; }
.calendar-box { border-left: 1px solid rgba(180,134,22,.16); padding: 32px 42px; background: rgba(255,255,255,.32); }
.calendar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.calendar-top strong { letter-spacing: .06em; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px 14px; text-align: center; font-size: 14px; }
.calendar-grid.labels { margin-bottom: 9px; font-size: 11px; color: rgba(7,31,61,.82); }
.calendar-grid .muted { opacity: .38; }

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
  .hero { min-height: 520px; }
  .hero-sea { right: 0; bottom: 42%; }
  .hero-terrace { left: 0; top: 42%; }
  .hero-soft-left { background: linear-gradient(180deg, rgba(251,248,239,.72), rgba(251,248,239,.18), rgba(251,248,239,0)); }
  .hero-content { width: 100%; padding: 20px 24px 210px; }
  .hero h1 { font-size: 34px; max-width: 430px; }
  .legal-line { font-size: 13px; margin-bottom: 26px; }
  .booking-cards { width: calc(100% - 32px); margin-top: -135px; grid-template-columns: 1fr 1fr; gap: 10px; }
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
