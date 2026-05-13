import React, { useState } from "react";
import {
  Bath,
  BedDouble,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  CookingPot,
  ExternalLink,
  GalleryHorizontalEnd,
  Heart,
  Home,
  Image as ImageIcon,
  KeyRound,
  Mail,
  MapPin,
  Menu,
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

const gallery = [
  {
    title: "Vista mare",
    description: "Lo scorcio reale verso il mare dal terrazzo di Gelone Lungomare.",
    image: "/images/vista-mare-gelone.jpg",
  },
  {
    title: "Terrazza esterna",
    description:
      "Spazio esterno con piante, tenda e zona relax per vivere il soggiorno all'aperto.",
    image: "/images/terrazza-gelone.jpg",
  },
  {
    title: "Interni",
    description:
      "Soluzione comoda per 2 persone con camera, bagno e cucina.",
    image: "/images/interni-gelone.jpg",
  },
];

const features = [
  { icon: Home, label: "2 ospiti" },
  { icon: BedDouble, label: "1 camera" },
  { icon: Bath, label: "1 bagno" },
  { icon: CookingPot, label: "Cucina" },
  { icon: Waves, label: "Terrazza vista mare" },
];

const reasons = [
  {
    icon: MapPin,
    title: "Posizione vicino al mare",
    text: "A pochi passi dal lungomare di Gela, comodo per passeggiate, mare e servizi.",
  },
  {
    icon: Waves,
    title: "Terrazza vivibile",
    text: "Uno spazio esterno reale, con piante e scorcio mare, ideale per momenti di relax.",
  },
  {
    icon: KeyRound,
    title: "Check-in semplice",
    text: "Assistenza diretta e gestione ospiti ordinata con check-in online dopo conferma.",
  },
  {
    icon: Heart,
    title: "Per coppie e viaggiatori",
    text: "Ambiente riservato per 2 persone, pensato per soggiorni brevi e tranquilli.",
  },
];

function LogoMark({ small = false }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-[#b88a2b]/70 bg-[#fffaf0] text-[#0a1d35] shadow-sm ${
        small ? "h-14 w-14" : "h-20 w-20"
      }`}
    >
      <div className="absolute inset-1 rounded-full border border-[#d8b66c]/70" />
      <div className="text-center">
        <div className={small ? "text-xl" : "text-3xl"}>⛵</div>
        <div className="mt-[-4px] text-[10px] tracking-[0.2em] text-[#b88a2b]">
          ≋≋
        </div>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#eadfca] bg-[#fffaf0]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
        <a href="#home" className="flex items-center gap-4">
          <LogoMark small />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#9b6b25]">
              Locazione turistica
            </p>
            <h1 className="font-serif text-2xl tracking-[0.22em] text-[#0a1d35]">
              GELONE
            </h1>
            <p className="text-xs font-semibold tracking-[0.52em] text-[#0a1d35]">
              LUNGOMARE
            </p>
          </div>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#0a1d35] lg:flex">
          <a href="#home" className="hover:text-[#9b6b25]">Home</a>
          <a href="#alloggio" className="hover:text-[#9b6b25]">Alloggio</a>
          <a href="#foto" className="hover:text-[#9b6b25]">Foto</a>
          <a href="#disponibilita" className="hover:text-[#9b6b25]">Disponibilità</a>
          <a href="#contatti" className="hover:text-[#9b6b25]">Contatti</a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#disponibilita"
            className="hidden rounded-full bg-[#b88a2b] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#9b6b25] sm:inline-flex"
          >
            Prenota diretto
          </a>
          <a
            href="tel:+393476308456"
            className="hidden h-11 w-11 items-center justify-center rounded-full border border-[#e2d2b4] text-[#0a1d35] md:flex"
          >
            <Phone size={20} />
          </a>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e2d2b4] text-[#0a1d35] lg:hidden"
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}

function ChannelCard({ type, title, subtitle, href, primary = false }) {
  const styles = primary
    ? "border-[#d8b66c] bg-[#0a1d35] text-white shadow-xl shadow-[#0a1d35]/20"
    : type === "booking"
    ? "border-[#d6e3ff] bg-white text-[#174ea6]"
    : type === "airbnb"
    ? "border-[#ffd7df] bg-white text-[#ff385c]"
    : "border-[#cdebd5] bg-white text-[#168a3a]";

  const Icon =
    type === "direct"
      ? CalendarCheck
      : type === "booking"
      ? null
      : type === "airbnb"
      ? null
      : MessageCircle;

  return (
    <a
      href={href}
      target={href.startsWith("#") ? undefined : "_blank"}
      rel={href.startsWith("#") ? undefined : "noreferrer"}
      className={`group flex min-h-[78px] items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-1 hover:shadow-lg ${styles}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            primary
              ? "bg-[#f5c84b] text-[#0a1d35]"
              : type === "booking"
              ? "bg-[#003b95] text-white"
              : type === "airbnb"
              ? "bg-[#ff385c] text-white"
              : "bg-[#1fb153] text-white"
          }`}
        >
          {Icon ? (
            <Icon size={24} />
          ) : (
            <span className="text-xl font-black">
              {type === "booking" ? "B." : "A"}
            </span>
          )}
        </div>

        <div>
          <p className="font-serif text-xl font-bold tracking-wide">{title}</p>
          {subtitle && (
            <p
              className={`mt-1 text-xs font-bold uppercase tracking-[0.18em] ${
                primary ? "text-[#f5c84b]" : "text-current/70"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <ChevronRight
        className={primary ? "text-[#f5c84b]" : "text-current/70"}
        size={24}
      />
    </a>
  );
}

function FeatureStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-[#eadfca] bg-white/90 p-4 shadow-sm md:grid-cols-5">
      {features.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center justify-center rounded-2xl bg-[#fffaf0] px-4 py-5 text-center"
        >
          <item.icon className="text-[#b88a2b]" size={26} />
          <p className="mt-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#0a1d35]">
            {item.label}
          </p>
        </div>
      ))}
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
    if (!checkIn || !checkOut) {
      return "Inserisci data di arrivo e data di partenza.";
    }

    if (checkOut <= checkIn) {
      return "La data di partenza deve essere successiva alla data di arrivo.";
    }

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checkIn, checkOut }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.message || "Non è stato possibile verificare la disponibilità."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err?.message ||
          "Errore durante il controllo disponibilità. Puoi contattarci su WhatsApp."
      );
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
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok) {
        throw new Error(
          data?.message || "Non è stato possibile bloccare le date."
        );
      }

      setBookingResult(data);
      setResult({
        ok: true,
        available: false,
        message:
          "Le date sono state bloccate nel sistema Gelone Lungomare in attesa di conferma.",
      });
    } catch (err) {
      setError(
        err?.message ||
          "Errore durante il blocco date. Puoi contattarci su WhatsApp."
      );
    } finally {
      setBooking(false);
    }
  }

  const whatsappWithDates = `https://wa.me/393476308456?text=${encodeURIComponent(
    `Ciao, vorrei prenotare direttamente Gelone Lungomare. Date richieste: ${
      checkIn || "arrivo"
    } - ${checkOut || "partenza"}`
  )}`;

  const canShowBookingForm = result?.available === true && !bookingResult;

  return (
    <form
      onSubmit={handleCheckAvailability}
      className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-sm md:p-8"
    >
      <div className="mb-6 rounded-[1.5rem] border border-[#f5c84b] bg-[#fff7d6] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-[#9b6b25]" size={24} />
          <div>
            <p className="font-extrabold text-[#0a1d35]">
              Prenotazione diretta disponibile
            </p>
            <p className="mt-1 text-sm leading-6 text-[#555]">
              Controlli la disponibilità, blocchi le date e ricevi conferma
              diretta dalla struttura.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
            Check-in
          </span>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#fffaf0] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
            Check-out
          </span>
          <input
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#fffaf0] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
            Ospiti
          </span>
          <select
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#fffaf0] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          >
            <option value="1">1 ospite</option>
            <option value="2">2 ospiti</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={checking || booking}
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#b88a2b] px-7 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#9b6b25] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:text-lg"
      >
        {checking ? "Controllo in corso..." : "Verifica disponibilità"}
        <SearchCheck size={20} />
      </button>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`mt-5 rounded-2xl border p-5 ${
            result.available === true
              ? "border-green-200 bg-green-50 text-green-900"
              : result.available === false
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-[#d7c49f] bg-[#faf6ee] text-[#0a1d35]"
          }`}
        >
          <p className="font-bold">
            {result.available === true
              ? "Gelone Lungomare risulta disponibile."
              : result.available === false
              ? "Gelone Lungomare non risulta disponibile."
              : "Risultato disponibilità"}
          </p>

          <p className="mt-2 leading-7">
            {result.message ||
              "La verifica è stata completata. Per conferma definitiva contattaci prima di prenotare."}
          </p>
        </div>
      )}

      {canShowBookingForm && (
        <div className="mt-6 rounded-[1.5rem] border border-[#d7c49f] bg-[#fffaf0] p-5">
          <h3 className="text-xl font-bold text-[#0a1d35]">
            Blocca le date dal sito ufficiale
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#555]">
            Compila i dati. Le date verranno bloccate nel sistema interno in
            attesa della conferma finale della struttura.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
                Nome e cognome
              </span>
              <input
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Es. Mario Rossi"
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
                Telefono / WhatsApp
              </span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="Es. 347..."
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
                Email
              </span>
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
                Note
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Scrivi eventuali richieste o orario indicativo di arrivo."
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={booking}
              onClick={handleCreateBooking}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#132f52] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {booking
                ? "Blocco date in corso..."
                : "Blocca date e invia richiesta"}
              <Send size={20} />
            </button>

            <a
              href={whatsappWithDates}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white px-7 py-4 text-base font-bold text-[#0a1d35] transition hover:bg-[#fff7e6]"
            >
              WhatsApp <MessageCircle size={20} />
            </a>
          </div>
        </div>
      )}

      {bookingResult && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
          <p className="text-lg font-bold">Richiesta inviata correttamente.</p>
          <p className="mt-2 leading-7">
            Le date sono state bloccate nel sistema Gelone Lungomare in attesa
            della conferma finale della struttura.
          </p>
          <p className="mt-2 text-sm">
            Codice richiesta: <strong>{bookingResult.bookingId}</strong>
          </p>
        </div>
      )}
    </form>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#9b6b25]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-4xl text-[#0a1d35] md:text-5xl">
        {title}
      </h2>
      {text && <p className="mt-5 text-lg leading-8 text-[#555]">{text}</p>}
    </div>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#fffaf0] text-[#0a1d35]">
      <BrandHeader />

      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#ead6a6,transparent_32%),radial-gradient(circle_at_bottom_right,#d8e9ef,transparent_28%)]" />

        <div className="relative mx-auto max-w-7xl px-5 py-8 md:py-12">
          <div className="overflow-hidden rounded-[2.2rem] border border-[#d8b66c]/60 bg-white shadow-2xl">
            <div className="grid min-h-[620px] md:grid-cols-[1fr_1fr]">
              <div className="relative flex flex-col justify-between p-7 md:p-10">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-[#fffaf0] px-4 py-2 text-sm font-semibold text-[#6d552d]">
                    <Camera size={18} />
                    Foto reali · Gela
                  </div>

                  <div className="mb-8 flex items-center gap-4">
                    <LogoMark />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#9b6b25]">
                        Locazione turistica
                      </p>
                      <h2 className="mt-2 font-serif text-5xl tracking-[0.18em] text-[#0a1d35] md:text-6xl">
                        GELONE
                      </h2>
                      <p className="text-lg font-semibold tracking-[0.45em] text-[#0a1d35]">
                        LUNGOMARE
                      </p>
                    </div>
                  </div>

                  <h3 className="font-serif text-4xl leading-tight text-[#0a1d35] md:text-6xl">
                    Vista mare, terrazza e comfort a due passi dal lungomare di
                    Gela
                  </h3>

                  <div className="my-6 h-px w-40 bg-[#d8b66c]" />

                  <p className="max-w-xl text-lg leading-8 text-[#4f4f4f]">
                    Appartamento accogliente e riservato per 2 persone, con
                    terrazza esterna, cucina e scorcio di vista mare. Ideale per
                    coppie e soggiorni brevi in Sicilia.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#6d552d]">
                    <span className="rounded-full border border-[#eadfca] bg-[#fffaf0] px-4 py-2">
                      Contatti diretti
                    </span>
                    <span className="rounded-full border border-[#eadfca] bg-[#fffaf0] px-4 py-2">
                      Foto reali
                    </span>
                    <span className="rounded-full border border-[#eadfca] bg-[#fffaf0] px-4 py-2">
                      Check-in semplice
                    </span>
                  </div>
                </div>

                <div className="mt-8 grid gap-3">
                  <ChannelCard
                    type="direct"
                    title="Prenota dal sito"
                    subtitle="Miglior tariffa diretta"
                    href="#disponibilita"
                    primary
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    <ChannelCard
                      type="booking"
                      title="Booking.com"
                      href={bookingUrl}
                    />
                    <ChannelCard type="airbnb" title="Airbnb" href={airbnbUrl} />
                    <ChannelCard
                      type="whatsapp"
                      title="WhatsApp"
                      href={directWhatsappUrl}
                    />
                  </div>
                </div>
              </div>

              <div className="relative min-h-[520px]">
                <img
                  src="/images/vista-mare-gelone.jpg"
                  alt="Vista mare reale Gelone Lungomare"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/20 via-black/10 to-[#fffaf0]/20" />

                <div className="absolute bottom-5 left-5 right-5 overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/85 p-3 shadow-2xl backdrop-blur md:left-8 md:right-8">
                  <div className="grid gap-3 md:grid-cols-[0.8fr_1fr]">
                    <img
                      src="/images/terrazza-gelone.jpg"
                      alt="Terrazza reale Gelone Lungomare"
                      className="h-40 w-full rounded-[1.2rem] object-cover"
                    />
                    <div className="flex flex-col justify-center p-2">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#9b6b25]">
                        Terrazza e scorcio mare
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#555]">
                        Una via di mezzo fedele: mare in evidenza, terrazza reale
                        e atmosfera mediterranea senza immagini ingannevoli.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="-mt-7 px-4 md:px-10">
            <FeatureStrip />
          </div>
        </div>
      </section>

      <section id="alloggio" className="mx-auto max-w-7xl px-5 py-16">
        <SectionTitle
          eyebrow="Perché scegliere Gelone Lungomare"
          title="Un soggiorno semplice, riservato e vicino al mare"
          text="La pagina deve essere bella, ma soprattutto onesta: racconta ciò che l'ospite trova davvero."
        />

        <div className="grid gap-6 md:grid-cols-4">
          {reasons.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.7rem] border border-[#eadfca] bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff3d2] text-[#9b6b25]">
                <item.icon size={28} />
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#0a1d35]">
                {item.title}
              </h3>
              <p className="mt-3 leading-7 text-[#555]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="foto" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-5">
          <SectionTitle
            eyebrow="Galleria"
            title="Foto reali della struttura"
            text="Mare, terrazza e ambienti: immagini coerenti con quello che l'ospite troverà."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {gallery.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-[1.7rem] border border-[#eadfca] bg-[#fffaf0] shadow-sm"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-72 w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="mt-2 leading-6 text-[#555]">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center">
            <a
              href="#disponibilita"
              className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-bold text-white transition hover:bg-[#132f52]"
            >
              Prenota dopo aver visto le foto <GalleryHorizontalEnd size={20} />
            </a>
          </div>
        </div>
      </section>

      <section id="disponibilita" className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#9b6b25]">
              Disponibilità e prenotazione
            </p>
            <h2 className="mt-3 font-serif text-4xl text-[#0a1d35] md:text-5xl">
              Verifica le date dal sito ufficiale
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#555]">
              Se le date sono libere, puoi inviare una richiesta diretta. Le
              date vengono bloccate nel sistema interno in attesa della conferma
              finale.
            </p>

            <div className="mt-8">
              <AvailabilityForm />
            </div>
          </div>

          <aside className="grid content-start gap-5">
            <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-sm">
              <Star className="text-[#b88a2b]" size={30} />
              <h3 className="mt-4 text-2xl font-bold">
                Prenotazione diretta consigliata
              </h3>
              <p className="mt-3 leading-7 text-[#555]">
                Prima verifica dal sito Gelone. Booking e Airbnb restano
                disponibili, ma il contatto diretto permette una gestione più
                semplice.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-sm">
              <ImageIcon className="text-[#b88a2b]" size={30} />
              <h3 className="mt-4 text-2xl font-bold">Trasparenza</h3>
              <p className="mt-3 leading-7 text-[#555]">
                Usiamo foto reali e descrizioni coerenti con la struttura:
                terrazza, scorcio mare e appartamento per 2 persone.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section id="posizione" className="bg-[#0a1d35] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#d8b66c]">
              Come arrivare
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              Via Pascoli 1, Gela
            </h2>
            <div className="mt-8 space-y-4 text-white/80">
              <p className="flex items-center gap-3">
                <MapPin className="text-[#d8b66c]" /> A pochi passi dal
                lungomare
              </p>
              <p className="flex items-center gap-3">
                <Waves className="text-[#d8b66c]" /> Zona mare e servizi
                principali
              </p>
              <p className="flex items-center gap-3">
                <Phone className="text-[#d8b66c]" /> Assistenza diretta ospiti
              </p>
            </div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#d8b66c] px-7 py-4 font-extrabold text-[#0a1d35]"
            >
              Apri Google Maps <ExternalLink size={18} />
            </a>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-3">
            <div className="relative min-h-[360px] overflow-hidden rounded-[1.5rem] bg-[#e6eef3]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#d7e8ef_0%,#f4ead7_55%,#bcd5e4_100%)]" />
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0a1d35] text-[#d8b66c] shadow-2xl">
                  <MapPin size={34} />
                </div>
                <div className="mt-4 rounded-2xl bg-[#0a1d35] p-5 text-center shadow-xl">
                  <p className="font-serif text-2xl">Gelone Lungomare</p>
                  <p className="mt-2 text-sm text-white/75">
                    Via Pascoli 1, Gela (CL)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contatti" className="mx-auto max-w-7xl px-5 py-16">
        <div className="rounded-[2rem] border border-[#d8b66c]/60 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-8 md:grid-cols-[1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-4">
                <LogoMark small />
                <div>
                  <p className="font-serif text-2xl tracking-[0.18em]">
                    GELONE
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.28em]">
                    Lungomare
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm leading-6 text-[#555]">
                <p>
                  <strong>CIN:</strong> IT084001B4D36830
                </p>
                <p>
                  <strong>CIR:</strong> 190840010022
                </p>
                <p>Locazione Turistica · Gela · Sicilia</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.28em] text-[#9b6b25]">
                Contatti
              </h3>
              <div className="mt-5 space-y-4">
                <a
                  href="tel:+393476308456"
                  className="flex items-center gap-3 font-semibold"
                >
                  <Phone className="text-[#b88a2b]" /> 3476308456
                </a>
                <a
                  href="tel:+393479461999"
                  className="flex items-center gap-3 font-semibold"
                >
                  <Phone className="text-[#b88a2b]" /> 3479461999
                </a>
                <a
                  href="mailto:info@gelone.it"
                  className="flex items-center gap-3 font-semibold"
                >
                  <Mail className="text-[#b88a2b]" /> info@gelone.it
                </a>
                <a
                  href="https://www.gelone.it"
                  className="flex items-center gap-3 font-semibold"
                >
                  <ExternalLink className="text-[#b88a2b]" /> www.gelone.it
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.28em] text-[#9b6b25]">
                Prenota
              </h3>
              <div className="mt-5 grid gap-3">
                <a
                  href="#disponibilita"
                  className="rounded-full bg-[#0a1d35] px-6 py-4 text-center font-extrabold text-white"
                >
                  Prenota diretto
                </a>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#0a1d35] px-6 py-4 text-center font-bold text-[#0a1d35]"
                >
                  WhatsApp
                </a>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#555]">
                Check-in e assistenza ospiti dopo la conferma della
                prenotazione.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eadfca] bg-[#0a1d35] px-5 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <p>Gelone Lungomare · Locazione Turistica</p>
          <p className="text-white/70">
            CIN IT084001B4D36830 · CIR 190840010022
          </p>
        </div>
      </footer>
    </main>
  );
}
