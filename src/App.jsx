import React, { useState } from "react";
import {
  Bath,
  BedDouble,
  CalendarCheck,
  Camera,
  CheckCircle2,
  CookingPot,
  ExternalLink,
  GalleryHorizontalEnd,
  Heart,
  Home,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  SearchCheck,
  Send,
  ShieldCheck,
  Star,
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

const CIN = "IT084001B4D36830";
const CIR = "190840010022";

const gallery = [
  { image: "/images/terrazza-gelone.jpg", title: "Terrazza con vista" },
  { image: "/images/vista-mare-gelone.jpg", title: "Vista mare" },
  { image: "/images/interni-gelone.jpg", title: "Interni" },
  { image: "/images/terrazza-gelone.jpg", title: "Zona relax" },
  { image: "/images/vista-mare-gelone.jpg", title: "Tramonto sul mare" },
];

const reasons = [
  {
    icon: MapPin,
    title: "POSIZIONE\nVICINO AL MARE",
    text: "A pochi passi dal lungomare di Gela, per passeggiate e tramonti indimenticabili.",
  },
  {
    icon: Waves,
    title: "TERRAZZA\nPRIVATA",
    text: "Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax.",
  },
  {
    icon: KeyRound,
    title: "CHECK-IN\nSEMPLICE",
    text: "Accesso comodo e supporto dedicato per un soggiorno senza pensieri.",
  },
  {
    icon: Heart,
    title: "PER COPPIE E\nVIAGGIATORI",
    text: "Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere.",
  },
];

const amenities = [
  { icon: Home, label: "2 OSPITI" },
  { icon: BedDouble, label: "1 CAMERA" },
  { icon: Bath, label: "1 BAGNO" },
  { icon: CookingPot, label: "CUCINA" },
  { icon: Waves, label: "TERRAZZA\nVISTA MARE" },
];

function GoldCorner({ position }) {
  const classes = {
    tl: "left-3 top-3 border-l-2 border-t-2",
    tr: "right-3 top-3 border-r-2 border-t-2",
    bl: "bottom-3 left-3 border-b-2 border-l-2",
    br: "bottom-3 right-3 border-b-2 border-r-2",
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute h-8 w-8 border-[#b88926] ${classes[position]}`}
    >
      <div className="absolute inset-1 border border-[#b88926]/70" />
    </div>
  );
}

function BrandLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/images/logo-gelone.png"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/favicon.svg";
        }}
        alt="Gelone Lungomare"
        className={`${compact ? "h-12 w-12" : "h-20 w-20"} rounded-xl object-contain`}
      />
      <div className="leading-none">
        <p className={`${compact ? "text-2xl" : "text-4xl"} font-serif tracking-[0.24em] text-[#071d3a]`}>
          GELONE
        </p>
        <p className={`${compact ? "text-sm" : "text-lg"} mt-1 font-semibold tracking-[0.48em] text-[#071d3a]`}>
          LUNGOMARE
        </p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.35em] text-[#071d3a]">
          Locazione Turistica
        </p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="relative z-40 bg-[#fffaf0]/95 shadow-[0_1px_0_rgba(184,137,38,0.28)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-8 py-4">
        <a href="#home" className="shrink-0">
          <BrandLogo compact />
        </a>

        <nav className="hidden items-center gap-9 text-[15px] font-semibold text-[#071d3a] lg:flex">
          <a className="relative text-[#071d3a] after:absolute after:-bottom-3 after:left-1/2 after:h-px after:w-10 after:-translate-x-1/2 after:bg-[#b88926]" href="#home">
            Home
          </a>
          <a className="hover:text-[#b88926]" href="#alloggio">Alloggio</a>
          <a className="hover:text-[#b88926]" href="#foto">Foto</a>
          <a className="hover:text-[#b88926]" href="#disponibilita">Disponibilità</a>
          <a className="hover:text-[#b88926]" href="#contatti">Contatti</a>
        </nav>

        <a
          href="#disponibilita"
          className="inline-flex items-center gap-2 rounded-md bg-[#b88926] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-[#b88926]/20 transition hover:bg-[#97711f]"
        >
          Prenota diretto <CalendarCheck size={17} />
        </a>
      </div>
    </header>
  );
}

function BookingChoiceRow() {
  return (
    <div className="mx-auto -mt-14 grid max-w-[1280px] gap-3 px-8 md:grid-cols-4">
      <a
        href="#disponibilita"
        className="relative z-20 flex min-h-[104px] items-center gap-4 rounded-xl border-2 border-[#d7b35f] bg-[#071d3a] p-5 text-white shadow-2xl shadow-[#071d3a]/25"
      >
        <img
          src="/images/logo-gelone.png"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/favicon.svg";
          }}
          alt="Gelone"
          className="h-14 w-14 rounded-lg object-contain"
        />
        <div>
          <p className="font-serif text-xl font-bold uppercase tracking-wide">Prenota dal sito</p>
          <p className="mt-1 text-sm font-extrabold uppercase tracking-[0.18em] text-[#f3c75d]">Miglior tariffa</p>
          <p className="mt-1 text-xs text-white/85">Risparmia prenotando diretto</p>
        </div>
      </a>

      <a
        href={bookingUrl}
        target="_blank"
        rel="noreferrer"
        className="relative z-20 flex min-h-[104px] items-center justify-center gap-4 rounded-xl border border-[#d8d1c5] bg-white/95 p-5 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
      >
        <span className="text-5xl font-black text-[#003b95]">B.</span>
        <span className="font-serif text-xl font-bold text-[#071d3a]">Booking.com</span>
      </a>

      <a
        href={airbnbUrl}
        target="_blank"
        rel="noreferrer"
        className="relative z-20 flex min-h-[104px] items-center justify-center gap-4 rounded-xl border border-[#d8d1c5] bg-white/95 p-5 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
      >
        <span className="text-5xl font-light text-[#ff385c]">⌂</span>
        <span className="font-serif text-xl font-bold text-[#071d3a]">Airbnb</span>
      </a>

      <a
        href={directWhatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="relative z-20 flex min-h-[104px] items-center justify-center gap-4 rounded-xl border border-[#d8d1c5] bg-white/95 p-5 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white">
          <MessageCircle size={28} />
        </span>
        <span className="font-serif text-xl font-bold text-[#071d3a]">WhatsApp</span>
      </a>
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

function AvailabilityForm({ compact = false }) {
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
    <form onSubmit={handleCheckAvailability} className={compact ? "" : "rounded-2xl border border-[#eadfca] bg-white p-6 shadow-sm"}>
      <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
        <label className="block rounded-lg border border-[#e6dac7] bg-white px-4 py-3">
          <span className="mb-2 block text-xs font-bold text-[#071d3a]">Check-in</span>
          <span className="flex items-center gap-2">
            <CalendarCheck size={18} className="text-[#071d3a]" />
            <input
              type="date"
              min={today}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="w-full bg-transparent text-sm text-[#071d3a] outline-none"
            />
          </span>
        </label>

        <label className="block rounded-lg border border-[#e6dac7] bg-white px-4 py-3">
          <span className="mb-2 block text-xs font-bold text-[#071d3a]">Check-out</span>
          <span className="flex items-center gap-2">
            <CalendarCheck size={18} className="text-[#071d3a]" />
            <input
              type="date"
              min={checkIn || today}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className="w-full bg-transparent text-sm text-[#071d3a] outline-none"
            />
          </span>
        </label>

        <label className="block rounded-lg border border-[#e6dac7] bg-white px-4 py-3">
          <span className="mb-2 block text-xs font-bold text-[#071d3a]">Ospiti</span>
          <select
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="w-full bg-transparent text-sm text-[#071d3a] outline-none"
          >
            <option value="1">1 ospite</option>
            <option value="2">2 ospiti</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={checking || booking}
        className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-md bg-[#b88926] px-5 py-3 font-serif text-lg font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#97711f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {checking ? "Controllo in corso..." : "Verifica disponibilità"}
        <CalendarCheck size={18} />
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#071d3a]">
        <ShieldCheck size={17} className="text-[#071d3a]" />
        Miglior tariffa garantita prenotando dal sito
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${result.available === true ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <p className="font-bold">
            {result.available === true
              ? "Gelone Lungomare risulta disponibile."
              : "Gelone Lungomare non risulta disponibile."}
          </p>
          <p className="mt-1 leading-6">
            {result.message || "La verifica è stata completata. Per conferma definitiva contattaci prima di prenotare."}
          </p>
        </div>
      )}

      {canShowBookingForm && (
        <div className="mt-5 rounded-xl border border-[#e6dac7] bg-[#fffaf0] p-5">
          <h3 className="font-serif text-xl font-bold text-[#071d3a]">Blocca le date dal sito ufficiale</h3>
          <p className="mt-1 text-sm leading-6 text-[#5a4b39]">
            Compila i dati. Le date verranno bloccate nel sistema interno in attesa della conferma finale.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Nome e cognome"
              className="rounded-lg border border-[#e6dac7] bg-white px-4 py-3 outline-none focus:border-[#b88926] md:col-span-2"
            />
            <input
              type="tel"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              placeholder="Telefono / WhatsApp"
              className="rounded-lg border border-[#e6dac7] bg-white px-4 py-3 outline-none focus:border-[#b88926]"
            />
            <input
              type="email"
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              placeholder="Email"
              className="rounded-lg border border-[#e6dac7] bg-white px-4 py-3 outline-none focus:border-[#b88926]"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Note o orario indicativo di arrivo"
              rows={3}
              className="rounded-lg border border-[#e6dac7] bg-white px-4 py-3 outline-none focus:border-[#b88926] md:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCreateBooking}
              disabled={booking}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-md bg-[#071d3a] px-6 py-3 font-bold text-white transition hover:bg-[#143459] disabled:opacity-60"
            >
              {booking ? "Blocco date in corso..." : "Blocca date e invia richiesta"}
              <Send size={18} />
            </button>
            <a
              href={whatsappWithDates}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-md border border-[#071d3a] bg-white px-6 py-3 font-bold text-[#071d3a]"
            >
              WhatsApp <MessageCircle size={18} />
            </a>
          </div>
        </div>
      )}

      {bookingResult && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="font-bold">Richiesta inviata correttamente.</p>
          <p className="mt-1 text-sm leading-6">Le date sono state bloccate nel sistema Gelone Lungomare in attesa della conferma finale.</p>
          <p className="mt-1 text-xs">Codice richiesta: <strong>{bookingResult.bookingId}</strong></p>
        </div>
      )}
    </form>
  );
}

function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-[#fffaf0]">
      <GoldCorner position="tl" />
      <GoldCorner position="tr" />
      <div className="mx-auto max-w-[1500px] px-8 pt-6">
        <div className="relative min-h-[570px] overflow-hidden rounded-none">
          <div className="absolute inset-0">
            <img
              src="/images/vista-mare-gelone.jpg"
              alt="Vista mare Gelone Lungomare"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <img
              src="/images/terrazza-gelone.jpg"
              alt="Terrazza Gelone Lungomare"
              className="absolute right-0 top-0 h-full w-[56%] object-cover opacity-95 [mask-image:linear-gradient(to_right,transparent,black_18%,black)]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf0] via-[#fffaf0]/65 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fffaf0] to-transparent" />
          </div>

          <div className="relative z-10 grid min-h-[570px] md:grid-cols-[0.48fr_0.52fr]">
            <div className="flex flex-col justify-center pb-24 pl-4 pr-8 pt-4 md:pl-12">
              <div className="mb-7">
                <BrandLogo />
                <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[#071d3a]">
                  CIN: {CIN} <span className="mx-3 text-[#b88926]">|</span> CIR: {CIR}
                </p>
              </div>

              <h1 className="max-w-2xl font-serif text-[42px] leading-[1.14] tracking-[0.02em] text-[#071d3a] md:text-[58px]">
                Vista mare, terrazza e comfort a due passi dal lungomare di Gela
              </h1>
              <div className="my-7 flex items-center gap-3">
                <span className="h-px w-32 bg-[#b88926]" />
                <span className="h-2 w-2 rotate-45 bg-[#b88926]" />
                <span className="h-px w-32 bg-[#b88926]/40" />
              </div>
              <p className="max-w-lg text-lg leading-8 text-[#071d3a]">
                Appartamento accogliente e riservato con ampia terrazza vista mare, ideale per coppie e soggiorni di relax in Sicilia.
              </p>
            </div>
          </div>
        </div>
      </div>
      <BookingChoiceRow />
    </section>
  );
}

function AmenityStrip() {
  return (
    <section className="bg-[#fffaf0] px-8 py-8">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 divide-y divide-[#e6dac7] border-y border-[#e6dac7] md:grid-cols-5 md:divide-x md:divide-y-0">
        {amenities.map((item) => (
          <div key={item.label} className="flex items-center justify-center gap-4 px-5 py-5 text-center">
            <item.icon size={36} strokeWidth={1.4} className="text-[#b88926]" />
            <p className="whitespace-pre-line text-sm font-extrabold uppercase tracking-[0.12em] text-[#071d3a]">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReasonsSection() {
  return (
    <section id="alloggio" className="bg-[#fffaf0] px-8 pb-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 text-center">
          <h2 className="font-serif text-3xl font-bold uppercase tracking-[0.08em] text-[#071d3a]">
            Perché scegliere Gelone Lungomare
          </h2>
          <div className="mx-auto mt-4 flex w-28 items-center justify-center gap-2">
            <span className="h-px flex-1 bg-[#b88926]" />
            <span className="h-2 w-2 rotate-45 bg-[#b88926]" />
            <span className="h-px flex-1 bg-[#b88926]" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {reasons.map((item) => (
            <article key={item.title} className="rounded-lg border border-[#e6dac7] bg-white/65 p-7 text-center shadow-sm">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#e1cfaa] bg-[radial-gradient(circle,#fffaf0_42%,#eadfca_43%,#fffaf0_72%)] text-[#b88926]">
                <item.icon size={34} strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 whitespace-pre-line font-serif text-xl font-bold uppercase leading-6 tracking-[0.08em] text-[#071d3a]">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-6 text-[#071d3a]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GallerySection() {
  return (
    <section id="foto" className="bg-[#fffaf0] px-8 pb-12">
      <div className="mx-auto max-w-[1280px] text-center">
        <h2 className="font-serif text-3xl font-bold uppercase tracking-[0.22em] text-[#071d3a]">Galleria</h2>
        <div className="mx-auto mt-3 flex w-20 items-center justify-center gap-2">
          <span className="h-px flex-1 bg-[#b88926]" />
          <span className="h-2 w-2 rotate-45 bg-[#b88926]" />
          <span className="h-px flex-1 bg-[#b88926]" />
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {gallery.map((item, index) => (
            <figure key={`${item.title}-${index}`} className="overflow-hidden rounded-md border border-[#d8d1c5] bg-white shadow-sm">
              <img src={item.image} alt={item.title} className="h-40 w-full object-cover" />
            </figure>
          ))}
        </div>

        <a href="#foto" className="mt-5 inline-flex items-center gap-3 rounded-md bg-[#071d3a] px-8 py-3 font-serif text-sm font-bold uppercase tracking-wider text-white">
          Vedi tutte le foto <GalleryHorizontalEnd size={18} />
        </a>
      </div>
    </section>
  );
}

function CalendarMock() {
  const weeks = [
    [26, 27, 28, 29, 30, 31, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 1, 2, 3, 4, 5, 6],
  ];
  const days = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

  return (
    <div className="rounded-xl border border-[#e6dac7] bg-white/70 p-6">
      <div className="mb-5 flex items-center justify-between text-[#071d3a]">
        <span className="text-xl">‹</span>
        <p className="font-serif font-bold uppercase tracking-[0.12em]">Giugno 2025</p>
        <span className="text-xl">›</span>
      </div>
      <div className="grid grid-cols-7 gap-y-4 text-center text-sm text-[#071d3a]">
        {days.map((day) => (
          <div key={day} className="font-bold uppercase tracking-[0.12em]">{day}</div>
        ))}
        {weeks.flat().map((day, index) => (
          <div key={`${day}-${index}`} className={`font-medium ${index < 6 || index > 34 ? "text-[#071d3a]/45" : "text-[#071d3a]"}`}>
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}

function AvailabilitySection() {
  return (
    <section id="disponibilita" className="bg-[#fffaf0] px-8 pb-8">
      <div className="mx-auto grid max-w-[1280px] gap-7 rounded-xl border border-[#e6dac7] bg-white/55 p-7 shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="font-serif text-3xl font-bold uppercase tracking-[0.10em] text-[#071d3a]">
            Disponibilità e prenotazione
          </h2>
          <div className="mt-3 flex w-36 items-center gap-2">
            <span className="h-px flex-1 bg-[#b88926]" />
            <span className="h-2 w-2 rotate-45 bg-[#b88926]" />
            <span className="h-px flex-1 bg-[#b88926]/40" />
          </div>
          <div className="mt-6">
            <AvailabilityForm compact />
          </div>
        </div>
        <CalendarMock />
      </div>
    </section>
  );
}

function MapCard() {
  return (
    <div className="relative min-h-[270px] overflow-hidden rounded-lg border border-[#d8d1c5] bg-[#e8eef0]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#a9d2e8_0%,#a9d2e8_34%,#f3eadb_35%,#f3eadb_100%)]" />
      <div className="absolute left-[38%] top-0 h-full w-1 rotate-[32deg] bg-[#d4c29a]/70" />
      <div className="absolute left-[50%] top-0 h-full w-px rotate-[80deg] bg-white/90" />
      <div className="absolute left-[56%] top-0 h-full w-px rotate-[10deg] bg-white/90" />
      <div className="absolute left-[44%] top-[42%] h-px w-[45%] rotate-[-18deg] bg-white/90" />
      <div className="absolute left-[50%] top-[50%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#071d3a] text-white shadow-xl">
        <MapPin size={30} />
      </div>
      <p className="absolute right-8 top-8 font-serif text-xl font-bold text-[#071d3a]">Gela</p>
      <p className="absolute left-[42%] top-[34%] text-xs font-semibold text-[#6d86a0]">Lungomare Federico II di Svevia</p>

      <div className="absolute bottom-6 right-6 max-w-xs rounded-lg bg-[#071d3a] p-5 text-white shadow-2xl">
        <p className="font-serif text-2xl font-bold">Gelone Lungomare</p>
        <p className="mt-2 text-sm leading-6 text-white/90">
          Via Pascoli 1, Gela (CL)<br />Sul lungomare, in una zona tranquilla e ben servita.
        </p>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-6 py-2 font-serif text-sm font-bold uppercase tracking-wide text-[#071d3a]">
          Indicazioni <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

function LocationSection() {
  return (
    <section id="posizione" className="bg-[#fffaf0] px-8 pb-10">
      <div className="mx-auto grid max-w-[1280px] gap-7 rounded-xl border border-[#e6dac7] bg-white/55 p-7 shadow-sm lg:grid-cols-[0.45fr_0.55fr]">
        <div>
          <h2 className="font-serif text-3xl font-bold uppercase tracking-[0.08em] text-[#071d3a]">
            Come arrivare / posizione
          </h2>
          <div className="mt-3 flex w-36 items-center gap-2">
            <span className="h-px flex-1 bg-[#b88926]" />
            <span className="h-2 w-2 rotate-45 bg-[#b88926]" />
            <span className="h-px flex-1 bg-[#b88926]/40" />
          </div>

          <div className="mt-8 space-y-6 text-lg text-[#071d3a]">
            <p className="flex items-center gap-4"><MapPin className="text-[#b88926]" /> Via Pascoli 1, 93012 Gela (CL)</p>
            <p className="flex items-center gap-4"><span className="text-2xl text-[#b88926]">♟</span> A 2 minuti a piedi dal lungomare</p>
            <p className="flex items-center gap-4"><span className="text-2xl text-[#b88926]">▰</span> A 5 minuti dal centro di Gela</p>
            <p className="flex items-center gap-4"><span className="text-2xl text-[#b88926]">▣</span> A 10 minuti dalla Stazione di Gela</p>
          </div>
        </div>
        <MapCard />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contatti" className="relative border-y border-[#b88926]/55 bg-[#fffaf0] px-8 py-8">
      <GoldCorner position="bl" />
      <GoldCorner position="br" />
      <div className="mx-auto grid max-w-[1280px] gap-7 md:grid-cols-[1fr_1fr_1fr_0.7fr] md:items-center">
        <div>
          <BrandLogo compact />
          <div className="mt-4 text-sm font-semibold leading-7 text-[#071d3a]">
            <p>CIN: {CIN}</p>
            <p>CIR: {CIR}</p>
          </div>
        </div>

        <div className="space-y-3 text-[#071d3a]">
          <p className="font-serif text-sm font-bold uppercase tracking-[0.2em]">Contatti</p>
          <a href="tel:+393476308456" className="flex items-center gap-3"><Phone size={17} className="text-[#b88926]" />3476308456</a>
          <a href="tel:+393479461999" className="flex items-center gap-3"><Phone size={17} className="text-[#b88926]" />3479461999</a>
          <a href="mailto:info@gelone.it" className="flex items-center gap-3"><Mail size={17} className="text-[#b88926]" />info@gelone.it</a>
          <a href="https://www.gelone.it" className="flex items-center gap-3"><ExternalLink size={17} className="text-[#b88926]" />www.gelone.it</a>
        </div>

        <div className="text-center text-[#071d3a]">
          <div className="mx-auto flex items-center justify-center gap-5 text-[#b88926]">
            <span className="font-serif text-5xl">I</span>
            <span className="text-5xl">🦅</span>
            <span className="font-serif text-5xl">I</span>
          </div>
          <p className="mt-3 font-serif text-lg">Check-in e assistenza ospiti</p>
        </div>

        <div className="text-center text-[#071d3a] md:text-right">
          <p className="font-serif text-sm font-bold uppercase tracking-[0.2em]">Seguici</p>
          <div className="mt-4 flex justify-center gap-4 md:justify-end">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b88926] font-bold text-white">f</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b88926] font-bold text-white">◎</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#fffaf0] text-[#071d3a]">
      <Header />
      <Hero />
      <AmenityStrip />
      <ReasonsSection />
      <GallerySection />
      <AvailabilitySection />
      <LocationSection />
      <Footer />
    </main>
  );
}
