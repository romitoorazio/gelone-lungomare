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
  Info,
  MessageCircle,
  BedDouble,
  Bath,
  Landmark,
  CalendarCheck,
  ClipboardList,
  Euro,
  SearchCheck,
  Send,
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
    title: "Terrazza esterna",
    description:
      "Uno spazio all'aperto dove rilassarsi, fare colazione o godersi l'atmosfera del lungomare.",
    image: "/images/terrazza-gelone.jpg",
  },
  {
    title: "Vista mare",
    description:
      "Una posizione comoda, vicina al mare e ai principali servizi della città.",
    image: "/images/vista-mare-gelone.jpg",
  },
  {
    title: "Camera, bagno e cucina",
    description:
      "Soluzione riservata per 2 persone, con camera da letto, bagno e cucina.",
    image: "/images/interni-gelone.jpg",
  },
];

const features = [
  {
    icon: Home,
    title: "Per 2 persone",
    text: "Ideale per coppie, viaggiatori singoli o soggiorni brevi a Gela.",
  },
  {
    icon: BedDouble,
    title: "1 camera da letto",
    text: "Ambiente riservato e confortevole per il riposo.",
  },
  {
    icon: Bath,
    title: "1 bagno",
    text: "Bagno privato con i servizi essenziali per il soggiorno.",
  },
  {
    icon: Utensils,
    title: "Cucina",
    text: "Cucina disponibile per vivere il soggiorno con maggiore autonomia.",
  },
];

const directBenefits = [
  {
    icon: Euro,
    title: "Miglior prezzo diretto",
    text: "Prenotando dal sito ufficiale puoi ricevere condizioni dedicate rispetto ai portali.",
  },
  {
    icon: MessageCircle,
    title: "Contatto diretto",
    text: "Parli direttamente con la struttura, senza passaggi inutili e senza attese.",
  },
  {
    icon: ShieldCheck,
    title: "Date bloccate subito",
    text: "Se le date sono libere, la richiesta blocca il periodo in attesa della conferma finale.",
  },
];

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-[#e4d8c2] bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#f4ead7] text-[#9b6b25]">
        <Icon size={22} />
      </div>
      <h3 className="text-lg font-semibold text-[#0a1d35]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#5c5c5c]">{text}</p>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-[#e4d8c2] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0a1d35] text-white">
        <Icon size={22} />
      </div>
      <h3 className="text-xl font-bold text-[#0a1d35]">{title}</h3>
      <p className="mt-2 leading-7 text-[#555]">{text}</p>
    </div>
  );
}

function GeloneWordmark({ compact = false }) {
  return (
    <span
      className={`inline-flex shrink-0 flex-col items-center justify-center rounded-2xl border border-[#d8b66c] bg-[#0a1d35] text-white shadow-sm ${
        compact ? "h-10 w-10" : "h-14 w-14"
      }`}
      aria-hidden="true"
    >
      <span className={compact ? "font-serif text-lg leading-none" : "font-serif text-2xl leading-none"}>
        G
      </span>
      {!compact && (
        <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.18em] text-[#f5c84b]">
          Mare
        </span>
      )}
    </span>
  );
}

function DirectBookingButton({ compact = false }) {
  return (
    <a
      href="#verifica-disponibilita"
      className={`group inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full border-2 border-[#0a1d35] bg-[#f5c84b] text-center font-extrabold text-[#0a1d35] shadow-xl shadow-[#d8b66c]/20 transition hover:-translate-y-0.5 hover:bg-[#ffd96a] hover:shadow-2xl ${
        compact ? "px-4 py-3 text-sm" : "px-6 py-4"
      }`}
    >
      <GeloneWordmark compact={compact} />
      <span className="flex flex-col items-start leading-tight">
        <span>{compact ? "Sito ufficiale" : "Prenota diretto e risparmia"}</span>
        {!compact && (
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#5e471a]">
            Canale consigliato Gelone
          </span>
        )}
      </span>
      {!compact && <CalendarCheck size={18} />}
    </a>
  );
}

function BookingButton({ compact = false }) {
  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full border border-[#d6e3ff] bg-white text-center font-extrabold text-[#174ea6] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eef5ff] ${
        compact ? "px-4 py-3 text-sm" : "px-6 py-4"
      }`}
    >
      <span className="font-sans text-base font-black tracking-tight">
        Booking<span className="text-[#003b95]">.com</span>
      </span>
      {!compact && <ExternalLink size={18} />}
    </a>
  );
}

function AirbnbButton({ compact = false }) {
  return (
    <a
      href={airbnbUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full border border-[#ffd7df] bg-white text-center font-extrabold text-[#ff385c] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff1f4] ${
        compact ? "px-4 py-3 text-sm" : "px-6 py-4"
      }`}
    >
      <span className="font-sans text-base font-black tracking-tight">Airbnb</span>
      {!compact && <ExternalLink size={18} />}
    </a>
  );
}

function WhatsAppButton({ compact = false, direct = false }) {
  return (
    <a
      href={direct ? directWhatsappUrl : whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white text-center font-bold text-[#0a1d35] transition hover:bg-[#faf6ee] ${
        compact ? "px-4 py-3 text-sm" : "px-7 py-4"
      }`}
    >
      {compact ? "WhatsApp" : "Scrivici su WhatsApp"}
      {!compact && <MessageCircle size={18} />}
    </a>
  );
}

function MapsButton() {
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#b88416] bg-[#f5c84b] px-7 py-4 text-center font-extrabold text-[#0a1d35] shadow-md transition hover:bg-[#ffd96a]"
    >
      Apri Google Maps <ExternalLink size={18} />
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
        body: JSON.stringify({
          checkIn,
          checkOut,
        }),
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
      className="rounded-[2rem] border border-[#d7c49f] bg-white p-6 shadow-sm md:p-8"
    >
      <div className="mb-6 rounded-[1.5rem] border border-[#f5c84b] bg-[#fff7d6] p-5">
        <div className="flex items-start gap-3">
          <Euro className="mt-1 text-[#9b6b25]" size={24} />
          <div>
            <p className="font-extrabold text-[#0a1d35]">
              Canale diretto Gelone
            </p>
            <p className="mt-1 text-sm leading-6 text-[#555]">
              È il percorso consigliato: controlli la disponibilità, blocchi le
              date e ricevi conferma diretta dalla struttura, senza passare
              subito dai portali.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
            Data arrivo
          </span>
          <input
            type="date"
            min={today}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
            Data partenza
          </span>
          <input
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={checking || booking}
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border-2 border-[#0a1d35] bg-[#f5c84b] px-7 py-4 text-base font-extrabold text-[#0a1d35] shadow-lg transition hover:bg-[#ffd96a] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:text-lg"
      >
        {checking
          ? "Controllo in corso..."
          : "Verifica disponibilità e prezzo diretto"}
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
        <div className="mt-6 rounded-[1.5rem] border border-[#d7c49f] bg-[#faf6ee] p-5">
          <h3 className="text-xl font-bold text-[#0a1d35]">
            Blocca le date dal sito ufficiale
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#555]">
            Compila i dati. Le date verranno bloccate nel sistema interno in
            attesa della conferma finale della struttura. Riceverai risposta su
            telefono, WhatsApp o email.
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

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#0a1d35]">
                Numero ospiti
              </span>
              <select
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
                className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 text-[#0a1d35] outline-none focus:border-[#9b6b25]"
              >
                <option value="1">1 ospite</option>
                <option value="2">2 ospiti</option>
              </select>
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
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border-2 border-[#0a1d35] bg-[#0a1d35] px-7 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#132f52] disabled:cursor-not-allowed disabled:opacity-60"
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
              Scrivi su WhatsApp <MessageCircle size={20} />
            </a>
          </div>
        </div>
      )}

      {bookingResult && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
          <p className="text-lg font-bold">Richiesta inviata correttamente.</p>
          <p className="mt-2 leading-7">
            Le date sono state bloccate nel sistema Gelone Lungomare in attesa
            della conferma finale della struttura. Ti contatteremo a breve.
          </p>
          <p className="mt-2 text-sm">
            Codice richiesta: <strong>{bookingResult.bookingId}</strong>
          </p>
        </div>
      )}

      <p className="mt-5 text-sm leading-6 text-[#555]">
        La verifica serve a controllare se Gelone Lungomare risulta libera. Dopo
        l'invio della richiesta, le date vengono bloccate nel sistema interno in
        attesa della conferma finale della struttura.
      </p>
    </form>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#faf6ee] text-[#0a1d35]">
      <header className="sticky top-0 z-40 border-b border-[#e4d8c2] bg-[#faf6ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <a href="#home" className="block shrink-0">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#9b6b25]">
              Locazione turistica
            </p>
            <h1 className="font-serif text-2xl tracking-[0.18em]">GELONE</h1>
            <p className="text-xs tracking-[0.45em]">LUNGOMARE</p>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#appartamento" className="hover:text-[#9b6b25]">
              Appartamento
            </a>
            <a href="#foto" className="hover:text-[#9b6b25]">
              Foto
            </a>
            <a href="#posizione" className="hover:text-[#9b6b25]">
              Dove siamo
            </a>
            <a href="#verifica-disponibilita" className="hover:text-[#9b6b25]">
              Disponibilità
            </a>
            <a href="#contatti" className="hover:text-[#9b6b25]">
              Contatti
            </a>
          </nav>

          <DirectBookingButton compact />
        </div>
      </header>

      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#e6cf9a,transparent_35%),radial-gradient(circle_at_bottom_right,#d8e9ef,transparent_30%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#d7c49f] bg-white/70 px-4 py-2 text-sm text-[#6d552d]">
              <Waves size={18} />
              A Gela, vicino al lungomare
            </div>

            <h2 className="font-serif text-5xl leading-tight tracking-tight md:text-7xl">
              Gelone <span className="block text-[#9b6b25]">Lungomare</span>
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4c4c4c]">
              Locazione turistica a Gela con terrazza e vista mare. Una
              soluzione comoda e riservata per 2 persone, ideale per coppie o
              viaggiatori che cercano tranquillità, posizione e praticità.
            </p>

            <div className="mt-6 max-w-xl overflow-hidden rounded-[1.75rem] border border-[#d8b66c] bg-white/90 shadow-lg">
              <div className="border-b border-[#f0e4c8] bg-[#0a1d35] px-5 py-3 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f5c84b]">
                  Sito ufficiale Gelone Lungomare
                </p>
              </div>
              <div className="flex gap-4 p-5">
                <GeloneWordmark />
                <div>
                  <h3 className="text-2xl font-extrabold text-[#0a1d35]">
                    Prenota diretto e risparmia
                  </h3>
                  <p className="mt-2 leading-7 text-[#555]">
                    Controlli le date dal sito ufficiale, blocchi la richiesta e
                    parli direttamente con la struttura. Booking e Airbnb
                    restano disponibili come canali secondari.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <DirectBookingButton />
              <WhatsAppButton direct />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <BookingButton />
              <AirbnbButton />
            </div>

            <div className="mt-5 grid max-w-xl gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl border-2 border-[#f5c84b] bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9b6b25]">
                  Consigliato
                </p>
                <p className="mt-1 font-extrabold text-[#0a1d35]">
                  Sito ufficiale
                </p>
              </div>
              <div className="rounded-2xl border border-[#d6e3ff] bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#174ea6]">
                  Portale
                </p>
                <p className="mt-1 font-extrabold text-[#174ea6]">
                  Booking.com
                </p>
              </div>
              <div className="rounded-2xl border border-[#ffd7df] bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff385c]">
                  Portale
                </p>
                <p className="mt-1 font-extrabold text-[#ff385c]">
                  Airbnb
                </p>
              </div>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 text-sm text-[#4c4c4c] sm:grid-cols-4">
              <div className="rounded-2xl border border-[#e4d8c2] bg-white/70 p-4">
                <strong className="block text-[#0a1d35]">2</strong>
                persone
              </div>
              <div className="rounded-2xl border border-[#e4d8c2] bg-white/70 p-4">
                <strong className="block text-[#0a1d35]">1</strong>
                camera
              </div>
              <div className="rounded-2xl border border-[#e4d8c2] bg-white/70 p-4">
                <strong className="block text-[#0a1d35]">1</strong>
                bagno
              </div>
              <div className="rounded-2xl border border-[#e4d8c2] bg-white/70 p-4">
                <strong className="block text-[#0a1d35]">1</strong>
                cucina
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7c49f] bg-white p-3 shadow-xl">
            <div className="relative flex min-h-[480px] items-end overflow-hidden rounded-[1.5rem] p-6">
              <img
                src="/images/terrazza-gelone.jpg"
                alt="Terrazza esterna Gelone Lungomare"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

              <div className="relative rounded-2xl bg-white/90 p-6 shadow-lg backdrop-blur">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Soggiorno per 2 persone
                </p>
                <h3 className="mt-2 font-serif text-3xl">
                  Terrazza, mare e comfort
                </h3>
                <p className="mt-3 max-w-md leading-7 text-[#555]">
                  Uno spazio esterno da vivere, vicino al lungomare di Gela e ai
                  principali servizi della città.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="appartamento" className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-6 md:grid-cols-4">
          {features.map((item) => (
            <Feature
              key={item.title}
              icon={item.icon}
              title={item.title}
              text={item.text}
            />
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
              L'appartamento
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              Comodo, riservato, vicino al lungomare
            </h2>
          </div>

          <div className="text-lg leading-8 text-[#555]">
            <p>
              Gelone Lungomare è una locazione turistica pensata per ospitare
              fino a 2 persone. Dispone di una camera da letto, un bagno, una
              cucina e una terrazza esterna che rende il soggiorno più
              piacevole.
            </p>
            <p className="mt-5">
              È una scelta adatta per chi vuole vivere Gela con una posizione
              pratica, vicina al mare e ai principali servizi della città.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
            Prenotazione diretta
          </p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">
            Il modo più semplice per prenotare
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#555]">
            Dal sito ufficiale controlli subito le date e invii la richiesta
            direttamente alla struttura. Dopo la conferma riceverai le istruzioni
            per il check-in online.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {directBenefits.map((item) => (
            <BenefitCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              text={item.text}
            />
          ))}
        </div>
      </section>

      <section id="foto" className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
              Foto
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              Gli spazi di Gelone Lungomare
            </h2>
          </div>
          <Camera className="hidden text-[#9b6b25] md:block" size={44} />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {gallery.map((item) => (
            <article
              key={item.title}
              className="overflow-hidden rounded-2xl border border-[#e4d8c2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-72 w-full object-cover"
              />
              <div className="p-5">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 leading-6 text-[#5c5c5c]">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="posizione" className="bg-[#0a1d35] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#d8b66c]">
              Dove siamo
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              A Gela, vicino al lungomare
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/75">
              Una posizione comoda per raggiungere il mare, il centro cittadino,
              bar, ristoranti e servizi principali.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-6">
            <div className="flex items-start gap-4">
              <MapPin className="mt-1 text-[#d8b66c]" />
              <div>
                <h3 className="text-2xl font-semibold">Via Pascoli 1, Gela</h3>
                <p className="mt-2 text-white/75">
                  Provincia di Caltanissetta, Sicilia
                </p>
                <div className="mt-6">
                  <MapsButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="verifica-disponibilita"
        className="mx-auto max-w-7xl px-5 py-16"
      >
        <div className="mb-8 max-w-3xl">
          <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
            Disponibilità
          </p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">
            Prenota diretto dal sito ufficiale
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#555]">
            Inserisci le date e il sito controllerà la disponibilità tramite il
            sistema interno Gelone. Se le date sono libere, puoi inviare la
            richiesta e bloccarle in attesa della conferma finale.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_0.8fr]">
          <AvailabilityForm />

          <div className="grid gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <CalendarCheck className="text-[#9b6b25]" size={30} />
              <h3 className="mt-3 text-xl font-semibold">
                1. Controllo date
              </h3>
              <p className="mt-2 leading-7 text-[#555]">
                Il sito invia le date al sistema interno di Gelone Lungomare.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <ClipboardList className="text-[#9b6b25]" size={30} />
              <h3 className="mt-3 text-xl font-semibold">
                2. Blocco richiesta
              </h3>
              <p className="mt-2 leading-7 text-[#555]">
                Se le date sono libere, puoi inviare la richiesta e bloccarle
                temporaneamente.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <ShieldCheck className="text-[#9b6b25]" size={30} />
              <h3 className="mt-3 text-xl font-semibold">
                3. Conferma diretta
              </h3>
              <p className="mt-2 leading-7 text-[#555]">
                Riceverai conferma dalla struttura e il link per completare il
                check-in online.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e4d8c2] bg-[#fff7d6] p-5 shadow-sm">
              <Info className="text-[#9b6b25]" size={30} />
              <h3 className="mt-3 text-xl font-semibold">
                Preferisci i portali?
              </h3>
              <p className="mt-2 leading-7 text-[#555]">
                Puoi prenotare anche da Booking o Airbnb. Per il miglior contatto
                con la struttura, consigliamo comunque il sito ufficiale.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <BookingButton compact />
                <AirbnbButton compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contatti" className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
              Contatti
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              Hai dubbi prima di prenotare?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#555]">
              Scrivici o chiamaci per informazioni su disponibilità, arrivo,
              servizi e check-in.
            </p>
          </div>

          <div className="grid gap-4">
            <a
              href="tel:+393476308456"
              className="flex items-center gap-4 rounded-2xl border border-[#e4d8c2] bg-[#faf6ee] p-5 font-semibold"
            >
              <Phone className="text-[#9b6b25]" /> 347 630 8456
            </a>

            <a
              href="tel:+393479461999"
              className="flex items-center gap-4 rounded-2xl border border-[#e4d8c2] bg-[#faf6ee] p-5 font-semibold"
            >
              <Phone className="text-[#9b6b25]" /> 347 946 1999
            </a>

            <a
              href="mailto:info@gelone.it"
              className="flex items-center gap-4 rounded-2xl border border-[#e4d8c2] bg-[#faf6ee] p-5 font-semibold"
            >
              <Mail className="text-[#9b6b25]" /> info@gelone.it
            </a>

            <div className="flex flex-col gap-3 sm:flex-row">
              <DirectBookingButton />
              <WhatsAppButton />
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto max-w-7xl px-5 py-16">
        <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <Landmark className="mt-1 text-[#9b6b25]" size={30} />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Informazioni
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                Locazione turistica Gelone Lungomare
              </h2>
              <div className="mt-5 space-y-3 leading-7 text-[#555]">
                <p>
                  Gelone Lungomare è una locazione turistica a Gela per soggiorni
                  brevi. I dati inseriti nel modulo vengono usati solo per
                  gestire la richiesta di disponibilità e prenotazione.
                </p>
                <p>
                  Dopo la conferma della prenotazione, potrà essere richiesto
                  all'ospite di completare il check-in online per gli adempimenti
                  previsti dalla normativa.
                </p>
                <p>
                  CIN: <strong>IT084001B4D36830</strong> · CIR:{" "}
                  <strong>190840010022</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e4d8c2] bg-[#0a1d35] px-5 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-serif text-2xl">Gelone Lungomare</p>
            <p className="mt-2 text-sm text-white/70">
              Locazione turistica · Gela · Via Pascoli 1
            </p>
            <p className="mt-2 text-xs text-white/60">
              CIN IT084001B4D36830 · CIR 190840010022
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@gelone.it"
              className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              info@gelone.it
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              WhatsApp
            </a>
            <a
              href="/ospiti.html"
              className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Area ospiti
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
