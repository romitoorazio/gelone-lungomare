import React from "react";
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
} from "lucide-react";

const bookingUrl = "https://www.booking.com/Share-OQe9T5";

const whatsappUrl =
  "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Via%20Pascoli%201%20Gela";

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

function BookingButton({ compact = false }) {
  return (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#b88416] bg-[#f5c84b] text-center font-bold text-[#0a1d35] shadow-md transition hover:bg-[#ffd96a] ${
        compact ? "px-5 py-3 text-sm" : "px-7 py-4"
      }`}
    >
      {compact ? "Booking" : "Prenota su Booking"}
      {!compact && <ExternalLink size={18} />}
    </a>
  );
}

function WhatsAppButton({ compact = false }) {
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white text-center font-semibold text-[#0a1d35] transition hover:bg-[#faf6ee] ${
        compact ? "px-5 py-3 text-sm" : "px-7 py-4"
      }`}
    >
      {compact ? "WhatsApp" : "Scrivici su WhatsApp"}
      {!compact && <MessageCircle size={18} />}
    </a>
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
            <a href="#info" className="hover:text-[#9b6b25]">
              Info
            </a>
            <a href="#privacy" className="hover:text-[#9b6b25]">
              Privacy
            </a>
          </nav>

          <BookingButton compact />
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

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BookingButton />
              <WhatsAppButton />
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
              cucina e una terrazza esterna che rende il soggiorno più piacevole.
            </p>
            <p className="mt-5">
              È una scelta adatta per chi vuole vivere Gela con una posizione
              pratica, vicina al mare e ai principali servizi della città.
            </p>
          </div>
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
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-[#0a1d35]"
                >
                  Apri su Google Maps <ExternalLink size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="info" className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <ShieldCheck className="text-[#9b6b25]" size={34} />
            <h3 className="mt-4 font-serif text-2xl">Dati struttura</h3>
            <div className="mt-4 space-y-2 text-[#555]">
              <p>CIN: IT084001B4D36830</p>
              <p>CIR: 190840010022</p>
              <p>Locazione turistica a Gela</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <Landmark className="text-[#9b6b25]" size={34} />
            <h3 className="mt-4 font-serif text-2xl">Per chi è ideale</h3>
            <p className="mt-4 leading-7 text-[#555]">
              Ideale per coppie, viaggiatori singoli, soggiorni brevi, lavoro o
              vacanza vicino al mare.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <Info className="text-[#9b6b25]" size={34} />
            <h3 className="mt-4 font-serif text-2xl">Prenotazioni</h3>
            <p className="mt-4 leading-7 text-[#555]">
              Puoi prenotare su Booking oppure contattarci direttamente su
              WhatsApp per informazioni e disponibilità.
            </p>
          </div>
        </div>
      </section>

      <section id="contatti" className="mx-auto max-w-7xl px-5 py-16">
        <div className="rounded-[2rem] border border-[#d7c49f] bg-white p-8 shadow-sm md:p-12">
          <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Prenota
              </p>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl">
                Richiedi disponibilità o prenota online
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#555]">
                Puoi prenotare tramite Booking oppure contattarci direttamente
                su WhatsApp per informazioni, disponibilità e assistenza.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <BookingButton />
                <WhatsAppButton />
              </div>
            </div>

            <div className="space-y-5 rounded-2xl bg-[#faf6ee] p-6">
              <div className="flex gap-4">
                <Phone className="text-[#9b6b25]" />
                <div>
                  <p className="font-semibold">Telefono / WhatsApp</p>
                  <p className="text-[#555]">3476308456 · 3479461999</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Mail className="text-[#9b6b25]" />
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-[#555]">info@gelone.it</p>
                </div>
              </div>

              <div className="border-t border-[#e1d2b8] pt-5 text-sm leading-7 text-[#555]">
                <p>CIN: IT084001B4D36830</p>
                <p>CIR: 190840010022</p>
                <p>www.gelone.it</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="bg-white px-5 py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#e4d8c2] bg-[#faf6ee] p-8 text-[#0a1d35] shadow-sm md:p-12">
          <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
            Privacy e Cookie
          </p>
          <h2 className="mt-3 font-serif text-4xl">
            Informativa privacy e cookie policy
          </h2>

          <div className="mt-6 space-y-5 leading-7 text-[#555]">
            <p>
              Questo sito presenta la locazione turistica Gelone Lungomare e
              permette di contattare la struttura tramite telefono, email,
              WhatsApp e link esterni di prenotazione.
            </p>

            <p>
              Il sito non raccoglie dati personali tramite moduli interni,
              registrazioni, newsletter o pagamenti diretti. I dati eventualmente
              comunicati volontariamente tramite email, telefono o WhatsApp
              vengono usati solo per rispondere alle richieste di informazioni,
              disponibilità e assistenza.
            </p>

            <p>
              Il sito contiene collegamenti verso Booking, WhatsApp e Google
              Maps. Cliccando su questi collegamenti l'utente accede a servizi
              esterni, soggetti alle rispettive informative privacy e cookie.
            </p>

            <p>
              Nella versione attuale il sito non utilizza cookie di profilazione,
              strumenti pubblicitari, newsletter, moduli di contatto interni o
              sistemi di pagamento diretto.
            </p>

            <div className="rounded-2xl bg-white p-5 text-sm leading-7">
              <p>
                <strong>Titolare:</strong> Gelone Lungomare
              </p>
              <p>
                <strong>Email:</strong> info@gelone.it
              </p>
              <p>
                <strong>Telefono:</strong> 3476308456 · 3479461999
              </p>
              <p>
                <strong>Sito:</strong> www.gelone.it
              </p>
              <p>
                <strong>CIN:</strong> IT084001B4D36830
              </p>
              <p>
                <strong>CIR:</strong> 190840010022
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e4d8c2] px-5 pb-28 pt-8 text-center text-sm text-[#555] md:pb-8">
        <p className="font-serif text-xl tracking-[0.2em] text-[#0a1d35]">
          GELONE LUNGOMARE
        </p>
        <p className="mt-2">
          Locazione turistica a Gela · CIN IT084001B4D36830 · CIR 190840010022
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-5">
          <a
            href="#privacy"
            className="underline underline-offset-4 hover:text-[#9b6b25]"
          >
            Privacy e Cookie
          </a>
          <a
            href="mailto:info@gelone.it"
            className="underline underline-offset-4 hover:text-[#9b6b25]"
          >
            info@gelone.it
          </a>
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#d7c49f] bg-[#faf6ee]/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <BookingButton compact />
          <WhatsAppButton compact />
        </div>
      </div>
    </main>
  );
}