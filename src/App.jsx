import React, { useState } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Camera,
  Car,
  ChefHat,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  ExternalLink,
  Heart,
  Home,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Train,
  Umbrella,
  Users, Waves,
} from "lucide-react";

const bookingUrl = "https://www.booking.com/hotel/it/gelone-lungomare.it.html";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const mapsUrl = "https://maps.app.goo.gl/JwYWW3RqFz5VdtCu6";
const whatsappUrl =
  "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const colors = {
  navy: "#071b35",
  gold: "#b88a22",
  cream: "#fbf6ea",
  line: "#e5d7ba",
};

const gallery = [
  "/images/terrazza-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
  "/images/interni-gelone.jpg",
  "/images/terrazza-gelone.jpg",
  "/images/vista-mare-gelone.jpg",
];

function LogoBlock({ small = false }) {
  return (
    <div className={`flex items-center gap-3 ${small ? "scale-90 origin-left" : ""}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#071b35] p-2 shadow-sm md:h-16 md:w-16">
        <img src="/favicon.svg" alt="Gelone Lungomare" className="h-full w-full object-contain" />
      </div>
      <div className="leading-none">
        <div className="font-serif text-[28px] tracking-[0.34em] text-[#071b35] md:text-[36px]">
          GELONE
        </div>
        <div className="mt-2 text-[14px] font-semibold tracking-[0.78em] text-[#071b35] md:text-[17px]">
          LUNGOMARE
        </div>
        <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.42em] text-[#071b35]">
          Locazione turistica
        </div>
      </div>
    </div>
  );
}

function Ornament() {
  return (
    <div className="mx-auto mt-2 flex w-40 items-center justify-center gap-2 md:mx-0">
      <span className="h-px flex-1 bg-[#c4a35b]" />
      <span className="h-2 w-2 rotate-45 bg-[#b88a22]" />
      <span className="h-px flex-1 bg-[#c4a35b]" />
    </div>
  );
}

function HeroImage() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src="/images/vista-mare-gelone.jpg"
        alt="Vista mare Gelone Lungomare"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <img
        src="/images/terrazza-gelone.jpg"
        alt="Terrazza Gelone Lungomare"
        className="absolute right-0 top-0 h-full w-[58%] object-cover [mask-image:linear-gradient(to_right,transparent_0%,black_24%,black_100%)]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#fbf6ea]/98 via-[#fbf6ea]/73 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf6ea] to-transparent" />
    </div>
  );
}

function BookingCard({ type, title, subtitle, href }) {
  const isDirect = type === "direct";
  const icon =
    type === "direct" ? (
      <img src="/favicon.svg" alt="Gelone" className="h-10 w-10" />
    ) : type === "booking" ? (
      <span className="text-5xl font-black text-[#003b95]">B.</span>
    ) : type === "airbnb" ? (
      <span className="text-5xl font-light text-[#ff385c]">âŒ‚</span>
    ) : (
      <MessageCircle className="text-[#25d366]" size={42} />
    );

  return (
    <a
      href={href}
      target={href.startsWith("#") ? undefined : "_blank"}
      rel={href.startsWith("#") ? undefined : "noreferrer"}
      className={`flex h-[86px] items-center gap-5 rounded-lg border p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
        isDirect
          ? "border-[#c1973a] bg-[#071b35] text-white"
          : "border-[#d8caa9] bg-white/95 text-[#071b35]"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center">{icon}</div>
      <div>
        <div className={`font-serif text-[20px] font-bold tracking-wide ${isDirect ? "text-white" : "text-[#071b35]"}`}>
          {title}
        </div>
        {subtitle && (
          <div className={`mt-1 text-[12px] font-bold uppercase tracking-[0.18em] ${isDirect ? "text-[#f2c35d]" : "text-[#071b35]/70"}`}>
            {subtitle}
          </div>
        )}
      </div>
    </a>
  );
}

function Amenity({ icon: Icon, label }) {
  return (
    <div className="flex min-h-[70px] flex-1 items-center justify-center gap-3 border-r border-[#e5d7ba] px-4 last:border-r-0">
      <Icon size={30} className="text-[#b88a22]" strokeWidth={1.5} />
      <span className="text-center text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#071b35]">
        {label}
      </span>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }) {
  return (
    <article className="rounded-lg border border-[#e5d7ba] bg-white/60 p-6 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#e6d9bd] bg-[#fbf6ea] text-[#b88a22] shadow-inner">
        <Icon size={30} strokeWidth={1.7} />
      </div>
      <h3 className="mt-4 whitespace-pre-line font-serif text-[18px] font-bold uppercase leading-tight tracking-[0.08em] text-[#071b35]">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-6 text-[#071b35]">{text}</p>
    </article>
  );
}

async function readJsonResponse(response) {
  const responseText = await response.text();
  try {
    return responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error("Errore tecnico del server. Riprova piÃ¹ tardi oppure contattaci su WhatsApp.");
  }
}

function AvailabilityForm() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
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
    if (dateError) return setError(dateError);
    try {
      setChecking(true);
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data?.message || "Non Ã¨ stato possibile verificare la disponibilitÃ .");
      setResult(data);
    } catch (err) {
      setError(err?.message || "Errore durante il controllo disponibilitÃ . Puoi contattarci su WhatsApp.");
    } finally {
      setChecking(false);
    }
  }

  async function handleCreateBooking() {
    setError("");
    setBookingResult(null);
    const dateError = validateDates();
    if (dateError) return setError(dateError);
    if (!guestName.trim()) return setError("Inserisci nome e cognome.");
    if (!guestPhone.trim() && !guestEmail.trim()) return setError("Inserisci almeno telefono o email.");
    try {
      setBooking(true);
      const response = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName, guestPhone, guestEmail, guests: Number(guests), checkIn, checkOut, notes }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data?.message || "Non Ã¨ stato possibile bloccare le date.");
      setBookingResult(data);
      setResult({ ok: true, available: false, message: "Le date sono state bloccate nel sistema Gelone Lungomare in attesa di conferma." });
    } catch (err) {
      setError(err?.message || "Errore durante il blocco date. Puoi contattarci su WhatsApp.");
    } finally {
      setBooking(false);
    }
  }

  const canShowBookingForm = result?.available === true && !bookingResult;

  return (
    <form onSubmit={handleCheckAvailability}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block rounded-lg border border-[#e3d2ad] bg-white/80 p-4">
          <span className="block text-xs font-bold text-[#071b35]">Check-in</span>
          <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-2 w-full bg-transparent text-sm text-[#071b35] outline-none" />
        </label>
        <label className="block rounded-lg border border-[#e3d2ad] bg-white/80 p-4">
          <span className="block text-xs font-bold text-[#071b35]">Check-out</span>
          <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-2 w-full bg-transparent text-sm text-[#071b35] outline-none" />
        </label>
        <label className="block rounded-lg border border-[#e3d2ad] bg-white/80 p-4">
          <span className="block text-xs font-bold text-[#071b35]">Ospiti</span>
          <select value={guests} onChange={(e) => setGuests(e.target.value)} className="mt-2 w-full bg-transparent text-sm text-[#071b35] outline-none">
            <option value="1">1 ospite</option>
            <option value="2">2 ospiti</option>
          </select>
        </label>
      </div>

      <button type="submit" disabled={checking || booking} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#b88a22] px-6 py-3 font-serif text-lg font-bold uppercase tracking-[0.12em] text-white shadow-sm disabled:opacity-60">
        {checking ? "Controllo in corso..." : "Verifica disponibilitÃ "} <CalendarDays size={18} />
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#071b35]"><ShieldCheck size={18} /> Miglior tariffa garantita prenotando dal sito</div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
      {result && (
        <div className={`mt-4 rounded-lg border p-4 ${result.available ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <strong>{result.available ? "Gelone Lungomare risulta disponibile." : "Gelone Lungomare non risulta disponibile."}</strong>
          <p className="mt-1">{result.message || "Verifica completata."}</p>
        </div>
      )}

      {canShowBookingForm && (
        <div className="mt-5 rounded-lg border border-[#e3d2ad] bg-[#fbf6ea] p-5">
          <h3 className="font-serif text-2xl font-bold text-[#071b35]">Blocca le date dal sito ufficiale</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome e cognome" className="rounded-lg border border-[#e3d2ad] bg-white px-4 py-3 outline-none md:col-span-2" />
            <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Telefono / WhatsApp" className="rounded-lg border border-[#e3d2ad] bg-white px-4 py-3 outline-none" />
            <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" className="rounded-lg border border-[#e3d2ad] bg-white px-4 py-3 outline-none" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note" rows={3} className="rounded-lg border border-[#e3d2ad] bg-white px-4 py-3 outline-none md:col-span-2" />
          </div>
          <button type="button" disabled={booking} onClick={handleCreateBooking} className="mt-4 rounded-md bg-[#071b35] px-6 py-3 font-bold text-white disabled:opacity-60">
            {booking ? "Invio in corso..." : "Blocca date e invia richiesta"}
          </button>
        </div>
      )}

      {bookingResult && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">Richiesta inviata correttamente. Codice: <strong>{bookingResult.bookingId}</strong></div>}
    </form>
  );
}

function CalendarBox() {
  const weeks = [
    [26, 27, 28, 29, 30, 31, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 1, 2, 3, 4, 5, 6],
  ];
  return (
    <div className="rounded-lg border border-[#e3d2ad] bg-white/70 p-5 text-center text-[#071b35]">
      <div className="flex items-center justify-between font-serif font-bold uppercase tracking-[0.12em]"><ChevronLeft size={18} /> Giugno 2025 <ChevronRight size={18} /></div>
      <div className="mt-5 grid grid-cols-7 gap-3 text-[12px] font-bold uppercase"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div>
      {weeks.map((week, i) => <div key={i} className="mt-3 grid grid-cols-7 gap-3 text-sm">{week.map((d, j) => <span key={`${i}-${j}`}>{d}</span>)}</div>)}
    </div>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#071b35]">
      <div className="pointer-events-none fixed inset-0 z-50 border-[6px] border-[#b88a22]/15" />
      <div className="mx-auto max-w-[1040px] bg-[#fbf6ea] shadow-[0_0_50px_rgba(7,27,53,0.08)]">
        <header className="flex items-center justify-between border-b border-[#e5d7ba] px-8 py-4">
          <LogoBlock small />
          <nav className="hidden gap-8 text-[15px] font-semibold md:flex">
            {['Home','Alloggio','Foto','DisponibilitÃ ','Contatti'].map((item) => <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-[#b88a22]">{item}</a>)}
          </nav>
          <a href="#disponibilita" className="rounded-md bg-[#b88a22] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">Prenota diretto</a>
        </header>

        <section id="home" className="relative min-h-[510px] overflow-hidden">
          <HeroImage />
          <div className="relative z-10 px-8 pt-10 md:w-[58%]">
            <LogoBlock />
            <p className="mt-5 text-[12px] font-bold tracking-[0.15em]">CIN: IT084001B4D36830 <span className="mx-3 text-[#b88a22]">|</span> CIR: 190840010022</p>
            <h1 className="mt-9 font-serif text-[44px] leading-[1.18] tracking-[0.06em] md:text-[54px]">Vista mare, terrazza e comfort a due passi dal lungomare di Gela</h1>
            <Ornament />
            <p className="mt-7 max-w-[500px] text-[17px] leading-8">Appartamento accogliente e riservato con ampia terrazza vista mare, ideale per coppie e soggiorni di relax in Sicilia.</p>
          </div>
        </section>

        <section className="relative z-20 -mt-9 px-8">
          <div className="grid gap-4 md:grid-cols-4">
            <BookingCard type="direct" title="PRENOTA DAL SITO" subtitle="Miglior tariffa" href="#disponibilita" />
            <BookingCard type="booking" title="Booking.com" href={bookingUrl} />
            <BookingCard type="airbnb" title="Airbnb" href={airbnbUrl} />
            <BookingCard type="whatsapp" title="WhatsApp" href={whatsappUrl} />
          </div>
        </section>

        <section className="mt-6 flex border-y border-[#e5d7ba] bg-[#fbf6ea] px-8">
          <Amenity icon={Users} label="2 ospiti" />
          <Amenity icon={BedDouble} label="1 camera" />
          <Amenity icon={Bath} label="1 bagno" />
          <Amenity icon={CookingPot} label="Cucina" />
          <Amenity icon={Umbrella} label={<><span>Terrazza</span><br/>vista mare</>} />
        </section>

        <section id="alloggio" className="px-8 py-8">
          <h2 className="text-center font-serif text-[26px] font-bold uppercase tracking-[0.12em]">PerchÃ© scegliere Gelone Lungomare</h2>
          <div className="mx-auto mt-2 h-px w-44 bg-[#c4a35b]" />
          <div className="mt-7 grid gap-6 md:grid-cols-4">
            <FeatureCard icon={MapPin} title={'Posizione\nvicino al mare'} text="A pochi passi dal lungomare di Gela, per passeggiate e tramonti indimenticabili." />
            <FeatureCard icon={Umbrella} title={'Terrazza\nprivata'} text="Ampia terrazza attrezzata con vista mare, perfetta per colazioni e momenti di relax." />
            <FeatureCard icon={KeyRound} title={'Check-in\nsemplice'} text="Accesso comodo e supporto dedicato per un soggiorno senza pensieri." />
            <FeatureCard icon={Heart} title={'Per coppie e\nviaggiatori'} text="Ambiente intimo, tranquillo e confortevole, pensato per il tuo benessere." />
          </div>
        </section>

        <section id="foto" className="px-8 pb-8">
          <h2 className="text-center font-serif text-[26px] font-bold uppercase tracking-[0.18em]">Galleria</h2>
          <div className="mx-auto mt-2 h-px w-24 bg-[#c4a35b]" />
          <div className="mt-6 grid grid-cols-5 gap-3">
            {gallery.map((src, i) => <img key={i} src={src} alt={`Foto Gelone ${i + 1}`} className="h-[108px] w-full rounded-md border border-[#d8caa9] object-cover" />)}
          </div>
          <div className="mt-4 text-center"><a href={bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded bg-[#071b35] px-8 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white">Vedi tutte le foto <Camera size={17} /></a></div>
        </section>

        <section id="disponibilita" className="mx-8 grid gap-6 rounded-lg border border-[#e5d7ba] bg-white/35 p-6 md:grid-cols-[1fr_0.8fr]">
          <div>
            <h2 className="font-serif text-[28px] font-bold uppercase tracking-[0.12em]">DisponibilitÃ  e prenotazione</h2>
            <Ornament />
            <div className="mt-5"><AvailabilityForm /></div>
          </div>
          <CalendarBox />
        </section>

        <section id="contatti" className="mx-8 mt-6 grid gap-6 rounded-lg border border-[#e5d7ba] bg-white/35 p-6 md:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="font-serif text-[26px] font-bold uppercase tracking-[0.12em]">Come arrivare / Posizione</h2>
            <Ornament />
            <div className="mt-6 space-y-5 text-[17px]">
              <p className="flex gap-4"><MapPin className="text-[#b88a22]" /> Via Pascoli 1, 93012 Gela (CL)</p>
              <p className="flex gap-4"><MapPin className="text-[#b88a22]" /> A 2 minuti a piedi dal lungomare</p>
              <p className="flex gap-4"><Car className="text-[#b88a22]" /> A 5 minuti dal centro di Gela</p>
              <p className="flex gap-4"><Train className="text-[#b88a22]" /> A 10 minuti dalla Stazione di Gela</p>
            </div>
          </div>
          <div className="relative min-h-[235px] overflow-hidden rounded-md border border-[#d8caa9] bg-[#e8edf0]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#a9d0df_0_36%,#e9e2d4_36%_100%)]" />
            <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(90deg,rgba(7,27,53,.12)_1px,transparent_1px),linear-gradient(rgba(7,27,53,.12)_1px,transparent_1px)] [background-size:26px_26px]" />
            <MapPin className="absolute left-[48%] top-[47%] -translate-x-1/2 -translate-y-1/2 fill-[#071b35] text-[#071b35]" size={46} />
            <div className="absolute bottom-5 right-5 rounded-md bg-[#071b35] p-5 text-white shadow-xl">
              <h3 className="font-serif text-2xl font-bold">Gelone Lungomare</h3>
              <p className="mt-1">Via Pascoli 1, Gela (CL)</p>
              <p className="mt-2 max-w-[230px] leading-6">Sul lungomare, in una zona tranquilla e ben servita.</p>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full justify-center rounded bg-white px-4 py-2 font-bold text-[#071b35]">INDICAZIONI <ExternalLink size={16} className="ml-2" /></a>
            </div>
          </div>
        </section>

        <footer className="mt-8 grid gap-6 border-t border-[#b88a22] px-8 py-6 md:grid-cols-[1fr_1fr_1fr]">
          <div><LogoBlock small /><p className="mt-4 font-bold">CIN: IT084001B4D36830</p><p className="font-bold">CIR: 190840010022</p></div>
          <div className="space-y-2 text-[16px]"><p className="flex gap-3"><Phone size={18}/>3476308456</p><p className="flex gap-3"><Phone size={18}/>3479461999</p><p className="flex gap-3"><Mail size={18}/>info@gelone.it</p><p className="flex gap-3"><Waves size={18}/>www.gelone.it</p></div>
          <div className="text-center"><ChefHat className="mx-auto text-[#b88a22]" size={48}/><p className="mt-2 font-serif text-lg">Check-in e assistenza ospiti</p></div>
        </footer>
      </div>
    </main>
  );
}




