import React, { useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Waves,
  Home,
  Camera,
  ExternalLink,
  Utensils,
  ShieldCheck,
  MessageCircle,
  BedDouble,
  Bath,
  CalendarCheck,
  Euro,
  SearchCheck,
  Send,
  Landmark,
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
    description: "Lo scorcio mare reale viene usato come protagonista della home.",
    image: "/images/vista-mare-gelone.jpg",
  },
  {
    title: "Terrazza esterna",
    description: "La terrazza reale viene integrata nel layout come richiamo visivo mediterraneo.",
    image: "/images/terrazza-gelone.jpg",
  },
  {
    title: "Interni",
    description: "Soluzione riservata per 2 persone, con camera, bagno e cucina.",
    image: "/images/interni-gelone.jpg",
  },
];

const features = [
  { icon: Home, title: "2 persone", text: "Ideale per coppie o soggiorni brevi." },
  { icon: BedDouble, title: "1 camera", text: "Ambiente riservato e confortevole." },
  { icon: Bath, title: "1 bagno", text: "Bagno privato con servizi essenziali." },
  { icon: Utensils, title: "Cucina", text: "Maggiore autonomia durante il soggiorno." },
];

function LogoBadge({ dark = false }) {
  return (
    <div
      className={`flex items-center gap-3 ${dark ? "text-white" : "text-[#0a1d35]"}`}
    >
      <div
        className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${
          dark
            ? "border-white/50 bg-white/15 text-white"
            : "border-[#d8b66c] bg-[#fffaf0] text-[#0a1d35]"
        } shadow-lg backdrop-blur`}
      >
        <div className="absolute inset-1 rounded-full border border-[#d8b66c]/70" />
        <span className="text-3xl">⛵</span>
      </div>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.34em] ${dark ? "text-[#f5d58b]" : "text-[#9b6b25]"}`}>
          Locazione turistica
        </p>
        <p className="font-serif text-2xl tracking-[0.22em]">GELONE</p>
        <p className="text-xs font-semibold tracking-[0.44em]">LUNGOMARE</p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
        <LogoBadge dark />
        <nav className="hidden items-center gap-7 rounded-full border border-white/20 bg-black/20 px-6 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur md:flex">
          <a href="#foto" className="hover:text-[#f5d58b]">Foto</a>
          <a href="#alloggio" className="hover:text-[#f5d58b]">Alloggio</a>
          <a href="#disponibilita" className="hover:text-[#f5d58b]">Disponibilità</a>
          <a href="#contatti" className="hover:text-[#f5d58b]">Contatti</a>
        </nav>
        <a
          href="#disponibilita"
          className="rounded-full border border-[#f5d58b] bg-[#f5c84b] px-5 py-3 text-sm font-extrabold text-[#0a1d35] shadow-xl transition hover:bg-[#ffe083]"
        >
          Prenota diretto
        </a>
      </div>
    </header>
  );
}

function PortalButton({ href, label, tone = "dark", children }) {
  const styles = {
    dark: "border-[#f5d58b] bg-[#0a1d35] text-white hover:bg-[#132f52]",
    light: "border-white/70 bg-white/90 text-[#0a1d35] hover:bg-white",
    blue: "border-[#d6e3ff] bg-white text-[#174ea6] hover:bg-[#eef5ff]",
    red: "border-[#ffd7df] bg-white text-[#ff385c] hover:bg-[#fff1f4]",
    green: "border-[#cdebd5] bg-white text-[#168a3a] hover:bg-[#effaf2]",
  };

  return (
    <a
      href={href}
      target={href.startsWith("#") ? undefined : "_blank"}
      rel={href.startsWith("#") ? undefined : "noreferrer"}
      className={`group inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full border px-6 py-4 text-center font-extrabold shadow-lg transition hover:-translate-y-0.5 ${styles[tone]}`}
    >
      {children}
      <span>{label}</span>
      <ExternalLink className={href.startsWith("#") ? "hidden" : ""} size={17} />
    </a>
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
      if (!response.ok) {
        throw new Error(data?.message || "Non è stato possibile verificare la disponibilità.");
      }
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
      if (!response.ok) {
        throw new Error(data?.message || "Non è stato possibile bloccare le date.");
      }

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
    <form
      onSubmit={handleCheckAvailability}
      className="rounded-[2rem] border border-[#e8dcc4] bg-white p-5 shadow-xl md:p-7"
    >
      <div className="mb-5 rounded-[1.5rem] border border-[#f5c84b] bg-[#fff7d6] p-4">
        <div className="flex items-start gap-3">
          <Euro className="mt-1 text-[#9b6b25]" size={22} />
          <div>
            <p className="font-extrabold text-[#0a1d35]">Canale diretto Gelone</p>
            <p className="mt-1 text-sm leading-6 text-[#555]">
              Verifica la disponibilità e blocca le date dal sito ufficiale.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Arrivo</span>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#fffaf0] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Partenza</span>
          <input
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#fffaf0] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Ospiti</span>
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
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-extrabold text-white shadow-lg transition hover:bg-[#132f52] disabled:cursor-not-allowed disabled:opacity-60"
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
            {result.message || "La verifica è stata completata. Per conferma definitiva contattaci prima di prenotare."}
          </p>
        </div>
      )}

      {canShowBookingForm && (
        <div className="mt-6 rounded-[1.5rem] border border-[#d7c49f] bg-[#fffaf0] p-5">
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
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Telefono / WhatsApp</span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="Es. 347..."
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Email</span>
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">Note</span>
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
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#b88a2b] px-7 py-4 font-extrabold text-white shadow-lg transition hover:bg-[#9b6b25] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {booking ? "Blocco date in corso..." : "Blocca date e invia richiesta"}
              <Send size={20} />
            </button>

            <a
              href={whatsappWithDates}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white px-7 py-4 font-bold text-[#0a1d35] transition hover:bg-[#fff7e6]"
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
            Le date sono state bloccate nel sistema Gelone Lungomare in attesa della conferma finale.
          </p>
          <p className="mt-2 text-sm">Codice richiesta: <strong>{bookingResult.bookingId}</strong></p>
        </div>
      )}
    </form>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#9b6b25]">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-4xl text-[#0a1d35] md:text-5xl">{title}</h2>
      {text && <p className="mt-5 text-lg leading-8 text-[#555]">{text}</p>}
    </div>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#fffaf0] text-[#0a1d35]">
      <Header />

      <section id="home" className="relative min-h-screen overflow-hidden bg-[#0a1d35]">
        <img
          src="/images/vista-mare-gelone.jpg"
          alt="Vista mare reale Gelone Lungomare"
          className="absolute inset-0 h-full w-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,29,53,0.92)_0%,rgba(10,29,53,0.66)_42%,rgba(10,29,53,0.12)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(245,200,75,0.18),transparent_28%),radial-gradient(circle_at_18%_84%,rgba(255,250,240,0.14),transparent_26%)]" />

        <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-end gap-10 px-5 pb-10 pt-32 lg:grid-cols-[0.95fr_1.05fr] lg:pb-16 lg:pt-40">
          <div className="pb-4 text-white">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur">
              <Camera size={18} />
              Mare in primo piano · Terrazza reale integrata
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.42em] text-[#f5d58b]">
              Sito ufficiale
            </p>
            <h1 className="mt-4 font-serif text-6xl leading-[0.95] tracking-tight md:text-8xl">
              Gelone
              <span className="block text-[#f5d58b]">Lungomare</span>
            </h1>

            <div className="my-7 h-px w-44 bg-[#f5d58b]" />

            <p className="max-w-xl text-xl leading-9 text-white/88">
              Locazione turistica a Gela per 2 persone, con terrazza esterna,
              cucina e scorcio vista mare. Una pagina più elegante, simile al
              mockup, ma costruita con le tue foto reali.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PortalButton href="#disponibilita" label="Prenota dal sito" tone="dark">
                <CalendarCheck size={20} />
              </PortalButton>
              <PortalButton href={directWhatsappUrl} label="WhatsApp" tone="light">
                <MessageCircle size={20} />
              </PortalButton>
            </div>
          </div>

          <div className="relative hidden min-h-[630px] lg:block">
            <div className="absolute right-0 top-0 h-[570px] w-[78%] overflow-hidden rounded-[2.4rem] border border-white/25 bg-white/10 p-3 shadow-2xl backdrop-blur">
              <img
                src="/images/terrazza-gelone.jpg"
                alt="Terrazza reale Gelone Lungomare"
                className="h-full w-full rounded-[1.9rem] object-cover"
              />
              <div className="absolute inset-3 rounded-[1.9rem] bg-gradient-to-t from-[#0a1d35]/70 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 rounded-[1.5rem] border border-white/25 bg-white/88 p-5 text-[#0a1d35] shadow-xl backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#9b6b25]">
                  Terrazza mediterranea
                </p>
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  La foto reale della terrazza viene usata come richiamo di stile,
                  mentre il mare resta protagonista nello sfondo.
                </p>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-[58%] rounded-[2rem] border border-[#f5d58b]/60 bg-[#fffaf0] p-5 shadow-2xl">
              <LogoBadge />
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <strong className="block text-xl">2</strong>
                  ospiti
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <strong className="block text-xl">1</strong>
                  camera
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <strong className="block text-xl">1</strong>
                  bagno
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <strong className="block text-xl">1</strong>
                  cucina
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-12 px-5">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-[#eadfca] bg-white p-4 shadow-2xl md:grid-cols-3">
          <PortalButton href="#disponibilita" label="Sito ufficiale" tone="dark">
            <CalendarCheck size={20} />
          </PortalButton>
          <PortalButton href={bookingUrl} label="Booking.com" tone="blue">
            <Landmark size={20} />
          </PortalButton>
          <PortalButton href={airbnbUrl} label="Airbnb" tone="red">
            <Home size={20} />
          </PortalButton>
        </div>
      </section>

      <section id="alloggio" className="mx-auto max-w-7xl px-5 py-20">
        <SectionTitle
          eyebrow="L'esperienza"
          title="Elegante come il mockup, ma fedele alla struttura reale"
          text="Il mare resta protagonista, la terrazza viene integrata come elemento di atmosfera, e la prenotazione diretta rimane centrale."
        />

        <div className="grid gap-6 md:grid-cols-4">
          {features.map((item) => (
            <article key={item.title} className="rounded-[1.7rem] border border-[#eadfca] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex h-13 w-13 items-center justify-center rounded-full bg-[#fff3d2] text-[#9b6b25]">
                <item.icon size={26} />
              </div>
              <h3 className="mt-5 text-xl font-bold">{item.title}</h3>
              <p className="mt-3 leading-7 text-[#555]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="foto" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5">
          <SectionTitle
            eyebrow="Galleria"
            title="Foto reali, presentate meglio"
            text="La grafica valorizza le immagini senza sostituirle con ambienti inventati."
          />

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="overflow-hidden rounded-[2rem] border border-[#eadfca] bg-[#fffaf0] shadow-xl">
              <img src="/images/vista-mare-gelone.jpg" alt="Vista mare" className="h-[520px] w-full object-cover" />
              <div className="p-6">
                <h3 className="font-serif text-3xl">Vista mare</h3>
                <p className="mt-2 leading-7 text-[#555]">Mare in primo piano, come richiesto, ma usando la foto reale caricata nel progetto.</p>
              </div>
            </div>

            <div className="grid gap-6">
              {gallery.slice(1).map((item) => (
                <article key={item.title} className="overflow-hidden rounded-[2rem] border border-[#eadfca] bg-[#fffaf0] shadow-sm">
                  <img src={item.image} alt={item.title} className="h-56 w-full object-cover" />
                  <div className="p-5">
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#555]">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="disponibilita" className="mx-auto max-w-7xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#9b6b25]">
              Disponibilità
            </p>
            <h2 className="mt-3 font-serif text-5xl leading-tight text-[#0a1d35]">
              Verifica le date dal sito ufficiale
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#555]">
              Se le date sono libere puoi inviare una richiesta diretta. Le date
              vengono bloccate nel sistema interno in attesa della conferma finale.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#eadfca] bg-white p-5 shadow-sm">
                <ShieldCheck className="text-[#b88a2b]" />
                <p className="mt-3 font-bold">Richiesta diretta</p>
                <p className="mt-2 text-sm leading-6 text-[#555]">Parli direttamente con la struttura.</p>
              </div>
              <div className="rounded-2xl border border-[#eadfca] bg-white p-5 shadow-sm">
                <Waves className="text-[#b88a2b]" />
                <p className="mt-3 font-bold">Soggiorno vicino al mare</p>
                <p className="mt-2 text-sm leading-6 text-[#555]">Posizione comoda a Gela.</p>
              </div>
            </div>
          </div>

          <AvailabilityForm />
        </div>
      </section>

      <section id="contatti" className="bg-[#0a1d35] py-20 text-white">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <LogoBadge dark />
              <p className="mt-6 max-w-md leading-8 text-white/75">
                Locazione turistica a Gela, vicino al lungomare. Contatti diretti
                per informazioni e prenotazioni.
              </p>
              <div className="mt-6 space-y-2 text-sm text-white/75">
                <p><strong className="text-white">CIN:</strong> IT084001B4D36830</p>
                <p><strong className="text-white">CIR:</strong> 190840010022</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <a href="tel:+393476308456" className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
                <Phone className="text-[#f5d58b]" />
                <p className="mt-3 font-bold">3476308456</p>
              </a>
              <a href="tel:+393479461999" className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
                <Phone className="text-[#f5d58b]" />
                <p className="mt-3 font-bold">3479461999</p>
              </a>
              <a href="mailto:info@gelone.it" className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
                <Mail className="text-[#f5d58b]" />
                <p className="mt-3 font-bold">info@gelone.it</p>
              </a>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
                <MapPin className="text-[#f5d58b]" />
                <p className="mt-3 font-bold">Via Pascoli 1, Gela</p>
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#061526] px-5 py-7 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <p>Gelone Lungomare · Locazione Turistica</p>
          <p className="text-white/60">CIN IT084001B4D36830 · CIR 190840010022</p>
        </div>
      </footer>
    </main>
  );
}
