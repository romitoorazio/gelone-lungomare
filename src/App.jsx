import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, UNIT_ID as DEFAULT_UNIT_ID } from "./firebase";
import { DEFAULT_UNIT, normalizeUnit } from "./units";

const LOGO_HEADER = "/images/logo-gelone-header-senza-qrcode.png";
const LOGO_EMBLEMA = "/images/logo-gelone-emblema-senza-qrcode.png";
const HERO_FUSA = "/images/hero-gelone-fusa.png";
const HERO_VIDEO = "/images/hero-gelone-video.mp4";
const HERO_POSTER = "/images/hero-gelone-poster.jpg";
const FOTO_MARE = "/images/vista-mare-gelone.jpg";
const FOTO_TERRAZZA = "/images/terrazza-gelone.jpg";
const FOTO_INTERNI = "/images/interni-gelone.jpg";

const bookingUrl = "https://www.booking.com/Share-OQe9T5";
const airbnbUrl = "https://www.airbnb.it/rooms/1267419022190887817";
const whatsappUrl = "https://wa.me/393476308456?text=Ciao%2C%20vorrei%20informazioni%20su%20Gelone%20Lungomare";

const CIN = "IT085007C2TUGEP2SD";
const CIR = "19085007C264694";
const UNIT_ID = DEFAULT_UNIT_ID || "lunarossa1";
const LEGAL_VERSION = "2026-05-16-rimborsi";

const defaultPricing = {
  nightlyRate: 70,
  cleaningFee: 0,
  minimumNights: 1,
  depositPercent: 30,
  directRateText: "Miglior tariffa prenotando dal sito",
  directPaymentEnabled: false,
};

const fallbackGallery = [FOTO_TERRAZZA, FOTO_MARE, FOTO_INTERNI, FOTO_TERRAZZA, FOTO_MARE];

function optimizeImageUrl(url, width = 1200) {
  const value = String(url || "").trim();
  if (!value) return value;

  if (value.includes("res.cloudinary.com") && value.includes("/upload/")) {
    return value.replace("/upload/", `/upload/f_auto,q_auto,c_fill,w_${width}/`);
  }

  return value;
}

function getUnitPhotos(unit) {
  const photos = Array.isArray(unit?.photos)
    ? unit.photos
        .filter((photo) => photo?.url)
        .sort((a, b) => {
          if (Boolean(a.cover) !== Boolean(b.cover)) {
            return a.cover ? -1 : 1;
          }
          return Number(a.order || 999) - Number(b.order || 999);
        })
        .map((photo) => ({
          ...photo,
          url: optimizeImageUrl(photo.url, 1200),
          thumbUrl: optimizeImageUrl(photo.url, 520),
        }))
    : [];

  return photos;
}

function getUnitCover(unit) {
  const photos = getUnitPhotos(unit);
  return photos[0]?.thumbUrl || FOTO_TERRAZZA;
}

function getUnitDescription(unit) {
  const text = String(unit?.description || "").trim();
  if (text && !text.toLowerCase().includes("unità attuale") && !text.toLowerCase().includes("nuova unità")) {
    return text;
  }

  return "Locazione turistica a Gela per 2 persone, vicino al lungomare, con camera da letto, bagno, cucina e terrazza vista mare.";
}

function getPublicUnitName(unit) {
  return String(unit?.publicName || unit?.name || "Gelone Lungomare").trim() || "Gelone Lungomare";
}

function getUnitCardBadge(unit) {
  const name = getPublicUnitName(unit).toLowerCase();
  if (name.includes("lungomare")) return "Vista lungomare";
  return "Alloggio Gelone";
}

function getUnitStats(unit) {
  const guests = Number(unit?.maxGuests || 2);
  const bedrooms = Number(unit?.bedrooms || 1);
  const bathrooms = Number(unit?.bathrooms || 1);

  return [
    `${guests} ${guests === 1 ? "ospite" : "ospiti"}`,
    `${bedrooms} ${bedrooms === 1 ? "camera" : "camere"}`,
    `${bathrooms} ${bathrooms === 1 ? "bagno" : "bagni"}`,
    unit?.hasKitchen === false ? null : "cucina",
  ].filter(Boolean);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateInput(dateIso) {
  if (!dateIso) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDateInput(d);
}

function addDaysIso(dateIso, days) {
  const d = parseDateInput(dateIso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return formatDateInput(d);
}

function getNightDates(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return [];
  const nights = [];
  const cursor = parseDateInput(checkIn);
  const end = parseDateInput(checkOut);

  if (!cursor || !end) return [];

  while (cursor < end) {
    nights.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return nights;
}

function getCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  const mondayBasedDay = (firstOfMonth.getDay() + 6) % 7;
  start.setDate(firstOfMonth.getDate() - mondayBasedDay);

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);

    return {
      iso: formatDateInput(d),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === monthDate.getMonth(),
      isPast: formatDateInput(d) < todayIso(),
    };
  });
}

function getMonthLabel(monthDate) {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  })
    .format(monthDate)
    .toUpperCase();
}

function getCalendarStatusLabel(status) {
  if (!status) return "Disponibile";
  if (status === "blocked") return "Bloccata";
  if (["pending_direct", "pending"].includes(status)) return "Richiesta";
  return "Occupata";
}

function formatEuro(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(number);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function formatNightsLabel(value) {
  const nights = Number(value || 0);
  return `${nights} ${nights === 1 ? "notte" : "notti"}`;
}

function formatDisplayDate(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || "-";
  }

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function getPaymentStatusLabel(value) {
  const status = String(value || "").trim();

  if (status === "paid") return "Prenotazione saldata";
  if (status === "deposit_paid") return "Caparra ricevuta";

  return "Pagamento ricevuto";
}

function SectionTitle({ children }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      <span />
    </div>
  );
}

function LegalPage({ page, onClose }) {
  const title =
    page === "privacy"
      ? "Privacy Policy"
      : page === "cookie"
        ? "Cookie Policy"
        : "Termini e condizioni";

  return (
    <div className="legal-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="legal-card">
        <div className="legal-head">
          <div>
            <p>Gelone Lungomare</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        {page === "privacy" && (
          <div className="legal-page-content">
            <p><strong>Ultimo aggiornamento:</strong> 16/05/2026</p>
            <p>
              La presente informativa descrive come vengono trattati i dati personali raccolti tramite il sito www.gelone.it
              per richieste di disponibilità, prenotazioni dirette, contatti telefonici, WhatsApp, email e pagamenti online.
            </p>

            <h3>Titolare del trattamento</h3>
            <p>
              Il titolare del trattamento è Orazio Romito, riferimento per Gelone Lungomare, Via Pascoli 1, 93012 Gela (CL).
              Email di contatto: info@gelone.it.
            </p>

            <h3>Dati trattati</h3>
            <p>
              Possiamo trattare nome e cognome, email, numero di telefono, date di soggiorno, numero ospiti, messaggi inviati,
              dati relativi alla prenotazione, stato del pagamento e dati tecnici necessari al funzionamento del sito.
              I dati della carta non vengono salvati da Gelone Lungomare: il pagamento è gestito da Stripe.
            </p>

            <h3>Finalità e basi giuridiche</h3>
            <p>
              I dati sono usati per rispondere alle richieste, verificare disponibilità, gestire prenotazioni, pagamenti,
              comunicazioni prima e dopo il soggiorno, obblighi amministrativi e fiscali, sicurezza del sito e tutela dei diritti.
              Le basi giuridiche sono misure precontrattuali, esecuzione del contratto, obblighi di legge e legittimo interesse.
            </p>

            <h3>Destinatari e strumenti usati</h3>
            <p>
              I dati possono essere trattati tramite servizi tecnici necessari al funzionamento del sito e della prenotazione,
              tra cui Firebase/Google Cloud, Vercel, Stripe, Cloudinary, email, telefono e WhatsApp.
              I dati possono essere comunicati ad autorità o consulenti quando previsto dalla legge.
            </p>

            <h3>Tempi di conservazione</h3>
            <p>
              Le richieste non confermate sono conservate per il tempo necessario alla gestione del contatto.
              Le prenotazioni e i dati amministrativi sono conservati per il tempo richiesto dalla normativa applicabile
              e per la tutela dei diritti del titolare.
            </p>

            <h3>Diritti dell'interessato</h3>
            <p>
              Puoi chiedere accesso, rettifica, cancellazione, limitazione, opposizione al trattamento e portabilità dei dati,
              nei casi previsti dal GDPR. Puoi scrivere a info@gelone.it. Resta salvo il diritto di proporre reclamo
              all'autorità competente per la protezione dei dati personali.
            </p>
          </div>
        )}

        {page === "cookie" && (
          <div className="legal-page-content">
            <p><strong>Ultimo aggiornamento:</strong> 16/05/2026</p>
            <p>
              Il sito www.gelone.it utilizza solo strumenti necessari al funzionamento tecnico della navigazione,
              della disponibilità, della prenotazione e dell'area amministrativa.
            </p>

            <h3>Cookie tecnici</h3>
            <p>
              I cookie o strumenti tecnici possono servire per sicurezza, sessione, preferenze essenziali e funzionamento
              del sito. Questi strumenti non richiedono consenso preventivo.
            </p>

            <h3>Cookie di profilazione e marketing</h3>
            <p>
              Al momento il sito pubblico non utilizza cookie di marketing o profilazione inseriti direttamente da Gelone Lungomare.
              Se in futuro verranno aggiunti Google Analytics, Meta Pixel, mappe incorporate o altri strumenti di tracciamento,
              la presente policy sarà aggiornata e verrà mostrato un banner per la gestione del consenso.
            </p>

            <h3>Servizi esterni</h3>
            <p>
              Il sito può contenere link verso servizi esterni come Google Maps, WhatsApp, Booking, Airbnb e Stripe.
              Cliccando tali link l'utente esce dal sito Gelone Lungomare e si applicano le informative privacy/cookie
              dei rispettivi fornitori.
            </p>
          </div>
        )}

        {page === "terms" && (
          <div className="legal-page-content">
            <p><strong>Ultimo aggiornamento:</strong> 16/05/2026</p>
            <p>
              I presenti termini regolano l'utilizzo del sito www.gelone.it e le richieste di prenotazione diretta
              per Gelone Lungomare, locazione turistica sita in Via Pascoli 1, 93012 Gela (CL).
            </p>

            <h3>Richieste e prenotazioni</h3>
            <p>
              L'invio di una richiesta dal sito non garantisce automaticamente la prenotazione definitiva.
              La prenotazione si considera confermata dopo conferma scritta da parte della struttura oppure dopo pagamento
              richiesto tramite link sicuro Stripe, secondo quanto indicato nella comunicazione inviata all'ospite.
            </p>

            <h3>Prezzi, caparra e pagamenti</h3>
            <p>
              I prezzi mostrati nel sito sono indicativi e possono variare in base a date, disponibilità, durata del soggiorno
              e accordi diretti. La prenotazione diretta può richiedere il pagamento di una caparra confirmatoria, normalmente
              pari al 30% del totale, salvo diverso accordo scritto con l'ospite.
            </p>
            <p>
              Il saldo, quando dovuto, viene pagato secondo le modalità comunicate dalla struttura prima dell'arrivo
              o al momento del check-in. I pagamenti online sono gestiti tramite Stripe. Gelone Lungomare non conserva
              i dati completi della carta di pagamento.
            </p>

            <h3>Cancellazioni e rimborsi</h3>
            <p>
              Salvo diverso accordo scritto tra le parti, per le prenotazioni dirette effettuate tramite il sito si applicano
              le seguenti condizioni di cancellazione.
            </p>
            <p>
              <strong>Cancellazione fino a 14 giorni prima del check-in:</strong> rimborso totale degli importi già pagati.
            </p>
            <p>
              <strong>Cancellazione da 13 a 7 giorni prima del check-in:</strong> la caparra confirmatoria viene trattenuta
              dalla struttura; l'eventuale saldo non è dovuto se non ancora pagato.
            </p>
            <p>
              <strong>Cancellazione negli ultimi 6 giorni prima del check-in, mancata presentazione o no-show:</strong>
              la caparra confirmatoria viene trattenuta. Eventuali importi già versati a saldo non sono rimborsabili,
              salvo diverso accordo scritto con la struttura.
            </p>
            <p>
              <strong>Partenza anticipata:</strong> le notti non usufruite non sono rimborsabili, salvo diverso accordo scritto.
            </p>
            <p>
              <strong>Cancellazione da parte della struttura:</strong> se Gelone Lungomare non potesse ospitare il cliente
              per cause imputabili alla struttura, verrà rimborsato integralmente quanto già pagato oppure verrà proposta,
              se possibile, una soluzione alternativa accettata dall'ospite.
            </p>
            <p>
              I rimborsi, quando dovuti, vengono effettuati sullo stesso metodo di pagamento usato dall'ospite, di norma
              entro 7 giorni lavorativi dall'accordo di cancellazione. I tempi effettivi di riaccredito possono dipendere
              dalla banca o dal circuito di pagamento.
            </p>

            <h3>Regole della casa</h3>
            <p>
              L'ospite è tenuto a usare l'alloggio con cura, rispettare orari di check-in e check-out comunicati,
              norme condominiali, quiete pubblica e divieti indicati dalla struttura. Eventuali danni o usi impropri
              possono essere addebitati secondo legge.
            </p>

            <h3>Codici identificativi</h3>
            <p>
              CIN: IT085007C2TUGEP2SD. CIR: 19085007C264694.
            </p>
          </div>
        )}
      </div>
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
  const [guestEmailConfirm, setGuestEmailConfirm] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [botTrap, setBotTrap] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [legalPage, setLegalPage] = useState("");
  const [requestStatus, setRequestStatus] = useState(null);
  const [paymentReturnStatus, setPaymentReturnStatus] = useState(null);
  const [paymentReturnDetails, setPaymentReturnDetails] = useState(null);
  const [paymentReturnLoading, setPaymentReturnLoading] = useState(false);
  const [paymentRetryLoading, setPaymentRetryLoading] = useState(false);
  const [paymentRetryError, setPaymentRetryError] = useState("");
  const [pricing, setPricing] = useState(defaultPricing);
  const [publicUnits, setPublicUnits] = useState([DEFAULT_UNIT]);
  const [selectedPublicUnitId, setSelectedPublicUnitId] = useState(UNIT_ID);
  const [galleryPhotos, setGalleryPhotos] = useState(fallbackGallery);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarStatusByDate, setCalendarStatusByDate] = useState({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const selectedPublicUnit = useMemo(
    () => publicUnits.find((unit) => unit.id === selectedPublicUnitId) || publicUnits[0] || DEFAULT_UNIT,
    [publicUnits, selectedPublicUnitId]
  );
  const selectedUnitName = getPublicUnitName(selectedPublicUnit);
  const selectedUnitCin = selectedPublicUnit.cin || CIN;
  const selectedUnitCir = selectedPublicUnit.cir || CIR;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");
    const cancelledBookingId = params.get("bookingId") || "";
    const cancelledPaymentType = params.get("paymentType") || "deposit";

    async function loadPaymentReturnDetails(value) {
      if (!value) return;

      setPaymentReturnLoading(true);

      try {
        const response = await fetch(`/api/payment-result?session_id=${encodeURIComponent(value)}`);
        const data = await response.json().catch(() => null);

        if (response.ok && data?.ok) {
          setPaymentReturnDetails(data);
        }
      } catch (error) {
        console.warn("Riepilogo pagamento non caricato:", error);
      } finally {
        setPaymentReturnLoading(false);
      }
    }

    if (payment === "success") {
      setPaymentReturnStatus({
        ok: true,
        title: "Pagamento ricevuto",
        message:
          "Grazie, il pagamento è stato ricevuto. La prenotazione è stata aggiornata automaticamente nel nostro sistema. Riceverai anche una email di conferma.",
        sessionId,
      });
      loadPaymentReturnDetails(sessionId);
    }

    if (payment === "cancelled") {
      setPaymentReturnStatus({
        ok: false,
        title: "Pagamento non completato",
        message:
          "Nessun importo è stato addebitato. Puoi riprovare il pagamento oppure contattarci su WhatsApp per completare la prenotazione.",
        sessionId: "",
        bookingId: cancelledBookingId,
        paymentType: cancelledPaymentType,
      });
      setPaymentReturnDetails(null);
      setPaymentRetryError("");
    }

    if (payment) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPricing() {
      const settingsDocId = selectedPublicUnitId === UNIT_ID ? "pms" : `pms_${selectedPublicUnitId}`;
      setPricing(defaultPricing);

      try {
        const snapshot = await getDoc(doc(db, "settings", settingsDocId));
        if (!mounted || !snapshot.exists()) return;

        const data = snapshot.data();
        setPricing({
          nightlyRate: Number(data.nightlyRate || defaultPricing.nightlyRate),
          cleaningFee: Number(data.cleaningFee || defaultPricing.cleaningFee),
          minimumNights: Number(data.minimumNights || defaultPricing.minimumNights),
          depositPercent: Number(data.depositPercent || defaultPricing.depositPercent),
          directRateText: data.directRateText || defaultPricing.directRateText,
        
          directPaymentEnabled: Boolean(data.directPaymentEnabled),
});
      } catch (error) {
        console.warn("Tariffe non caricate, uso valori predefiniti:", error);
      }
    }

    loadPricing();
    return () => { mounted = false; };
  }, [selectedPublicUnitId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "units"),
      (snapshot) => {
        if (!snapshot.exists()) {
          setPublicUnits([DEFAULT_UNIT]);
          setSelectedPublicUnitId(UNIT_ID);
          return;
        }

        const items = Array.isArray(snapshot.data()?.items) ? snapshot.data().items : [];
        const normalizedUnits = (items.length > 0 ? items : [DEFAULT_UNIT])
          .map((item) => normalizeUnit(item))
          .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
        const visibleUnits = normalizedUnits.filter((unit) => unit.active && unit.publicVisible);
        const nextPublicUnits = visibleUnits.length > 0 ? visibleUnits : [DEFAULT_UNIT];

        setPublicUnits(nextPublicUnits);
        setSelectedPublicUnitId((current) =>
          nextPublicUnits.some((unit) => unit.id === current) ? current : nextPublicUnits[0].id
        );
      },
      (error) => {
        console.warn("Unità pubbliche non caricate, uso Lunarossa 1:", error);
        setPublicUnits([DEFAULT_UNIT]);
        setSelectedPublicUnitId(UNIT_ID);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const photos = getUnitPhotos(selectedPublicUnit).map((photo) => photo.url);
    setGalleryPhotos(photos.length > 0 ? photos : fallbackGallery);
    setActivePhotoIndex(null);
  }, [selectedPublicUnit]);

  const openGallery = (index = 0) => {
    if (!galleryPhotos.length) return;
    setActivePhotoIndex(Math.max(0, Math.min(index, galleryPhotos.length - 1)));
  };

  const closeGallery = () => setActivePhotoIndex(null);

  async function retryCancelledPayment() {
    const bookingId = paymentReturnStatus?.bookingId;

    if (!bookingId) {
      document.getElementById("disponibilita")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    setPaymentRetryLoading(true);
    setPaymentRetryError("");

    try {
      const response = await fetch("/api/create-payment-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          paymentType: paymentReturnStatus?.paymentType || "deposit",
          publicDirectPayment: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok || !data.checkoutUrl) {
        throw new Error(
          data?.message ||
          "Non riesco a riaprire il pagamento. Contattaci su WhatsApp."
        );
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      setPaymentRetryError(
        error?.message ||
        "Non riesco a riaprire il pagamento. Contattaci su WhatsApp."
      );
    } finally {
      setPaymentRetryLoading(false);
    }
  }

  const moveGallery = (direction) => {
    setActivePhotoIndex((current) => {
      if (current === null || galleryPhotos.length === 0) return current;
      return (current + direction + galleryPhotos.length) % galleryPhotos.length;
    });
  };

  useEffect(() => {
    if (activePhotoIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeGallery();
      if (event.key === "ArrowLeft") moveGallery(-1);
      if (event.key === "ArrowRight") moveGallery(1);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activePhotoIndex, galleryPhotos.length]);

  const galleryPreview = useMemo(() => galleryPhotos.slice(0, 5), [galleryPhotos]);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    let mounted = true;

    async function loadCalendarAvailability() {
      setCalendarLoading(true);

      try {
        const start = calendarDays[0]?.iso;
        const end = calendarDays[calendarDays.length - 1]?.iso;

        if (!start || !end) return;

        const response = await fetch(
          `/api/public-calendar?unitId=${encodeURIComponent(selectedPublicUnitId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Calendario non disponibile");
        }

        if (!mounted) return;

        const nextStatusByDate = {};

        (data.days || []).forEach((day) => {
          if (day?.date && day?.status && day.status !== "cancelled") {
            nextStatusByDate[day.date] = day.status;
          }
        });

        setCalendarStatusByDate(nextStatusByDate);
      } catch (error) {
        console.warn("Calendario disponibilità non caricato:", error);
        if (mounted) setCalendarStatusByDate({});
      } finally {
        if (mounted) setCalendarLoading(false);
      }
    }

    loadCalendarAvailability();

    return () => {
      mounted = false;
    };
  }, [calendarDays, calendarRefreshKey, selectedPublicUnitId]);

  const selectedNights = useMemo(() => getNightDates(checkIn, checkOut), [checkIn, checkOut]);
  const priceEstimate = useMemo(() => {
    const nights = selectedNights.length;
    const nightlyRate = Number(pricing.nightlyRate || 0);
    const cleaningFee = Number(pricing.cleaningFee || 0);
    const subtotal = nights * nightlyRate;
    const total = nights > 0 ? subtotal + cleaningFee : 0;
    const depositAmount = total > 0 ? Math.round((total * Number(pricing.depositPercent || 0)) / 100) : 0;

    return { nights, nightlyRate, cleaningFee, subtotal, total, depositAmount };
  }, [selectedNights, pricing]);

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

    if (priceEstimate.nights < Number(pricing.minimumNights || 1)) {
      setAvailability({
        ok: false,
        message: `Soggiorno minimo: ${formatNightsLabel(pricing.minimumNights)}.`,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: selectedPublicUnitId, checkIn, checkOut, guests: Number(guests) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Errore verifica disponibilità");

      const available = data.available !== false;
      const availabilityMessage = available
        ? pricing.directPaymentEnabled
          ? "Periodo disponibile. Scorri sotto per pagare la caparra oppure inviare una richiesta senza pagamento."
          : "Periodo disponibile. Il pagamento online è spento: puoi inviare una richiesta senza pagamento."
        : "Periodo non disponibile. Prova altre date oppure contattaci su WhatsApp.";

      setAvailability({
        ok: available,
        message: availabilityMessage,
      });

      if (available) {
        window.setTimeout(() => {
          document.getElementById("prenota-diretta")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 180);
      }
    } catch (error) {
      setAvailability({ ok: false, message: error.message || "Errore durante la verifica." });
    } finally {
      setLoading(false);
    }
  };

  function validateGuestForm() {
    if (!guestName.trim() || !guestEmail.trim() || !guestEmailConfirm.trim() || !guestPhone.trim()) {
      setRequestStatus({ ok: false, message: "Compila nome, email, conferma email e telefono." });
      return false;
    }

    if (!isValidEmail(guestEmail)) {
      setRequestStatus({ ok: false, message: "Inserisci un indirizzo email valido." });
      return false;
    }

    if (guestEmail.trim().toLowerCase() !== guestEmailConfirm.trim().toLowerCase()) {
      setRequestStatus({ ok: false, message: "Le due email non coincidono. Controlla bene indirizzo email." });
      return false;
    }

    if (!isValidPhone(guestPhone)) {
      setRequestStatus({ ok: false, message: "Inserisci un numero di telefono valido." });
      return false;
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setRequestStatus({ ok: false, message: "Seleziona date valide prima di prenotare." });
      return false;
    }

    if (!availability?.ok) {
      setRequestStatus({ ok: false, message: "Verifica prima la disponibilità delle date." });
      return false;
    }

    if (!privacyAccepted) {
      setRequestStatus({
        ok: false,
        message: "Accetta Privacy Policy, Cookie Policy e Termini prima di continuare.",
      });
      return false;
    }

    return true;
  }

  async function submitBookingRequest({ payNow = false } = {}) {
    setRequestStatus(null);

    if (!validateGuestForm()) {
      return;
    }

    if (payNow && !pricing.directPaymentEnabled) {
      setRequestStatus({
        ok: false,
        message: "Il pagamento online è disattivato. Invia la richiesta senza pagamento.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: selectedPublicUnitId,
          unitName: selectedPublicUnit.publicName || selectedPublicUnit.name || "Gelone Lungomare",
          checkIn,
          checkOut,
          guests: Number(guests),
          guestName,
          guestEmail,
          guestPhone,
          notes: `Richiesta inviata dal sito Gelone Lungomare. Totale stimato: ${formatEuro(priceEstimate.total)} per ${formatNightsLabel(priceEstimate.nights)}.`,
          totalPrice: priceEstimate.total,
          nightlyRate: priceEstimate.nightlyRate,
          cleaningFee: priceEstimate.cleaningFee,
          nightsCount: priceEstimate.nights,
          depositAmount: priceEstimate.depositAmount,
          privacyAccepted: true,
          termsAccepted: true,
          cookiePolicyAccepted: true,
          legalAcceptedAt: new Date().toISOString(),
          privacyVersion: LEGAL_VERSION,
          termsVersion: LEGAL_VERSION,
          cookieVersion: LEGAL_VERSION,
          website: botTrap,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Errore invio richiesta");

      setCalendarRefreshKey((value) => value + 1);

      if (payNow) {
        setRequestStatus({
          ok: true,
          message: "Prenotazione creata. Ti stiamo portando al pagamento sicuro Stripe...",
        });

        const paymentResponse = await fetch("/api/create-payment-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: data.bookingId,
            paymentType: "deposit",
          
            publicDirectPayment: true,
}),
        });

        const paymentData = await paymentResponse.json().catch(() => null);

        if (!paymentResponse.ok || !paymentData?.ok || !paymentData.checkoutUrl) {
          setRequestStatus({
            ok: false,
            message:
              paymentData?.message ||
              "Richiesta creata, ma non riesco ad aprire il pagamento. Ti contatteremo per completare la conferma.",
          });
          return;
        }

        window.location.href = paymentData.checkoutUrl;
        return;
      }

      setRequestStatus({
        ok: true,
        message: "Richiesta inviata. Ti contatteremo per confermare oppure per inviarti il link caparra.",
      });
    } catch (error) {
      setRequestStatus({
        ok: false,
        message: error.message || "Errore durante l'invio.",
      });
    } finally {
      setLoading(false);
    }
  }

  const createBookingRequest = async (event) => {
    event.preventDefault();
    await submitBookingRequest({ payNow: false });
  };

  const createBookingAndPay = async () => {
    await submitBookingRequest({ payNow: true });
  };

  function changeCalendarMonth(direction) {
    setCalendarMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + direction);
      next.setDate(1);
      return next;
    });
  }

  function selectCalendarDate(dateIso) {
    if (!dateIso || dateIso < minCheckIn) return;

    setAvailability(null);
    setRequestStatus(null);

    if (!checkIn || checkOut || dateIso <= checkIn) {
      setCheckIn(dateIso);
      setCheckOut(addDaysIso(dateIso, 1));
      return;
    }

    setCheckOut(dateIso);
  }

  return (
    <main className="site-shell">
      <style>{css}</style>
      <style>{`
        /* multi-unit-selector-final */
        #alloggi.units-showcase {
          padding: clamp(48px, 7vw, 90px) 18px !important;
          background: #faf6ee !important;
          overflow: hidden !important;
        }

        #alloggi .units-intro {
          max-width: 980px !important;
          margin: 0 auto 26px !important;
          text-align: center !important;
        }

        #alloggi .units-intro p {
          max-width: 760px !important;
          margin: 14px auto 0 !important;
          color: #555 !important;
          font-size: 16px !important;
          line-height: 1.7 !important;
        }

        #alloggi .units-intro p::before {
          content: none !important;
          display: none !important;
        }

        .unit-showcase-grid,
        .unit-showcase-card,
        .unit-photo-button,
        .unit-card-body,
        .unit-card-topline,
        .unit-card-actions {
          all: unset;
          box-sizing: border-box;
        }

        .multi-unit-picker {
          width: min(1120px, 100%) !important;
          margin: 0 auto 24px !important;
          display: flex !important;
          gap: 12px !important;
          overflow-x: auto !important;
          padding: 6px 2px 12px !important;
          scrollbar-width: thin !important;
        }

        .unit-picker-button {
          flex: 0 0 auto !important;
          min-width: 220px !important;
          border: 1px solid #e4d8c2 !important;
          border-radius: 18px !important;
          background: #fff !important;
          color: #0a1d35 !important;
          padding: 14px 16px !important;
          text-align: left !important;
          cursor: pointer !important;
          box-shadow: 0 10px 30px rgba(10, 29, 53, 0.06) !important;
        }

        .unit-picker-button strong {
          display: block !important;
          font-size: 16px !important;
          line-height: 1.25 !important;
          overflow-wrap: anywhere !important;
        }

        .unit-picker-button span {
          display: block !important;
          margin-top: 4px !important;
          color: #9b6b25 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
        }

        .unit-picker-button.active {
          border-color: #0a1d35 !important;
          background: #0a1d35 !important;
          color: #fff !important;
        }

        .unit-picker-button.active span {
          color: #f5c84b !important;
        }

        .selected-unit-panel {
          width: min(1120px, 100%) !important;
          margin: 0 auto !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr) !important;
          gap: 0 !important;
          overflow: hidden !important;
          border: 1px solid #e4d8c2 !important;
          border-radius: 32px !important;
          background: #fff !important;
          box-shadow: 0 24px 70px rgba(10, 29, 53, 0.12) !important;
        }

        .selected-unit-photo {
          position: relative !important;
          min-height: 360px !important;
          background: #0a1d35 !important;
          overflow: hidden !important;
        }

        .selected-unit-photo button {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 360px !important;
          border: 0 !important;
          padding: 0 !important;
          cursor: pointer !important;
          background: transparent !important;
        }

        .selected-unit-photo img {
          width: 100% !important;
          height: 100% !important;
          min-height: 360px !important;
          object-fit: cover !important;
          display: block !important;
        }

        .selected-unit-photo span {
          position: absolute !important;
          left: 22px !important;
          bottom: 22px !important;
          border-radius: 999px !important;
          background: rgba(10, 29, 53, 0.88) !important;
          color: #fff !important;
          padding: 11px 16px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
        }

        .selected-unit-content {
          min-width: 0 !important;
          padding: clamp(24px, 4vw, 42px) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }

        .selected-unit-eyebrow {
          color: #9b6b25 !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.16em !important;
        }

        .selected-unit-content h3 {
          margin: 12px 0 12px !important;
          color: #0a1d35 !important;
          font-size: clamp(30px, 4vw, 52px) !important;
          line-height: 1.05 !important;
          overflow-wrap: anywhere !important;
        }

        .selected-unit-content p {
          margin: 0 !important;
          color: #555 !important;
          font-size: 16px !important;
          line-height: 1.75 !important;
        }

        .selected-unit-stats {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 9px !important;
          margin: 22px 0 !important;
        }

        .selected-unit-stats span {
          border-radius: 999px !important;
          border: 1px solid #e4d8c2 !important;
          background: #faf6ee !important;
          color: #0a1d35 !important;
          padding: 9px 12px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .selected-unit-actions {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 12px !important;
          margin-top: 8px !important;
        }

        .selected-unit-actions button {
          flex: 1 1 180px !important;
          border-radius: 999px !important;
          padding: 14px 18px !important;
          font-weight: 900 !important;
          cursor: pointer !important;
        }

        .selected-unit-primary {
          border: 1px solid #0a1d35 !important;
          background: #0a1d35 !important;
          color: #fff !important;
        }

        .selected-unit-secondary {
          border: 1px solid #0a1d35 !important;
          background: #fff !important;
          color: #0a1d35 !important;
        }

        @media (max-width: 860px) {
          .selected-unit-panel {
            grid-template-columns: 1fr !important;
          }

          .selected-unit-photo,
          .selected-unit-photo button,
          .selected-unit-photo img {
            min-height: 270px !important;
          }

          .unit-picker-button {
            min-width: 190px !important;
          }
        }

        @media (max-width: 560px) {
          #alloggi.units-showcase {
            padding: 38px 12px !important;
          }

          .selected-unit-content {
            padding: 22px !important;
          }

          .selected-unit-content h3 {
            font-size: 30px !important;
          }

          .selected-unit-actions {
            flex-direction: column !important;
          }

          .selected-unit-actions button {
            width: 100% !important;
            flex-basis: auto !important;
          }
        }
      `}</style>
      {legalPage && (
        <LegalPage page={legalPage} onClose={() => setLegalPage("")} />
      )}

      <header className="topbar">
        <a href="#home" className="brand" aria-label="Gelone Lungomare home">
          <img src={LOGO_HEADER} alt="Gelone Lungomare" />
        </a>

        <nav className="navlinks" aria-label="Navigazione principale">
          <a className="active" href="#home">Home</a>
          <a href="#alloggi">Alloggi</a>
          <a href="#foto">Foto</a>
          <a href="#disponibilita">Disponibilità</a>
          <a href="#contatti">Contatti</a>
        </nav>

        <a className="top-cta" href="#disponibilita">Prenota diretto <span>▣</span></a>
      </header>

      {paymentReturnStatus && (
        <section className={`payment-return-banner ${paymentReturnStatus.ok ? "ok" : "no"}`} role="status">
          <div className="payment-return-head">
            <div className="payment-return-icon">{paymentReturnStatus.ok ? "✓" : "!"}</div>
            <div>
              <strong>{paymentReturnStatus.title}</strong>
              <p>{paymentReturnStatus.message}</p>
              {paymentReturnStatus.sessionId && (
                <small>Riferimento pagamento: {paymentReturnStatus.sessionId}</small>
              )}
            </div>
          </div>

          {!paymentReturnStatus.ok && (
            <div className="payment-return-body">
              <div className="payment-cancelled-card">
                <strong>Cosa puoi fare adesso</strong>
                <p>
                  La richiesta non è persa: puoi riprovare il pagamento, tornare alla disponibilità oppure scriverci su WhatsApp.
                </p>
                <ul>
                  <li>Nessun importo risulta addebitato.</li>
                  <li>Se hai chiuso Stripe per errore, puoi riprovare subito.</li>
                  <li>Se preferisci, completiamo noi la prenotazione manualmente.</li>
                </ul>
                {paymentRetryError && (
                  <div className="payment-retry-error">{paymentRetryError}</div>
                )}
              </div>
            </div>
          )}

          {paymentReturnStatus.ok && (
            <div className="payment-return-body">
              {paymentReturnLoading && (
                <div className="payment-summary-note">Caricamento riepilogo prenotazione...</div>
              )}

              {!paymentReturnLoading && paymentReturnDetails?.found && (
                <div className="payment-summary-grid">
                  <div>
                    <span>Struttura</span>
                    <b>{paymentReturnDetails.unitName}</b>
                  </div>
                  <div>
                    <span>Arrivo</span>
                    <b>{formatDisplayDate(paymentReturnDetails.checkIn)}</b>
                  </div>
                  <div>
                    <span>Partenza</span>
                    <b>{formatDisplayDate(paymentReturnDetails.checkOut)}</b>
                  </div>
                  <div>
                    <span>Ospiti</span>
                    <b>{paymentReturnDetails.guests || "-"}</b>
                  </div>
                  <div>
                    <span>Totale</span>
                    <b>{formatEuro(paymentReturnDetails.totalPrice)}</b>
                  </div>
                  <div>
                    <span>Pagato</span>
                    <b>{formatEuro(paymentReturnDetails.paymentAmount)}</b>
                  </div>
                  <div>
                    <span>Stato</span>
                    <b>{getPaymentStatusLabel(paymentReturnDetails.paymentStatus)}</b>
                  </div>
                  <div>
                    <span>Riferimento</span>
                    <b>{paymentReturnDetails.reference}</b>
                  </div>
                </div>
              )}

              {!paymentReturnLoading && !paymentReturnDetails?.found && (
                <div className="payment-summary-note">
                  Il pagamento è stato ricevuto. Se il riepilogo non compare subito, controlla l'email di conferma.
                </div>
              )}

              <div className="payment-next-steps">
                <strong>Prossimi passi</strong>
                <p>Riceverai una email di conferma pagamento. Per dubbi o orario di arrivo puoi scriverci su WhatsApp.</p>
              </div>
            </div>
          )}

          <div className="payment-return-actions">
            {paymentReturnStatus.ok ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer">Scrivi su WhatsApp</a>
            ) : (
              <>
                <button
                  type="button"
                  onClick={retryCancelledPayment}
                  disabled={paymentRetryLoading}
                >
                  {paymentRetryLoading ? "Apertura Stripe..." : "Riprova pagamento"}
                </button>
                <a href={whatsappUrl} target="_blank" rel="noreferrer">Scrivi su WhatsApp</a>
                <a
                  href="#disponibilita"
                  onClick={() => setPaymentReturnStatus(null)}
                >
                  Torna alle date
                </a>
              </>
            )}
            <button type="button" onClick={() => setPaymentReturnStatus(null)}>
              Chiudi
            </button>
          </div>
        </section>
      )}

      <section id="home" className="hero">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="hero-readable" />
        <div className="hero-bottom-fade" />

        <div className="hero-content">
          <p className="legal-line">CIN: {selectedUnitCin} <span>|</span> CIR: {selectedUnitCir}</p>
          <h1>Gelone Lungomare: locazione turistica a Gela vicino al mare</h1>
          <div className="gold-rule" />
          <p className="hero-copy">
            Alloggio per 2 persone con camera da letto, bagno, cucina e terrazza vista mare. Prenota dal sito, WhatsApp, Booking o Airbnb.
          </p>
        </div>
      </section>

      <section className="booking-cards" aria-label="Opzioni di prenotazione">
        <a className="booking-card direct" href="#disponibilita">
          <img src={LOGO_EMBLEMA} alt="" />
          <span>
            <strong>PRENOTA DAL SITO</strong>
            <b>DA {formatEuro(pricing.nightlyRate)} / NOTTE</b>
            <em>{pricing.directRateText}</em>
          </span>
        </a>
        <a className="booking-card portal" href={selectedPublicUnit.bookingUrl || bookingUrl} target="_blank" rel="noreferrer">
          <strong className="booking-b">B.</strong>
          <span>Booking.com</span>
        </a>
        <a className="booking-card portal" href={selectedPublicUnit.airbnbUrl || airbnbUrl} target="_blank" rel="noreferrer">
          <strong className="airbnb-mark">⌂</strong>
          <span>Airbnb</span>
        </a>
        <a className="booking-card portal" href={whatsappUrl} target="_blank" rel="noreferrer">
          <strong className="whatsapp-mark">●</strong>
          <span>WhatsApp</span>
        </a>
      </section>

      <section id="alloggi" className="units-showcase">
        <div className="units-intro">
          <p className="eyebrow">Alloggi Gelone</p>
          <SectionTitle>{publicUnits.length > 1 ? "SCEGLI IL TUO ALLOGGIO" : "IL TUO ALLOGGIO"}</SectionTitle>
          <p>
            {publicUnits.length > 1
              ? "Seleziona un alloggio: foto, disponibilità, tariffe e prenotazione cambiano in base all'unità scelta."
              : "Gelone Lungomare è pensato per 2 persone, con camera da letto, bagno e cucina, vicino al lungomare di Gela."}
          </p>
        </div>

        {publicUnits.length > 1 && (
          <div className="multi-unit-picker" aria-label="Seleziona alloggio">
            {publicUnits.map((unit) => {
              const isSelected = unit.id === selectedPublicUnitId;
              const publicUnitName = getPublicUnitName(unit);

              return (
                <button
                  key={unit.id}
                  type="button"
                  className={isSelected ? "unit-picker-button active" : "unit-picker-button"}
                  onClick={() => {
                    setSelectedPublicUnitId(unit.id);
                    setAvailability(null);
                    setRequestStatus(null);
                    setCalendarRefreshKey((value) => value + 1);
                  }}
                >
                  <strong>{publicUnitName}</strong>
                  <span>{isSelected ? "Selezionato" : getUnitCardBadge(unit)}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="selected-unit-panel">
          <div className="selected-unit-photo">
            <button
              type="button"
              onClick={() => {
                setActivePhotoIndex(0);
                window.setTimeout(() => document.getElementById("foto")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
              }}
              aria-label={`Guarda le foto di ${selectedUnitName}`}
            >
              <img src={getUnitCover(selectedPublicUnit)} alt={selectedUnitName} />
              <span>
                {getUnitPhotos(selectedPublicUnit).length > 0
                  ? `${getUnitPhotos(selectedPublicUnit).length} foto`
                  : "Galleria"}
              </span>
            </button>
          </div>

          <div className="selected-unit-content">
            <div className="selected-unit-eyebrow">
              {publicUnits.length > 1 ? "Alloggio selezionato" : "Alloggio"}
            </div>
            <h3>{selectedUnitName}</h3>
            <p>{getUnitDescription(selectedPublicUnit)}</p>

            <div className="selected-unit-stats">
              {getUnitStats(selectedPublicUnit).map((stat) => (
                <span key={stat}>{stat}</span>
              ))}
            </div>

            <div className="selected-unit-actions">
              <button
                type="button"
                className="selected-unit-primary"
                onClick={() => {
                  setAvailability(null);
                  setRequestStatus(null);
                  setCalendarRefreshKey((value) => value + 1);
                  window.setTimeout(() => document.getElementById("disponibilita")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                }}
              >
                Verifica disponibilità
              </button>

              <button
                type="button"
                className="selected-unit-secondary"
                onClick={() => {
                  setActivePhotoIndex(0);
                  window.setTimeout(() => document.getElementById("foto")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                }}
              >
                Vedi foto
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="alloggio" className="amenities">
        <div><span>♙</span><strong>{selectedPublicUnit.maxGuests || 2} OSPITI</strong></div>
        <div><span>▭</span><strong>{selectedPublicUnit.bedrooms || 1} CAMERA</strong></div>
        <div><span>♨</span><strong>{selectedPublicUnit.bathrooms || 1} BAGNO</strong></div>
        {selectedPublicUnit.hasKitchen !== false && <div><span>◴</span><strong>CUCINA</strong></div>}
        <div><span>≋</span><strong>TERRAZZA VISTA MARE</strong></div>
      </section>

      <section className="why">
        <SectionTitle>PERCHÉ SCEGLIERE GELONE LUNGOMARE</SectionTitle>
        <div className="why-grid">
          <article>
            <i>●</i>
            <h3>POSIZIONE VICINO AL MARE</h3>
            <p>A pochi passi dal Lungomare Federico II e dalla spiaggia di Gela, comodo per soggiorni brevi e vacanze in Sicilia.</p>
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
        <div className="gallery-layout">
          <button type="button" className="gallery-feature" onClick={() => openGallery(0)} aria-label="Apri foto principale">
            <img src={galleryPhotos[0]} alt={`Foto principale ${selectedPublicUnit.publicName || selectedPublicUnit.name || "Gelone Lungomare"}`} />
            <span>Apri galleria</span>
          </button>

          <div className="gallery-grid" aria-label="Anteprima foto alloggio">
            {galleryPreview.slice(1).map((src, index) => {
              const realIndex = index + 1;
              const remaining = galleryPhotos.length - galleryPreview.length;
              const isLastPreview = realIndex === galleryPreview.length - 1 && remaining > 0;

              return (
                <button
                  key={`${src}-${realIndex}`}
                  type="button"
                  className="gallery-thumb"
                  onClick={() => openGallery(realIndex)}
                  aria-label={`Apri foto ${realIndex + 1}`}
                >
                  <img src={src} alt={`Foto ${selectedPublicUnit.publicName || selectedPublicUnit.name || "Gelone Lungomare"} ${realIndex + 1}`} />
                  {isLastPreview && <span className="more-photos">+{remaining}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <button className="photo-button" type="button" onClick={() => openGallery(0)}>VEDI TUTTE LE FOTO <span>▧</span></button>
      </section>

      <section id="disponibilita" className="availability">
        <div className="availability-card">
          <div className="availability-form-wrap">
            <SectionTitle>DISPONIBILITÀ E PRENOTAZIONE</SectionTitle>
            <p className="selected-unit-strip">Alloggio selezionato: <strong>{selectedUnitName}</strong></p>
            <form className="date-form" onSubmit={checkAvailability}>
              <label>
                <span>Check-in</span>
                <input min={minCheckIn} value={checkIn} onChange={(e) => {
                  setCheckIn(e.target.value);
                  setAvailability(null);
                  setRequestStatus(null);
                  if (!checkOut || checkOut <= e.target.value) setCheckOut(addDaysIso(e.target.value, 1));
                }} type="date" />
              </label>
              <label>
                <span>Check-out</span>
                <input min={checkIn ? addDaysIso(checkIn, 1) : minCheckIn} value={checkOut} onChange={(e) => {
                  setCheckOut(e.target.value);
                  setAvailability(null);
                  setRequestStatus(null);
                }} type="date" />
              </label>
              <label>
                <span>Ospiti</span>
                <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                  {Array.from({ length: Math.max(1, Number(selectedPublicUnit.maxGuests || 2)) }, (_, index) => index + 1).map((guestCount) => (
                    <option key={guestCount} value={String(guestCount)}>
                      {guestCount} {guestCount === 1 ? "ospite" : "ospiti"}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={loading} type="submit">{loading ? "VERIFICA..." : "VERIFICA DISPONIBILITÀ"} <span>▣</span></button>
            </form>
            <div className="price-box">
              <div>
                <span>Tariffa diretta</span>
                <strong>da {formatEuro(pricing.nightlyRate)} / notte</strong>
                <small>Nessuna commissione portale. Su Booking è più alta.</small>
              </div>
              {priceEstimate.nights > 0 && (
                <div>
                  <span>Totale stimato</span>
                  <strong>{formatEuro(priceEstimate.total)}</strong>
                  <small>per {formatNightsLabel(priceEstimate.nights)}{priceEstimate.cleaningFee > 0 ? `, pulizie incluse ${formatEuro(priceEstimate.cleaningFee)}` : ""}</small>
                </div>
              )}
              {priceEstimate.depositAmount > 0 && (
                <div>
                  <span>Caparra indicativa</span>
                  <strong>{formatEuro(priceEstimate.depositAmount)}</strong>
                  <small>{pricing.depositPercent}% per conferma, salvo accordi diretti.</small>
                </div>
              )}
            </div>
            <p className="best-rate">♡ {pricing.directRateText}</p>
            <p className={pricing.directPaymentEnabled ? "payment-mode-banner on" : "payment-mode-banner off"}>
              {pricing.directPaymentEnabled
                ? "Pagamento online attivo: dopo la verifica disponibilità puoi pagare la caparra con Stripe."
                : "Pagamento online non attivo: l'ospite può inviare solo una richiesta senza pagamento."}
            </p>

            {availability && (
              <div className={availability.ok ? "notice ok" : "notice no"}>{availability.message}</div>
            )}

            {availability?.ok && (
              <form id="prenota-diretta" className="guest-form" onSubmit={createBookingRequest}>
                <div className="guest-form-title">
                  <strong>Completa la prenotazione</strong>
                  <span>Inserisci i dati, accetta privacy e condizioni, poi scegli se pagare la caparra o inviare solo richiesta.</span>
                </div>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome e cognome" />
                <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" type="email" />
                <input value={guestEmailConfirm} onChange={(e) => setGuestEmailConfirm(e.target.value)} placeholder="Conferma email" type="email" />
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Telefono" />
                <input
                  className="bot-trap"
                  value={botTrap}
                  onChange={(e) => setBotTrap(e.target.value)}
                  tabIndex="-1"
                  autoComplete="off"
                  aria-hidden="true"
                  placeholder="Sito web"
                />
                <div className="cancellation-summary">
                  <strong>Condizioni cancellazione:</strong>
                  rimborso totale fino a 14 giorni prima del check-in; da 13 a 7 giorni prima viene trattenuta la caparra;
                  negli ultimi 6 giorni, no-show o partenza anticipata gli importi versati non sono rimborsabili salvo diverso accordo scritto.
                </div>
                <label className="privacy-consent">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  />
                  <span>
                    Ho letto e accetto
                    <button type="button" className="inline-legal" onClick={() => setLegalPage("privacy")}>Privacy Policy</button>,
                    <button type="button" className="inline-legal" onClick={() => setLegalPage("cookie")}>Cookie Policy</button>
                    e
                    <button type="button" className="inline-legal" onClick={() => setLegalPage("terms")}>Termini e condizioni, incluse cancellazioni e rimborsi</button>.
                  </span>
                </label>
                {pricing.directPaymentEnabled ? (
                  <button
                    disabled={loading}
                    type="button"
                    className="pay-now-button"
                    onClick={createBookingAndPay}
                  >
                    {loading ? "ATTENDI..." : `PRENOTA E PAGA CAPARRA ${formatEuro(priceEstimate.depositAmount || priceEstimate.total)}`}
                  </button>
                ) : (
                  <div className="payment-disabled-note">
                    Pagamento online disattivato dall'admin. L'ospite può inviare solo una richiesta.
                  </div>
                )}
                <button disabled={loading} type="submit" className="request-only-button">
                  INVIA RICHIESTA SENZA PAGAMENTO
                </button>
              </form>
            )}

            {requestStatus && <div className={requestStatus.ok ? "notice ok" : "notice no"}>{requestStatus.message}</div>}
          </div>

          <div className="calendar-box">
            <div className="calendar-top">
              <button type="button" onClick={() => changeCalendarMonth(-1)} aria-label="Mese precedente">‹</button>
              <strong>{getMonthLabel(calendarMonth)}</strong>
              <button type="button" onClick={() => changeCalendarMonth(1)} aria-label="Mese successivo">›</button>
            </div>

            <div className="calendar-grid labels">
              {["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"].map((d) => <b key={d}>{d}</b>)}
            </div>

            <div className="calendar-grid calendar-days">
              {calendarDays.map((day) => {
                const status = calendarStatusByDate[day.iso];
                const isSelectedNight = selectedNights.includes(day.iso);
                const isCheckIn = checkIn === day.iso;
                const isCheckOut = checkOut === day.iso;
                const className = [
                  !day.inCurrentMonth ? "muted" : "",
                  day.isPast ? "past" : "",
                  status ? "busy" : "free",
                  status === "blocked" ? "blocked" : "",
                  ["pending_direct", "pending"].includes(status) ? "pending" : "",
                  isSelectedNight ? "selected" : "",
                  isCheckIn ? "edge" : "",
                  isCheckOut ? "checkout-edge" : "",
                ].filter(Boolean).join(" ");

                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={day.isPast || Boolean(status)}
                    onClick={() => selectCalendarDate(day.iso)}
                    className={className}
                    title={`${day.iso} - ${getCalendarStatusLabel(status)}`}
                  >
                    <span>{day.day}</span>
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend">
              <span><i className="free" /> Libero</span>
              <span><i className="busy" /> Occupato</span>
              <span><i className="blocked" /> Bloccato</span>
              <span><i className="selected" /> Selezionato</span>
            </div>

            <p className="calendar-note">
              {calendarLoading
                ? "Aggiornamento disponibilità..."
                : "Calendario collegato alle notti salvate nel PMS: prenotazioni, blocchi, Booking e Airbnb sincronizzati."}
            </p>
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
        <div className="footer-legal">
          <h3>INFORMAZIONI LEGALI</h3>
          <button type="button" onClick={() => setLegalPage("privacy")}>Privacy Policy</button>
          <button type="button" onClick={() => setLegalPage("cookie")}>Cookie Policy</button>
          <button type="button" onClick={() => setLegalPage("terms")}>Termini e condizioni</button>
        </div>
      </footer>
      <div className="copyright">© 2026 Gelone Lungomare – Locazione Turistica. Tutti i diritti riservati.</div>

      {activePhotoIndex !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Galleria foto" onClick={closeGallery}>
          <button type="button" className="lightbox-close" onClick={closeGallery} aria-label="Chiudi galleria">×</button>
          {galleryPhotos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav prev"
              onClick={(event) => { event.stopPropagation(); moveGallery(-1); }}
              aria-label="Foto precedente"
            >
              ‹
            </button>
          )}
          <figure className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <img
              src={galleryPhotos[activePhotoIndex]}
              alt={`Foto ${activePhotoIndex + 1} ${selectedPublicUnit.publicName || selectedPublicUnit.name || "Gelone Lungomare"}`}
            />
            <figcaption>
              {selectedPublicUnit.publicName || selectedPublicUnit.name || "Gelone Lungomare"} · Foto {activePhotoIndex + 1} di {galleryPhotos.length}
            </figcaption>
          </figure>
          {galleryPhotos.length > 1 && (
            <button
              type="button"
              className="lightbox-nav next"
              onClick={(event) => { event.stopPropagation(); moveGallery(1); }}
              aria-label="Foto successiva"
            >
              ›
            </button>
          )}
        </div>
      )}
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
.top-cta { justify-self: end; background: linear-gradient(180deg, #c29523, #a77a0e); color: #fff; border-radius: 5px; padding: 17px 24px; min-width: 205px; text-align: center; font-weight: 800; font-size: 17px; letter-spacing: .02em; box-shadow: 0 12px 24px rgba(130, 92, 5, .18); }
.top-cta span { margin-left: 8px; font-size: 15px; }

.payment-return-banner {
  margin: 18px auto 0;
  width: min(1050px, calc(100% - 32px));
  display: grid;
  gap: 16px;
  padding: 20px 22px;
  border-radius: 16px;
  border: 1px solid rgba(47, 125, 78, .22);
  background: linear-gradient(180deg, rgba(47, 125, 78, .12), rgba(255,255,255,.82));
  color: #1e623b;
  box-shadow: 0 18px 44px rgba(13,25,43,.10);
}
.payment-return-banner.no {
  border-color: rgba(154, 72, 47, .22);
  background: rgba(154, 72, 47, .10);
  color: #8a351e;
}
.payment-return-head {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.payment-return-icon {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #1e623b;
  color: #fff;
  font-size: 25px;
  font-weight: 900;
  flex: 0 0 auto;
}
.payment-return-banner.no .payment-return-icon {
  background: #8a351e;
}
.payment-return-banner strong {
  display: block;
  font-size: 21px;
  letter-spacing: .03em;
}
.payment-return-banner p {
  margin: 5px 0 0;
  font-size: 14px;
  line-height: 1.45;
}
.payment-return-banner small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  opacity: .78;
  word-break: break-all;
}
.payment-return-body {
  display: grid;
  gap: 14px;
}
.payment-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.payment-summary-grid div,
.payment-summary-note,
.payment-next-steps {
  border: 1px solid rgba(7,31,61,.10);
  background: rgba(255,255,255,.76);
  border-radius: 10px;
  padding: 12px;
}
.payment-summary-grid span {
  display: block;
  color: var(--gold);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .10em;
  margin-bottom: 4px;
}
.payment-summary-grid b {
  display: block;
  color: var(--navy);
  font-size: 15px;
}
.payment-summary-note {
  color: var(--navy);
  font-size: 14px;
  line-height: 1.45;
}
.payment-next-steps strong {
  color: var(--navy);
  font-size: 16px;
}
.payment-cancelled-card {
  border: 1px solid rgba(154,72,47,.18);
  background: rgba(255,255,255,.78);
  border-radius: 12px;
  padding: 14px;
  color: var(--navy);
}
.payment-cancelled-card strong {
  color: #8a351e;
  font-size: 17px;
}
.payment-cancelled-card p {
  margin: 6px 0 10px;
  color: rgba(7,31,61,.78);
}
.payment-cancelled-card ul {
  margin: 0;
  padding-left: 18px;
  color: rgba(7,31,61,.74);
  font-size: 14px;
  line-height: 1.55;
}
.payment-retry-error {
  margin-top: 12px;
  border: 1px solid rgba(154,72,47,.20);
  background: rgba(154,72,47,.08);
  color: #8a351e;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
}
.payment-next-steps p {
  color: rgba(7,31,61,.74);
}
.payment-return-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.payment-return-actions a,
.payment-return-actions button {
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: var(--navy);
  padding: 10px 16px;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
}
.payment-return-actions a {
  background: #1e623b;
  color: #fff;
}

.hero { position: relative; min-height: 430px; overflow: hidden; isolation: isolate; background: #d7d4c7; }
.hero-video { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: cover; object-position: center center; transform: scale(1.006); }
.hero::after { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(251,248,239,.52) 0%, rgba(251,248,239,.32) 24%, rgba(251,248,239,.08) 47%, rgba(251,248,239,0) 66%); pointer-events: none; }
.hero-readable { position: absolute; left: 0; top: 0; bottom: 0; width: 45%; z-index: 2; background: linear-gradient(90deg, rgba(251,248,239,.18), rgba(251,248,239,.04), rgba(251,248,239,0)); pointer-events: none; }
.hero-bottom-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 104px; z-index: 3; background: linear-gradient(180deg, rgba(251,248,239,0), rgba(251,248,239,.72) 70%, var(--cream)); pointer-events: none; }
.hero-content { position: relative; z-index: 4; width: min(420px, 40%); padding: 22px 0 112px 64px; }
.legal-line { margin: 0 0 28px; font-size: 14px; font-weight: 800; letter-spacing: .07em; white-space: nowrap; text-shadow: 0 1px 12px rgba(255,255,255,.70); }
.legal-line span { color: var(--gold); margin: 0 18px; }
.hero h1 { margin: 0; max-width: 410px; font-size: clamp(27px, 2.35vw, 35px); line-height: 1.16; font-weight: 500; letter-spacing: .035em; text-wrap: balance; text-shadow: 0 2px 14px rgba(255,255,255,.65); }
.gold-rule { width: 200px; height: 1px; margin: 18px 0 18px; background: linear-gradient(90deg, var(--gold), rgba(180,134,22,0)); position: relative; }
.gold-rule::after { content: ''; position: absolute; top: -4px; left: 130px; width: 9px; height: 9px; background: var(--gold); transform: rotate(45deg); }
.hero-copy { margin: 0; max-width: 390px; font-size: 15px; line-height: 1.52; font-family: Georgia, 'Times New Roman', serif; color: rgba(7,31,61,.96); text-shadow: 0 1px 12px rgba(255,255,255,.72); }

.booking-cards { position: relative; z-index: 5; margin: -38px auto 0; width: min(900px, calc(100% - 170px)); display: grid; grid-template-columns: 1.08fr .92fr .92fr .92fr; gap: 16px; align-items: stretch; }
.booking-card { min-height: 58px; border-radius: 7px; display: flex; align-items: center; justify-content: center; box-shadow: 0 13px 30px rgba(13,25,43,.12); border: 1px solid rgba(140, 109, 50, .20); background: rgba(255,255,255,.94); backdrop-filter: blur(4px); }
.booking-card.direct { background: var(--navy); color: #fff; justify-content: flex-start; padding: 8px 14px; border: 2px solid var(--gold); gap: 13px; }
.booking-card.direct img { width: 42px; height: 36px; object-fit: contain; flex: 0 0 auto; opacity: .95; }
.booking-card.direct span { display: grid; gap: 2px; }
.booking-card.direct strong { font-size: 14px; letter-spacing: .08em; }
.booking-card.direct b { color: var(--gold2); font-size: 12.5px; letter-spacing: .14em; }
.booking-card.direct em { font-size: 11px; font-style: normal; }
.booking-card.portal { gap: 12px; font-size: 17px; font-weight: 800; letter-spacing: .015em; }
.booking-b { color: #0b5ea8; font-size: 28px; line-height: 1; }
.airbnb-mark { color: #e55b72; font-size: 32px; line-height: 1; font-family: Arial, sans-serif; font-weight: 400; }
.whatsapp-mark { color: #23bd60; font-size: 32px; line-height: .8; }

.amenities { margin: 34px auto 0; width: min(1050px, calc(100% - 120px)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid; grid-template-columns: repeat(5, 1fr); }
.amenities div { min-height: 76px; display: flex; align-items: center; justify-content: center; gap: 16px; border-right: 1px solid var(--line); text-align: center; }
.amenities div:last-child { border-right: none; }
.amenities span { color: var(--gold); font-size: 27px; font-family: Georgia, serif; }
.amenities strong { font-size: 15px; letter-spacing: .11em; line-height: 1.25; }

.section-title { text-align: center; margin: 30px 0 22px; }
.section-title h2 { margin: 0; font-size: clamp(20px, 2.2vw, 28px); letter-spacing: .08em; font-weight: 700; }
.section-title span { display: block; width: 122px; height: 1px; margin: 13px auto 0; background: var(--gold); position: relative; }
.section-title span::after { content: ''; position: absolute; left: 50%; top: -4px; width: 9px; height: 9px; background: var(--gold); transform: translateX(-50%) rotate(45deg); }

.why, .gallery-section, .availability, .position, .units-showcase { padding: 0 58px; }
.units-intro { width: min(880px, 100%); margin: 0 auto 20px; text-align: center; }
.eyebrow { margin: 26px 0 -18px; color: var(--gold); font-size: 12px; font-weight: 900; letter-spacing: .22em; text-transform: uppercase; }
.units-intro p:not(.eyebrow) { margin: -4px auto 0; max-width: 720px; color: rgba(7,31,61,.76); font-size: 15px; line-height: 1.55; }
.unit-showcase-grid { width: min(1050px, 100%); margin: 0 auto 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 20px; }
.unit-showcase-grid.single { grid-template-columns: minmax(0, 820px); justify-content: center; }
.unit-showcase-card { min-height: 270px; display: grid; grid-template-columns: minmax(240px, .85fr) minmax(0, 1fr); gap: 0; align-items: stretch; border: 1px solid rgba(180,134,22,.24); border-radius: 12px; overflow: hidden; background: rgba(255,250,241,.96); text-align: left; box-shadow: 0 20px 55px rgba(10,29,53,.09); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
.unit-showcase-card:hover, .unit-showcase-card.active { transform: translateY(-2px); border-color: rgba(180,134,22,.65); box-shadow: 0 26px 68px rgba(10,29,53,.14); }
.unit-photo-button { position: relative; width: 100%; min-height: 100%; border: 0; padding: 0; background: #eadfce; cursor: pointer; overflow: hidden; }
.unit-photo-button img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .45s ease, filter .45s ease; }
.unit-photo-button:hover img { transform: scale(1.045); filter: brightness(.92); }
.unit-photo-button span { position: absolute; left: 16px; bottom: 16px; padding: 8px 12px; border-radius: 999px; background: rgba(7,31,61,.88); color: #fff; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.unit-card-body { padding: 28px 28px 24px; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
.unit-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.unit-card-topline em { color: #b48616; font-size: .72rem; font-style: normal; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
.unit-card-topline b { color: rgba(7,31,61,.48); font-size: .70rem; letter-spacing: .10em; text-transform: uppercase; }
.unit-card-body h3 { margin: 0; color: #0a1d35; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(1.75rem, 3vw, 2.35rem); line-height: 1.02; }
.unit-card-body p { margin: 0; color: #5f5548; font-size: .98rem; line-height: 1.55; }
.unit-stat-list { display: flex; flex-wrap: wrap; gap: 8px; }
.unit-stat-list span { padding: 7px 10px; border-radius: 999px; background: rgba(180,134,22,.10); border: 1px solid rgba(180,134,22,.18); color: var(--navy); font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.unit-card-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.unit-card-actions button { min-height: 40px; border-radius: 999px; padding: 0 16px; cursor: pointer; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; font-size: 12px; }
.unit-primary-action { border: 0; background: var(--navy); color: #fff; }
.unit-secondary-action { border: 1px solid rgba(7,31,61,.18); background: rgba(255,255,255,.55); color: var(--navy); }
.why-grid { width: min(1050px, 100%); margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.why-grid article { background: rgba(255,255,255,.45); border: 1px solid rgba(180,134,22,.22); border-radius: 7px; padding: 25px 28px 24px; text-align: center; min-height: 175px; }
.why-grid i { width: 58px; height: 58px; margin: 0 auto 14px; border-radius: 50%; background: rgba(180,134,22,.08); border: 1px solid rgba(180,134,22,.16); display: grid; place-items: center; color: var(--gold); font-style: normal; font-size: 22px; }
.why-grid h3 { margin: 0 0 10px; font-size: 16px; line-height: 1.18; letter-spacing: .05em; }
.why-grid p { margin: 0; font-size: 14px; line-height: 1.48; }

.gallery-section { padding-top: 4px; }
.gallery-layout { width: min(1050px, 100%); margin: 0 auto; display: grid; grid-template-columns: 1.35fr .9fr; gap: 14px; align-items: stretch; }
.gallery-feature, .gallery-thumb { border: 0; padding: 0; position: relative; overflow: hidden; background: #eee; cursor: pointer; box-shadow: 0 0 0 1px rgba(180,134,22,.22); }
.gallery-feature { min-height: 360px; border-radius: 9px; }
.gallery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.gallery-thumb { min-height: 173px; border-radius: 7px; }
.gallery-feature img, .gallery-thumb img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .45s ease, filter .45s ease; }
.gallery-feature:hover img, .gallery-thumb:hover img { transform: scale(1.045); filter: brightness(.92); }
.gallery-feature span { position: absolute; left: 18px; bottom: 18px; padding: 10px 14px; border-radius: 999px; background: rgba(7,31,61,.88); color: #fff; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.more-photos { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(7,31,61,.58); color: #fff; font-size: 32px; font-weight: 900; }
.photo-button { width: 250px; height: 38px; margin: 14px auto 0; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--navy); color: #fff; border-radius: 4px; font-size: 14px; font-weight: 800; letter-spacing: .08em; cursor: pointer; }
.lightbox { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 28px 76px; background: rgba(3,12,24,.88); backdrop-filter: blur(6px); }
.lightbox-content { width: min(1120px, 100%); margin: 0; display: grid; gap: 12px; color: #fff; text-align: center; }
.lightbox-content img { max-width: 100%; max-height: 78vh; margin: 0 auto; object-fit: contain; border-radius: 10px; box-shadow: 0 28px 90px rgba(0,0,0,.42); }
.lightbox-content figcaption { font-size: 14px; letter-spacing: .04em; color: rgba(255,255,255,.82); }
.lightbox-close, .lightbox-nav { position: fixed; border: 0; border-radius: 999px; background: rgba(255,255,255,.92); color: var(--navy); cursor: pointer; display: grid; place-items: center; box-shadow: 0 16px 50px rgba(0,0,0,.28); }
.lightbox-close { top: 20px; right: 22px; width: 44px; height: 44px; font-size: 34px; line-height: 1; }
.lightbox-nav { top: 50%; width: 52px; height: 52px; transform: translateY(-50%); font-size: 44px; line-height: 1; }
.lightbox-nav.prev { left: 18px; }
.lightbox-nav.next { right: 18px; }

.availability-card { width: min(1050px, 100%); margin: 28px auto 0; border: 1px solid rgba(180,134,22,.20); border-radius: 8px; display: grid; grid-template-columns: 1.25fr .9fr; overflow: hidden; background: rgba(255,255,255,.32); }
.availability-form-wrap { padding: 0 34px 28px; }
.selected-unit-strip { margin: -7px 0 18px; padding: 10px 14px; border-radius: 999px; background: rgba(180,134,22,.10); border: 1px solid rgba(180,134,22,.18); text-align: center; font-size: 14px; color: rgba(7,31,61,.76); }
.selected-unit-strip strong { color: var(--navy); }
.date-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.date-form label { display: grid; gap: 7px; padding: 13px 14px; background: rgba(255,255,255,.55); border: 1px solid rgba(180,134,22,.18); border-radius: 6px; }
.date-form label span { font-size: 13px; font-weight: 800; }
.date-form input, .date-form select, .guest-form input { border: 0; background: transparent; color: var(--navy); min-width: 0; outline: none; font-family: Georgia, serif; }
.date-form button { grid-column: 1 / -1; height: 48px; border: 0; border-radius: 5px; background: linear-gradient(180deg, #c39726, #a5790e); color: #fff; font-weight: 800; letter-spacing: .07em; cursor: pointer; }
.price-box { margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.price-box div { background: rgba(255,255,255,.72); border: 1px solid rgba(180,134,22,.20); border-radius: 8px; padding: 13px 14px; display: grid; gap: 4px; }
.price-box span { font-size: 11px; font-weight: 800; letter-spacing: .12em; color: var(--gold); text-transform: uppercase; }
.price-box strong { font-size: 20px; color: var(--navy); }
.price-box small { font-size: 12px; line-height: 1.35; color: rgba(7,31,61,.72); }
.best-rate { text-align: center; margin: 13px 0 0; font-size: 15px; }
.payment-mode-banner {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  text-align: center;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
}
.payment-mode-banner.on {
  background: rgba(47,125,78,.10);
  color: #1e623b;
  border: 1px solid rgba(47,125,78,.20);
}
.payment-mode-banner.off {
  background: rgba(154,72,47,.08);
  color: #8a351e;
  border: 1px solid rgba(154,72,47,.18);
}
.notice { margin: 14px 0 0; padding: 12px 14px; border-radius: 6px; font-size: 14px; text-align: center; }
.notice.ok { background: rgba(47, 125, 78, .10); color: #1e623b; border: 1px solid rgba(47, 125, 78, .18); }
.notice.no { background: rgba(154, 72, 47, .10); color: #8a351e; border: 1px solid rgba(154, 72, 47, .18); }
.guest-form { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; scroll-margin-top: 110px; }
.guest-form-title {
  grid-column: 1 / -1;
  border: 1px solid rgba(7,31,61,.12);
  background: rgba(255,255,255,.72);
  border-radius: 8px;
  padding: 13px 14px;
  color: var(--navy);
}
.guest-form-title strong {
  display: block;
  font-size: 17px;
  margin-bottom: 5px;
}
.guest-form-title span {
  display: block;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(7,31,61,.74);
}
.guest-form input { background: rgba(255,255,255,.7); border: 1px solid rgba(180,134,22,.18); border-radius: 6px; padding: 12px; }
.guest-form button { grid-column: 1 / -1; border: 0; border-radius: 5px; background: var(--navy); color: #fff; padding: 13px; font-weight: 800; letter-spacing: .06em; cursor: pointer; }
.guest-form .pay-now-button { background: linear-gradient(180deg, #c39726, #a5790e); color: #fff; }
.guest-form .request-only-button { background: rgba(255,255,255,.74); color: var(--navy); border: 1px solid rgba(7,31,61,.18); }
.payment-disabled-note {
  grid-column: 1 / -1;
  border: 1px solid rgba(154,72,47,.18);
  background: rgba(154,72,47,.08);
  color: #8a351e;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
  font-size: 14px;
}
.bot-trap {
  position: absolute !important;
  left: -9999px !important;
  width: 1px !important;
  height: 1px !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.cancellation-summary {
  grid-column: 1 / -1;
  border: 1px solid rgba(180,134,22,.28);
  background: rgba(180,134,22,.10);
  color: #0a1d35;
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.48;
}
.cancellation-summary strong {
  color: var(--gold);
}

.privacy-consent {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid rgba(180,134,22,.20);
  background: rgba(255,255,255,.62);
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.45;
}
.privacy-consent input { margin-top: 4px; flex: 0 0 auto; }
.inline-legal {
  display: inline;
  border: 0;
  background: transparent;
  color: var(--gold);
  padding: 0 3px;
  font-weight: 900;
  text-decoration: underline;
  cursor: pointer;
}
.legal-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(3,12,24,.78);
  backdrop-filter: blur(5px);
}
.legal-card {
  width: min(880px, 100%);
  max-height: 88vh;
  overflow: auto;
  border-radius: 18px;
  background: var(--paper);
  color: var(--navy);
  box-shadow: 0 28px 90px rgba(0,0,0,.32);
  border: 1px solid rgba(180,134,22,.28);
}
.legal-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 22px 26px;
  border-bottom: 1px solid rgba(180,134,22,.20);
  background: rgba(255,253,247,.98);
}
.legal-head p {
  margin: 0 0 5px;
  color: var(--gold);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .22em;
  text-transform: uppercase;
}
.legal-head h2 { margin: 0; font-size: 30px; }
.legal-head button {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 999px;
  background: var(--navy);
  color: #fff;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
}
.legal-page-content { padding: 24px 28px 30px; }
.legal-page-content h3 { margin: 24px 0 8px; color: var(--gold); font-size: 18px; }
.legal-page-content p { margin: 0 0 12px; line-height: 1.68; font-size: 15px; }
.footer-legal { display: grid; gap: 8px; }
.footer-legal button {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}
.calendar-box { border-left: 1px solid rgba(180,134,22,.16); padding: 32px 42px; background: rgba(255,255,255,.32); }
.calendar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
.calendar-top strong { letter-spacing: .06em; text-align: center; }
.calendar-top button { width: 34px; height: 34px; border: 1px solid rgba(180,134,22,.25); border-radius: 999px; background: rgba(255,255,255,.72); color: var(--navy); font-size: 22px; cursor: pointer; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px 14px; text-align: center; font-size: 14px; }
.calendar-grid.labels { margin-bottom: 9px; font-size: 11px; color: rgba(7,31,61,.82); }
.calendar-days button { aspect-ratio: 1 / 1; border: 1px solid rgba(7,31,61,.08); border-radius: 999px; background: rgba(255,255,255,.62); color: var(--navy); font-family: Georgia, serif; cursor: pointer; transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.calendar-days button:not(:disabled):hover { transform: translateY(-1px); border-color: rgba(180,134,22,.48); background: rgba(255,255,255,.92); }
.calendar-days button.muted { opacity: .32; }
.calendar-days button.past { opacity: .24; cursor: not-allowed; }
.calendar-days button.busy { background: rgba(154,72,47,.14); border-color: rgba(154,72,47,.30); color: #7a2c18; cursor: not-allowed; text-decoration: line-through; }
.calendar-days button.blocked { background: rgba(7,31,61,.12); border-color: rgba(7,31,61,.28); color: var(--navy); }
.calendar-days button.pending { background: rgba(180,134,22,.16); border-color: rgba(180,134,22,.34); color: #8a640e; }
.calendar-days button.selected { background: rgba(180,134,22,.22); border-color: rgba(180,134,22,.70); box-shadow: inset 0 0 0 2px rgba(255,255,255,.65); }
.calendar-days button.edge { background: var(--gold); color: #fff; border-color: var(--gold); text-decoration: none; }
.calendar-days button.checkout-edge { border-color: var(--navy); box-shadow: inset 0 0 0 2px rgba(7,31,61,.16); }
.calendar-legend { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 12px; color: rgba(7,31,61,.78); }
.calendar-legend span { display: inline-flex; align-items: center; gap: 6px; }
.calendar-legend i { width: 11px; height: 11px; border-radius: 999px; border: 1px solid rgba(7,31,61,.12); background: rgba(255,255,255,.8); }
.calendar-legend i.busy { background: rgba(154,72,47,.20); border-color: rgba(154,72,47,.32); }
.calendar-legend i.blocked { background: rgba(7,31,61,.16); border-color: rgba(7,31,61,.30); }
.calendar-legend i.selected { background: rgba(180,134,22,.28); border-color: rgba(180,134,22,.70); }
.calendar-note { margin: 14px 0 0; font-size: 12px; line-height: 1.45; color: rgba(7,31,61,.70); }

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
  .hero { min-height: 500px; }
  .hero-video { object-position: center center; }
  .hero::after { background: linear-gradient(180deg, rgba(251,248,239,.64), rgba(251,248,239,.20), rgba(251,248,239,0)); }
  .hero-readable { width: 100%; }
  .hero-content { width: 100%; padding: 20px 24px 185px; }
  .hero h1 { font-size: 34px; max-width: 430px; }
  .legal-line { font-size: 13px; margin-bottom: 26px; }
  .payment-summary-grid { grid-template-columns: 1fr 1fr; }
  .payment-return-actions { justify-content: stretch; }
  .payment-return-actions a,
  .payment-return-actions button { flex: 1; text-align: center; }
  .booking-cards { width: calc(100% - 32px); margin-top: -118px; grid-template-columns: 1fr 1fr; gap: 10px; }
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
  .why, .gallery-section, .availability, .position, .units-showcase { padding: 0 16px; }
  .why-grid, .unit-showcase-grid, .availability-card, .position-card, .footer { grid-template-columns: 1fr; }
  .unit-showcase-grid.single { grid-template-columns: 1fr; }
  .unit-showcase-card { grid-template-columns: 1fr; min-height: 0; }
  .unit-photo-button { min-height: 240px; }
  .unit-card-body { padding: 22px 20px 20px; }
  .unit-card-topline { align-items: flex-start; flex-direction: column; gap: 6px; }
  .unit-card-actions { flex-direction: column; }
  .unit-card-actions button { width: 100%; }
  .gallery-layout { grid-template-columns: 1fr; }
  .gallery-feature { min-height: 280px; }
  .gallery-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .gallery-thumb { min-height: 125px; }
  .lightbox { padding: 72px 14px 24px; }
  .lightbox-content img { max-height: 70vh; }
  .lightbox-nav { width: 44px; height: 44px; font-size: 38px; background: rgba(255,255,255,.86); }
  .calendar-box { border-left: 0; border-top: 1px solid rgba(180,134,22,.16); padding: 22px; }
  /* mobile privacy payment fix */
  .date-form, .guest-form { grid-template-columns: 1fr; }
  .guest-form { gap: 12px; }
  .guest-form input { font-size: 16px; padding: 14px; }
  .guest-form button { min-height: 52px; font-size: 14px; line-height: 1.25; }
  .privacy-consent { font-size: 14px; padding: 14px; }
  .privacy-consent input { width: 24px; height: 24px; margin-top: 1px; }
  .inline-legal { font-size: 14px; padding: 0 4px; }
  .guest-form { gap: 12px; }
  .guest-form input { font-size: 16px; padding: 14px; }
  .guest-form button { min-height: 52px; font-size: 14px; line-height: 1.25; }
  .privacy-consent { font-size: 14px; padding: 14px; }
  .privacy-consent input { width: 24px; height: 24px; margin-top: 1px; }
  .inline-legal { font-size: 14px; padding: 0 4px; }
  .map-card { grid-template-columns: 1fr; }
  .map-bg { min-height: 145px; }
  .footer { padding: 22px 26px; text-align: center; }
  .footer img { margin: 0 auto; }
  .contacts { justify-content: center; }
  .socials { justify-content: center; }
}
`;
