import React, { useState } from "react";
import {
  Bath,
  BedDouble,
  CalendarCheck,
  Camera,
  ExternalLink,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  SearchCheck,
  Send,
  ShieldCheck,
  Utensils,
  Waves,
} from "lucide-react";

const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.it.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const mapsUrl = "https://maps.app.goo.gl/JwYWW3RqFz5VdtCu6";

const whatsappUrl =
  "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const directWhatsappUrl =
  "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20prenotare%20direttamente%20Gelone%20Lungomare%20dal%20sito%20ufficiale";

const gallery = [
  "/images/vista-mare-gelone.jpg",
  "/images/terrazza-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
  "/images/interni-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
];

const featureCards = [
  {
    icon: "⌖",
    title: "POSIZIONE\nVICINO AL MARE",
    text: "A pochi passi dal lungomare di Gela, per passeggiate e tramonti indimenticabili.",
  },
  {
    icon: "☂",
    title: "TERRAZZA\nPRIVATA",
    text: "Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax.",
  },
  {
    icon: "●",
    title: "CHECK-IN\nSEMPLICE",
    text: "Accesso comodo e supporto dedicato per un soggiorno senza pensieri.",
  },
  {
    icon: "♥",
    title: "PER COPPIE E\nVIAGGIATORI",
    text: "Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere.",
  },
];

function GreekCorner({ position }) {
  const positions = {
    tl: "left-3 top-3",
    tr: "right-3 top-3 rotate-90",
    bl: "bottom-3 left-3 -rotate-90",
    br: "bottom-3 right-3 rotate-180",
  };

  return (
    <div className={`pointer-events-none absolute h-8 w-8 text-[#b88a2b] ${positions[position]}`}>
      <div className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-[#b88a2b]" />
      <div className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-[#b88a2b]" />
    </div>
  );
}

function LogoBlock({ footer = false }) {
  return (
    <div className={footer ? "flex flex-col" : "flex items-start gap-4"}>
      <div className={footer ? "mb-2" : "flex items-center gap-4"}>
        {!footer && (
          <div className="relative flex h-20 w-24 shrink-0 items-center justify-center">
            <div className="absolute inset-x-1 bottom-2 h-3 rounded-full bg-[#0a1d35]/10" />
            <div className="relative flex h-16 w-20 items-center justify-center rounded-full border border-[#d9c18a] bg-[#fffaf0] text-4xl shadow-sm">
              ⛵
            </div>
          </div>
        )}
        <div>
          <div className={footer ? "font-serif text-xl tracking-[0.18em] text-[#0a1d35]" : "font-serif text-5xl leading-none tracking-[0.28em] text-[#0a1d35]"}>
            GELONE
          </div>
          <div className={footer ? "mt-1 text-[10px] font-bold uppercase tracking-[0.42em] text-[#0a1d35]" : "mt-2 text-lg font-semibold tracking-[0.55em] text-[#0a1d35]"}>
            LUNGOMARE
          </div>
          <div className={footer ? "mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#0a1d35]" : "mt-2 text-xs font-semibold uppercase tracking-[0.42em] text-[#0a1d35]"}>
            LOCAZIONE TURISTICA
          </div>
        </div>
      </div>
    </div>
  );
}

async function readJsonResponse(response) {
  const responseText = await response.text();

  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      "Errore tecnico del server. Riprova più tardi oppure contattaci su WhatsApp."
    );
  }
}

function AvailabilityForm() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guests, setGuests] = useState("2");
  const [notes, setNotes] = useState("");

  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  function validateDates() {
    if (!checkIn || !checkOut) return "Inserisci data di arrivo e data di partenza.";
    if (checkOut <= checkIn) return "La data di partenza deve essere successiva alla data di arrivo.";
    return "";
  }

  async function handleCheckAvailability(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setBookingResult(null);

    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      return;
    }

    try {
      setChecking(true);
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut }),
      });

      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data?.message || "Non è stato possibile verificare la disponibilità.");
      setResult(data);
    } catch (err) {
      setError(err?.message || "Errore durante il controllo disponibilità. Puoi contattarci su WhatsApp.");
    } finally {
      setChecking(false);
    }
  }

  async function handleCreateBooking() {
    setError("");
    setBookingResult(null);

    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      return;
    }

    if (!guestName.trim()) {
      setError("Inserisci nome e cognome.");
      return;
    }

    if (!guestPhone.trim() && !guestEmail.trim()) {
      setError("Inserisci almeno telefono o email.");
      return;
    }

    try {
      setBooking(true);
      const response = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestPhone,
          guestEmail,
          guests: Number(guests),
          checkIn,
          checkOut,
          notes,
        }),
      });

      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data?.message || "Non è stato possibile bloccare le date.");

      setBookingResult(data);
      setResult({
        ok: true,
        available: false,
        message: "Le date sono state bloccate nel sistema Gelone Lungomare in attesa di conferma.",
      });
    } catch (err) {
      setError(err?.message || "Errore durante il blocco date. Puoi contattarci su WhatsApp.");
    } finally {
      setBooking(false);
    }
  }

  const whatsappWithDates = `https://wa.me/393476308456?text=${encodeURIComponent(
    `Ciao, vorrei prenotare direttamente Gelone Lungomare. Date richieste: ${checkIn || "arrivo"} - ${checkOut || "partenza"}`
  )}`;

  const canShowBookingForm = result?.available === true && !bookingResult;

  return (
    <form onSubmit={handleCheckAvailability}>
      <div className="grid gap-5 md:grid-cols-[1fr_1fr_0.8fr]">
        <label className="rounded-xl border border-[#e2d2b4] bg-white p-4">
          <span className="block text-sm font-semibold text-[#0a1d35]">Check-in</span>
          <div className="mt-2 flex items-center gap-2 text-sm text-[#0a1d35]">
            <CalendarCheck size={17} className="text-[#b88a2b]" />
            <input
              type="date"
              min={today}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </label>

        <label className="rounded-xl border border-[#e2d2b4] bg-white p-4">
          <span className="block text-sm font-semibold text-[#0a1d35]">Check-out</span>
          <div className="mt-2 flex items-center gap-2 text-sm text-[#0a1d35]">
            <CalendarCheck size={17} className="text-[#b88a2b]" />
            <input
              type="date"
              min={checkIn || today}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </label>

        <label className="rounded-xl border border-[#e2d2b4] bg-white p-4">
          <span className="block text-sm font-semibold text-[#0a1d35]">Ospiti</span>
          <select
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="mt-2 w-full bg-transparent text-sm outline-none"
          >
            <option value="1">1 ospite</option>
            <option value="2">2 ospiti</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={checking || booking}
        className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-lg bg-[#b8860b] px-6 py-4 text-lg font-extrabold uppercase tracking-[0.08em] text-white shadow-md transition hover:bg-[#9b7109] disabled:opacity-60"
      >
        {checking ? "Controllo in corso..." : "Verifica disponibilità"}
        <CalendarCheck size={19} />
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#0a1d35]">
        <ShieldCheck size={18} /> Miglior tariffa garantita prenotando dal sito
      </p>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

      {result && (
        <div
          className={`mt-5 rounded-xl border p-5 ${
            result.available === true
              ? "border-green-200 bg-green-50 text-green-900"
              : result.available === false
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-[#d7c49f] bg-[#fffaf0] text-[#0a1d35]"
          }`}
        >
          <p className="font-bold">
            {result.available === true
              ? "Gelone Lungomare risulta disponibile."
              : result.available === false
              ? "Gelone Lungomare non risulta disponibile."
              : "Risultato disponibilità"}
          </p>
          <p className="mt-2 leading-7">{result.message || "La verifica è stata completata."}</p>
        </div>
      )}

      {canShowBookingForm && (
        <div className="mt-6 rounded-2xl border border-[#e2d2b4] bg-[#fffaf0] p-5">
          <h3 className="text-xl font-bold text-[#0a1d35]">Blocca le date dal sito ufficiale</h3>
          <p className="mt-2 text-sm leading-6 text-[#555]">
            Compila i dati. Le date verranno bloccate nel sistema interno in attesa della conferma finale.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Nome e cognome</span>
              <input
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Es. Mario Rossi"
                className="w-full rounded-xl border border-[#d7c49f] bg-white px-4 py-4 outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Telefono / WhatsApp</span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="Es. 347..."
                className="w-full rounded-xl border border-[#d7c49f] bg-white px-4 py-4 outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Email</span>
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-[#d7c49f] bg-white px-4 py-4 outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Note</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Scrivi eventuali richieste o orario indicativo di arrivo."
                className="w-full rounded-xl border border-[#d7c49f] bg-white px-4 py-4 outline-none focus:border-[#9b6b25]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={booking}
              onClick={handleCreateBooking}
              className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-extrabold text-white disabled:opacity-60"
            >
              {booking ? "Blocco date in corso..." : "Blocca date e invia richiesta"}
              <Send size={19} />
            </button>

            <a
              href={whatsappWithDates}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white px-7 py-4 font-bold text-[#0a1d35]"
            >
              WhatsApp <MessageCircle size={19} />
            </a>
          </div>
        </div>
      )}

      {bookingResult && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
          <p className="text-lg font-bold">Richiesta inviata correttamente.</p>
          <p className="mt-2 leading-7">Le date sono state bloccate nel sistema Gelone Lungomare in attesa della conferma finale.</p>
          <p className="mt-2 text-sm">Codice richiesta: <strong>{bookingResult.bookingId}</strong></p>
        </div>
      )}
    </form>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="mb-7 text-center">
      <h2 className="font-serif text-3xl font-bold uppercase tracking-[0.1em] text-[#0a1d35] md:text-4xl">
        {children}
      </h2>
      <div className="mx-auto mt-3 flex w-24 items-center justify-center">
        <div className="h-px flex-1 bg-[#d8b66c]" />
        <div className="mx-2 h-2 w-2 rotate-45 bg-[#b88a2b]" />
        <div className="h-px flex-1 bg-[#d8b66c]" />
      </div>
    </div>
  );
}

function StaticCalendar() {
  const rows = [
    [26, 27, 28, 29, 30, 31, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 1, 2, 3, 4, 5, 6],
  ];

  return (
    <div className="rounded-xl border border-[#e2d2b4] bg-white p-7 text-[#0a1d35]">
      <div className="mb-5 flex items-center justify-between font-serif text-lg font-bold uppercase tracking-[0.08em]">
        <span>‹</span>
        <span>Giugno 2025</span>
        <span>›</span>
      </div>
      <div className="grid grid-cols-7 gap-y-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-[#0a1d35]">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-7 gap-y-4 text-center text-sm text-[#0a1d35]">
        {rows.flat().map((day, index) => (
          <span key={`${day}-${index}`} className={index < 6 || index > 35 ? "opacity-55" : "font-semibold"}>
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffaf0] text-[#0a1d35]">
      <GreekCorner position="tl" />
      <GreekCorner position="tr" />

      <header className="relative z-30 mx-auto flex max-w-[1260px] items-start justify-between gap-8 px-10 pt-6">
        <div>
          <LogoBlock />
          <p className="mt-4 text-sm font-semibold tracking-[0.06em] text-[#0a1d35]">
            CIN: IT084001B4D36830 <span className="mx-4 text-[#b88a2b]">|</span> CIR: 190840010022
          </p>
        </div>

        <div className="flex flex-1 items-center justify-end gap-10 pt-6">
          <nav className="hidden items-center gap-10 font-serif text-lg font-semibold text-[#0a1d35] lg:flex">
            <a href="#home" className="relative pb-2">
              Home
              <span className="absolute bottom-0 left-1/2 h-px w-10 -translate-x-1/2 bg-[#b88a2b]" />
            </a>
            <a href="#alloggio">Alloggio</a>
            <a href="#foto">Foto</a>
            <a href="#disponibilita">Disponibilità</a>
            <a href="#contatti">Contatti</a>
          </nav>

          <a
            href="#disponibilita"
            className="inline-flex items-center gap-2 rounded-md bg-[#b8860b] px-6 py-4 font-serif text-lg font-bold text-white shadow-sm"
          >
            Prenota diretto <CalendarCheck size={18} />
          </a>
        </div>
      </header>

      <section id="home" className="relative -mt-20 min-h-[650px] overflow-hidden pt-44">
        <div className="absolute inset-0">
          <img
            src="/images/vista-mare-gelone.jpg"
            alt="Vista mare Gelone Lungomare"
            className="h-full w-full object-cover"
          />
          <img
            src="/images/terrazza-gelone.jpg"
            alt="Terrazza Gelone Lungomare"
            className="absolute bottom-0 right-0 h-full w-[56%] object-cover opacity-95 [mask-image:linear-gradient(to_right,transparent,black_22%,black)]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf0]/96 via-[#fffaf0]/60 to-[#fffaf0]/10" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#fffaf0] to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1260px] px-10 pb-16">
          <div className="max-w-[570px] pt-6">
            <h1 className="font-serif text-[44px] font-bold leading-[1.2] tracking-[0.03em] text-[#0a1d35] md:text-[58px]">
              Vista mare, terrazza e comfort a due passi dal lungomare di Gela
            </h1>
            <div className="my-6 flex w-52 items-center">
              <div className="h-px flex-1 bg-[#d8b66c]" />
              <div className="mx-3 h-2 w-2 rotate-45 bg-[#b88a2b]" />
              <div className="h-px flex-1 bg-[#d8b66c]" />
            </div>
            <p className="max-w-[500px] font-serif text-xl leading-8 text-[#0a1d35]">
              Appartamento accogliente e riservato con ampia terrazza vista mare,
              ideale per coppie e soggiorni di relax in Sicilia.
            </p>
          </div>

          <div className="relative z-20 mt-24 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <a
              href="#disponibilita"
              className="flex min-h-[105px] items-center gap-5 rounded-xl border-2 border-[#d8b66c] bg-[#061d3d] px-7 py-5 text-white shadow-2xl"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-[#d8b66c] text-[#d8b66c]">
                <CalendarCheck size={32} />
              </div>
              <div>
                <p className="font-serif text-2xl font-bold uppercase tracking-[0.06em]">Prenota dal sito</p>
                <p className="text-lg font-bold uppercase text-[#d8b66c]">Miglior tariffa</p>
                <p className="font-serif text-base">Risparmia prenotando diretto</p>
              </div>
            </a>

            <a href={bookingUrl} target="_blank" rel="noreferrer" className="flex min-h-[105px] items-center justify-center gap-4 rounded-xl border border-[#d2c3a8] bg-white/95 px-6 py-5 shadow-lg">
              <span className="text-5xl font-black text-[#004bb8]">B.</span>
              <span className="font-serif text-xl font-bold uppercase tracking-[0.08em]">Booking.com</span>
            </a>

            <a href={airbnbUrl} target="_blank" rel="noreferrer" className="flex min-h-[105px] items-center justify-center gap-4 rounded-xl border border-[#d2c3a8] bg-white/95 px-6 py-5 shadow-lg">
              <span className="text-5xl font-light text-[#ff385c]">⌂</span>
              <span className="font-serif text-xl font-bold uppercase tracking-[0.08em]">Airbnb</span>
            </a>

            <a href={directWhatsappUrl} target="_blank" rel="noreferrer" className="flex min-h-[105px] items-center justify-center gap-4 rounded-xl border border-[#d2c3a8] bg-white/95 px-6 py-5 shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#36b85a] text-white"><MessageCircle size={28} /></span>
              <span className="font-serif text-xl font-bold uppercase tracking-[0.08em]">WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1260px] px-10">
        <div className="grid grid-cols-2 border-b border-t border-[#e2d2b4] bg-[#fffaf0] md:grid-cols-5">
          {[
            { icon: Home, label: "2 Ospiti" },
            { icon: BedDouble, label: "1 Camera" },
            { icon: Bath, label: "1 Bagno" },
            { icon: Utensils, label: "Cucina" },
            { icon: Waves, label: "Terrazza\nVista Mare" },
          ].map((item, index) => (
            <div key={item.label} className={`flex items-center justify-center gap-4 px-6 py-8 ${index ? "border-l border-[#e2d2b4]" : ""}`}>
              <item.icon size={34} className="text-[#b88a2b]" />
              <span className="whitespace-pre-line font-serif text-lg font-bold uppercase tracking-[0.08em] text-[#0a1d35]">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="alloggio" className="mx-auto max-w-[1260px] px-10 py-14">
        <SectionTitle>Perché scegliere Gelone Lungomare</SectionTitle>

        <div className="grid gap-7 md:grid-cols-4">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-lg border border-[#e2d2b4] bg-white/75 px-8 py-8 text-center shadow-sm">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#e7dac0] bg-[#fffaf0] text-4xl text-[#b88a2b] shadow-inner">
                {card.icon}
              </div>
              <h3 className="mt-5 whitespace-pre-line font-serif text-xl font-bold uppercase leading-6 tracking-[0.06em] text-[#0a1d35]">
                {card.title}
              </h3>
              <p className="mt-4 font-serif text-base leading-7 text-[#0a1d35]">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="foto" className="mx-auto max-w-[1260px] px-10 pb-12">
        <SectionTitle>Galleria</SectionTitle>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {gallery.map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image}
              alt={`Foto Gelone Lungomare ${index + 1}`}
              className="h-36 w-full rounded-md border border-[#e2d2b4] object-cover shadow-sm md:h-40"
            />
          ))}
        </div>

        <div className="mt-4 text-center">
          <a href="#foto" className="inline-flex items-center gap-3 rounded-md bg-[#061d3d] px-10 py-3 font-serif font-bold uppercase tracking-[0.08em] text-white">
            Vedi tutte le foto <Camera size={18} />
          </a>
        </div>
      </section>

      <section id="disponibilita" className="mx-auto max-w-[1260px] px-10 pb-5">
        <div className="grid gap-6 rounded-lg border border-[#e2d2b4] bg-white/55 p-6 md:grid-cols-[1.25fr_1fr]">
          <div>
            <SectionTitle>Disponibilità e prenotazione</SectionTitle>
            <AvailabilityForm />
          </div>
          <div className="flex items-end">
            <StaticCalendar />
          </div>
        </div>
      </section>

      <section id="contatti" className="mx-auto max-w-[1260px] px-10 pb-8">
        <div className="grid gap-8 rounded-lg border border-[#e2d2b4] bg-white/55 p-6 md:grid-cols-[0.8fr_1.6fr]">
          <div>
            <SectionTitle>Come arrivare / Posizione</SectionTitle>
            <div className="space-y-5 font-serif text-lg text-[#0a1d35]">
              <p className="flex items-center gap-4"><MapPin className="text-[#b88a2b]" /> Via Pascoli 1, 93012 Gela (CL)</p>
              <p className="flex items-center gap-4"><span className="text-2xl text-[#b88a2b]">🚶</span> A 2 minuti a piedi dal lungomare</p>
              <p className="flex items-center gap-4"><span className="text-2xl text-[#b88a2b]">🚗</span> A 5 minuti dal centro di Gela</p>
              <p className="flex items-center gap-4"><span className="text-2xl text-[#b88a2b]">🚆</span> A 10 minuti dalla Stazione di Gela</p>
            </div>
          </div>

          <div className="relative min-h-[280px] overflow-hidden rounded-md border border-[#e2d2b4] bg-[#dcecf0]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#d4ecf2_0%,#d4ecf2_34%,#f2ebdf_35%,#f2ebdf_100%)]" />
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(#aeb9c1_1px,transparent_1px),linear-gradient(90deg,#aeb9c1_1px,transparent_1px)] [background-size:35px_35px]" />
            <div className="absolute left-[42%] top-[45%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a1d35] text-white shadow-xl">
              <MapPin size={34} />
            </div>
            <div className="absolute bottom-8 right-8 max-w-[310px] rounded-md bg-[#061d3d] p-6 text-center text-white shadow-xl">
              <p className="font-serif text-2xl font-bold">Gelone Lungomare</p>
              <p className="mt-2 font-serif text-lg">Via Pascoli 1, Gela (CL)</p>
              <p className="mt-3 font-serif text-base leading-6">Sul lungomare, in una zona tranquilla e ben servita.</p>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-sm bg-white px-10 py-3 font-serif font-bold uppercase tracking-[0.08em] text-[#061d3d]">
                Indicazioni ◇
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-[#d8b66c] bg-[#fffaf0] px-10 py-8">
        <GreekCorner position="bl" />
        <GreekCorner position="br" />
        <div className="mx-auto grid max-w-[1260px] gap-8 md:grid-cols-[1fr_0.9fr_1.1fr_0.7fr]">
          <div className="border-r border-[#d8b66c] pr-8">
            <LogoBlock footer />
            <p className="mt-4 font-serif text-lg font-bold">CIN: IT084001B4D36830</p>
            <p className="font-serif text-lg font-bold">CIR: 190840010022</p>
          </div>

          <div className="border-r border-[#d8b66c] pr-8">
            <h3 className="font-serif font-bold uppercase tracking-[0.12em]">Contatti</h3>
            <div className="mt-4 space-y-2 font-serif text-base">
              <a href="tel:+393476308456" className="flex items-center gap-3"><Phone size={16} />3476308456</a>
              <a href="tel:+393479461999" className="flex items-center gap-3"><Phone size={16} />3479461999</a>
              <a href="mailto:info@gelone.it" className="flex items-center gap-3"><Mail size={16} />info@gelone.it</a>
              <a href="https://www.gelone.it" className="flex items-center gap-3"><ExternalLink size={16} />www.gelone.it</a>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-r border-[#d8b66c] pr-8 text-center">
            <div className="text-7xl text-[#b88a2b]">♛</div>
            <p className="font-serif text-lg">Check-in e assistenza ospiti</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <h3 className="font-serif font-bold uppercase tracking-[0.12em]">Seguici</h3>
            <div className="mt-5 flex gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b8860b] font-serif text-xl font-bold text-white">f</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b8860b] font-serif text-xl font-bold text-white">◎</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
