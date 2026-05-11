import React from "react";
import {
  MapPin,
  Phone,
  Mail,
  CalendarDays,
  Wifi,
  Waves,
  Home,
  Camera,
  ExternalLink,
} from "lucide-react";

const bookingUrl = "https://www.booking.com/Share-OQe9T5";
const whatsappUrl =
  "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";
const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Via%20Pascoli%201%20Gela";

const gallery = [
  {
    title: "Terrazza esterna",
    description: "Spazio all'aperto per rilassarsi e godersi il soggiorno.",
    image: "/images/terrazza-gelone.jpg",
  },
  {
    title: "Vista mare",
    description: "A pochi passi dal lungomare di Gela.",
    image: "/images/vista-mare-gelone.jpg",
  },
  {
    title: "Camera, bagno e cucina",
    description: "Soluzione comoda per 2 persone con cucina e bagno privato.",
    image: "/images/interni-gelone.jpg",
  },
];

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-[#e4d8c2] bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#f4ead7] text-[#9b6b25]">
        <Icon size={22} />
      </div>
      <h3 className="text-lg font-semibold text-[#0a1d35]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#5c5c5c]">{text}</p>
    </div>
  );
}

export default function App() {
  return (
    <main className="min-h-screen bg-[#faf6ee] text-[#0a1d35]">
      <header className="sticky top-0 z-30 border-b border-[#e4d8c2] bg-[#faf6ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#9b6b25]">
              Locazione turistica
            </p>
            <h1 className="font-serif text-2xl tracking-[0.18em]">GELONE</h1>
            <p className="text-sm tracking-[0.45em]">LUNGOMARE</p>
          </div>

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
            <a href="#contatti" className="hover:text-[#9b6b25]">
              Contatti
            </a>
          </nav>

          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#0a1d35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132f52]"
          >
            Prenota
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden">
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
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-semibold text-white shadow-md transition hover:bg-[#132f52]"
              >
                Prenota su Booking <ExternalLink size={18} />
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0a1d35] bg-white/70 px-7 py-4 font-semibold text-[#0a1d35] transition hover:bg-white"
              >
                Scrivici su WhatsApp
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7c49f] bg-white p-3 shadow-xl">
            <div className="relative flex min-h-[480px] items-end overflow-hidden rounded-[1.5rem] p-6">
              <img
                src="/images/vista-mare-gelone.jpg"
                alt="Vista mare da Gelone Lungomare"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

              <div className="relative rounded-2xl bg-white/90 p-6 shadow-lg backdrop-blur">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Soggiorno per 2 persone
                </p>
                <h3 className="mt-2 font-serif text-3xl">
                  Terrazza, mare e comfort
                </h3>
                <p className="mt-3 max-w-md leading-7 text-[#555]">
                  Vista mare, terrazza esterna e una posizione comoda per vivere
                  Gela in modo semplice e rilassato.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="appartamento" className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-6 md:grid-cols-4">
          <Feature
            icon={Home}
            title="Per 2 persone"
            text="Soluzione ideale per coppie o soggiorni brevi a Gela."
          />
          <Feature
            icon={CalendarDays}
            title="1 camera da letto"
            text="Ambiente riservato e confortevole per il riposo."
          />
          <Feature
            icon={Wifi}
            title="Cucina e servizi"
            text="Cucina disponibile, bagno privato e comfort essenziali."
          />
          <Feature
            icon={Waves}
            title="Vicino al mare"
            text="Posizione comoda per raggiungere il lungomare e i servizi."
          />
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
              className="overflow-hidden rounded-2xl border border-[#e4d8c2] bg-white shadow-sm"
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-64 w-full object-cover"
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
              Una posizione comoda per raggiungere il mare, il centro
              cittadino, bar, ristoranti e servizi principali.
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
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#0a1d35] px-7 py-4 text-center font-semibold text-white"
                >
                  Prenota su Booking
                </a>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#0a1d35] px-7 py-4 text-center font-semibold text-[#0a1d35]"
                >
                  WhatsApp
                </a>
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

      <footer className="border-t border-[#e4d8c2] px-5 py-8 text-center text-sm text-[#555]">
        <p className="font-serif text-xl tracking-[0.2em] text-[#0a1d35]">
          GELONE LUNGOMARE
        </p>
        <p className="mt-2">
          Locazione turistica a Gela · CIN IT084001B4D36830 · CIR 190840010022
        </p>
      </footer>
    </main>
  );
}