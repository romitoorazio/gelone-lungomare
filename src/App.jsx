import React, { useMemo, useState } from "react";

const BRAND = {
  name: "Gelone Lungomare",
  cin: "IT084001B4D36830",
  cir: "190840010022",
  phone1: "3476308456",
  phone2: "3479461999",
  email: "info@gelone.it",
  website: "www.gelone.it",
  address: "Via Pascoli 1, 93012 Gela (CL)",
};

const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.it.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const whatsappUrl = `https://wa.me/39${BRAND.phone1}`;

const gallery = [
  "/images/terrazza-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
  "/images/interni-gelone.jpg",
  "/images/terrazza-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
];

function Icon({ children }) {
  return <span className="gelone-icon" aria-hidden="true">{children}</span>;
}

function Field({ label, type = "text", value, onChange, children }) {
  return (
    <label className="gelone-field">
      <span>{label}</span>
      {children || (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function MonthCalendar() {
  const days = [
    [26, 27, 28, 29, 30, 31, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 1, 2, 3, 4, 5, 6],
  ];
  const labels = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

  return (
    <div className="calendar-card">
      <div className="calendar-head"><span>‹</span><strong>GIUGNO 2025</strong><span>›</span></div>
      <div className="calendar-grid calendar-labels">
        {labels.map((d) => <span key={d}>{d}</span>)}
      </div>
      {days.map((row, i) => (
        <div className="calendar-grid" key={i}>
          {row.map((d, j) => (
            <span className={(i === 0 && j < 6) || (i === 5 && j > 0) ? "muted" : ""} key={`${i}-${j}`}>{d}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [message, setMessage] = useState(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);

  const whatsappText = useMemo(() => {
    const text = `Ciao, vorrei informazioni per Gelone Lungomare${checkIn && checkOut ? ` dal ${checkIn} al ${checkOut}` : ""}.`;
    return `https://wa.me/39${BRAND.phone1}?text=${encodeURIComponent(text)}`;
  }, [checkIn, checkOut]);

  async function checkAvailability(e) {
    e?.preventDefault?.();
    setMessage(null);
    setAvailable(false);

    if (!checkIn || !checkOut) {
      setMessage({ type: "error", text: "Seleziona check-in e check-out." });
      return;
    }

    try {
      setChecking(true);
      const res = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guests: Number(guests || 2) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore durante la verifica disponibilità.");

      if (data.available) {
        setAvailable(true);
        setMessage({ type: "success", text: "Date disponibili. Puoi inviare la richiesta diretta." });
      } else {
        setMessage({ type: "error", text: "Date non disponibili. Prova un altro periodo o contattaci su WhatsApp." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Verifica non riuscita." });
    } finally {
      setChecking(false);
    }
  }

  async function sendRequest(e) {
    e.preventDefault();
    setMessage(null);

    if (!guestName || !guestPhone || !checkIn || !checkOut) {
      setMessage({ type: "error", text: "Inserisci nome, telefono, check-in e check-out." });
      return;
    }

    try {
      setChecking(true);
      const res = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestPhone,
          guestEmail: "",
          checkIn,
          checkOut,
          guests: Number(guests || 2),
          notes: "Richiesta inviata dal sito Gelone Lungomare",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore invio richiesta.");
      setMessage({ type: "success", text: "Richiesta inviata. Ti ricontatteremo per confermare la prenotazione." });
      setAvailable(false);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Invio non riuscito." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="gelone-page">
      <style>{styles}</style>

      <header className="topbar">
        <div className="top-inner">
          <a className="brand" href="#home" aria-label="Gelone Lungomare home">
            <img src="/images/logo-gelone-header-senza-qrcode.png" alt="Gelone Lungomare" />
          </a>
          <nav className="nav">
            <a className="active" href="#home">Home</a>
            <a href="#alloggio">Alloggio</a>
            <a href="#foto">Foto</a>
            <a href="#prenota">Disponibilità</a>
            <a href="#contatti">Contatti</a>
          </nav>
          <a className="header-cta" href="#prenota">Prenota diretto <span>▣</span></a>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-bg hero-sea" />
        <div className="hero-bg hero-terrace" />
        <div className="hero-mist" />

        <div className="hero-content">
          <div className="legal-line">CIN: {BRAND.cin}<span />CIR: {BRAND.cir}</div>
          <div className="hero-copy">
            <h1>Vista mare, terrazza e comfort a due passi dal lungomare di Gela</h1>
            <div className="ornament" />
            <p>Appartamento accogliente e riservato con ampia terrazza vista mare, ideale per coppie e soggiorni di relax in Sicilia.</p>
          </div>
        </div>

        <div className="booking-row">
          <a href="#prenota" className="booking-card direct">
            <img src="/images/logo-gelone-emblema-senza-qrcode.png" alt="" />
            <span><strong>PRENOTA DAL SITO</strong><b>MIGLIOR TARIFFA</b><small>Risparmia prenotando diretto</small></span>
          </a>
          <a href={bookingUrl} target="_blank" rel="noreferrer" className="booking-card portal booking"><strong>B.</strong><span>Booking.com</span></a>
          <a href={airbnbUrl} target="_blank" rel="noreferrer" className="booking-card portal airbnb"><strong>⌂</strong><span>Airbnb</span></a>
          <a href={whatsappText || whatsappUrl} target="_blank" rel="noreferrer" className="booking-card portal whatsapp"><strong>●</strong><span>WhatsApp</span></a>
        </div>
      </section>

      <section className="amenities" id="alloggio">
        <div><Icon>♙</Icon><strong>2 OSPITI</strong></div>
        <div><Icon>▱</Icon><strong>1 CAMERA</strong></div>
        <div><Icon>♨</Icon><strong>1 BAGNO</strong></div>
        <div><Icon>◴</Icon><strong>CUCINA</strong></div>
        <div><Icon>≋</Icon><strong>TERRAZZA VISTA MARE</strong></div>
      </section>

      <section className="why section-pad">
        <h2>PERCHÉ SCEGLIERE GELONE LUNGOMARE</h2>
        <div className="title-mark" />
        <div className="why-grid">
          <article><Icon>●</Icon><h3>POSIZIONE VICINO AL MARE</h3><p>A pochi passi dal lungomare di Gela, per passeggiate e momenti indimenticabili.</p></article>
          <article><Icon>☂</Icon><h3>TERRAZZA PRIVATA</h3><p>Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax.</p></article>
          <article><Icon>◆</Icon><h3>CHECK-IN SEMPLICE</h3><p>Accesso comodo e supporto dedicato per un soggiorno senza pensieri.</p></article>
          <article><Icon>♥</Icon><h3>PER COPPIE E VIAGGIATORI</h3><p>Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere.</p></article>
        </div>
      </section>

      <section className="gallery section-pad" id="foto">
        <h2>GALLERIA</h2>
        <div className="title-mark" />
        <div className="gallery-grid">
          {gallery.map((src, index) => <img src={src} alt={`Foto Gelone Lungomare ${index + 1}`} key={`${src}-${index}`} />)}
        </div>
        <a className="photo-button" href="#foto">VEDI TUTTE LE FOTO <span>▧</span></a>
      </section>

      <section className="booking-section section-pad" id="prenota">
        <div className="booking-panel">
          <div className="form-side">
            <h2>DISPONIBILITÀ E PRENOTAZIONE</h2>
            <form onSubmit={available ? sendRequest : checkAvailability}>
              <div className="fields-row">
                <Field label="Check-in" type="date" value={checkIn} onChange={setCheckIn} />
                <Field label="Check-out" type="date" value={checkOut} onChange={setCheckOut} />
                <Field label="Ospiti">
                  <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                    <option value="1">1 ospite</option>
                    <option value="2">2 ospiti</option>
                  </select>
                </Field>
              </div>

              {available && (
                <div className="fields-row guest-row">
                  <Field label="Nome" value={guestName} onChange={setGuestName} />
                  <Field label="Telefono" value={guestPhone} onChange={setGuestPhone} />
                </div>
              )}

              <button className="gold-wide" disabled={checking} type="submit">
                {checking ? "ATTENDI..." : available ? "INVIA RICHIESTA" : "VERIFICA DISPONIBILITÀ"} <span>▣</span>
              </button>
              {message && <p className={`notice ${message.type}`}>{message.text}</p>}
            </form>
          </div>
          <MonthCalendar />
        </div>
      </section>

      <section className="location section-pad">
        <h2>COME ARRIVARE / POSIZIONE</h2>
        <div className="title-mark" />
        <div className="location-card">
          <div className="location-text">
            <p><span>●</span>{BRAND.address}</p>
            <ul>
              <li>Lungomare Federico II – 2 min a piedi</li>
              <li>Spiaggia di Gela – 5 min a piedi</li>
              <li>Centro Storico – 8 min in auto</li>
              <li>Stazione di Gela – 7 min in auto</li>
            </ul>
          </div>
          <div className="map-box">
            <div className="map-pin">●</div>
            <div className="map-label"><strong>Gelone Lungomare</strong><span>Via Pascoli 1, Gela (CL)</span></div>
          </div>
        </div>
      </section>

      <footer className="footer" id="contatti">
        <div className="footer-inner">
          <div className="footer-logo">
            <img src="/images/logo-gelone-header-senza-qrcode.png" alt="Gelone Lungomare" />
            <p>CIN: {BRAND.cin} <span>|</span> CIR: {BRAND.cir}</p>
          </div>
          <div className="contacts">
            <h3>CONTATTI</h3>
            <a href={`tel:+39${BRAND.phone1}`}>☎ {BRAND.phone1}</a>
            <a href={`tel:+39${BRAND.phone2}`}>☎ {BRAND.phone2}</a>
            <a href={`mailto:${BRAND.email}`}>✉ {BRAND.email}</a>
            <a href="https://www.gelone.it">◎ {BRAND.website}</a>
          </div>
          <div className="socials">
            <h3>SEGUICI</h3>
            <span>f</span><span>◎</span><span>☏</span>
          </div>
        </div>
        <div className="copy">© 2025 Gelone Lungomare – Locazione Turistica. Tutti i diritti riservati.</div>
      </footer>
    </main>
  );
}

const styles = `
:root{
  --navy:#071b36;
  --navy2:#0b274a;
  --gold:#b98507;
  --gold2:#d5ae55;
  --cream:#fbf7ef;
  --line:#e4d7be;
  --text:#10233d;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:#f4efe5;color:var(--text);font-family:"Georgia", "Times New Roman", serif}
a{text-decoration:none;color:inherit}
.gelone-page{max-width:1360px;margin:0 auto;background:var(--cream);box-shadow:0 0 45px rgba(24,20,13,.08);overflow:hidden}
.topbar{height:116px;background:rgba(255,252,246,.95);border-bottom:1px solid var(--line);position:relative;z-index:3}
.top-inner{height:100%;width:100%;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:260px 1fr 240px;align-items:center;gap:22px;padding:0 28px}
.brand img{width:225px;display:block}
.nav{display:flex;justify-content:center;gap:42px;font:600 18px/1.1 Georgia,serif;color:var(--navy)}
.nav a{padding:38px 0 14px;position:relative}.nav a.active:after{content:"";position:absolute;left:50%;bottom:0;width:48px;height:2px;background:var(--gold);transform:translateX(-50%)}
.header-cta{justify-self:end;background:linear-gradient(180deg,#bd8a12,#a77505);color:white;border-radius:5px;padding:18px 27px;font:700 20px/1 Georgia,serif;letter-spacing:.4px;box-shadow:0 7px 18px rgba(115,77,0,.18)}.header-cta span{margin-left:8px;font-size:18px}
.hero{height:480px;position:relative;isolation:isolate;background:#ddd;overflow:visible}
.hero-bg{position:absolute;top:0;bottom:0;background-size:cover;background-position:center;z-index:0}
.hero-sea{left:0;width:58%;background-image:url('/images/vista-mare-gelone.jpg');background-position:center center}
.hero-terrace{right:0;width:58%;background-image:url('/images/terrazza-gelone.jpg');background-position:center center;clip-path:polygon(16% 0,100% 0,100% 100%,0 100%)}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(250,247,239,.34) 0%,rgba(250,247,239,.24) 29%,rgba(250,247,239,.03) 49%,rgba(0,0,0,.06) 100%);z-index:1;pointer-events:none}.hero-mist{position:absolute;inset:auto 0 0;height:170px;background:linear-gradient(0deg,var(--cream) 0%,rgba(251,247,239,.78) 39%,rgba(251,247,239,0) 100%);z-index:2;pointer-events:none}
.hero-content{position:relative;z-index:3;max-width:1180px;margin:0 auto;padding:24px 28px 0}.legal-line{font:700 17px/1.2 Georgia,serif;letter-spacing:1.4px;color:#061832;margin:0 0 56px}.legal-line span{display:inline-block;width:1px;height:18px;background:var(--gold2);margin:0 24px -3px}.hero-copy{width:min(480px,43vw);padding:0 0 0 0;background:linear-gradient(90deg,rgba(251,247,239,.42),rgba(251,247,239,.08));border-radius:0 36px 36px 0}.hero h1{margin:0;color:var(--navy);font:500 clamp(34px,3vw,51px)/1.16 Georgia,serif;letter-spacing:1.6px;text-shadow:0 1px 0 rgba(255,255,255,.45)}.ornament{width:260px;height:18px;margin:28px 0 22px;position:relative;border-top:1px solid var(--gold2)}.ornament:after{content:"";position:absolute;left:50%;top:-5px;width:10px;height:10px;background:var(--gold);transform:translateX(-50%) rotate(45deg)}.hero p{max-width:440px;margin:0;color:#0b1f3a;font:500 19px/1.62 Georgia,serif;text-shadow:0 1px 0 rgba(255,255,255,.42)}
.booking-row{position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);z-index:5;width:min(1090px,88%);display:grid;grid-template-columns:1.15fr .95fr .95fr .95fr;gap:18px}.booking-card{height:94px;border-radius:7px;box-shadow:0 12px 24px rgba(23,20,14,.16);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.94);border:1px solid rgba(196,174,137,.72);transition:.2s ease}.booking-card:hover{transform:translateY(-2px)}.direct{justify-content:flex-start;padding:13px 20px;background:#061b35;color:#fff;border:2px solid #c39322;gap:16px}.direct img{width:58px;height:58px;object-fit:contain;opacity:.95}.direct span{display:flex;flex-direction:column;gap:4px}.direct strong{font-size:21px;letter-spacing:.8px}.direct b{color:#d2a72a;font-size:18px;letter-spacing:2.7px}.direct small{font-size:15px}.portal{gap:18px;font:700 23px/1 Georgia,serif;color:var(--navy)}.portal strong{font:800 44px/1 Arial,sans-serif}.portal.booking strong{color:#084a8f}.portal.airbnb strong{color:#e84f69;font-size:42px}.portal.whatsapp strong{color:#20bf63;font-size:54px;line-height:.4}.portal.whatsapp span{font-size:24px}
.amenities{max-width:1080px;margin:58px auto 0;padding:28px 10px 25px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;text-align:center}.amenities div{min-height:56px;display:flex;align-items:center;justify-content:center;gap:18px;border-right:1px solid var(--line)}.amenities div:last-child{border-right:0}.gelone-icon{color:var(--gold);font-size:32px;line-height:1}.amenities strong{font:800 17px/1.25 Georgia,serif;letter-spacing:1.2px;color:var(--navy)}
.section-pad{padding:24px 58px}.section-pad h2{margin:0;text-align:center;color:var(--navy);font:700 29px/1.15 Georgia,serif;letter-spacing:2.2px}.title-mark{width:170px;height:15px;border-top:1px solid var(--gold2);margin:13px auto 20px;position:relative}.title-mark:after{content:"";position:absolute;top:-6px;left:50%;width:11px;height:11px;background:var(--gold);transform:translateX(-50%) rotate(45deg)}.why-grid{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:26px}.why-grid article{min-height:190px;border:1px solid #eadcc4;border-radius:7px;background:rgba(255,255,255,.43);text-align:center;padding:26px 28px 22px;box-shadow:0 10px 25px rgba(29,24,14,.03)}.why-grid .gelone-icon{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#f6efe2;border:1px solid #eee0c7;margin-bottom:14px;font-size:25px}.why-grid h3{margin:0 0 10px;font:800 17px/1.17 Georgia,serif;letter-spacing:.9px;color:var(--navy)}.why-grid p{margin:0;font:16px/1.42 Georgia,serif;color:#162740}.gallery{padding-top:0}.gallery-grid{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.gallery-grid img{width:100%;height:126px;object-fit:cover;border-radius:5px;box-shadow:0 5px 14px rgba(13,29,52,.12)}.photo-button{display:flex;align-items:center;justify-content:center;gap:12px;width:258px;height:38px;margin:14px auto 0;background:var(--navy);color:#fff;border-radius:4px;font:700 16px/1 Georgia,serif;letter-spacing:1.1px}
.booking-section{padding-top:0}.booking-panel{max-width:1060px;margin:0 auto;border:1px solid #eadcc4;border-radius:8px;background:rgba(255,255,255,.34);display:grid;grid-template-columns:1.25fr .95fr;overflow:hidden}.form-side{padding:24px 36px}.form-side h2{text-align:center;font-size:25px;margin-bottom:20px}.fields-row{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.guest-row{grid-template-columns:1fr 1fr;margin-top:14px}.gelone-field{display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,.64);border:1px solid #e4d7be;border-radius:6px;padding:13px 14px}.gelone-field span{font:700 14px/1 Georgia,serif;color:var(--navy)}.gelone-field input,.gelone-field select{border:0;background:transparent;color:#203451;font:500 15px/1.2 Georgia,serif;outline:none;min-height:24px}.gold-wide{width:100%;margin-top:18px;height:50px;border:0;border-radius:5px;background:linear-gradient(180deg,#bf8b12,#a77505);color:#fff;font:800 18px/1 Georgia,serif;letter-spacing:1px;cursor:pointer}.notice{margin:14px 0 0;font:600 15px/1.35 Georgia,serif}.notice.success{color:#0c6f39}.notice.error{color:#9b1c1c}.calendar-card{padding:22px 46px;border-left:1px solid #eadcc4;background:rgba(255,255,255,.25)}.calendar-head{display:flex;justify-content:space-between;align-items:center;color:var(--navy);font:700 16px Georgia,serif;margin-bottom:16px}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:10px;margin-bottom:10px;font:600 15px Georgia,serif;color:var(--navy)}.calendar-labels{font-size:11px;letter-spacing:1px}.calendar-grid .muted{color:#aaa}
.location{padding-top:0}.location-card{max-width:1060px;margin:0 auto;border:1px solid #eadcc4;border-radius:8px;background:rgba(255,255,255,.35);display:grid;grid-template-columns:.8fr 1.2fr;gap:18px;padding:20px 26px}.location-text p{margin:0 0 16px;font:600 17px Georgia,serif;color:var(--navy)}.location-text p span{color:var(--gold);margin-right:16px}.location-text ul{margin:0;padding-left:42px;color:#11243f;font:16px/1.7 Georgia,serif}.location-text li::marker{color:var(--gold)}.map-box{min-height:150px;border-radius:5px;overflow:hidden;position:relative;background:linear-gradient(135deg,#f5efe3 0 26%,#dad6ca 26% 28%,#faf9f4 28% 47%,#e1ddcf 47% 49%,#f8f6f0 49% 66%,#bde3ee 66% 100%);border:1px solid #ddd0b9}.map-box:before{content:"";position:absolute;inset:0;background:linear-gradient(30deg,transparent 49%,rgba(205,176,93,.55) 50%,transparent 51%),linear-gradient(120deg,transparent 51%,rgba(150,160,155,.35) 52%,transparent 53%);background-size:180px 140px,220px 170px}.map-pin{position:absolute;left:36%;top:28%;font-size:42px;color:#d63d2f;text-shadow:0 4px 9px rgba(0,0,0,.16)}.map-label{position:absolute;right:0;top:0;bottom:0;width:38%;background:rgba(255,255,255,.86);display:flex;flex-direction:column;justify-content:center;padding:28px;color:var(--navy)}.map-label strong{font:800 22px Georgia,serif}.map-label span{font:600 16px Georgia,serif;margin-top:8px}
.footer{background:#fffaf1;border-top:1px solid var(--line);margin-top:8px}.footer-inner{max-width:1080px;margin:0 auto;padding:30px 28px;display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:48px;align-items:center}.footer-logo img{width:220px}.footer-logo p{font:700 14px Georgia,serif;letter-spacing:.8px;color:var(--navy)}.contacts h3,.socials h3{font:800 18px Georgia,serif;color:var(--navy);margin:0 0 12px}.contacts a{display:block;color:var(--navy);font:600 15px/1.75 Georgia,serif}.socials span{display:inline-grid;place-items:center;width:42px;height:42px;margin-right:12px;border-radius:50%;background:var(--navy);color:#fff;font:700 21px Arial}.copy{background:var(--navy);color:#fff;text-align:center;padding:13px;font:500 14px Georgia,serif}
@media (max-width:900px){.gelone-page{max-width:none}.topbar{height:auto}.top-inner{grid-template-columns:1fr;gap:12px;padding:18px}.brand img{width:210px;margin:auto}.nav{gap:18px;flex-wrap:wrap;font-size:16px}.header-cta{justify-self:center}.hero{height:auto;padding-bottom:40px}.hero-sea,.hero-terrace{width:100%;clip-path:none;opacity:.72}.hero-terrace{top:44%;height:56%;bottom:0}.hero-content{padding:24px 22px 140px}.legal-line{font-size:12px;margin-bottom:32px}.hero-copy{width:100%;background:rgba(251,247,239,.25)}.hero h1{font-size:34px}.hero p{font-size:16px}.booking-row{position:relative;left:auto;bottom:auto;transform:none;width:auto;margin:-120px 18px 0;grid-template-columns:1fr}.amenities{margin-top:28px;grid-template-columns:1fr 1fr;padding:20px}.amenities div{border-right:0;border-bottom:1px solid var(--line);padding:12px}.section-pad{padding:24px 18px}.why-grid,.gallery-grid,.booking-panel,.location-card,.footer-inner{grid-template-columns:1fr}.calendar-card{border-left:0;border-top:1px solid #eadcc4}.fields-row,.guest-row{grid-template-columns:1fr}.gallery-grid img{height:170px}.map-label{position:absolute;width:50%}}
`;
