import React, { useEffect, useMemo, useState } from "react";
import {
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Building2,
  CalendarDays,
  Copy,
  ImagePlus,
  CreditCard,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Star,
  Trash2,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { auth, db, ADMIN_EMAILS, UNIT_ID } from "./firebase";
import { DEFAULT_UNIT, DEFAULT_UNITS, normalizeUnit, sanitizeUnitId } from "./units";

const defaultSettings = {
  checkInTime: "15:00",
  checkOutTime: "10:00",
  maxGuests: 2,
  wifiName: "lunarossa",
  wifiPassword: "gelone123",
  bookingIcalUrl: "",
  airbnbIcalUrl: "",
  welcomateUrl:
    "https://welcomate.it/guest/property/27a6597b-6fd5-4abe-84f7-bdabed6898c4?ota=DIRECT",
  notificationEmail: "info@gelone.it",
  nightlyRate: 70,
  cleaningFee: 0,
  minimumNights: 1,
  depositPercent: 30,
  directRateText: "Miglior tariffa prenotando dal sito",
  directPaymentEnabled: false,
};

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dnpbz05pr";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "gelone_units";
const CLOUDINARY_WIDGET_SCRIPT_ID = "cloudinary-upload-widget-script";
const CLOUDINARY_WIDGET_SCRIPT_URL = "https://upload-widget.cloudinary.com/latest/global/all.js";

function loadCloudinaryWidgetScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser non disponibile."));
  }

  if (window.cloudinary?.createUploadWidget) {
    return Promise.resolve(window.cloudinary);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(CLOUDINARY_WIDGET_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.cloudinary), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Widget Cloudinary non caricato.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = CLOUDINARY_WIDGET_SCRIPT_ID;
    script.src = CLOUDINARY_WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.cloudinary?.createUploadWidget) {
        resolve(window.cloudinary);
      } else {
        reject(new Error("Widget Cloudinary non disponibile dopo il caricamento."));
      }
    };
    script.onerror = () => reject(new Error("Impossibile caricare il widget Cloudinary."));
    document.body.appendChild(script);
  });
}

const sourceOptions = [
  { value: "manual", label: "Manuale" },
  { value: "direct_site", label: "Sito diretto" },
  { value: "booking", label: "Booking" },
  { value: "booking_ical", label: "Booking iCal" },
  { value: "airbnb", label: "Airbnb" },
  { value: "airbnb_ical", label: "Airbnb iCal" },
];

const statusOptions = [
  { value: "pending_direct", label: "Richiesta sito" },
  { value: "confirmed_direct", label: "Confermata" },
  { value: "pending", label: "Richiesta" },
  { value: "booking", label: "Booking" },
  { value: "imported_ical", label: "Importata iCal" },
  { value: "blocked", label: "Bloccata" },
  { value: "cancelled", label: "Cancellata" },
];

const paymentOptions = [
  { value: "unpaid", label: "Non pagato" },
  { value: "pending", label: "Pagamento in corso" },
  { value: "deposit_paid", label: "Caparra pagata" },
  { value: "paid", label: "Pagato" },
  { value: "failed", label: "Pagamento fallito" },
  { value: "expired", label: "Link scaduto" },
  { value: "refunded", label: "Rimborsato" },
];

const welcomateOptions = [
  { value: "to_send", label: "Da inviare" },
  { value: "sent", label: "Inviato" },
  { value: "completed", label: "Compilato" },
  { value: "missing", label: "Mancano dati" },
  { value: "not_needed", label: "Non necessario" },
];

function toDateInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getToday() {
  return toDateInputValue(new Date());
}

function parseDateAsUTC(dateString) {
  const [year, month, day] = String(dateString || "")
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getNightDates(checkIn, checkOut) {
  const nights = [];
  if (!checkIn || !checkOut) return nights;

  const cursor = parseDateAsUTC(checkIn);
  const end = parseDateAsUTC(checkOut);

  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    const date =
      typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatEuro(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(number);
}

function getNightsCount(checkIn, checkOut) {
  return getNightDates(checkIn, checkOut).length;
}

function getSourceLabel(source) {
  return sourceOptions.find((item) => item.value === source)?.label || source || "-";
}

function getStatusLabel(status) {
  return statusOptions.find((item) => item.value === status)?.label || status || "-";
}

function getPaymentLabel(paymentStatus) {
  return (
    paymentOptions.find((item) => item.value === paymentStatus)?.label ||
    "Non pagato"
  );
}

function getWelcomateLabel(welcomateStatus) {
  return (
    welcomateOptions.find((item) => item.value === welcomateStatus)?.label ||
    "Da inviare"
  );
}

function getWelcomateClass(welcomateStatus) {
  if (welcomateStatus === "completed") {
    return "border-green-200 bg-green-50 text-green-900";
  }

  if (welcomateStatus === "sent") {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }

  if (welcomateStatus === "missing") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (welcomateStatus === "not_needed") {
    return "border-slate-200 bg-slate-100 text-slate-900";
  }

  return "border-amber-200 bg-amber-50 text-amber-900";
}

function getStatusClass(status) {
  if (status === "confirmed_direct" || status === "booking") {
    return "border-green-200 bg-green-50 text-green-900";
  }

  if (status === "pending_direct" || status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "blocked") {
    return "border-slate-200 bg-slate-100 text-slate-900";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  return "border-[#e4d8c2] bg-[#faf6ee] text-[#0a1d35]";
}

function normalizePhoneForWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("39")) return digits;
  return `39${digits}`;
}

function cleanMoneyValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

async function copyToClipboard(text) {
  const value = String(text || "");

  if (navigator?.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      console.warn("Clipboard API non disponibile:", err);
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch (err) {
    console.warn("Fallback copia non riuscito:", err);
    return false;
  }
}

function buildWhatsAppMessage(booking, settings) {
  const name = booking.guestName || "ospite";
  const checkIn = formatDate(booking.checkIn);
  const checkOut = formatDate(booking.checkOut);

  return encodeURIComponent(
    `Ciao ${name}, ti contatto da Gelone Lungomare per la tua richiesta dal ${checkIn} al ${checkOut}. ` +
      `Per completare la prenotazione ti invio le informazioni e il link per la registrazione ospiti. ` +
      `${settings?.welcomateUrl ? `Link dati ospiti: ${settings.welcomateUrl}` : ""}`
  );
}

function buildWelcomateText(booking, settings) {
  const name = booking.guestName || "";
  const checkIn = formatDate(booking.checkIn);
  const checkOut = formatDate(booking.checkOut);
  const link = settings?.welcomateUrl || defaultSettings.welcomateUrl;

  return `Ciao ${name},

grazie per aver scelto Gelone Lungomare.

Per velocizzare il check-in e completare la registrazione obbligatoria degli ospiti per Polizia di Stato / Alloggiati Web e ISTAT, ti chiediamo di compilare il modulo online prima dell'arrivo tramite questo link sicuro:

${link}

Date richiesta:
Arrivo: ${checkIn}
Partenza: ${checkOut}

Grazie,
Orazio
Gelone Lungomare`;
}


function createUnitForm(unit = DEFAULT_UNIT) {
  const normalized = normalizeUnit(unit);

  return {
    id: normalized.id,
    name: normalized.name,
    publicName: normalized.publicName,
    description: normalized.description || "",
    maxGuests: String(normalized.maxGuests || 2),
    bedrooms: String(normalized.bedrooms || 1),
    bathrooms: String(normalized.bathrooms || 1),
    hasKitchen: Boolean(normalized.hasKitchen),
    cin: normalized.cin || "",
    cir: normalized.cir || "",
    active: Boolean(normalized.active),
    publicVisible: Boolean(normalized.publicVisible),
    welcomateEnabled: Boolean(normalized.welcomateEnabled),
    bookingUrl: normalized.bookingUrl || "",
    airbnbUrl: normalized.airbnbUrl || "",
    icalPath: normalized.icalPath || `/api/ical/${normalized.id}.ics`,
    sortOrder: String(normalized.sortOrder || 999),
    photos: Array.isArray(normalized.photos) ? normalized.photos : [],
  };
}

function LoginScreen() {
  const [email, setEmail] = useState("romitoorazio@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Inserisci email e password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Accesso non riuscito. Controlla email e password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf6ee] px-5 py-10 text-[#0a1d35]">
      <div className="mx-auto max-w-md rounded-[2rem] border border-[#e4d8c2] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
            Admin PMS
          </p>
          <h1 className="mt-3 font-serif text-4xl">Gelone Lungomare</h1>
          <p className="mt-3 leading-7 text-[#555]">
            Accedi per gestire prenotazioni, blocchi date, pagamenti e
            impostazioni della struttura.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Email admin</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 outline-none focus:border-[#9b6b25]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 outline-none focus:border-[#9b6b25]"
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white transition hover:bg-[#132f52] disabled:opacity-60"
          >
            <Lock size={18} />
            {loading ? "Accesso..." : "Entra"}
          </button>
        </form>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <div className="rounded-2xl border border-[#e4d8c2] bg-white p-5 shadow-sm">
      <Icon className="text-[#9b6b25]" size={28} />
      <p className="mt-3 text-sm uppercase tracking-[0.2em] text-[#9b6b25]">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#0a1d35]">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-[#666]">{subtitle}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-3 font-bold transition ${
        active ? "bg-[#0a1d35] text-white" : "bg-white text-[#0a1d35]"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, className = "", type = "button", disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#faf6ee] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#9b6b25]">{label}</p>
      <p className="mt-1 font-semibold text-[#0a1d35]">{value || "-"}</p>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [unitForm, setUnitForm] = useState(() => createUnitForm(DEFAULT_UNIT));
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedUnitId, setSelectedUnitId] = useState(UNIT_ID);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [settingsSavedAt, setSettingsSavedAt] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [manualCopy, setManualCopy] = useState({ title: "", text: "" });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [internalRecords, setInternalRecords] = useState([]);
  const [economyPeriod, setEconomyPeriod] = useState("all");
  const [economyDateFrom, setEconomyDateFrom] = useState("");
  const [economyDateTo, setEconomyDateTo] = useState("");
  const [internalRecordForm, setInternalRecordForm] = useState({
    category: "nota",
    title: "",
    note: "",
    priority: "Media",
    dueDate: "",
    linkedBookingId: "",
  });

  const [detailForm, setDetailForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    totalPrice: "",
    depositAmount: "",
    paymentStatus: "unpaid",
    welcomateStatus: "to_send",
    notes: "",
    internalNotes: "",
  });

  const [newBooking, setNewBooking] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: getToday(),
    checkOut: "",
    guests: 2,
    source: "manual",
    status: "confirmed_direct",
    totalPrice: "",
    depositAmount: "",
    paymentStatus: "unpaid",
    welcomateStatus: "to_send",
    notes: "",
  });

  const [blockForm, setBlockForm] = useState({
    checkIn: getToday(),
    checkOut: "",
    notes: "",
  });

  const selectedUnit =
    units.find((unit) => unit.id === selectedUnitId) || DEFAULT_UNITS[0];

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const unsubscribeUnits = onSnapshot(
      doc(db, "settings", "units"),
      (snapshot) => {
        const items = Array.isArray(snapshot.data()?.items)
          ? snapshot.data().items
          : [];

        const rows = items
          .map((item) => normalizeUnit(item))
          .sort((a, b) => {
            if ((a.sortOrder || 999) === (b.sortOrder || 999)) {
              return a.name.localeCompare(b.name);
            }
            return (a.sortOrder || 999) - (b.sortOrder || 999);
          });

        const nextUnits = rows.length > 0 ? rows : DEFAULT_UNITS;
        setUnits(nextUnits);
        setSelectedUnitId((current) =>
          nextUnits.some((unit) => unit.id === current) ? current : UNIT_ID
        );
      },
      (err) => {
        console.error("Errore lettura unità:", err);
        setUnits(DEFAULT_UNITS);
      }
    );

    return () => unsubscribeUnits();
  }, [isAdmin]);

  useEffect(() => {
    setUnitForm(createUnitForm(selectedUnit));
  }, [selectedUnitId, units]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const bookingsQuery = query(
      collection(db, "bookings"),
      orderBy("checkIn", "asc")
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => (item.unitId || UNIT_ID) === selectedUnitId);
        setBookings(rows);
      },
      (err) => {
        console.error("Errore lettura prenotazioni:", err);
        setError(
          "Non riesco a leggere le prenotazioni. Controlla indici e regole Firestore."
        );
      }
    );

    const publicSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : `pms_${selectedUnitId}`;
    const privateSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : selectedUnitId;

    setSettings(defaultSettings);

    const unsubscribeSettings = onSnapshot(doc(db, "settings", publicSettingsDocId), (snap) => {
      if (snap.exists()) {
        setSettings((currentSettings) => ({
          ...defaultSettings,
          ...currentSettings,
          ...snap.data(),
        }));
      }
    });

    const unsubscribePrivateSettings = onSnapshot(
      doc(db, "privateSettings", privateSettingsDocId),
      (snap) => {
        if (snap.exists()) {
          setSettings((currentSettings) => ({
            ...defaultSettings,
            ...currentSettings,
            bookingIcalUrl: snap.data().bookingIcalUrl || "",
            airbnbIcalUrl: snap.data().airbnbIcalUrl || "",
            welcomateUrl:
              snap.data().welcomateUrl ||
              currentSettings.welcomateUrl ||
              defaultSettings.welcomateUrl,
            notificationEmail:
              snap.data().notificationEmail ||
              currentSettings.notificationEmail ||
              defaultSettings.notificationEmail,
          }));
        }
      }
    );

    return () => {
      unsubscribeBookings();
      unsubscribeSettings();
      unsubscribePrivateSettings();
    };
  }, [isAdmin, selectedUnitId]);

  useEffect(() => {
    if (!selectedBooking) {
      setDetailForm({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        totalPrice: "",
        depositAmount: "",
        paymentStatus: "unpaid",
        notes: "",
        internalNotes: "",
      });
      return;
    }

    setDetailForm({
      guestName: selectedBooking.guestName || "",
      guestEmail: selectedBooking.guestEmail || "",
      guestPhone: selectedBooking.guestPhone || "",
      totalPrice:
        selectedBooking.totalPrice === null || selectedBooking.totalPrice === undefined
          ? ""
          : String(selectedBooking.totalPrice),
      depositAmount:
        selectedBooking.depositAmount === null ||
        selectedBooking.depositAmount === undefined
          ? ""
          : String(selectedBooking.depositAmount),
      paymentStatus: selectedBooking.paymentStatus || "unpaid",
      welcomateStatus: selectedBooking.welcomateStatus || "to_send",
      notes: selectedBooking.notes || "",
      internalNotes: selectedBooking.internalNotes || "",
    });
  }, [selectedBookingId, selectedBooking?.updatedAt]);

  const filteredBookings = useMemo(() => {
    const text = bookingSearch.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (statusFilter === "active" && booking.status === "cancelled") {
        return false;
      }

      if (statusFilter !== "all" && statusFilter !== "active") {
        if ((booking.status || "") !== statusFilter) return false;
      }

      if (sourceFilter !== "all" && (booking.source || "") !== sourceFilter) {
        return false;
      }

      if (!text) return true;

      return [
        booking.guestName,
        booking.guestEmail,
        booking.guestPhone,
        booking.checkIn,
        booking.checkOut,
        booking.source,
        booking.status,
        booking.welcomateStatus,
        booking.notes,
        booking.internalNotes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [bookings, bookingSearch, sourceFilter, statusFilter]);

  const visibleActivityLogs = useMemo(() => {
    return activityLogs
      .filter((item) => !item.unitId || item.unitId === selectedUnitId)
      .slice(0, 80);
  }, [activityLogs, selectedUnitId]);

  const visibleInternalRecords = useMemo(() => {
    return internalRecords
      .filter((item) => !item.unitId || item.unitId === selectedUnitId)
      .slice(0, 120);
  }, [internalRecords, selectedUnitId]);

  const internalRecordStats = useMemo(() => {
    const today = getToday();
    const urgentLimitDate = parseDateAsUTC(today);
    urgentLimitDate.setUTCDate(urgentLimitDate.getUTCDate() + 7);
    const urgentLimit = urgentLimitDate.toISOString().slice(0, 10);

    const openRecords = visibleInternalRecords.filter((item) => item.status !== "closed");
    const closedRecords = visibleInternalRecords.filter((item) => item.status === "closed");
    const highPriority = openRecords.filter((item) => item.priority === "Alta");
    const dueSoon = openRecords.filter((item) => {
      const dueDate = String(item.dueDate || "");
      return dueDate && dueDate <= urgentLimit;
    });

    return {
      open: openRecords.length,
      closed: closedRecords.length,
      highPriority: highPriority.length,
      dueSoon: dueSoon.length,
    };
  }, [visibleInternalRecords]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const activityLogsQuery = query(
      collection(db, "maintenanceLogs"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeActivityLogs = onSnapshot(
      activityLogsQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        const adminRows = rows
          .filter((item) => item.type === "admin_activity")
          .slice(0, 120);

        const recordRows = rows
          .filter((item) => item.type === "internal_record")
          .slice(0, 160);

        setActivityLogs(adminRows);
        setInternalRecords(recordRows);
      },
      (err) => {
        console.warn("Log attivita non caricati:", err);
        setActivityLogs([]);
        setInternalRecords([]);
      }
    );

    return () => unsubscribeActivityLogs();
  }, [isAdmin, selectedUnitId]);

  const stats = useMemo(() => {
    const active = bookings.filter((item) => item.status !== "cancelled");
    const confirmed = active.filter((item) =>
      ["confirmed_direct", "booking", "airbnb", "imported_ical"].includes(
        item.status
      )
    );
    const blocked = active.filter((item) => item.status === "blocked");
    const pending = active.filter((item) =>
      ["pending_direct", "pending"].includes(item.status)
    );
    const paid = active.filter((item) =>
      ["deposit_paid", "paid"].includes(item.paymentStatus)
    );
    const welcomateToCheck = active.filter((item) =>
      ["to_send", "sent", "missing", undefined, null, ""].includes(
        item.welcomateStatus
      )
    );

    return {
      active: active.length,
      confirmed: confirmed.length,
      blocked: blocked.length,
      pending: pending.length,
      paid: paid.length,
      welcomateToCheck: welcomateToCheck.length,
    };
  }, [bookings]);


  const economyStats = useMemo(() => {
    const today = getToday();
    const currentMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);

    const isInsideSelectedPeriod = (booking) => {
      const checkIn = String(booking.checkIn || "");

      if (economyPeriod === "all") return true;
      if (!checkIn) return false;

      if (economyPeriod === "today") {
        return checkIn === today;
      }

      if (economyPeriod === "month") {
        return checkIn.slice(0, 7) === currentMonth;
      }

      if (economyPeriod === "year") {
        return checkIn.slice(0, 4) === currentYear;
      }

      if (economyPeriod === "custom") {
        if (economyDateFrom && checkIn < economyDateFrom) return false;
        if (economyDateTo && checkIn > economyDateTo) return false;
        return true;
      }

      return true;
    };

    const activeRows = bookings
      .filter((booking) => booking.status !== "cancelled")
      .filter(isInsideSelectedPeriod);

    const realBookings = activeRows.filter((booking) => booking.status !== "blocked");

    const confirmedRows = realBookings.filter((booking) =>
      ["confirmed_direct", "booking", "airbnb", "imported_ical"].includes(booking.status)
    );

    const getTotal = (booking) => Number(booking.totalPrice || 0);
    const getDeposit = (booking) => Number(booking.depositAmount || 0);

    const getPaidAmount = (booking) => {
      if (booking.paymentStatus === "paid") return getTotal(booking);
      if (booking.paymentStatus === "deposit_paid") return getDeposit(booking);
      return 0;
    };

    const confirmedRevenue = confirmedRows.reduce(
      (sum, booking) => sum + getTotal(booking),
      0
    );

    const collected = realBookings.reduce(
      (sum, booking) => sum + getPaidAmount(booking),
      0
    );

    const depositCollected = realBookings.reduce((sum, booking) => {
      if (booking.paymentStatus === "deposit_paid") return sum + getDeposit(booking);
      return sum;
    }, 0);

    const balanceDue = realBookings.reduce((sum, booking) => {
      const due = Math.max(getTotal(booking) - getPaidAmount(booking), 0);
      return sum + due;
    }, 0);

    const soldNights = confirmedRows.reduce(
      (sum, booking) => sum + getNightsCount(booking.checkIn, booking.checkOut),
      0
    );

    const averageNight = soldNights > 0 ? confirmedRevenue / soldNights : 0;

    const reportRows = realBookings
      .map((booking) => {
        const total = getTotal(booking);
        const paid = getPaidAmount(booking);
        const due = Math.max(total - paid, 0);

        return {
          ...booking,
          nights: getNightsCount(booking.checkIn, booking.checkOut),
          paidAmount: paid,
          balanceDue: due,
        };
      })
      .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));

    const urgentLimitDate = parseDateAsUTC(today);
    urgentLimitDate.setUTCDate(urgentLimitDate.getUTCDate() + 7);
    const urgentLimit = urgentLimitDate.toISOString().slice(0, 10);

    const pendingPayments = realBookings
      .map((booking) => {
        const total = getTotal(booking);
        const paid = getPaidAmount(booking);
        const due = Math.max(total - paid, 0);
        const checkIn = String(booking.checkIn || "");
        const isUrgentBalance = due > 0 && checkIn >= today && checkIn <= urgentLimit;

        return {
          ...booking,
          nights: getNightsCount(booking.checkIn, booking.checkOut),
          paidAmount: paid,
          balanceDue: due,
          isUrgentBalance,
        };
      })
      .filter((booking) => booking.balanceDue > 0)
      .sort((a, b) => {
        if (a.isUrgentBalance !== b.isUrgentBalance) {
          return a.isUrgentBalance ? -1 : 1;
        }

        return String(a.checkIn || "").localeCompare(String(b.checkIn || ""));
      });

    const urgentBalanceRows = pendingPayments.filter((booking) => booking.isUrgentBalance);

    return {
      confirmedRevenue,
      collected,
      depositCollected,
      balanceDue,
      soldNights,
      averageNight,
      pendingPayments,
      reportRows,
      openBalanceCount: pendingPayments.length,
      urgentBalanceCount: urgentBalanceRows.length,
      urgentBalanceTotal: urgentBalanceRows.reduce((sum, booking) => sum + Number(booking.balanceDue || 0), 0),
      filteredCount: realBookings.length,
    };
  }, [bookings, economyPeriod, economyDateFrom, economyDateTo]);

  function getBookingReadiness(booking) {
    if (!booking) {
      return {
        ready: false,
        label: "Da completare",
        severity: "high",
        issues: ["Prenotazione non selezionata"],
      };
    }

    if (booking.status === "blocked" || booking.status === "cancelled") {
      return {
        ready: false,
        label: "Non operativa",
        severity: "low",
        issues: [],
      };
    }

    const issues = [];
    const total = Number(booking.totalPrice || 0);
    const deposit = Number(booking.depositAmount || 0);
    const paymentStatus = String(booking.paymentStatus || "unpaid");
    const source = String(booking.source || "");
    const status = String(booking.status || "");

    const paidAmount =
      paymentStatus === "paid"
        ? total
        : paymentStatus === "deposit_paid"
          ? deposit
          : 0;

    const balanceDue = Math.max(total - paidAmount, 0);

    if (total <= 0) {
      issues.push("Prezzo totale mancante");
    }

    if (!String(booking.guestPhone || "").trim()) {
      issues.push("Telefono ospite mancante");
    }

    if (!String(booking.guestEmail || "").trim()) {
      issues.push("Email ospite mancante");
    }

    if (paymentStatus === "unpaid" || paymentStatus === "failed" || paymentStatus === "expired") {
      issues.push("Pagamento non completato");
    }

    if (paymentStatus === "pending") {
      issues.push("Pagamento in corso da controllare");
    }

    if (paymentStatus === "deposit_paid" && balanceDue > 0) {
      issues.push("Saldo ancora da incassare");
    }

    if (!["sent", "completed", "not_needed"].includes(String(booking.welcomateStatus || ""))) {
      issues.push("WelcoMate da inviare o controllare");
    }

    if (
      (source === "direct_site" || ["pending_direct", "confirmed_direct"].includes(status)) &&
      !(booking.privacyAccepted && booking.termsAccepted)
    ) {
      issues.push("Consenso privacy/termini non registrato");
    }

    const highProblems = issues.filter((issue) =>
      issue.includes("Prezzo") ||
      issue.includes("Telefono") ||
      issue.includes("Pagamento non completato") ||
      issue.includes("in corso")
    );

    if (issues.length === 0) {
      return {
        ready: true,
        label: "Pronta",
        severity: "ok",
        issues: [],
      };
    }

    return {
      ready: false,
      label: highProblems.length > 0 ? "Da completare" : "Da controllare",
      severity: highProblems.length > 0 ? "high" : "medium",
      issues,
    };
  }

  function getReadinessClass(readiness) {
    if (readiness?.ready) {
      return "border-green-200 bg-green-50 text-green-900";
    }

    if (readiness?.severity === "high") {
      return "border-red-200 bg-red-50 text-red-900";
    }

    if (readiness?.severity === "low") {
      return "border-slate-200 bg-slate-100 text-slate-900";
    }

    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  const qualityStats = useMemo(() => {
    const rows = bookings
      .filter((booking) => booking.status !== "blocked" && booking.status !== "cancelled")
      .map((booking) => ({
        ...booking,
        readiness: getBookingReadiness(booking),
      }))
      .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));

    const readyRows = rows.filter((booking) => booking.readiness.ready);
    const toCompleteRows = rows.filter((booking) => booking.readiness.severity === "high");
    const toCheckRows = rows.filter((booking) => booking.readiness.severity === "medium");

    const missingPriceRows = rows.filter((booking) =>
      booking.readiness.issues.some((issue) => issue.includes("Prezzo"))
    );

    const missingContactRows = rows.filter((booking) =>
      booking.readiness.issues.some((issue) => issue.includes("Telefono") || issue.includes("Email"))
    );

    const paymentProblemRows = rows.filter((booking) =>
      booking.readiness.issues.some((issue) => issue.includes("Pagamento") || issue.includes("Saldo"))
    );

    const welcomateProblemRows = rows.filter((booking) =>
      booking.readiness.issues.some((issue) => issue.includes("WelcoMate"))
    );

    return {
      rows,
      readyRows,
      toCompleteRows,
      toCheckRows,
      missingPriceRows,
      missingContactRows,
      paymentProblemRows,
      welcomateProblemRows,
    };
  }, [bookings]);

  const checkinStats = useMemo(() => {
    const today = getToday();
    const limitDate = parseDateAsUTC(today);
    limitDate.setUTCDate(limitDate.getUTCDate() + 7);
    const limit = limitDate.toISOString().slice(0, 10);

    const activeStatuses = ["confirmed_direct", "booking", "airbnb", "imported_ical"];

    const rows = bookings
      .filter((booking) => booking.status !== "cancelled" && booking.status !== "blocked")
      .filter((booking) => activeStatuses.includes(booking.status))
      .filter((booking) => {
        const checkIn = String(booking.checkIn || "");
        return checkIn >= today && checkIn <= limit;
      })
      .map((booking) => {
        const readiness = getBookingReadiness(booking);
        const total = Number(booking.totalPrice || 0);
        const deposit = Number(booking.depositAmount || 0);
        const paymentStatus = String(booking.paymentStatus || "unpaid");
        const paidAmount =
          paymentStatus === "paid"
            ? total
            : paymentStatus === "deposit_paid"
              ? deposit
              : 0;
        const balanceDue = Math.max(total - paidAmount, 0);
        const checkIn = String(booking.checkIn || "");
        const isToday = checkIn === today;
        const welcomateOpen = !["sent", "completed", "not_needed"].includes(
          String(booking.welcomateStatus || "")
        );

        return {
          ...booking,
          readiness,
          balanceDue,
          isToday,
          welcomateOpen,
        };
      })
      .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));

    return {
      rows,
      todayRows: rows.filter((booking) => booking.isToday),
      readyRows: rows.filter((booking) => booking.readiness.ready),
      notReadyRows: rows.filter((booking) => !booking.readiness.ready),
      openBalanceRows: rows.filter((booking) => booking.balanceDue > 0),
      welcomateRows: rows.filter((booking) => booking.welcomateOpen),
    };
  }, [bookings]);

  function getPreparationLabel(status) {
    if (status === "completed") return "Completata";
    if (status === "in_progress") return "In corso";
    return "Da fare";
  }

  function getPreparationClass(status) {
    if (status === "completed") return "border-green-200 bg-green-50 text-green-900";
    if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-red-200 bg-red-50 text-red-900";
  }

  const preparationStats = useMemo(() => {
    const today = getToday();
    const limitDate = parseDateAsUTC(today);
    limitDate.setUTCDate(limitDate.getUTCDate() + 14);
    const limit = limitDate.toISOString().slice(0, 10);

    const activeStatuses = ["confirmed_direct", "booking", "airbnb", "imported_ical"];

    const activeRows = bookings
      .filter((booking) => booking.status !== "cancelled" && booking.status !== "blocked")
      .filter((booking) => activeStatuses.includes(booking.status))
      .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));

    const rows = activeRows
      .filter((booking) => {
        const checkOut = String(booking.checkOut || "");
        return checkOut >= today && checkOut <= limit;
      })
      .map((booking) => {
        const nextBooking =
          activeRows.find((item) => String(item.checkIn || "") >= String(booking.checkOut || "")) ||
          null;

        const status = booking.preparationStatus || "to_do";
        const checks = booking.preparationChecks || {};
        const checkKeys = ["cleaning", "bathroom", "kitchen", "linen", "keys", "finalCheck"];
        const completedChecks = checkKeys.filter((key) => Boolean(checks[key]));

        return {
          ...booking,
          preparationStatus: status,
          preparationChecks: checks,
          preparationCompletedChecks: completedChecks.length,
          preparationTotalChecks: checkKeys.length,
          preparationReady: status === "completed" && completedChecks.length === checkKeys.length,
          nextBooking,
          isTodayCheckout: String(booking.checkOut || "") === today,
          isSameDayTurnover: nextBooking?.checkIn === booking.checkOut,
        };
      })
      .sort((a, b) => {
        if (a.isTodayCheckout !== b.isTodayCheckout) return a.isTodayCheckout ? -1 : 1;
        if (a.isSameDayTurnover !== b.isSameDayTurnover) return a.isSameDayTurnover ? -1 : 1;
        return String(a.checkOut || "").localeCompare(String(b.checkOut || ""));
      });

    return {
      rows,
      todayRows: rows.filter((booking) => booking.isTodayCheckout),
      sameDayRows: rows.filter((booking) => booking.isSameDayTurnover),
      toDoRows: rows.filter((booking) => booking.preparationStatus === "to_do"),
      inProgressRows: rows.filter((booking) => booking.preparationStatus === "in_progress"),
      completedRows: rows.filter((booking) => booking.preparationStatus === "completed"),
      notReadyRows: rows.filter((booking) => !booking.preparationReady),
    };
  }, [bookings]);

  const controlsStats = useMemo(() => {
    const today = getToday();
    const urgentLimitDate = parseDateAsUTC(today);
    urgentLimitDate.setUTCDate(urgentLimitDate.getUTCDate() + 7);
    const urgentLimit = urgentLimitDate.toISOString().slice(0, 10);

    const activeRows = bookings.filter((booking) => booking.status !== "cancelled");
    const realRows = activeRows.filter((booking) => booking.status !== "blocked");
    const confirmedStatuses = ["confirmed_direct", "booking", "airbnb", "imported_ical"];

    const getTotal = (booking) => Number(booking.totalPrice || 0);
    const getDeposit = (booking) => Number(booking.depositAmount || 0);

    const getPaidAmount = (booking) => {
      if (booking.paymentStatus === "paid") return getTotal(booking);
      if (booking.paymentStatus === "deposit_paid") return getDeposit(booking);
      return 0;
    };

    const rowsWithControlData = realRows.map((booking) => {
      const total = getTotal(booking);
      const paid = getPaidAmount(booking);
      const balanceDue = Math.max(total - paid, 0);
      const checkIn = String(booking.checkIn || "");
      const isCheckInSoon = checkIn >= today && checkIn <= urgentLimit;
      const missingPhone = !String(booking.guestPhone || "").trim();
      const missingEmail = !String(booking.guestEmail || "").trim();
      const missingContact = missingPhone || missingEmail;
      const missingPrice = total <= 0;
      const welcomateStatus = booking.welcomateStatus || "to_send";
      const welcomateNeedsWork = ["to_send", "missing", "", undefined, null].includes(welcomateStatus);
      const isConfirmed = confirmedStatuses.includes(booking.status);

      return {
        ...booking,
        total,
        paidAmount: paid,
        balanceDue,
        isCheckInSoon,
        missingPhone,
        missingEmail,
        missingContact,
        missingPrice,
        welcomateNeedsWork,
        isConfirmed,
      };
    });

    const requestsToConfirm = rowsWithControlData.filter((booking) =>
      ["pending_direct", "pending"].includes(booking.status)
    );

    const openBalances = rowsWithControlData.filter((booking) => booking.balanceDue > 0);

    const welcomateToSend = rowsWithControlData.filter(
      (booking) => booking.isConfirmed && booking.welcomateNeedsWork
    );

    const checkInsSoon = rowsWithControlData.filter(
      (booking) => booking.isConfirmed && booking.isCheckInSoon
    );

    const missingPriceRows = rowsWithControlData.filter((booking) => booking.missingPrice);
    const missingContactRows = rowsWithControlData.filter((booking) => booking.missingContact);

    const actionRows = [];

    requestsToConfirm.forEach((booking) => {
      actionRows.push({
        id: booking.id + "_confirm",
        booking,
        priority: "Alta",
        type: "Richiesta da confermare",
        detail: "Richiesta non ancora confermata",
        action: "confirm",
      });
    });

    openBalances.forEach((booking) => {
      actionRows.push({
        id: booking.id + "_balance",
        booking,
        priority: booking.isCheckInSoon ? "Alta" : "Media",
        type: "Saldo da incassare",
        detail: "Da ricevere " + formatEuro(booking.balanceDue),
        action: "balance",
      });
    });

    welcomateToSend.forEach((booking) => {
      actionRows.push({
        id: booking.id + "_welcomate",
        booking,
        priority: booking.isCheckInSoon ? "Alta" : "Media",
        type: "WelcoMate da gestire",
        detail: getWelcomateLabel(booking.welcomateStatus),
        action: "welcomate",
      });
    });

    missingPriceRows.forEach((booking) => {
      actionRows.push({
        id: booking.id + "_price",
        booking,
        priority: "Media",
        type: "Prezzo mancante",
        detail: "Totale prenotazione non inserito",
        action: "details",
      });
    });

    missingContactRows.forEach((booking) => {
      actionRows.push({
        id: booking.id + "_contact",
        booking,
        priority: booking.isCheckInSoon ? "Alta" : "Media",
        type: "Contatto incompleto",
        detail:
          (booking.missingPhone ? "telefono mancante" : "") +
          (booking.missingPhone && booking.missingEmail ? " · " : "") +
          (booking.missingEmail ? "email mancante" : ""),
        action: "details",
      });
    });

    actionRows.sort((a, b) => {
      const priorityOrder = { Alta: 0, Media: 1, Bassa: 2 };
      const priorityDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (priorityDiff !== 0) return priorityDiff;
      return String(a.booking.checkIn || "").localeCompare(String(b.booking.checkIn || ""));
    });

    return {
      requestsToConfirm,
      openBalances,
      welcomateToSend,
      checkInsSoon,
      missingPriceRows,
      missingContactRows,
      actionRows: actionRows.slice(0, 40),
      openBalanceTotal: openBalances.reduce((sum, booking) => sum + Number(booking.balanceDue || 0), 0),
    };
  }, [bookings]);

  const backupStats = useMemo(() => {
    const today = getToday();
    const allRows = bookings;
    const futureRows = bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      return String(booking.checkOut || booking.checkIn || "") >= today;
    });
    const cancelledRows = bookings.filter((booking) => booking.status === "cancelled");
    const deletedOrCancelledLogs = visibleActivityLogs.filter((log) =>
      ["deleted_booking", "cancelled_booking"].includes(log.action)
    );

    return {
      allBookings: allRows.length,
      futureBookings: futureRows.length,
      cancelledBookings: cancelledRows.length,
      activityLogs: visibleActivityLogs.length,
      deletedOrCancelledLogs: deletedOrCancelledLogs.length,
    };
  }, [bookings, visibleActivityLogs]);

  function clearMessages() {
    setMessage("");
    setError("");
    setSettingsSavedAt("");
    setSyncResult(null);
    setCleanupResult(null);
    setManualCopy({ title: "", text: "" });
  }

  function exportEconomyCsv() {
    clearMessages();

    const rows = economyStats.reportRows || [];
    const today = getToday();
    const urgentLimitDate = parseDateAsUTC(today);
    urgentLimitDate.setUTCDate(urgentLimitDate.getUTCDate() + 7);
    const urgentLimit = urgentLimitDate.toISOString().slice(0, 10);

    if (rows.length === 0) {
      setError("Nessuna prenotazione da esportare nel periodo selezionato.");
      return;
    }

    const escapeCsv = (value) => {
      const textValue = String(value ?? "");
      return '"' + textValue.replaceAll('"', '""') + '"';
    };

    const moneyForCsv = (value) => {
      const number = Number(value || 0);
      return Number.isFinite(number) ? number.toFixed(2).replace(".", ",") : "0,00";
    };

    const headers = [
      "Unita",
      "Ospite",
      "Email",
      "Telefono",
      "Arrivo",
      "Partenza",
      "Notti",
      "Origine",
      "Stato",
      "Pagamento",
      "Totale",
      "Incassato",
      "Da ricevere",
      "Da incassare urgente",
      "Pagamento manuale da",
      "Pagamento manuale aggiornato il",
      "Note",
    ];

    const csvRows = [
      headers.map(escapeCsv).join(";"),
      ...rows.map((booking) =>
        [
          selectedUnit?.name || selectedUnitId,
          booking.guestName || "",
          booking.guestEmail || "",
          booking.guestPhone || "",
          formatDate(booking.checkIn),
          formatDate(booking.checkOut),
          booking.nights || 0,
          getSourceLabel(booking.source),
          getStatusLabel(booking.status),
          getPaymentLabel(booking.paymentStatus),
          moneyForCsv(booking.totalPrice),
          moneyForCsv(booking.paidAmount),
          moneyForCsv(booking.balanceDue),
          booking.balanceDue > 0 &&
          String(booking.checkIn || "") >= today &&
          String(booking.checkIn || "") <= urgentLimit
            ? "Si"
            : "No",
          booking.manualPaymentUpdatedBy || "",
          formatDateTime(booking.manualPaymentUpdatedAt),
          booking.internalNotes || booking.notes || "",
        ]
          .map(escapeCsv)
          .join(";")
      ),
    ];

    const csv = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const periodLabel =
      economyPeriod === "custom"
        ? (economyDateFrom || "inizio") + "_" + (economyDateTo || "fine")
        : economyPeriod;

    const filename =
      "gelone-economia-" + selectedUnitId + "-" + periodLabel + "-" + getToday() + ".csv";

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage("Report economia esportato: " + rows.length + " prenotazioni.");

    addActivityLog("exported_economy_csv", null, {
      rows: rows.length,
      period: economyPeriod,
      dateFrom: economyDateFrom || "",
      dateTo: economyDateTo || "",
    });
  }

  function escapeCsvValue(value) {
    const textValue = String(value ?? "");
    return '"' + textValue.replaceAll('"', '""') + '"';
  }

  function moneyCsvValue(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toFixed(2).replace(".", ",") : "0,00";
  }

  function downloadCsvFile(filename, headers, rows) {
    if (!rows.length) {
      setError("Nessun dato da esportare per questa selezione.");
      return false;
    }

    const csvRows = [
      headers.map(escapeCsvValue).join(";"),
      ...rows.map((row) => row.map(escapeCsvValue).join(";")),
    ];

    const csv = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  }

  function exportBookingsCsv(mode = "all") {
    clearMessages();

    const today = getToday();

    let rows = bookings;

    if (mode === "future") {
      rows = bookings.filter((booking) => {
        if (booking.status === "cancelled") return false;
        return String(booking.checkOut || booking.checkIn || "") >= today;
      });
    }

    if (mode === "cancelled") {
      rows = bookings.filter((booking) => booking.status === "cancelled");
    }

    rows = [...rows].sort((a, b) =>
      String(a.checkIn || "").localeCompare(String(b.checkIn || ""))
    );

    const headers = [
      "Unita",
      "ID prenotazione",
      "Ospite",
      "Email",
      "Telefono",
      "Arrivo",
      "Partenza",
      "Notti",
      "Ospiti",
      "Origine",
      "Stato",
      "Pagamento",
      "Totale",
      "Caparra",
      "WelcoMate",
      "Creata",
      "Aggiornata",
      "Motivo cancellazione",
      "Note ospite",
      "Note interne",
    ];

    const csvRows = rows.map((booking) => [
      selectedUnit?.name || selectedUnitId,
      booking.id || "",
      booking.guestName || "",
      booking.guestEmail || "",
      booking.guestPhone || "",
      formatDate(booking.checkIn),
      formatDate(booking.checkOut),
      getNightsCount(booking.checkIn, booking.checkOut),
      booking.guests ?? "",
      getSourceLabel(booking.source),
      getStatusLabel(booking.status),
      getPaymentLabel(booking.paymentStatus),
      moneyCsvValue(booking.totalPrice),
      moneyCsvValue(booking.depositAmount),
      getWelcomateLabel(booking.welcomateStatus),
      formatDateTime(booking.createdAt),
      formatDateTime(booking.updatedAt),
      booking.cancellationReason || "",
      booking.notes || "",
      booking.internalNotes || "",
    ]);

    const filename =
      "gelone-prenotazioni-" + selectedUnitId + "-" + mode + "-" + today + ".csv";

    const ok = downloadCsvFile(filename, headers, csvRows);

    if (ok) {
      setMessage("Export prenotazioni creato: " + rows.length + " righe.");
      addActivityLog("exported_bookings_csv", null, {
        mode,
        rows: rows.length,
      });
    }
  }

  function exportActivityLogsCsv(mode = "all") {
    clearMessages();

    let rows = visibleActivityLogs;

    if (mode === "deleted_cancelled") {
      rows = visibleActivityLogs.filter((log) =>
        ["deleted_booking", "cancelled_booking"].includes(log.action)
      );
    }

    const headers = [
      "Data",
      "Admin",
      "Azione",
      "Unita",
      "Booking ID",
      "Ospite",
      "Email",
      "Telefono",
      "Arrivo",
      "Partenza",
      "Stato",
      "Pagamento",
      "Dettagli",
    ];

    const csvRows = rows.map((log) => [
      formatDateTime(log.createdAt),
      log.adminEmail || "",
      String(log.action || "").replaceAll("_", " "),
      log.unitName || log.unitId || "",
      log.bookingId || "",
      log.guestName || "",
      log.guestEmail || "",
      log.guestPhone || "",
      formatDate(log.checkIn),
      formatDate(log.checkOut),
      log.status || "",
      getPaymentLabel(log.paymentStatus),
      log.details ? JSON.stringify(log.details) : "",
    ]);

    const filename =
      "gelone-log-attivita-" + selectedUnitId + "-" + mode + "-" + getToday() + ".csv";

    const ok = downloadCsvFile(filename, headers, csvRows);

    if (ok) {
      setMessage("Export log attività creato: " + rows.length + " righe.");
      addActivityLog("exported_activity_logs_csv", null, {
        mode,
        rows: rows.length,
      });
    }
  }

  async function createInternalRecord(event) {
    event.preventDefault();
    clearMessages();

    const title = String(internalRecordForm.title || "").trim();
    const note = String(internalRecordForm.note || "").trim();

    if (title.length < 3) {
      setError("Inserisci un titolo chiaro per il registro interno.");
      return;
    }

    if (note.length < 5) {
      setError("Inserisci una nota interna più dettagliata.");
      return;
    }

    const linkedBooking =
      bookings.find((booking) => booking.id === internalRecordForm.linkedBookingId) || null;

    try {
      const recordRef = await addDoc(collection(db, "maintenanceLogs"), {
        type: "internal_record",
        unitId: selectedUnitId,
        unitName: selectedUnit?.name || selectedUnitId,
        category: internalRecordForm.category || "nota",
        title,
        note,
        priority: internalRecordForm.priority || "Media",
        status: "open",
        dueDate: internalRecordForm.dueDate || "",
        linkedBookingId: linkedBooking?.id || "",
        linkedGuestName: linkedBooking?.guestName || "",
        linkedCheckIn: linkedBooking?.checkIn || "",
        linkedCheckOut: linkedBooking?.checkOut || "",
        adminEmail: user?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("created_internal_record", null, {
        recordId: recordRef.id,
        category: internalRecordForm.category || "nota",
        priority: internalRecordForm.priority || "Media",
        title,
        linkedBookingId: linkedBooking?.id || "",
        linkedGuestName: linkedBooking?.guestName || "",
      });

      setInternalRecordForm({
        category: "nota",
        title: "",
        note: "",
        priority: "Media",
        dueDate: "",
        linkedBookingId: "",
      });

      setMessage("Nota inserita nel registro interno.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio del registro interno.");
    }
  }

  async function setInternalRecordStatus(record, status) {
    clearMessages();

    if (!record?.id) {
      setError("Record interno non valido.");
      return;
    }

    try {
      const updateData = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (status === "closed") {
        updateData.closedAt = serverTimestamp();
        updateData.closedBy = user?.email || "";
      }

      if (status === "open") {
        updateData.reopenedAt = serverTimestamp();
        updateData.reopenedBy = user?.email || "";
      }

      await updateDoc(doc(db, "maintenanceLogs", record.id), updateData);

      await addActivityLog("updated_internal_record_status", null, {
        recordId: record.id,
        title: record.title || "",
        category: record.category || "",
        previousStatus: record.status || "",
        status,
      });

      setMessage(status === "closed" ? "Nota interna chiusa." : "Nota interna riaperta.");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento del registro interno.");
    }
  }

  async function setPreparationStatus(booking, status) {
    clearMessages();

    if (!booking?.id) {
      setError("Prenotazione non valida.");
      return;
    }

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        preparationStatus: status,
        preparationUpdatedAt: serverTimestamp(),
        preparationUpdatedBy: user?.email || "",
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("updated_preparation_status", booking, {
        preparationStatus: status,
        preparationLabel: getPreparationLabel(status),
        checkOut: booking.checkOut || "",
        nextCheckIn: booking.nextBooking?.checkIn || "",
      });

      setMessage("Stato preparazione aggiornato: " + getPreparationLabel(status) + ".");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento della preparazione alloggio.");
    }
  }

  async function setPreparationCheck(booking, key, checked) {
    clearMessages();

    if (!booking?.id) {
      setError("Prenotazione non valida.");
      return;
    }

    const currentChecks = booking.preparationChecks || {};
    const nextChecks = {
      ...currentChecks,
      [key]: Boolean(checked),
    };

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        preparationChecks: nextChecks,
        preparationStatus:
          ["cleaning", "bathroom", "kitchen", "linen", "keys", "finalCheck"].every((key) =>
            Boolean(nextChecks[key])
          )
            ? "completed"
            : ["cleaning", "bathroom", "kitchen", "linen", "keys", "finalCheck"].some((key) =>
                  Boolean(nextChecks[key])
                )
              ? "in_progress"
              : "to_do",
        preparationUpdatedAt: serverTimestamp(),
        preparationUpdatedBy: user?.email || "",
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("updated_preparation_check", booking, {
        check: key,
        checked: Boolean(checked),
      });

      setMessage("Controllo preparazione aggiornato.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio del controllo preparazione.");
    }
  }

  async function updatePreparationNote(booking) {
    clearMessages();

    if (!booking?.id) {
      setError("Prenotazione non valida.");
      return;
    }

    const note = window.prompt(
      "Nota pulizia/preparazione per " +
        (booking.guestName || "questa prenotazione") +
        ":",
      booking.preparationNote || ""
    );

    if (note === null) return;

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        preparationNote: String(note || "").trim(),
        preparationUpdatedAt: serverTimestamp(),
        preparationUpdatedBy: user?.email || "",
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("updated_preparation_note", booking, {
        note: String(note || "").trim(),
      });

      setMessage("Nota preparazione aggiornata.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio della nota preparazione.");
    }
  }

  async function addActivityLog(action, booking = null, details = {}) {
    try {
      await addDoc(collection(db, "maintenanceLogs"), {
        type: "admin_activity",
        action,
        unitId: booking?.unitId || selectedUnitId,
        unitName: booking?.unitName || selectedUnit?.name || selectedUnitId,
        bookingId: booking?.id || "",
        guestName: booking?.guestName || "",
        guestEmail: booking?.guestEmail || "",
        guestPhone: booking?.guestPhone || "",
        checkIn: booking?.checkIn || "",
        checkOut: booking?.checkOut || "",
        status: booking?.status || "",
        paymentStatus: booking?.paymentStatus || "",
        adminEmail: user?.email || "",
        details,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Log attivita non salvato:", err);
    }
  }

  async function getOccupiedNights(nights) {
    const snapshots = await Promise.all(
      nights.map((night) => getDoc(doc(db, "nights", `${selectedUnitId}_${night}`)))
    );

    return snapshots
      .filter((snapshot) => {
        if (!snapshot.exists()) return false;
        const data = snapshot.data();
        return data?.status !== "cancelled";
      })
      .map((snapshot) => snapshot.data()?.date)
      .filter(Boolean);
  }

  async function saveSettings(options = {}) {
    if (!options.silent) {
      clearMessages();
    }

    try {
      const batch = writeBatch(db);

      const publicSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : `pms_${selectedUnitId}`;
      const privateSettingsDocId = selectedUnitId === UNIT_ID ? "pms" : selectedUnitId;

      batch.set(doc(db, "settings", publicSettingsDocId), {
        checkInTime: settings.checkInTime || defaultSettings.checkInTime,
        checkOutTime: settings.checkOutTime || defaultSettings.checkOutTime,
        maxGuests: Number(settings.maxGuests || selectedUnit.maxGuests || defaultSettings.maxGuests),
        nightlyRate: Number(settings.nightlyRate || defaultSettings.nightlyRate),
        cleaningFee: Number(settings.cleaningFee || 0),
        minimumNights: Number(settings.minimumNights || defaultSettings.minimumNights),
        depositPercent: Number(settings.depositPercent || defaultSettings.depositPercent),
        directRateText: settings.directRateText || defaultSettings.directRateText,
        
        directPaymentEnabled: Boolean(settings.directPaymentEnabled),
wifiName: settings.wifiName || "",
        wifiPassword: settings.wifiPassword || "",
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, "privateSettings", privateSettingsDocId), {
        bookingIcalUrl: settings.bookingIcalUrl || "",
        airbnbIcalUrl: settings.airbnbIcalUrl || "",
        welcomateUrl: settings.welcomateUrl || "",
        notificationEmail: settings.notificationEmail || "info@gelone.it",
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      if (!options.silent) {
        await addActivityLog("updated_settings", null, {
          nightlyRate: Number(settings.nightlyRate || defaultSettings.nightlyRate),
          cleaningFee: Number(settings.cleaningFee || 0),
          minimumNights: Number(settings.minimumNights || defaultSettings.minimumNights),
          depositPercent: Number(settings.depositPercent || defaultSettings.depositPercent),
          directPaymentEnabled: Boolean(settings.directPaymentEnabled),
        });
      }

      if (!options.silent) {
        const savedTime = new Intl.DateTimeFormat("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date());
        setSettingsSavedAt(savedTime);
        setMessage(`Impostazioni salvate alle ${savedTime}.`);
      }

      return true;
    } catch (err) {
      console.error(err);
      if (!options.silent) {
        setSettingsSavedAt("");
        setError("Errore durante il salvataggio delle impostazioni.");
      }

      return false;
    }
  }

  async function syncCalendars() {
    clearMessages();
    setSyncLoading(true);

    try {
      const saved = await saveSettings({ silent: true });

      if (!saved) {
        setError("Non riesco a salvare i link iCal prima della sincronizzazione.");
        return;
      }

      const token = await getIdToken(user, true);
      const response = await fetch("/api/sync-calendars", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unitId: selectedUnitId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(
          data?.message || "Errore durante la sincronizzazione dei calendari esterni."
        );
        return;
      }

      setSyncResult(data);

      const totals = data.totals || {};
      await addActivityLog("synced_calendars", null, {
        imported: totals.imported || data.importedBookings || 0,
        skippedDuplicate: totals.skippedDuplicate || 0,
        skippedConflict: totals.skippedConflict || data.skippedNights || 0,
      });

      setMessage(
        `Sincronizzazione completata: ${totals.imported || data.importedBookings || 0} eventi importati, ${totals.skippedDuplicate || 0} duplicati evitati, ${totals.skippedConflict || data.skippedNights || 0} conflitti protetti.`
      );
    } catch (err) {
      console.error(err);
      setError("Errore tecnico durante la sincronizzazione calendari.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function cleanupGhostNights() {
    clearMessages();

    const selectedUnitName =
      selectedUnit.publicName || selectedUnit.name || selectedUnitId;

    const confirmed = window.confirm(
      "Vuoi controllare e cancellare le notti fantasma per " +
        selectedUnitName +
        "?\n\nLe prenotazioni vere e i blocchi manuali attivi non vengono toccati."
    );

    if (!confirmed) return;

    try {
      setCleanupLoading(true);

      const token = await getIdToken(user, true);
      const response = await fetch("/api/cleanup-ghost-nights", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unitId: selectedUnitId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(
          data?.message ||
            "Errore durante la pulizia delle notti fantasma."
        );
        return;
      }

      setCleanupResult(data);
      await addActivityLog("cleanup_ghost_nights", null, {
        scannedCount: data.scannedCount || 0,
        ghostCount: data.ghostCount || 0,
        deletedCount: data.deletedCount || 0,
        keptCount: data.keptCount || 0,
      });

      setMessage(
        data.message ||
          "Pulizia completata. Controlla il riepilogo nella sezione Manutenzione."
      );
    } catch (err) {
      console.error(err);
      setError("Errore tecnico durante la pulizia notti fantasma.");
    } finally {
      setCleanupLoading(false);
    }
  }

  async function createBooking(event) {
    event.preventDefault();
    clearMessages();

    if (!newBooking.checkIn || !newBooking.checkOut) {
      setError("Inserisci data arrivo e data partenza.");
      return;
    }

    if (newBooking.checkOut <= newBooking.checkIn) {
      setError("La partenza deve essere successiva all'arrivo.");
      return;
    }

    const nights = getNightDates(newBooking.checkIn, newBooking.checkOut);

    try {
      const occupied = await getOccupiedNights(nights);

      if (occupied.length > 0) {
        setError(
          `Almeno una notte risulta già occupata: ${occupied.map(formatDate).join(", ")}.`
        );
        return;
      }

      const bookingRef = await addDoc(collection(db, "bookings"), {
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        guestName: newBooking.guestName || "Prenotazione manuale",
        guestEmail: newBooking.guestEmail || "",
        guestPhone: newBooking.guestPhone || "",
        checkIn: newBooking.checkIn,
        checkOut: newBooking.checkOut,
        guests: Number(newBooking.guests || 1),
        source: newBooking.source,
        status: newBooking.status,
        totalPrice: cleanMoneyValue(newBooking.totalPrice),
        depositAmount: cleanMoneyValue(newBooking.depositAmount),
        paymentStatus: newBooking.paymentStatus || "unpaid",
        welcomateStatus: newBooking.welcomateStatus || "to_send",
        notes: newBooking.notes || "",
        internalNotes: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);

      nights.forEach((night) => {
        batch.set(doc(db, "nights", `${selectedUnitId}_${night}`), {
          unitId: selectedUnitId,
          date: night,
          bookingId: bookingRef.id,
          status: newBooking.status,
          source: newBooking.source,
          guestName: newBooking.guestName || "Prenotazione manuale",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      await addActivityLog("created_booking", {
        id: bookingRef.id,
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        guestName: newBooking.guestName || "Prenotazione manuale",
        guestEmail: newBooking.guestEmail || "",
        guestPhone: newBooking.guestPhone || "",
        checkIn: newBooking.checkIn,
        checkOut: newBooking.checkOut,
        status: newBooking.status,
        paymentStatus: newBooking.paymentStatus || "unpaid",
      }, {
        source: newBooking.source,
        guests: Number(newBooking.guests || 1),
        totalPrice: cleanMoneyValue(newBooking.totalPrice),
        depositAmount: cleanMoneyValue(newBooking.depositAmount),
      });

      setNewBooking({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkIn: getToday(),
        checkOut: "",
        guests: 2,
        source: "manual",
        status: "confirmed_direct",
        totalPrice: "",
        depositAmount: "",
        paymentStatus: "unpaid",
        welcomateStatus: "to_send",
        notes: "",
      });

      setMessage("Prenotazione inserita e notti bloccate.");
      setActiveTab("calendar");
    } catch (err) {
      console.error(err);
      setError("Errore durante la creazione della prenotazione.");
    }
  }

  async function createBlock(event) {
    event.preventDefault();
    clearMessages();

    if (!blockForm.checkIn || !blockForm.checkOut) {
      setError("Inserisci data inizio e data fine blocco.");
      return;
    }

    if (blockForm.checkOut <= blockForm.checkIn) {
      setError("La data fine deve essere successiva alla data inizio.");
      return;
    }

    const nights = getNightDates(blockForm.checkIn, blockForm.checkOut);

    try {
      const occupied = await getOccupiedNights(nights);

      if (occupied.length > 0) {
        setError(
          `Non posso bloccare: alcune notti risultano già occupate (${occupied
            .map(formatDate)
            .join(", ")}).`
        );
        return;
      }

      const bookingRef = await addDoc(collection(db, "bookings"), {
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        guestName: "Blocco manuale",
        guestEmail: "",
        guestPhone: "",
        checkIn: blockForm.checkIn,
        checkOut: blockForm.checkOut,
        guests: 0,
        source: "manual",
        status: "blocked",
        totalPrice: null,
        depositAmount: null,
        paymentStatus: "unpaid",
        welcomateStatus: "not_needed",
        notes: blockForm.notes || "",
        internalNotes: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);

      nights.forEach((night) => {
        batch.set(doc(db, "nights", `${selectedUnitId}_${night}`), {
          unitId: selectedUnitId,
          date: night,
          bookingId: bookingRef.id,
          status: "blocked",
          source: "manual",
          guestName: "Blocco manuale",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      await addActivityLog("created_block", {
        id: bookingRef.id,
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        guestName: "Blocco manuale",
        checkIn: blockForm.checkIn,
        checkOut: blockForm.checkOut,
        status: "blocked",
        paymentStatus: "unpaid",
      }, {
        notes: blockForm.notes || "",
      });

      setBlockForm({
        checkIn: getToday(),
        checkOut: "",
        notes: "",
      });

      setMessage("Date bloccate.");
      setActiveTab("calendar");
    } catch (err) {
      console.error(err);
      setError("Errore durante il blocco date.");
    }
  }

  async function confirmBooking(booking) {
    clearMessages();

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "bookings", booking.id), {
        status: "confirmed_direct",
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      getNightDates(booking.checkIn, booking.checkOut).forEach((night) => {
        batch.set(
          doc(db, "nights", `${booking.unitId || selectedUnitId}_${night}`),
          {
            unitId: booking.unitId || selectedUnitId,
            date: night,
            bookingId: booking.id,
            status: "confirmed_direct",
            source: booking.source || "manual",
            guestName: booking.guestName || "Prenotazione confermata",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      await addActivityLog("confirmed_booking", booking);
      setMessage("Prenotazione confermata.");
    } catch (err) {
      console.error(err);
      setError("Errore durante la conferma della prenotazione.");
    }
  }

  function hasSensitivePayment(booking) {
    return ["paid", "deposit_paid", "pending"].includes(String(booking?.paymentStatus || ""));
  }

  function buildDangerPaymentWarning(booking) {
    if (!hasSensitivePayment(booking)) return "";

    return (
      "\n\nATTENZIONE: questa prenotazione risulta con pagamento/caparra/link in corso." +
      "\nStato pagamento: " +
      getPaymentLabel(booking.paymentStatus) +
      "\nTotale: " +
      formatEuro(booking.totalPrice) +
      "\nCaparra: " +
      formatEuro(booking.depositAmount)
    );
  }

  async function cancelBooking(booking) {
    clearMessages();

    if (!booking?.id) {
      setError("Seleziona una prenotazione valida.");
      return;
    }

    const reason = window.prompt(
      "Motivo obbligatorio per annullare la prenotazione di " +
        (booking.guestName || "questo ospite") +
        ".\n\nQuesta azione libera le notti e modifica la disponibilità pubblica." +
        buildDangerPaymentWarning(booking) +
        "\n\nScrivi il motivo dell'annullamento:"
    );

    if (reason === null) {
      setMessage("Annullamento interrotto.");
      return;
    }

    const cleanReason = String(reason || "").trim();

    if (cleanReason.length < 5) {
      setError("Annullamento non eseguito: devi inserire un motivo chiaro, almeno 5 caratteri.");
      return;
    }

    const confirmed = window.confirm(
      "Confermi annullamento prenotazione?\n\n" +
        "Ospite: " +
        (booking.guestName || "-") +
        "\nDate: " +
        formatDate(booking.checkIn) +
        " - " +
        formatDate(booking.checkOut) +
        "\nMotivo: " +
        cleanReason +
        "\n\nLe notti verranno liberate nel calendario pubblico."
    );

    if (!confirmed) {
      setMessage("Annullamento interrotto.");
      return;
    }

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "bookings", booking.id), {
        status: "cancelled",
        cancellationReason: cleanReason,
        cancellationPreviousStatus: booking.status || "",
        cancellationPreviousPaymentStatus: booking.paymentStatus || "",
        cancelledAt: serverTimestamp(),
        cancelledBy: user?.email || "",
        updatedAt: serverTimestamp(),
      });

      const nights = getNightDates(booking.checkIn, booking.checkOut);
      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${booking.unitId || selectedUnitId}_${night}`));
      });

      await batch.commit();

      await addActivityLog("cancelled_booking", booking, {
        reason: cleanReason,
        previousStatus: booking.status || "",
        previousPaymentStatus: booking.paymentStatus || "",
        previousPaymentLabel: getPaymentLabel(booking.paymentStatus),
        totalPrice: booking.totalPrice ?? null,
        depositAmount: booking.depositAmount ?? null,
        nightsReleased: nights.length,
        sensitivePayment: hasSensitivePayment(booking),
      });

      setMessage("Prenotazione annullata con motivo registrato e notti liberate.");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'annullamento.");
    }
  }

  async function deleteBookingForever(booking) {
    clearMessages();

    if (!booking?.id) {
      setError("Seleziona una prenotazione valida.");
      return;
    }

    const reason = window.prompt(
      "Motivo eliminazione DEFINITIVA per " +
        (booking.guestName || "questa prenotazione") +
        ".\n\nQuesta azione cancella la prenotazione dall'Admin e libera le notti." +
        buildDangerPaymentWarning(booking) +
        "\n\nScrivi il motivo:"
    );

    if (reason === null) {
      setMessage("Eliminazione interrotta.");
      return;
    }

    const cleanReason = String(reason || "").trim();

    if (cleanReason.length < 5) {
      setError("Eliminazione non eseguita: devi inserire un motivo chiaro, almeno 5 caratteri.");
      return;
    }

    const confirmationText = window.prompt(
      "CONFERMA FORTE\n\n" +
        "Per eliminare definitivamente la prenotazione di " +
        (booking.guestName || "-") +
        " dal " +
        formatDate(booking.checkIn) +
        " al " +
        formatDate(booking.checkOut) +
        ", scrivi esattamente: ELIMINA"
    );

    if (String(confirmationText || "").trim().toUpperCase() !== "ELIMINA") {
      setError("Eliminazione bloccata: non hai scritto ELIMINA.");
      return;
    }

    const confirmed = window.confirm(
      "Ultima conferma.\n\n" +
        "La prenotazione verrà eliminata definitivamente.\n" +
        "Le notti verranno liberate.\n" +
        "Il log conserverà motivo, stato e pagamento precedente.\n\n" +
        "Procedere?"
    );

    if (!confirmed) {
      setMessage("Eliminazione interrotta.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const nights = getNightDates(booking.checkIn, booking.checkOut);

      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${booking.unitId || selectedUnitId}_${night}`));
      });

      batch.delete(doc(db, "bookings", booking.id));

      await batch.commit();

      await addActivityLog("deleted_booking", booking, {
        reason: cleanReason,
        previousStatus: booking.status || "",
        previousPaymentStatus: booking.paymentStatus || "",
        previousPaymentLabel: getPaymentLabel(booking.paymentStatus),
        totalPrice: booking.totalPrice ?? null,
        depositAmount: booking.depositAmount ?? null,
        nightsReleased: nights.length,
        sensitivePayment: hasSensitivePayment(booking),
        strongConfirmation: "ELIMINA",
      });

      if (selectedBookingId === booking.id) {
        setSelectedBookingId("");
      }

      setMessage("Prenotazione eliminata definitivamente con log di sicurezza registrato.");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'eliminazione.");
    }
  }

  async function saveBookingDetails(event) {
    event.preventDefault();
    clearMessages();

    if (!selectedBooking) {
      setError("Seleziona una prenotazione.");
      return;
    }

    try {
      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        guestName: detailForm.guestName || "",
        guestEmail: detailForm.guestEmail || "",
        guestPhone: detailForm.guestPhone || "",
        totalPrice: cleanMoneyValue(detailForm.totalPrice),
        depositAmount: cleanMoneyValue(detailForm.depositAmount),
        paymentStatus: detailForm.paymentStatus || "unpaid",
        welcomateStatus: detailForm.welcomateStatus || "to_send",
        notes: detailForm.notes || "",
        internalNotes: detailForm.internalNotes || "",
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("updated_booking_details", selectedBooking, {
        paymentStatus: detailForm.paymentStatus || "unpaid",
        welcomateStatus: detailForm.welcomateStatus || "to_send",
        totalPrice: cleanMoneyValue(detailForm.totalPrice),
        depositAmount: cleanMoneyValue(detailForm.depositAmount),
      });

      setMessage("Dettagli prenotazione aggiornati.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio dei dettagli.");
    }
  }

  async function setManualPaymentStatus(booking, paymentStatus, manualAction) {
    clearMessages();

    if (!booking?.id) {
      setError("Seleziona una prenotazione valida.");
      return;
    }

    if (booking.status === "blocked" || booking.status === "cancelled") {
      setError("Non puoi aggiornare il pagamento manuale di un blocco o di una prenotazione annullata.");
      return;
    }

    const confirmed = window.confirm(
      "Vuoi aggiornare manualmente il pagamento di " +
        (booking.guestName || "questa prenotazione") +
        " come: " +
        getPaymentLabel(paymentStatus) +
        "?"
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        paymentStatus,
        manualPaymentUpdatedAt: serverTimestamp(),
        manualPaymentUpdatedBy: user?.email || "",
        updatedAt: serverTimestamp(),
      });

      setDetailForm((current) => ({
        ...current,
        paymentStatus,
      }));

      await addActivityLog("updated_manual_payment", booking, {
        manualAction,
        paymentStatus,
        paymentLabel: getPaymentLabel(paymentStatus),
        totalPrice: booking.totalPrice ?? null,
        depositAmount: booking.depositAmount ?? null,
        source: "manual_admin",
      });

      setMessage("Pagamento manuale aggiornato: " + getPaymentLabel(paymentStatus) + ".");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento manuale del pagamento.");
    }
  }

  async function setPaymentStatus(booking, paymentStatus) {
    clearMessages();

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        paymentStatus,
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("updated_payment_status", booking, {
        paymentStatus,
        paymentLabel: getPaymentLabel(paymentStatus),
      });

      setMessage(`Stato pagamento aggiornato: ${getPaymentLabel(paymentStatus)}.`);
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento del pagamento.");
    }
  }

  async function createStripePaymentLink(booking, paymentType = "deposit") {
    clearMessages();

    if (!booking?.id) {
      setError("Seleziona una prenotazione valida.");
      return;
    }

    if (booking.status === "blocked" || booking.status === "cancelled") {
      setError("Non puoi creare un pagamento per una prenotazione bloccata o annullata.");
      return;
    }

    const currentPaymentStatus = String(booking.paymentStatus || "").toLowerCase();
    const effectivePaymentType =
      currentPaymentStatus === "deposit_paid" && paymentType === "full"
        ? "balance"
        : paymentType;

    if (currentPaymentStatus === "paid") {
      setError("Questa prenotazione risulta già saldata.");
      return;
    }

    if (currentPaymentStatus === "deposit_paid" && effectivePaymentType === "deposit") {
      setError("La caparra risulta già pagata. Usa il pulsante saldo da pagare.");
      return;
    }

    try {
      const adminUser = auth.currentUser;

      if (!adminUser) {
        setError("Sessione admin scaduta. Esci e rientra in Admin.");
        return;
      }

      const adminToken = await getIdToken(adminUser, true);

      const response = await fetch("/api/create-payment-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentType: effectivePaymentType,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok || !data.checkoutUrl) {
        setError(data?.message || "Non riesco a creare il link pagamento Stripe.");
        return;
      }

      const copied = await copyToClipboard(data.checkoutUrl);

      if (!copied) {
        setManualCopy({
          title: "Link pagamento Stripe",
          text: data.checkoutUrl,
        });
        setError("Link creato, ma il browser non ha permesso la copia automatica. Copialo dal riquadro.");
        return;
      }

      setManualCopy({
        title: "Link pagamento Stripe copiato",
        text: data.checkoutUrl,
      });

      await addActivityLog("created_stripe_link", booking, {
        paymentType: effectivePaymentType,
        amount: data.amount,
      });

      setMessage(
        `Link pagamento ${paymentType === "full" ? "saldo totale" : "caparra"} creato e copiato. Importo: ${formatEuro(data.amount)}.`
      );
    } catch (err) {
      console.error(err);
      setError("Errore tecnico durante la creazione del link pagamento Stripe.");
    }
  }

  async function setWelcomateStatus(booking, welcomateStatus) {
    clearMessages();

    try {
      const updateData = {
        welcomateStatus,
        updatedAt: serverTimestamp(),
      };

      if (welcomateStatus === "sent") {
        updateData.welcomateSentAt = serverTimestamp();
      }

      if (welcomateStatus === "completed") {
        updateData.welcomateCompletedAt = serverTimestamp();
      }

      await updateDoc(doc(db, "bookings", booking.id), updateData);

      await addActivityLog("updated_welcomate_status", booking, {
        welcomateStatus,
        welcomateLabel: getWelcomateLabel(welcomateStatus),
      });

      setMessage(`Check-in WelcoMate aggiornato: ${getWelcomateLabel(welcomateStatus)}.`);
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento dello stato WelcoMate.");
    }
  }

  async function copyWelcomateAndMarkSent(booking) {
    clearMessages();

    const text = buildWelcomateText(booking, settings);

    try {
      const copied = await copyToClipboard(text);

      if (!copied) {
        setManualCopy({
          title: "Testo WelcoMate pronto da copiare",
          text,
        });
        setError(
          "Il browser non ha permesso la copia automatica. Ti ho aperto il testo qui sotto: selezionalo e copialo manualmente."
        );
        return;
      }

      await updateDoc(doc(db, "bookings", booking.id), {
        welcomateStatus: "sent",
        welcomateSentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addActivityLog("copied_welcomate_text", booking, {
        welcomateStatus: "sent",
      });

      setMessage("Testo WelcoMate copiato negli appunti e stato segnato come inviato.");
    } catch (err) {
      console.error(err);
      setManualCopy({
        title: "Testo WelcoMate pronto da copiare",
        text,
      });
      setError(
        "Non riesco ad aggiornare automaticamente WelcoMate. Copia il testo qui sotto e riprova a segnare lo stato come Inviato."
      );
    }
  }

  function prepareNewUnit() {
    clearMessages();

    const usedIds = new Set(units.map((unit) => unit.id));
    let index = units.length + 1;
    let nextId = `lunarossa${index}`;

    while (usedIds.has(nextId)) {
      index += 1;
      nextId = `lunarossa${index}`;
    }

    setUnitForm(
      createUnitForm({
        ...DEFAULT_UNIT,
        id: nextId,
        name: `Lunarossa ${index}`,
        publicName: `Gelone Lungomare - Lunarossa ${index}`,
        description: "Nuova unità da completare",
        cin: "",
        cir: "",
        active: false,
        publicVisible: false,
        welcomateEnabled: false,
        bookingUrl: "",
        airbnbUrl: "",
        icalPath: `/api/ical/${nextId}.ics`,
        sortOrder: index,
        photos: [],
      })
    );

    setMessage("Scheda nuova unità pronta. Completa i dati e premi Salva unità.");
  }

  async function saveUnit(event) {
    event.preventDefault();
    clearMessages();

    const id = sanitizeUnitId(unitForm.id);

    if (!id) {
      setError("Inserisci un ID tecnico valido, per esempio lunarossa2.");
      return;
    }

    if (!unitForm.name.trim()) {
      setError("Inserisci il nome dell'unità.");
      return;
    }

    try {
      const normalized = normalizeUnit({
        ...unitForm,
        id,
        maxGuests: Number(unitForm.maxGuests || 1),
        bedrooms: Number(unitForm.bedrooms || 0),
        bathrooms: Number(unitForm.bathrooms || 0),
        sortOrder: Number(unitForm.sortOrder || 999),
        hasKitchen: Boolean(unitForm.hasKitchen),
        active: Boolean(unitForm.active),
        publicVisible: Boolean(unitForm.publicVisible),
        welcomateEnabled: Boolean(unitForm.welcomateEnabled),
        icalPath: unitForm.icalPath || `/api/ical/${id}.ics`,
        photos: Array.isArray(unitForm.photos) ? unitForm.photos : [],
      });

      const nextUnits = [
        ...units.filter((unit) => unit.id !== id),
        normalized,
      ].sort((a, b) => {
        if ((a.sortOrder || 999) === (b.sortOrder || 999)) {
          return a.name.localeCompare(b.name);
        }
        return (a.sortOrder || 999) - (b.sortOrder || 999);
      });

      await setDoc(
        doc(db, "settings", "units"),
        {
          items: nextUnits,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSelectedUnitId(id);
      setMessage("Unità salvata. Lunarossa 1 resta invariata e le future unità avranno calendari separati.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio dell'unità.");
    }
  }

  function normalizePhotoList(photos = []) {
    const list = Array.isArray(photos) ? photos : [];
    const hasCover = list.some((photo) => photo.cover);

    return list
      .filter((photo) => photo?.url)
      .map((photo, index) => ({
        id: String(photo.id || photo.assetId || photo.publicId || photo.path || `photo-${index + 1}`),
        url: String(photo.url || "").trim(),
        secureUrl: String(photo.secureUrl || photo.url || "").trim(),
        path: String(photo.path || "").trim(),
        publicId: String(photo.publicId || "").trim(),
        assetId: String(photo.assetId || "").trim(),
        source: String(photo.source || (photo.publicId ? "cloudinary" : "external")).trim(),
        name: String(photo.name || photo.displayName || `Foto ${index + 1}`).trim(),
        displayName: String(photo.displayName || photo.name || `Foto ${index + 1}`).trim(),
        caption: String(photo.caption || "").trim(),
        room: String(photo.room || "").trim(),
        width: Number(photo.width || 0),
        height: Number(photo.height || 0),
        format: String(photo.format || "").trim(),
        bytes: Number(photo.bytes || 0),
        cover: hasCover ? Boolean(photo.cover) : index === 0,
        order: index + 1,
        uploadedAt: photo.uploadedAt || "",
      }));
  }

  function setUnitPhotos(nextPhotos) {
    setUnitForm((current) => ({
      ...current,
      photos: normalizePhotoList(nextPhotos),
    }));
  }

  function buildUnitFromForm(id, photosOverride) {
    return normalizeUnit({
      ...unitForm,
      id,
      maxGuests: Number(unitForm.maxGuests || 1),
      bedrooms: Number(unitForm.bedrooms || 0),
      bathrooms: Number(unitForm.bathrooms || 0),
      sortOrder: Number(unitForm.sortOrder || 999),
      hasKitchen: Boolean(unitForm.hasKitchen),
      active: Boolean(unitForm.active),
      publicVisible: Boolean(unitForm.publicVisible),
      welcomateEnabled: Boolean(unitForm.welcomateEnabled),
      icalPath: unitForm.icalPath || `/api/ical/${id}.ics`,
      photos: normalizePhotoList(photosOverride ?? unitForm.photos ?? []),
    });
  }

  function sortUnitList(list) {
    return [...list].sort((a, b) => {
      if ((a.sortOrder || 999) === (b.sortOrder || 999)) {
        return a.name.localeCompare(b.name);
      }
      return (a.sortOrder || 999) - (b.sortOrder || 999);
    });
  }

  async function persistUnitPhotos(id, nextPhotos, successMessage) {
    const normalizedUnit = buildUnitFromForm(id, nextPhotos);
    const nextUnits = sortUnitList([
      ...units.filter((unit) => unit.id !== id),
      normalizedUnit,
    ]);

    await setDoc(
      doc(db, "settings", "units"),
      {
        items: nextUnits,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setUnits(nextUnits);
    setSelectedUnitId(id);
    setUnitForm(createUnitForm(normalizedUnit));
    setMessage(successMessage || "Foto salvate. La galleria dell'unità è aggiornata.");
  }

  async function handleCloudinaryPhotoUpload() {
    clearMessages();

    const id = sanitizeUnitId(unitForm.id || selectedUnitId);
    if (!id) {
      setError("Prima inserisci un ID tecnico valido per l'unità.");
      return;
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setError("Cloudinary non è configurato. Controlla cloud name e upload preset.");
      return;
    }

    try {
      setPhotoUploading(true);
      const cloudinary = await loadCloudinaryWidgetScript();
      const existingPhotos = normalizePhotoList(unitForm.photos || []);
      const uploadedPhotos = [];
      let persisted = false;

      const persistUploadedPhotos = async () => {
        if (persisted || uploadedPhotos.length === 0) return;
        persisted = true;

        const nextPhotos = normalizePhotoList([...existingPhotos, ...uploadedPhotos]);
        setUnitPhotos(nextPhotos);
        await persistUnitPhotos(
          id,
          nextPhotos,
          `${uploadedPhotos.length} foto caricata/e con Cloudinary e salvata/e nella scheda unità.`
        );
      };

      const widget = cloudinary.createUploadWidget(
        {
          cloudName: CLOUDINARY_CLOUD_NAME,
          uploadPreset: CLOUDINARY_UPLOAD_PRESET,
          sources: ["local", "camera", "url"],
          multiple: true,
          maxFiles: 30,
          maxImageFileSize: 12000000,
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
          tags: ["gelone", "unita", id],
          context: {
            unit_id: id,
            unit_name: unitForm.name || id,
          },
          showAdvancedOptions: false,
          cropping: false,
          folder: `gelone/units/${id}`,
          styles: {
            palette: {
              window: "#fffaf1",
              sourceBg: "#faf6ee",
              windowBorder: "#d7c49f",
              tabIcon: "#9b6b25",
              inactiveTabIcon: "#8d8375",
              menuIcons: "#0a1d35",
              link: "#9b6b25",
              action: "#0a1d35",
              inProgress: "#9b6b25",
              complete: "#1f7a4d",
              error: "#b3261e",
              textDark: "#0a1d35",
              textLight: "#ffffff",
            },
          },
        },
        async (uploadError, result) => {
          if (uploadError) {
            console.error(uploadError);
            setError("Cloudinary non ha completato il caricamento. Riprova o controlla il preset gelone_units.");
            setPhotoUploading(false);
            return;
          }

          if (result?.event === "success" && result.info?.secure_url) {
            const info = result.info;
            uploadedPhotos.push({
              id: String(info.asset_id || info.public_id || info.secure_url),
              assetId: String(info.asset_id || ""),
              publicId: String(info.public_id || ""),
              url: String(info.secure_url || info.url || ""),
              secureUrl: String(info.secure_url || info.url || ""),
              name: String(info.original_filename || info.display_name || `Foto ${existingPhotos.length + uploadedPhotos.length + 1}`),
              displayName: String(info.display_name || info.original_filename || ""),
              source: "cloudinary",
              cover: existingPhotos.length === 0 && uploadedPhotos.length === 1,
              order: existingPhotos.length + uploadedPhotos.length,
              uploadedAt: info.created_at || new Date().toISOString(),
              width: Number(info.width || 0),
              height: Number(info.height || 0),
              format: String(info.format || ""),
              bytes: Number(info.bytes || 0),
            });
          }

          if (result?.event === "queues-end") {
            try {
              await persistUploadedPhotos();
            } catch (persistError) {
              console.error(persistError);
              setError("Foto caricate su Cloudinary, ma non riesco a salvarle nella scheda unità. Riprova.");
            } finally {
              setPhotoUploading(false);
            }
          }

          if (["abort", "close"].includes(result?.event) && uploadedPhotos.length === 0) {
            setPhotoUploading(false);
          }
        }
      );

      widget.open();
    } catch (err) {
      console.error(err);
      setPhotoUploading(false);
      setError("Non riesco ad aprire il caricatore Cloudinary. Controlla connessione, preset e browser.");
    }
  }

  async function removeUnitPhoto(photo) {
    clearMessages();

    const id = sanitizeUnitId(unitForm.id || selectedUnitId);
    const nextPhotos = normalizePhotoList(
      (unitForm.photos || []).filter((item) => item.id !== photo.id && item.path !== photo.path)
    );

    setUnitPhotos(nextPhotos);

    try {
      await persistUnitPhotos(id, nextPhotos, "Foto rimossa e galleria salvata.");
    } catch (err) {
      console.error(err);
      setError("Foto rimossa dalla schermata, ma non riesco a salvare la modifica. Riprova con Salva unità.");
    }
  }

  async function setPhotoAsCover(photo) {
    const id = sanitizeUnitId(unitForm.id || selectedUnitId);
    const nextPhotos = normalizePhotoList(
      (unitForm.photos || []).map((item) => ({
        ...item,
        cover: item.id === photo.id,
      }))
    );

    setUnitPhotos(nextPhotos);

    try {
      await persistUnitPhotos(id, nextPhotos, "Copertina aggiornata e salvata.");
    } catch (err) {
      console.error(err);
      setError("Copertina aggiornata dalla schermata, ma non riesco a salvare la modifica. Riprova con Salva unità.");
    }
  }

  async function movePhoto(photo, direction) {
    const currentPhotos = normalizePhotoList(unitForm.photos || []);
    const currentIndex = currentPhotos.findIndex((item) => item.id === photo.id);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentPhotos.length) return;

    const nextPhotos = [...currentPhotos];
    [nextPhotos[currentIndex], nextPhotos[nextIndex]] = [nextPhotos[nextIndex], nextPhotos[currentIndex]];

    const normalizedPhotos = normalizePhotoList(nextPhotos);
    setUnitPhotos(normalizedPhotos);

    try {
      await persistUnitPhotos(sanitizeUnitId(unitForm.id || selectedUnitId), normalizedPhotos, "Ordine foto aggiornato e salvato.");
    } catch (err) {
      console.error(err);
      setError("Ordine foto aggiornato dalla schermata, ma non riesco a salvare la modifica. Riprova con Salva unità.");
    }
  }

  async function copyText(text, successMessage) {
    clearMessages();

    try {
      const copied = await copyToClipboard(text);

      if (!copied) {
        setManualCopy({
          title: "Testo pronto da copiare",
          text: String(text || ""),
        });
        setError(
          "Il browser non ha permesso la copia automatica. Ti ho aperto il testo qui sotto: selezionalo e copialo manualmente."
        );
        return;
      }

      setMessage(successMessage);
    } catch (err) {
      console.error(err);
      setManualCopy({
        title: "Testo pronto da copiare",
        text: String(text || ""),
      });
      setError("Non riesco a copiare automaticamente. Copia manualmente il testo qui sotto.");
    }
  }

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf6ee] text-[#0a1d35]">
        Caricamento...
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#faf6ee] px-5 py-10 text-[#0a1d35]">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-900">
          <h1 className="font-serif text-3xl">Accesso non autorizzato</h1>
          <p className="mt-3">
            L'email collegata non è autorizzata come amministratore.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="mt-5 rounded-full bg-red-900 px-6 py-3 font-bold text-white"
          >
            Esci
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf6ee] text-[#0a1d35]">
      <header className="sticky top-0 z-40 border-b border-[#e4d8c2] bg-[#faf6ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
              Mini PMS Firebase
            </p>
            <h1 className="font-serif text-3xl">Gelone Lungomare</h1>
            <p className="text-sm text-[#555]">
              Admin: {user.email} · Unità: {selectedUnit.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
              className="rounded-full border border-[#d7c49f] bg-white px-5 py-3 font-semibold text-[#0a1d35]"
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>

            <a
              href="/"
              className="rounded-full border border-[#0a1d35] bg-white px-5 py-3 font-semibold text-[#0a1d35]"
            >
              Sito pubblico
            </a>
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-5 py-3 font-bold text-white"
            >
              <LogOut size={18} />
              Esci
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-4 md:grid-cols-6">
          <StatCard title="Attive" value={stats.active} icon={CalendarDays} />
          <StatCard title="Confermate" value={stats.confirmed} icon={ShieldCheck} />
          <StatCard title="Richieste" value={stats.pending} icon={RefreshCcw} />
          <StatCard title="Blocchi" value={stats.blocked} icon={Lock} />
          <StatCard title="Pagate" value={stats.paid} icon={CreditCard} />
          <StatCard
            title="WelcoMate"
            value={stats.welcomateToCheck}
            icon={MessageCircle}
            subtitle="Da controllare"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <TabButton active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")}>
            Prenotazioni
          </TabButton>
          <TabButton active={activeTab === "new"} onClick={() => setActiveTab("new")}>
            Nuova prenotazione
          </TabButton>
          <TabButton active={activeTab === "economy"} onClick={() => setActiveTab("economy")}>
            Economia
          </TabButton>
          <TabButton active={activeTab === "checks"} onClick={() => setActiveTab("checks")}>
            Controlli
          </TabButton>
          <TabButton active={activeTab === "backup"} onClick={() => setActiveTab("backup")}>
            Backup
          </TabButton>
          <TabButton active={activeTab === "checkin"} onClick={() => setActiveTab("checkin")}>
            Check-in
          </TabButton>
          <TabButton active={activeTab === "preparation"} onClick={() => setActiveTab("preparation")}>
            Pulizie
          </TabButton>
          <TabButton active={activeTab === "quality"} onClick={() => setActiveTab("quality")}>
            Qualità dati
          </TabButton>
          <TabButton active={activeTab === "internal"} onClick={() => setActiveTab("internal")}>
            Registro operativo
          </TabButton>
          <TabButton active={activeTab === "block"} onClick={() => setActiveTab("block")}>
            Blocca date
          </TabButton>
          <TabButton active={activeTab === "units"} onClick={() => setActiveTab("units")}>
            Unità alloggiative
          </TabButton>
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
            Impostazioni
          </TabButton>
          <TabButton active={activeTab === "maintenance"} onClick={() => setActiveTab("maintenance")}>
            Manutenzione
          </TabButton>
          <TabButton active={activeTab === "logs"} onClick={() => setActiveTab("logs")}>
            Log attivita
          </TabButton>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            {error}
          </div>
        )}

        {manualCopy.text && (
          <div className="mt-6 rounded-[2rem] border border-[#e4d8c2] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Copia manuale
                </p>
                <h3 className="mt-1 font-serif text-2xl">{manualCopy.title}</h3>
                <p className="mt-2 text-sm text-[#555]">
                  Se il telefono o il browser bloccano gli appunti, seleziona il testo e copialo manualmente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualCopy({ title: "", text: "" })}
                className="rounded-full border border-[#0a1d35] px-5 py-3 font-bold"
              >
                Chiudi
              </button>
            </div>
            <textarea
              readOnly
              value={manualCopy.text}
              onFocus={(event) => event.target.select()}
              className="mt-4 min-h-56 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 text-sm leading-6"
            />
          </div>
        )}

        {activeTab === "internal" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Registro operativo
              </p>
              <h2 className="mt-2 font-serif text-3xl">Registro interno avanzato</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Qui puoi registrare manutenzioni, problemi ospiti, pulizie, note amministrative
                e promemoria interni. Ogni nota resta nello storico e può essere chiusa o riaperta.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <StatCard title="Aperte" value={internalRecordStats.open} icon={RefreshCcw} subtitle="Da seguire" />
                <StatCard title="Alta priorità" value={internalRecordStats.highPriority} icon={Lock} subtitle="Attenzione" />
                <StatCard title="Entro 7 giorni" value={internalRecordStats.dueSoon} icon={CalendarDays} subtitle="Scadenze vicine" />
                <StatCard title="Chiuse" value={internalRecordStats.closed} icon={ShieldCheck} subtitle="Completate" />
              </div>

              <form onSubmit={createInternalRecord} className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Nuova nota interna
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Aggiungi al registro
                </h3>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <FormField label="Categoria">
                    <select
                      value={internalRecordForm.category}
                      onChange={(event) =>
                        setInternalRecordForm({
                          ...internalRecordForm,
                          category: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    >
                      <option value="nota">Nota generale</option>
                      <option value="manutenzione">Manutenzione</option>
                      <option value="pulizia">Pulizia</option>
                      <option value="problema_ospite">Problema ospite</option>
                      <option value="amministrativo">Amministrativo</option>
                      <option value="promemoria">Promemoria</option>
                    </select>
                  </FormField>

                  <FormField label="Priorità">
                    <select
                      value={internalRecordForm.priority}
                      onChange={(event) =>
                        setInternalRecordForm({
                          ...internalRecordForm,
                          priority: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    >
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Bassa">Bassa</option>
                    </select>
                  </FormField>

                  <FormField label="Scadenza / data controllo">
                    <input
                      type="date"
                      value={internalRecordForm.dueDate}
                      onChange={(event) =>
                        setInternalRecordForm({
                          ...internalRecordForm,
                          dueDate: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Titolo">
                    <input
                      value={internalRecordForm.title}
                      onChange={(event) =>
                        setInternalRecordForm({
                          ...internalRecordForm,
                          title: event.target.value,
                        })
                      }
                      placeholder="Es. Controllare climatizzatore"
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Collega prenotazione">
                    <select
                      value={internalRecordForm.linkedBookingId}
                      onChange={(event) =>
                        setInternalRecordForm({
                          ...internalRecordForm,
                          linkedBookingId: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    >
                      <option value="">Nessuna prenotazione collegata</option>
                      {bookings
                        .filter((booking) => booking.status !== "cancelled")
                        .map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.guestName || "Prenotazione"} · {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                          </option>
                        ))}
                    </select>
                  </FormField>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                    >
                      Salva nota
                    </button>
                  </div>

                  <div className="md:col-span-3">
                    <FormField label="Nota dettagliata">
                      <textarea
                        value={internalRecordForm.note}
                        onChange={(event) =>
                          setInternalRecordForm({
                            ...internalRecordForm,
                            note: event.target.value,
                          })
                        }
                        placeholder="Scrivi cosa è successo, cosa va fatto, chi deve controllare o cosa è stato deciso."
                        className="min-h-32 w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                      />
                    </FormField>
                  </div>
                </div>
              </form>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Storico registro
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Note operative
                </h3>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Stato</th>
                        <th className="py-3">Priorità</th>
                        <th className="py-3">Categoria</th>
                        <th className="py-3">Titolo</th>
                        <th className="py-3">Scadenza</th>
                        <th className="py-3">Prenotazione</th>
                        <th className="py-3">Nota</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleInternalRecords.length === 0 && (
                        <tr>
                          <td colSpan="8" className="py-8 text-center text-[#555]">
                            Nessuna nota interna registrata.
                          </td>
                        </tr>
                      )}

                      {visibleInternalRecords.map((record) => (
                        <tr key={record.id} className="border-b border-[#f0e6d5] align-top">
                          <td className="py-4">
                            <Pill
                              className={
                                record.status === "closed"
                                  ? "border-green-200 bg-green-50 text-green-900"
                                  : "border-amber-200 bg-amber-50 text-amber-900"
                              }
                            >
                              {record.status === "closed" ? "Chiusa" : "Aperta"}
                            </Pill>
                          </td>
                          <td className="py-4">
                            <Pill
                              className={
                                record.priority === "Alta"
                                  ? "border-red-200 bg-red-50 text-red-900"
                                  : record.priority === "Bassa"
                                    ? "border-slate-200 bg-slate-100 text-slate-900"
                                    : "border-amber-200 bg-amber-50 text-amber-900"
                              }
                            >
                              {record.priority || "Media"}
                            </Pill>
                          </td>
                          <td className="py-4">{String(record.category || "nota").replaceAll("_", " ")}</td>
                          <td className="py-4 font-semibold">{record.title || "-"}</td>
                          <td className="py-4">{formatDate(record.dueDate)}</td>
                          <td className="py-4">
                            {record.linkedGuestName
                              ? record.linkedGuestName + " · " + formatDate(record.linkedCheckIn)
                              : "-"}
                          </td>
                          <td className="py-4 text-sm leading-6 text-[#555]">
                            {record.note || "-"}
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              {record.linkedBookingId && (
                                <SmallButton
                                  onClick={() => {
                                    setSelectedBookingId(record.linkedBookingId);
                                    setActiveTab("calendar");
                                  }}
                                  className="bg-[#0a1d35] text-white"
                                >
                                  Apri prenotazione
                                </SmallButton>
                              )}

                              {record.status === "closed" ? (
                                <SmallButton
                                  onClick={() => setInternalRecordStatus(record, "open")}
                                  className="bg-[#f5c84b] text-[#0a1d35]"
                                >
                                  Riapri
                                </SmallButton>
                              ) : (
                                <SmallButton
                                  onClick={() => setInternalRecordStatus(record, "closed")}
                                  className="bg-green-700 text-white"
                                >
                                  Chiudi
                                </SmallButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Il registro interno non modifica disponibilità, prenotazioni o pagamenti.
                  Serve come storico operativo e controllo interno della struttura.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "preparation" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Pulizie e preparazione
              </p>
              <h2 className="mt-2 font-serif text-3xl">Preparazione alloggio</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Lista operativa dei check-out e delle pulizie da completare prima del prossimo arrivo.
                Qui controlli bagno, cucina, biancheria, chiavi e verifica finale.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatCard title="Check-out oggi" value={preparationStats.todayRows.length} icon={CalendarDays} subtitle="Da preparare" />
                <StatCard title="Turnover stesso giorno" value={preparationStats.sameDayRows.length} icon={RefreshCcw} subtitle="Priorità alta" />
                <StatCard title="Da fare" value={preparationStats.toDoRows.length} icon={Lock} subtitle="Non iniziate" />
                <StatCard title="In corso" value={preparationStats.inProgressRows.length} icon={Search} subtitle="Parziali" />
                <StatCard title="Completate" value={preparationStats.completedRows.length} icon={ShieldCheck} subtitle="Pronte" />
                <StatCard title="Non pronte" value={preparationStats.notReadyRows.length} icon={CreditCard} subtitle="Da controllare" />
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Lista pulizie
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Check-out e preparazione
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  Segna i controlli completati e aggiorna lo stato dell'alloggio.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1350px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Check-out</th>
                        <th className="py-3">Ospite uscita</th>
                        <th className="py-3">Prossimo arrivo</th>
                        <th className="py-3">Stato</th>
                        <th className="py-3">Controlli</th>
                        <th className="py-3">Nota</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {preparationStats.rows.length === 0 && (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-[#555]">
                            Nessuna pulizia programmata nei prossimi 14 giorni.
                          </td>
                        </tr>
                      )}

                      {preparationStats.rows.map((booking) => {
                        const checks = booking.preparationChecks || {};
                        const checkItems = [
                          ["cleaning", "Pulizia"],
                          ["bathroom", "Bagno"],
                          ["kitchen", "Cucina"],
                          ["linen", "Biancheria"],
                          ["keys", "Chiavi"],
                          ["finalCheck", "Controllo finale"],
                        ];

                        return (
                          <tr key={booking.id} className="border-b border-[#f0e6d5] align-top">
                            <td className="py-4">
                              <div className="font-semibold">{formatDate(booking.checkOut)}</div>
                              {booking.isTodayCheckout && (
                                <Pill className="mt-2 border-red-200 bg-red-50 text-red-900">
                                  Oggi
                                </Pill>
                              )}
                              {booking.isSameDayTurnover && (
                                <Pill className="mt-2 border-red-200 bg-red-50 text-red-900">
                                  Turnover
                                </Pill>
                              )}
                            </td>
                            <td className="py-4 font-semibold">{booking.guestName || "-"}</td>
                            <td className="py-4">
                              {booking.nextBooking ? (
                                <div>
                                  <div className="font-semibold">
                                    {booking.nextBooking.guestName || "Prossimo ospite"}
                                  </div>
                                  <div className="text-sm text-[#555]">
                                    {formatDate(booking.nextBooking.checkIn)}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-4">
                              <Pill className={getPreparationClass(booking.preparationStatus)}>
                                {getPreparationLabel(booking.preparationStatus)}
                              </Pill>
                              <div className="mt-2 text-xs text-[#555]">
                                {booking.preparationCompletedChecks}/{booking.preparationTotalChecks} controlli
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="grid gap-2 md:grid-cols-2">
                                {checkItems.map(([key, label]) => (
                                  <label key={key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(checks[key])}
                                      onChange={(event) =>
                                        setPreparationCheck(booking, key, event.target.checked)
                                      }
                                    />
                                    <span>{label}</span>
                                  </label>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 text-sm leading-6 text-[#555]">
                              {booking.preparationNote || "-"}
                            </td>
                            <td className="py-4">
                              <div className="flex flex-wrap gap-2">
                                <SmallButton
                                  onClick={() => setPreparationStatus(booking, "to_do")}
                                  className="bg-red-900 text-white"
                                >
                                  Da fare
                                </SmallButton>

                                <SmallButton
                                  onClick={() => setPreparationStatus(booking, "in_progress")}
                                  className="bg-[#f5c84b] text-[#0a1d35]"
                                >
                                  In corso
                                </SmallButton>

                                <SmallButton
                                  onClick={() => setPreparationStatus(booking, "completed")}
                                  className="bg-green-700 text-white"
                                >
                                  Completata
                                </SmallButton>

                                <SmallButton
                                  onClick={() => updatePreparationNote(booking)}
                                  className="bg-[#9b6b25] text-white"
                                >
                                  Nota
                                </SmallButton>

                                <SmallButton
                                  onClick={() => {
                                    setSelectedBookingId(booking.id);
                                    setActiveTab("calendar");
                                  }}
                                  className="bg-[#0a1d35] text-white"
                                >
                                  Apri dettagli
                                </SmallButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  La scheda Pulizie aggiorna solo lo stato di preparazione della prenotazione.
                  Non modifica calendario, pagamenti o disponibilità pubblica.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "checkin" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Check-in operativo
              </p>
              <h2 className="mt-2 font-serif text-3xl">Arrivi da preparare</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Lista pratica degli arrivi di oggi e dei prossimi 7 giorni, con pagamento,
                WelcoMate, qualità dati, telefono e note operative.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatCard title="Arrivi oggi" value={checkinStats.todayRows.length} icon={CalendarDays} subtitle="Check-in odierni" />
                <StatCard title="Entro 7 giorni" value={checkinStats.rows.length} icon={RefreshCcw} subtitle="Arrivi vicini" />
                <StatCard title="Pronti" value={checkinStats.readyRows.length} icon={ShieldCheck} subtitle="Operativi completi" />
                <StatCard title="Non pronti" value={checkinStats.notReadyRows.length} icon={Lock} subtitle="Richiedono controllo" />
                <StatCard title="Saldi aperti" value={checkinStats.openBalanceRows.length} icon={CreditCard} subtitle="Da incassare" />
                <StatCard title="WelcoMate" value={checkinStats.welcomateRows.length} icon={MessageCircle} subtitle="Da gestire" />
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Lista check-in
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Arrivi operativi
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  Usa questa tabella per preparare gli arrivi senza entrare in ogni scheda.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1250px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Arrivo</th>
                        <th className="py-3">Ospite</th>
                        <th className="py-3">Telefono</th>
                        <th className="py-3">Qualità</th>
                        <th className="py-3">Pagamento</th>
                        <th className="py-3">Saldo</th>
                        <th className="py-3">WelcoMate</th>
                        <th className="py-3">Note interne</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {checkinStats.rows.length === 0 && (
                        <tr>
                          <td colSpan="9" className="py-8 text-center text-[#555]">
                            Nessun check-in nei prossimi 7 giorni.
                          </td>
                        </tr>
                      )}

                      {checkinStats.rows.map((booking) => {
                        const whatsappNumber = normalizePhoneForWhatsApp(booking.guestPhone);

                        return (
                          <tr key={booking.id} className="border-b border-[#f0e6d5] align-top">
                            <td className="py-4">
                              <div className="font-semibold">{formatDate(booking.checkIn)}</div>
                              {booking.isToday && (
                                <Pill className="mt-2 border-red-200 bg-red-50 text-red-900">
                                  Oggi
                                </Pill>
                              )}
                            </td>
                            <td className="py-4 font-semibold">{booking.guestName || "-"}</td>
                            <td className="py-4">{booking.guestPhone || "-"}</td>
                            <td className="py-4">
                              <Pill className={getReadinessClass(booking.readiness)}>
                                {booking.readiness.label}
                              </Pill>
                            </td>
                            <td className="py-4">{getPaymentLabel(booking.paymentStatus)}</td>
                            <td className="py-4 font-bold text-[#0a1d35]">
                              {formatEuro(booking.balanceDue)}
                            </td>
                            <td className="py-4">{getWelcomateLabel(booking.welcomateStatus)}</td>
                            <td className="py-4 text-sm text-[#555]">
                              {booking.internalNotes || "-"}
                            </td>
                            <td className="py-4">
                              <div className="flex flex-wrap gap-2">
                                <SmallButton
                                  onClick={() => {
                                    setSelectedBookingId(booking.id);
                                    setActiveTab("calendar");
                                  }}
                                  className="bg-[#0a1d35] text-white"
                                >
                                  Apri dettagli
                                </SmallButton>

                                {whatsappNumber && (
                                  <a
                                    href={`https://wa.me/${whatsappNumber}?text=${buildWhatsAppMessage(
                                      booking,
                                      settings
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white"
                                  >
                                    WhatsApp
                                  </a>
                                )}

                                {booking.balanceDue > 0 && (
                                  <SmallButton
                                    onClick={() =>
                                      setManualPaymentStatus(
                                        booking,
                                        "paid",
                                        "saldo_pagato_da_checkin"
                                      )
                                    }
                                    className="bg-green-700 text-white"
                                  >
                                    Segna saldo pagato
                                  </SmallButton>
                                )}

                                {booking.welcomateOpen && (
                                  <SmallButton
                                    onClick={() => copyWelcomateAndMarkSent(booking)}
                                    className="bg-[#9b6b25] text-white"
                                  >
                                    Copia WelcoMate
                                  </SmallButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Il Check-in operativo non cambia nulla automaticamente. Usa solo pulsanti espliciti
                  per pagamento, WhatsApp, WelcoMate o apertura dettagli.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "quality" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Qualità dati
              </p>
              <h2 className="mt-2 font-serif text-3xl">Prenotazioni pronte o da completare</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Questa sezione controlla la qualità operativa delle prenotazioni:
                prezzo, contatti, pagamento, WelcoMate e consensi quando arrivano dal sito.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <StatCard title="Pronte" value={qualityStats.readyRows.length} icon={ShieldCheck} subtitle="Complete operative" />
                <StatCard title="Da completare" value={qualityStats.toCompleteRows.length} icon={Lock} subtitle="Mancano dati importanti" />
                <StatCard title="Da controllare" value={qualityStats.toCheckRows.length} icon={RefreshCcw} subtitle="Verifiche consigliate" />
                <StatCard title="Problemi pagamento" value={qualityStats.paymentProblemRows.length} icon={CreditCard} subtitle="Saldo o stato pagamento" />
                <StatCard title="Senza prezzo" value={qualityStats.missingPriceRows.length} icon={Search} subtitle="Totale mancante" />
                <StatCard title="Contatti mancanti" value={qualityStats.missingContactRows.length} icon={Mail} subtitle="Telefono o email" />
                <StatCard title="WelcoMate" value={qualityStats.welcomateProblemRows.length} icon={MessageCircle} subtitle="Da inviare o controllare" />
                <StatCard title="Totale controllate" value={qualityStats.rows.length} icon={CalendarDays} subtitle="Prenotazioni attive" />
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Verifica operativa
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Lista qualità dati
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  Apri le prenotazioni non pronte e completa i dati mancanti.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Qualità</th>
                        <th className="py-3">Ospite</th>
                        <th className="py-3">Date</th>
                        <th className="py-3">Pagamento</th>
                        <th className="py-3">WelcoMate</th>
                        <th className="py-3">Problemi rilevati</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {qualityStats.rows.length === 0 && (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-[#555]">
                            Nessuna prenotazione attiva da controllare.
                          </td>
                        </tr>
                      )}

                      {qualityStats.rows.map((booking) => {
                        const readiness = getBookingReadiness(booking);

                        return (
                          <tr key={booking.id} className="border-b border-[#f0e6d5] align-top">
                            <td className="py-4">
                              <Pill className={getReadinessClass(readiness)}>
                                {readiness.label}
                              </Pill>
                            </td>
                            <td className="py-4 font-semibold">{booking.guestName || "-"}</td>
                            <td className="py-4">
                              {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                            </td>
                            <td className="py-4">{getPaymentLabel(booking.paymentStatus)}</td>
                            <td className="py-4">{getWelcomateLabel(booking.welcomateStatus)}</td>
                            <td className="py-4 text-sm text-[#555]">
                              {readiness.issues.length === 0
                                ? "Nessun problema"
                                : readiness.issues.join(" · ")}
                            </td>
                            <td className="py-4">
                              <div className="flex flex-wrap gap-2">
                                <SmallButton
                                  onClick={() => {
                                    setSelectedBookingId(booking.id);
                                    setActiveTab("calendar");
                                  }}
                                  className="bg-[#0a1d35] text-white"
                                >
                                  Apri dettagli
                                </SmallButton>

                                {readiness.issues.some((issue) => issue.includes("Saldo")) && (
                                  <SmallButton
                                    onClick={() =>
                                      setManualPaymentStatus(
                                        booking,
                                        "paid",
                                        "saldo_pagato_da_qualita_dati"
                                      )
                                    }
                                    className="bg-green-700 text-white"
                                  >
                                    Segna saldo pagato
                                  </SmallButton>
                                )}

                                {readiness.issues.some((issue) => issue.includes("WelcoMate")) && (
                                  <SmallButton
                                    onClick={() => copyWelcomateAndMarkSent(booking)}
                                    className="bg-[#9b6b25] text-white"
                                  >
                                    Copia WelcoMate
                                  </SmallButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Questo controllo non modifica automaticamente le prenotazioni.
                  Serve per evitare dati mancanti prima del check-in.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "backup" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Backup dati
              </p>
              <h2 className="mt-2 font-serif text-3xl">Export e sicurezza dati</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Scarica copie CSV delle prenotazioni e del registro attività.
                Questi export sono utili per controllo interno, commercialista,
                storico operativo e sicurezza.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-5">
                <StatCard title="Prenotazioni totali" value={backupStats.allBookings} icon={CalendarDays} subtitle="Attive + cancellate" />
                <StatCard title="Future" value={backupStats.futureBookings} icon={ShieldCheck} subtitle="Attive da oggi in poi" />
                <StatCard title="Annullate" value={backupStats.cancelledBookings} icon={Trash2} subtitle="Salvate nello storico" />
                <StatCard title="Log attività" value={backupStats.activityLogs} icon={Search} subtitle="Ultimi log caricati" />
                <StatCard title="Azioni delicate" value={backupStats.deletedOrCancelledLogs} icon={Lock} subtitle="Annullamenti/eliminazioni" />
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                  <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                    Prenotazioni
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                    Export prenotazioni CSV
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    Esporta i record prenotazione dell'unità selezionata con date,
                    ospite, stato, pagamento, totale, caparra e note.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <SmallButton
                      onClick={() => exportBookingsCsv("all")}
                      className="bg-[#0a1d35] px-5 py-3 text-white"
                    >
                      Esporta tutte
                    </SmallButton>

                    <SmallButton
                      onClick={() => exportBookingsCsv("future")}
                      className="bg-green-700 px-5 py-3 text-white"
                    >
                      Esporta future
                    </SmallButton>

                    <SmallButton
                      onClick={() => exportBookingsCsv("cancelled")}
                      className="bg-red-900 px-5 py-3 text-white"
                    >
                      Esporta cancellate
                    </SmallButton>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                  <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                    Registro attività
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                    Export log operativi CSV
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    Esporta i log Admin caricati: modifiche, pagamenti,
                    cancellazioni, eliminazioni, sincronizzazioni e manutenzione.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <SmallButton
                      onClick={() => exportActivityLogsCsv("all")}
                      className="bg-[#0a1d35] px-5 py-3 text-white"
                    >
                      Esporta log attività
                    </SmallButton>

                    <SmallButton
                      onClick={() => exportActivityLogsCsv("deleted_cancelled")}
                      className="bg-red-900 px-5 py-3 text-white"
                    >
                      Solo cancellazioni/eliminazioni
                    </SmallButton>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Gli export CSV vengono generati dal browser sui dati già visibili in Admin.
                Non modificano prenotazioni, calendari o pagamenti.
              </div>
            </div>
          </section>
        )}

        {activeTab === "checks" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Controllo operativo
              </p>
              <h2 className="mt-2 font-serif text-3xl">Cose da controllare</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Questa sezione ti dice cosa richiede attenzione prima del check-in:
                pagamenti, richieste, WelcoMate, dati mancanti e prenotazioni incomplete.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatCard title="Richieste" value={controlsStats.requestsToConfirm.length} icon={RefreshCcw} subtitle="Da confermare" />
                <StatCard title="Saldi aperti" value={formatEuro(controlsStats.openBalanceTotal)} icon={CreditCard} subtitle={controlsStats.openBalances.length + " prenotazioni"} />
                <StatCard title="WelcoMate" value={controlsStats.welcomateToSend.length} icon={MessageCircle} subtitle="Da inviare o controllare" />
                <StatCard title="Check-in 7 giorni" value={controlsStats.checkInsSoon.length} icon={CalendarDays} subtitle="Arrivi vicini" />
                <StatCard title="Senza prezzo" value={controlsStats.missingPriceRows.length} icon={Search} subtitle="Totale mancante" />
                <StatCard title="Dati mancanti" value={controlsStats.missingContactRows.length} icon={Mail} subtitle="Telefono o email" />
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                      Azioni operative
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                      Lista priorità
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#555]">
                      Le priorità alte sono quelle più vicine al check-in o più delicate.
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Priorità</th>
                        <th className="py-3">Tipo</th>
                        <th className="py-3">Ospite</th>
                        <th className="py-3">Date</th>
                        <th className="py-3">Dettaglio</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {controlsStats.actionRows.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-[#555]">
                            Nessuna azione urgente trovata.
                          </td>
                        </tr>
                      )}

                      {controlsStats.actionRows.map((item) => (
                        <tr key={item.id} className="border-b border-[#f0e6d5] align-top">
                          <td className="py-4">
                            <Pill
                              className={
                                item.priority === "Alta"
                                  ? "border-red-200 bg-red-50 text-red-900"
                                  : "border-amber-200 bg-amber-50 text-amber-900"
                              }
                            >
                              {item.priority}
                            </Pill>
                          </td>
                          <td className="py-4 font-semibold">{item.type}</td>
                          <td className="py-4">{item.booking.guestName || "-"}</td>
                          <td className="py-4">
                            {formatDate(item.booking.checkIn)} - {formatDate(item.booking.checkOut)}
                          </td>
                          <td className="py-4 text-sm text-[#555]">{item.detail}</td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <SmallButton
                                onClick={() => {
                                  setSelectedBookingId(item.booking.id);
                                  setActiveTab("calendar");
                                }}
                                className="bg-[#0a1d35] text-white"
                              >
                                Apri dettagli
                              </SmallButton>

                              {item.action === "confirm" && (
                                <SmallButton
                                  onClick={() => confirmBooking(item.booking)}
                                  className="bg-green-700 text-white"
                                >
                                  Conferma
                                </SmallButton>
                              )}

                              {item.action === "balance" && (
                                <SmallButton
                                  onClick={() =>
                                    setManualPaymentStatus(
                                      item.booking,
                                      "paid",
                                      "saldo_pagato_da_controlli"
                                    )
                                  }
                                  className="bg-green-700 text-white"
                                >
                                  Segna saldo pagato
                                </SmallButton>
                              )}

                              {item.action === "welcomate" && (
                                <SmallButton
                                  onClick={() => copyWelcomateAndMarkSent(item.booking)}
                                  className="bg-[#9b6b25] text-white"
                                >
                                  Copia WelcoMate
                                </SmallButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Questa scheda non modifica nulla da sola: ti mostra cosa controllare e usa solo pulsanti espliciti per le azioni operative.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "economy" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Controllo economico
              </p>
              <h2 className="mt-2 font-serif text-3xl">Dashboard economica</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Vista interna per controllare incassi, saldi da ricevere, notti vendute
                e valore medio delle prenotazioni dell'unità selezionata.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <div className="grid gap-4 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Periodo</span>
                    <select
                      value={economyPeriod}
                      onChange={(event) => setEconomyPeriod(event.target.value)}
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 font-semibold outline-none"
                    >
                      <option value="all">Tutto</option>
                      <option value="today">Oggi</option>
                      <option value="month">Questo mese</option>
                      <option value="year">Questo anno</option>
                      <option value="custom">Personalizzato</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Da data</span>
                    <input
                      type="date"
                      value={economyDateFrom}
                      onChange={(event) => {
                        setEconomyDateFrom(event.target.value);
                        setEconomyPeriod("custom");
                      }}
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 font-semibold outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">A data</span>
                    <input
                      type="date"
                      value={economyDateTo}
                      onChange={(event) => {
                        setEconomyDateTo(event.target.value);
                        setEconomyPeriod("custom");
                      }}
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4 font-semibold outline-none"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEconomyPeriod("all");
                        setEconomyDateFrom("");
                        setEconomyDateTo("");
                      }}
                      className="w-full rounded-full border border-[#0a1d35] bg-white px-5 py-4 font-bold text-[#0a1d35]"
                    >
                      Azzera filtro
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[#555]">
                  Prenotazioni considerate nel periodo: <strong>{economyStats.filteredCount}</strong>.
                  Il filtro usa la data di arrivo della prenotazione.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={exportEconomyCsv}
                    disabled={!economyStats.reportRows || economyStats.reportRows.length === 0}
                    className="rounded-full bg-[#0a1d35] px-5 py-3 font-bold text-white transition hover:bg-[#132f52] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Esporta CSV
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatCard title="Incasso confermato" value={formatEuro(economyStats.confirmedRevenue)} icon={CreditCard} subtitle="Totale prenotazioni confermate" />
                <StatCard title="Incassato" value={formatEuro(economyStats.collected)} icon={ShieldCheck} subtitle="Pagato o caparra ricevuta" />
                <StatCard title="Saldo da incassare" value={formatEuro(economyStats.balanceDue)} icon={RefreshCcw} subtitle="Importi ancora aperti" />
                <StatCard title="Caparre" value={formatEuro(economyStats.depositCollected)} icon={Lock} subtitle="Caparre registrate" />
                <StatCard title="Notti vendute" value={economyStats.soldNights} icon={CalendarDays} subtitle="Solo prenotazioni confermate" />
                <StatCard title="Media/notte" value={formatEuro(economyStats.averageNight)} icon={Star} subtitle="Valore medio per notte" />
                <StatCard title="Da incassare" value={economyStats.openBalanceCount} icon={Mail} subtitle="Prenotazioni con saldo aperto" />
                <StatCard title="Urgenti" value={economyStats.urgentBalanceCount} icon={Wifi} subtitle="Check-in entro 7 giorni" />
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-[#9b6b25]">
                  Controllo saldi
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#0a1d35]">
                  Prossimi importi da ricevere
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  Qui vedi le prenotazioni con totale ancora non completamente saldato.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <DetailRow label="Saldo aperto totale" value={formatEuro(economyStats.balanceDue)} />
                  <DetailRow label="Prenotazioni da incassare" value={economyStats.openBalanceCount} />
                  <DetailRow label="Urgenti entro 7 giorni" value={formatEuro(economyStats.urgentBalanceTotal)} />
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[950px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                        <th className="py-3">Arrivo</th>
                        <th className="py-3">Partenza</th>
                        <th className="py-3">Ospite</th>
                        <th className="py-3">Stato</th>
                        <th className="py-3">Pagamento</th>
                        <th className="py-3">Totale</th>
                        <th className="py-3">Incassato</th>
                        <th className="py-3">Da ricevere</th>
                        <th className="py-3">Priorità</th>
                        <th className="py-3">Azioni</th>
                      </tr>
                    </thead>

                    <tbody>
                      {economyStats.pendingPayments.length === 0 && (
                        <tr>
                          <td colSpan="10" className="py-8 text-center text-[#555]">
                            Nessun saldo aperto trovato.
                          </td>
                        </tr>
                      )}

                      {economyStats.pendingPayments.map((booking) => (
                        <tr key={booking.id} className="border-b border-[#f0e6d5]">
                          <td className="py-4">{formatDate(booking.checkIn)}</td>
                          <td className="py-4">{formatDate(booking.checkOut)}</td>
                          <td className="py-4 font-semibold">{booking.guestName || "-"}</td>
                          <td className="py-4">
                            <Pill className={getStatusClass(booking.status)}>
                              {getStatusLabel(booking.status)}
                            </Pill>
                          </td>
                          <td className="py-4">{getPaymentLabel(booking.paymentStatus)}</td>
                          <td className="py-4">{formatEuro(booking.totalPrice)}</td>
                          <td className="py-4">{formatEuro(booking.paidAmount)}</td>
                          <td className="py-4 font-bold text-[#0a1d35]">
                            {formatEuro(booking.balanceDue)}
                          </td>
                          <td className="py-4">
                            {booking.isUrgentBalance ? (
                              <Pill className="border-red-200 bg-red-50 text-red-900">
                                Urgente
                              </Pill>
                            ) : (
                              <Pill className="border-[#e4d8c2] bg-white text-[#0a1d35]">
                                Normale
                              </Pill>
                            )}
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <SmallButton
                                onClick={() => {
                                  setSelectedBookingId(booking.id);
                                  setActiveTab("calendar");
                                }}
                                className="bg-[#0a1d35] text-white"
                              >
                                Apri dettagli
                              </SmallButton>

                              <SmallButton
                                onClick={() =>
                                  setManualPaymentStatus(
                                    booking,
                                    "paid",
                                    "saldo_pagato_da_dashboard"
                                  )
                                }
                                className="bg-green-700 text-white"
                              >
                                Segna saldo pagato
                              </SmallButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  La dashboard usa i dati salvati nelle prenotazioni: totale, caparra e stato pagamento.
                  Non modifica nessuna prenotazione.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "maintenance" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Manutenzione PMS
              </p>
              <h2 className="mt-2 font-serif text-3xl">Strumenti tecnici</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Area riservata ai controlli interni del PMS. Qui puoi pulire eventuali
                notti bloccate senza prenotazione o blocco attivo collegato.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-[#e4d8c2] bg-[#faf6ee] p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-[#0a1d35]">
                      Pulisci notti fantasma
                    </h3>
                    <p className="mt-2 leading-7 text-[#555]">
                      Controlla la disponibilità dell'unità selezionata e cancella solo
                      le notti isolate che non hanno una prenotazione o un blocco attivo
                      collegato.
                    </p>
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.18em] text-[#9b6b25]">
                          Scegli unità da pulire
                        </span>
                        <select
                          value={selectedUnitId}
                          onChange={(event) => setSelectedUnitId(event.target.value)}
                          className="mt-3 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4 font-bold text-[#0a1d35]"
                        >
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {(unit.publicName || unit.name || unit.id)}
                              {unit.name && unit.publicName && unit.publicName !== unit.name
                                ? " — " + unit.name
                                : ""}{" "}
                              ({unit.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-3 text-sm leading-6 text-[#555]">
                        La pulizia verrà eseguita solo sull'unità selezionata qui sopra.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={cleanupGhostNights}
                    disabled={cleanupLoading}
                    className="rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white transition hover:bg-[#132f52] disabled:opacity-60"
                  >
                    {cleanupLoading ? "Pulizia in corso..." : "Pulisci notti fantasma"}
                  </button>
                </div>

                {cleanupResult && (
                  <div className="mt-5 rounded-2xl border border-[#d7c49f] bg-white p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#9b6b25]">
                      Risultato pulizia
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <DetailRow label="Unità" value={cleanupResult.unitName || cleanupResult.unitId} />
                      <DetailRow label="Controllate" value={cleanupResult.scannedCount ?? 0} />
                      <DetailRow label="Eliminate" value={cleanupResult.deletedCount ?? 0} />
                      <DetailRow label="Protette" value={cleanupResult.keptCount ?? 0} />
                    </div>

                    {Array.isArray(cleanupResult.deletedNights) &&
                      cleanupResult.deletedNights.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-[#faf6ee] p-4">
                          <p className="mb-2 font-bold text-[#0a1d35]">
                            Notti eliminate
                          </p>
                          <div className="space-y-2 text-sm text-[#555]">
                            {cleanupResult.deletedNights.map((night) => (
                              <div
                                key={night.id}
                                className="rounded-xl bg-white px-3 py-2"
                              >
                                {formatDate(night.date)} · {night.status || "-"} ·{" "}
                                {night.source || "-"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  Le prenotazioni vere e i blocchi manuali attivi non vengono toccati.
                  La pulizia lavora solo sulla tabella tecnica delle notti.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "logs" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                Registro interno
              </p>
              <h2 className="mt-2 font-serif text-3xl">Storico azioni Admin</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#555]">
                Qui trovi le ultime azioni importanti fatte in Admin: prenotazioni,
                pagamenti, cancellazioni, link Stripe e WelcoMate.
              </p>

              <button
                type="button"
                onClick={async () => {
                  clearMessages();
                  await addActivityLog("test_log", null, {
                    source: "manual_test",
                    unitId: selectedUnitId,
                  });
                  setMessage("Log di prova creato. Se non compare, fai CTRL+F5 o controlla Firestore.");
                }}
                className="mt-5 rounded-full bg-[#0a1d35] px-5 py-3 font-bold text-white"
              >
                Crea log di prova
              </button>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[950px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                      <th className="py-3">Data</th>
                      <th className="py-3">Admin</th>
                      <th className="py-3">Azione</th>
                      <th className="py-3">Ospite / Oggetto</th>
                      <th className="py-3">Date</th>
                      <th className="py-3">Dettagli</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleActivityLogs.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-[#555]">
                          Nessun log attivita trovato.
                        </td>
                      </tr>
                    )}

                    {visibleActivityLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[#f0e6d5] align-top">
                        <td className="py-4">{formatDateTime(log.createdAt)}</td>
                        <td className="py-4">{log.adminEmail || "-"}</td>
                        <td className="py-4">
                          <Pill className="border-[#e4d8c2] bg-[#faf6ee] text-[#0a1d35]">
                            {String(log.action || "-").replaceAll("_", " ")}
                          </Pill>
                        </td>
                        <td className="py-4 font-semibold">
                          {log.guestName || log.bookingId || "-"}
                        </td>
                        <td className="py-4">
                          {log.checkIn || log.checkOut
                            ? `${formatDate(log.checkIn)} - ${formatDate(log.checkOut)}`
                            : "-"}
                        </td>
                        <td className="py-4 text-sm text-[#555]">
                          {log.details
                            ? Object.entries(log.details)
                                .map(([key, value]) => `${key}: ${String(value)}`)
                                .join(" · ")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                Questo registro è interno: serve per controllare le azioni operative
                fatte dal pannello Admin.
              </div>
            </div>
          </section>
        )}

        {activeTab === "calendar" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-serif text-3xl">Prenotazioni e blocchi</h2>
                  <p className="mt-2 text-[#555]">
                    Gestisci richieste dal sito, conferme, pagamenti, WhatsApp e
                    link WelcoMate.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b6b25]"
                    />
                    <input
                      value={bookingSearch}
                      onChange={(event) => setBookingSearch(event.target.value)}
                      placeholder="Cerca ospite, telefono, data..."
                      className="w-full min-w-[260px] rounded-full border border-[#d7c49f] bg-[#faf6ee] py-3 pl-11 pr-4 outline-none"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-full border border-[#d7c49f] bg-[#faf6ee] px-4 py-3 font-semibold"
                  >
                    <option value="active">Solo attive</option>
                    <option value="all">Tutte</option>
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    className="rounded-full border border-[#d7c49f] bg-[#faf6ee] px-4 py-3 font-semibold"
                  >
                    <option value="all">Tutte le origini</option>
                    {sourceOptions.map((source) => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[1250px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                      <th className="py-3">Arrivo</th>
                      <th className="py-3">Partenza</th>
                      <th className="py-3">Notti</th>
                      <th className="py-3">Ospite</th>
                      <th className="py-3">Telefono</th>
                      <th className="py-3">Origine</th>
                      <th className="py-3">Stato</th>
                      <th className="py-3">WelcoMate</th>
                      <th className="py-3">Pagamento</th>
                      <th className="py-3">Prezzo</th>
                      <th className="py-3">Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredBookings.length === 0 && (
                      <tr>
                        <td colSpan="11" className="py-8 text-center text-[#555]">
                          Nessuna prenotazione trovata.
                        </td>
                      </tr>
                    )}

                    {filteredBookings.map((booking) => {
                      const whatsappNumber = normalizePhoneForWhatsApp(
                        booking.guestPhone
                      );
                      const isPending = ["pending_direct", "pending"].includes(
                        booking.status
                      );

                      return (
                        <tr key={booking.id} className="border-b border-[#f0e6d5]">
                          <td className="py-4">{formatDate(booking.checkIn)}</td>
                          <td className="py-4">{formatDate(booking.checkOut)}</td>
                          <td className="py-4">
                            {getNightsCount(booking.checkIn, booking.checkOut)}
                          </td>
                          <td className="py-4 font-semibold">
                            {booking.guestName || "-"}
                          </td>
                          <td className="py-4">{booking.guestPhone || "-"}</td>
                          <td className="py-4">{getSourceLabel(booking.source)}</td>
                          <td className="py-4">
                            <Pill className={getStatusClass(booking.status)}>
                              {getStatusLabel(booking.status)}
                            </Pill>
                          </td>
                          <td className="py-4">
                            <Pill className={getWelcomateClass(booking.welcomateStatus)}>
                              {getWelcomateLabel(booking.welcomateStatus)}
                            </Pill>
                          </td>
                          <td className="py-4">
                            {getPaymentLabel(booking.paymentStatus)}
                          </td>
                          <td className="py-4">{formatEuro(booking.totalPrice)}</td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <SmallButton
                                onClick={() => {
                                  setSelectedBookingId(booking.id);
                                  setActiveTab("calendar");
                                }}
                                className="bg-[#0a1d35] text-white"
                              >
                                Dettagli
                              </SmallButton>

                              {isPending && (
                                <SmallButton
                                  onClick={() => confirmBooking(booking)}
                                  className="bg-green-700 text-white"
                                >
                                  Conferma
                                </SmallButton>
                              )}

                              {whatsappNumber && (
                                <a
                                  href={`https://wa.me/${whatsappNumber}?text=${buildWhatsAppMessage(
                                    booking,
                                    settings
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white"
                                >
                                  WhatsApp
                                </a>
                              )}

                              {booking.status !== "cancelled" && (
                                <SmallButton
                                  onClick={() => cancelBooking(booking)}
                                  className="bg-[#f5c84b] text-[#0a1d35]"
                                >
                                  Annulla
                                </SmallButton>
                              )}

                              <SmallButton
                                onClick={() => deleteBookingForever(booking)}
                                className="bg-red-900 text-white"
                              >
                                Elimina
                              </SmallButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedBooking && (
              <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#9b6b25]">
                      Dettaglio prenotazione
                    </p>
                    <h3 className="mt-2 font-serif text-3xl">
                      {selectedBooking.guestName || "Prenotazione"}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className={getStatusClass(selectedBooking.status)}>
                        {getStatusLabel(selectedBooking.status)}
                      </Pill>
                      <Pill className="border-[#e4d8c2] bg-[#faf6ee] text-[#0a1d35]">
                        {getSourceLabel(selectedBooking.source)}
                      </Pill>
                      <Pill className="border-[#e4d8c2] bg-[#faf6ee] text-[#0a1d35]">
                        {getPaymentLabel(selectedBooking.paymentStatus)}
                      </Pill>
                      <Pill className={getWelcomateClass(selectedBooking.welcomateStatus)}>
                        WelcoMate: {getWelcomateLabel(selectedBooking.welcomateStatus)}
                      </Pill>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedBookingId("")}
                    className="rounded-full border border-[#0a1d35] px-5 py-3 font-bold"
                  >
                    Chiudi dettagli
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <DetailRow label="Arrivo" value={formatDate(selectedBooking.checkIn)} />
                  <DetailRow label="Partenza" value={formatDate(selectedBooking.checkOut)} />
                  <DetailRow
                    label="Notti"
                    value={getNightsCount(selectedBooking.checkIn, selectedBooking.checkOut)}
                  />
                  <DetailRow label="Ospiti" value={selectedBooking.guests ?? "-"} />
                  <DetailRow label="Email" value={selectedBooking.guestEmail || "-"} />
                  <DetailRow label="Telefono" value={selectedBooking.guestPhone || "-"} />
                  <DetailRow label="WelcoMate" value={getWelcomateLabel(selectedBooking.welcomateStatus)} />
                  <DetailRow label="Invio WelcoMate" value={formatDateTime(selectedBooking.welcomateSentAt)} />
                  <DetailRow label="Creata" value={formatDateTime(selectedBooking.createdAt)} />
                  <DetailRow label="Aggiornata" value={formatDateTime(selectedBooking.updatedAt)} />
                  <DetailRow
                    label="Consenso privacy"
                    value={
                      selectedBooking.privacyAccepted && selectedBooking.termsAccepted
                        ? "Accettato"
                        : "Non registrato"
                    }
                  />
                  <DetailRow
                    label="Data consenso"
                    value={formatDateTime(selectedBooking.legalAcceptedAt)}
                  />
                  {selectedBooking.status === "pending_direct" && (
                    <DetailRow
                      label="Scadenza blocco richiesta"
                      value={formatDateTime(selectedBooking.expiresAt)}
                    />
                  )}
                </div>


                <div className="mt-6 rounded-[1.5rem] border border-[#d7c49f] bg-[#faf6ee] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9b6b25]">
                        Pagamento online Stripe
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#555]">
                        Crea un link pagamento sicuro con Stripe per caparra o saldo da pagare.
                      </p>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <DetailRow label="Stato pagamento" value={getPaymentLabel(selectedBooking.paymentStatus)} />
                        <DetailRow label="Caparra" value={formatEuro(selectedBooking.depositAmount)} />
                        <DetailRow label="Totale" value={formatEuro(selectedBooking.totalPrice)} />
                        <DetailRow
                          label={selectedBooking.paymentStatus === "paid" ? "Saldo finale pagato" : selectedBooking.paymentStatus === "deposit_paid" ? "Saldo da pagare" : "Saldo dopo caparra"}
                          value={formatEuro(
                            Math.max(
                              Number(selectedBooking.totalPrice || 0) -
                                Number(selectedBooking.depositAmount || 0),
                              0
                            )
                          )}
                        />
                      </div>

                      {selectedBooking.paymentCheckoutUrl && (
                        <p className="mt-3 break-all rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0a1d35]">
                          {selectedBooking.paymentCheckoutUrl}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <SmallButton
                        onClick={() => createStripePaymentLink(selectedBooking, "deposit")}
                        className="bg-[#0a1d35] px-5 py-3 text-white"
                      >
                        Crea link caparra
                      </SmallButton>

                      <SmallButton
                        onClick={() => createStripePaymentLink(selectedBooking, "balance")}
                        className="bg-green-700 px-5 py-3 text-white"
                      >
                        Crea link saldo da pagare
                      </SmallButton>

                      {selectedBooking.paymentCheckoutUrl && (
                        <SmallButton
                          onClick={() =>
                            copyText(
                              selectedBooking.paymentCheckoutUrl,
                              "Ultimo link pagamento copiato negli appunti."
                            )
                          }
                          className="bg-[#9b6b25] px-5 py-3 text-white"
                        >
                          Copia ultimo link
                        </SmallButton>
                      )}

                      {selectedBooking.paymentCheckoutUrl && (
                        <a
                          href={selectedBooking.paymentCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-[#0a1d35] bg-white px-5 py-3 text-sm font-bold text-[#0a1d35]"
                        >
                          Apri ultimo link
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-[#d7c49f] bg-[#faf6ee] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9b6b25]">
                        Link WelcoMate da inviare all'ospite
                      </p>
                      <p className="mt-2 break-all rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0a1d35]">
                        {settings?.welcomateUrl || defaultSettings.welcomateUrl}
                      </p>
                      <p className="mt-2 text-sm text-[#555]">
                        Questo e il link dati ospiti che puoi copiare, aprire o mandare direttamente su WhatsApp/email.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <SmallButton
                        onClick={() =>
                          copyText(
                            settings?.welcomateUrl || defaultSettings.welcomateUrl,
                            "Link WelcoMate copiato negli appunti."
                          )
                        }
                        className="bg-[#0a1d35] px-5 py-3 text-white"
                      >
                        <Copy size={16} />
                        Copia link
                      </SmallButton>

                      <a
                        href={settings?.welcomateUrl || defaultSettings.welcomateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-[#0a1d35] bg-white px-5 py-3 text-sm font-bold text-[#0a1d35]"
                      >
                        Apri link
                      </a>

                      {selectedBooking.guestPhone && (
                        <a
                          href={`https://wa.me/${normalizePhoneForWhatsApp(
                            selectedBooking.guestPhone
                          )}?text=${encodeURIComponent(
                            buildWelcomateText(selectedBooking, settings)
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-bold text-white"
                        >
                          <MessageCircle size={16} />
                          Invia su WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={saveBookingDetails}
                  className="mt-6 grid gap-4 md:grid-cols-2"
                >
                  <FormField label="Nome ospite">
                    <input
                      value={detailForm.guestName}
                      onChange={(event) =>
                        setDetailForm({ ...detailForm, guestName: event.target.value })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Telefono">
                    <input
                      value={detailForm.guestPhone}
                      onChange={(event) =>
                        setDetailForm({ ...detailForm, guestPhone: event.target.value })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Email">
                    <input
                      type="email"
                      value={detailForm.guestEmail}
                      onChange={(event) =>
                        setDetailForm({ ...detailForm, guestEmail: event.target.value })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Stato pagamento">
                    <select
                      value={detailForm.paymentStatus}
                      onChange={(event) =>
                        setDetailForm({
                          ...detailForm,
                          paymentStatus: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    >
                      {paymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Check-in WelcoMate">
                    <select
                      value={detailForm.welcomateStatus}
                      onChange={(event) =>
                        setDetailForm({
                          ...detailForm,
                          welcomateStatus: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    >
                      {welcomateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Prezzo totale">
                    <input
                      type="number"
                      step="0.01"
                      value={detailForm.totalPrice}
                      onChange={(event) =>
                        setDetailForm({ ...detailForm, totalPrice: event.target.value })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Caparra">
                    <input
                      type="number"
                      step="0.01"
                      value={detailForm.depositAmount}
                      onChange={(event) =>
                        setDetailForm({
                          ...detailForm,
                          depositAmount: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Note ospite">
                    <textarea
                      value={detailForm.notes}
                      onChange={(event) =>
                        setDetailForm({ ...detailForm, notes: event.target.value })
                      }
                      className="min-h-28 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <FormField label="Note interne">
                    <textarea
                      value={detailForm.internalNotes}
                      onChange={(event) =>
                        setDetailForm({
                          ...detailForm,
                          internalNotes: event.target.value,
                        })
                      }
                      className="min-h-28 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                  </FormField>

                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                    >
                      <Save size={18} />
                      Salva dettagli
                    </button>

                    {["pending_direct", "pending"].includes(selectedBooking.status) && (
                      <SmallButton
                        onClick={() => confirmBooking(selectedBooking)}
                        className="bg-green-700 px-6 py-4 text-white"
                      >
                        Conferma richiesta
                      </SmallButton>
                    )}

                    <SmallButton
                      onClick={() =>
                        setManualPaymentStatus(
                          selectedBooking,
                          "deposit_paid",
                          "caparra_incassata"
                        )
                      }
                      className="bg-[#f5c84b] px-6 py-4 text-[#0a1d35]"
                    >
                      Segna caparra incassata
                    </SmallButton>

                    <SmallButton
                      onClick={() =>
                        setManualPaymentStatus(
                          selectedBooking,
                          "paid",
                          "saldo_pagato"
                        )
                      }
                      className="bg-green-700 px-6 py-4 text-white"
                    >
                      Segna saldo pagato
                    </SmallButton>

                    <SmallButton
                      onClick={() =>
                        setManualPaymentStatus(
                          selectedBooking,
                          "unpaid",
                          "non_pagato"
                        )
                      }
                      className="bg-white px-6 py-4 text-[#0a1d35] border border-[#0a1d35]"
                    >
                      Segna non pagato
                    </SmallButton>

                    <SmallButton
                      onClick={() => copyWelcomateAndMarkSent(selectedBooking)}
                      className="bg-[#9b6b25] px-6 py-4 text-white"
                    >
                      Copia WelcoMate
                    </SmallButton>

                    <SmallButton
                      onClick={() => setWelcomateStatus(selectedBooking, "completed")}
                      className="bg-green-700 px-6 py-4 text-white"
                    >
                      WelcoMate compilato
                    </SmallButton>

                    <SmallButton
                      onClick={() => setWelcomateStatus(selectedBooking, "missing")}
                      className="bg-red-800 px-6 py-4 text-white"
                    >
                      Mancano dati
                    </SmallButton>

                    {selectedBooking.guestPhone && (
                      <a
                        href={`https://wa.me/${normalizePhoneForWhatsApp(
                          selectedBooking.guestPhone
                        )}?text=${encodeURIComponent(
                          buildWelcomateText(selectedBooking, settings)
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-4 font-bold text-white"
                      >
                        <MessageCircle size={18} />
                        Apri WhatsApp
                      </a>
                    )}

                    {selectedBooking.guestEmail && (
                      <a
                        href={`mailto:${selectedBooking.guestEmail}?subject=Gelone Lungomare - richiesta prenotazione&body=${encodeURIComponent(
                          buildWelcomateText(selectedBooking, settings)
                        )}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#0a1d35] px-6 py-4 font-bold text-[#0a1d35]"
                      >
                        <Mail size={18} />
                        Email ospite
                      </a>
                    )}
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {activeTab === "new" && (
          <section className="mt-8 rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-3xl">Nuova prenotazione</h2>
            <p className="mt-2 text-[#555]">
              Inserisci manualmente una prenotazione già confermata, oppure una
              richiesta ricevuta fuori dal sito.
            </p>

            <form onSubmit={createBooking} className="mt-6 grid gap-4 md:grid-cols-2">
              <FormField label="Nome ospite">
                <input
                  value={newBooking.guestName}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestName: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Telefono">
                <input
                  value={newBooking.guestPhone}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestPhone: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={newBooking.guestEmail}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestEmail: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Ospiti">
                <input
                  type="number"
                  min="1"
                  max={selectedUnit.maxGuests}
                  value={newBooking.guests}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guests: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Arrivo">
                <input
                  type="date"
                  value={newBooking.checkIn}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, checkIn: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Partenza">
                <input
                  type="date"
                  value={newBooking.checkOut}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, checkOut: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Origine">
                <select
                  value={newBooking.source}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, source: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  {sourceOptions.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Stato">
                <select
                  value={newBooking.status}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, status: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  {statusOptions
                    .filter((status) => status.value !== "cancelled")
                    .map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="Prezzo totale">
                <input
                  type="number"
                  step="0.01"
                  value={newBooking.totalPrice}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, totalPrice: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Caparra">
                <input
                  type="number"
                  step="0.01"
                  value={newBooking.depositAmount}
                  onChange={(event) =>
                    setNewBooking({
                      ...newBooking,
                      depositAmount: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Stato pagamento">
                <select
                  value={newBooking.paymentStatus}
                  onChange={(event) =>
                    setNewBooking({
                      ...newBooking,
                      paymentStatus: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Check-in WelcoMate">
                <select
                  value={newBooking.welcomateStatus}
                  onChange={(event) =>
                    setNewBooking({
                      ...newBooking,
                      welcomateStatus: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  {welcomateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Note</span>
                <textarea
                  value={newBooking.notes}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, notes: event.target.value })
                  }
                  className="min-h-28 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                >
                  <Plus size={18} />
                  Inserisci prenotazione
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "block" && (
          <section className="mt-8 rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-3xl">Blocca date</h2>
            <p className="mt-2 text-[#555]">
              Usa questa funzione per manutenzioni, uso personale o periodi non
              vendibili. Il blocco protegge le notti anche sul sito pubblico.
            </p>

            <form onSubmit={createBlock} className="mt-6 grid gap-4 md:grid-cols-2">
              <FormField label="Inizio blocco">
                <input
                  type="date"
                  value={blockForm.checkIn}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, checkIn: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <FormField label="Fine blocco">
                <input
                  type="date"
                  value={blockForm.checkOut}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, checkOut: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </FormField>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Motivo / note</span>
                <textarea
                  value={blockForm.notes}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, notes: event.target.value })
                  }
                  className="min-h-28 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                >
                  <Lock size={18} />
                  Blocca date
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "units" && (
          <section className="mt-8 space-y-6">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-serif text-3xl">Unità alloggiative</h2>
                  <p className="mt-2 leading-7 text-[#555]">
                    Base multi-unità: Lunarossa 1 resta funzionante, ma da qui puoi preparare nuove unità con ID, dati, iCal e visibilità separati.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={prepareNewUnit}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white"
                >
                  <Plus size={18} />
                  Prepara nuova unità
                </button>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {units.map((unit) => (
                  <button
                    type="button"
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selectedUnitId === unit.id
                        ? "border-[#0a1d35] bg-[#faf6ee] shadow-sm"
                        : "border-[#e4d8c2] bg-white hover:bg-[#faf6ee]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Building2 className="text-[#9b6b25]" size={28} />
                      <Pill className={unit.active ? "border-green-200 bg-green-50 text-green-900" : "border-slate-200 bg-slate-100 text-slate-900"}>
                        {unit.active ? "Attiva" : "Bozza"}
                      </Pill>
                    </div>
                    <h3 className="mt-4 font-serif text-2xl">{unit.name}</h3>
                    <p className="mt-1 text-sm text-[#666]">ID: {unit.id}</p>
                    <p className="mt-3 text-sm leading-6 text-[#555]">
                      {unit.maxGuests} ospiti · {unit.bedrooms || 0} camera/e · {unit.bathrooms || 0} bagno/i
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill className={unit.publicVisible ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-100 text-slate-900"}>
                        {unit.publicVisible ? "Pubblica" : "Nascosta"}
                      </Pill>
                      <Pill className={unit.welcomateEnabled ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-100 text-slate-900"}>
                        {unit.welcomateEnabled ? "WelcoMate" : "No WelcoMate"}
                      </Pill>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <h3 className="font-serif text-3xl">Scheda unità</h3>
              <p className="mt-2 leading-7 text-[#555]">
                Per ora il sito pubblico continua a vendere Lunarossa 1. Le nuove unità possono essere preparate qui e attivate nel prossimo step senza mischiare prenotazioni e calendari.
              </p>

              <form onSubmit={saveUnit} className="mt-6 grid gap-4 lg:grid-cols-2">
                <FormField label="ID tecnico unità">
                  <input
                    value={unitForm.id}
                    onChange={(event) =>
                      setUnitForm({
                        ...unitForm,
                        id: sanitizeUnitId(event.target.value),
                        icalPath: `/api/ical/${sanitizeUnitId(event.target.value)}.ics`,
                      })
                    }
                    placeholder="es. lunarossa2"
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Nome interno">
                  <input
                    value={unitForm.name}
                    onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })}
                    placeholder="es. Lunarossa 2"
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Nome pubblico">
                  <input
                    value={unitForm.publicName}
                    onChange={(event) => setUnitForm({ ...unitForm, publicName: event.target.value })}
                    placeholder="es. Gelone Lungomare - Lunarossa 2"
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Ordine visualizzazione">
                  <input
                    type="number"
                    min="1"
                    value={unitForm.sortOrder}
                    onChange={(event) => setUnitForm({ ...unitForm, sortOrder: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Ospiti massimi">
                  <input
                    type="number"
                    min="1"
                    value={unitForm.maxGuests}
                    onChange={(event) => setUnitForm({ ...unitForm, maxGuests: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Camere da letto">
                  <input
                    type="number"
                    min="0"
                    value={unitForm.bedrooms}
                    onChange={(event) => setUnitForm({ ...unitForm, bedrooms: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Bagni">
                  <input
                    type="number"
                    min="0"
                    value={unitForm.bathrooms}
                    onChange={(event) => setUnitForm({ ...unitForm, bathrooms: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Cucina presente">
                  <select
                    value={unitForm.hasKitchen ? "yes" : "no"}
                    onChange={(event) => setUnitForm({ ...unitForm, hasKitchen: event.target.value === "yes" })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  >
                    <option value="yes">Sì</option>
                    <option value="no">No</option>
                  </select>
                </FormField>

                <FormField label="CIN">
                  <input
                    value={unitForm.cin}
                    onChange={(event) => setUnitForm({ ...unitForm, cin: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="CIR">
                  <input
                    value={unitForm.cir}
                    onChange={(event) => setUnitForm({ ...unitForm, cir: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Link Booking">
                  <input
                    value={unitForm.bookingUrl}
                    onChange={(event) => setUnitForm({ ...unitForm, bookingUrl: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Link Airbnb">
                  <input
                    value={unitForm.airbnbUrl}
                    onChange={(event) => setUnitForm({ ...unitForm, airbnbUrl: event.target.value })}
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Link iCal esportato dal sito">
                  <div className="flex gap-3">
                    <input
                      value={`https://www.gelone.it${unitForm.icalPath || `/api/ical/${unitForm.id}.ics`}`}
                      readOnly
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `https://www.gelone.it${unitForm.icalPath || `/api/ical/${unitForm.id}.ics`}`,
                          "Link iCal unità copiato."
                        )
                      }
                      className="rounded-2xl bg-[#0a1d35] px-5 font-bold text-white"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </FormField>

                <div className="rounded-2xl border border-[#eadbbf] bg-[#faf6ee] p-5 lg:col-span-2">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={unitForm.active}
                        onChange={(event) => setUnitForm({ ...unitForm, active: event.target.checked })}
                      />
                      Unità attiva
                    </label>
                    <label className="flex items-center gap-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={unitForm.publicVisible}
                        onChange={(event) => setUnitForm({ ...unitForm, publicVisible: event.target.checked })}
                      />
                      Visibile sul sito
                    </label>
                    <label className="flex items-center gap-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={unitForm.welcomateEnabled}
                        onChange={(event) => setUnitForm({ ...unitForm, welcomateEnabled: event.target.checked })}
                      />
                      WelcoMate attivo
                    </label>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#666]">
                    Consiglio: lascia le nuove unità in bozza finché non prepariamo foto, tariffe, iCal in ingresso e pagina pubblica multi-alloggio.
                  </p>
                </div>

                <div className="rounded-[2rem] border border-[#eadbbf] bg-[#faf6ee] p-5 lg:col-span-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="font-serif text-2xl">Foto unità</h4>
                      <p className="mt-1 text-sm leading-6 text-[#666]">
                        Carica foto da computer o telefono con Cloudinary. La foto viene ottimizzata per il sito e collegata alla singola unità: Lunarossa 1 aggiorna la galleria pubblica, Lunarossa 2 resta pronta finché è in bozza.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloudinaryPhotoUpload}
                      disabled={photoUploading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white transition hover:bg-[#132f52] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus size={18} />
                      {photoUploading ? "Caricamento..." : "Carica foto con Cloudinary"}
                    </button>
                  </div>

                  {(unitForm.photos || []).length > 0 ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(unitForm.photos || []).map((photo, index) => (
                        <div key={photo.id || photo.url} className="overflow-hidden rounded-2xl border border-[#e4d8c2] bg-white shadow-sm">
                          <div className="relative h-40 bg-[#eee]">
                            <img src={photo.url} alt={photo.name || `Foto ${index + 1}`} className="h-full w-full object-cover" />
                            {photo.cover && (
                              <span className="absolute left-3 top-3 rounded-full bg-[#0a1d35] px-3 py-1 text-xs font-bold text-white">
                                Copertina
                              </span>
                            )}
                          </div>
                          <div className="space-y-3 p-4">
                            <p className="truncate text-sm font-semibold text-[#0a1d35]">{photo.name || `Foto ${index + 1}`}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <SmallButton
                                onClick={() => setPhotoAsCover(photo)}
                                className="border border-[#d7c49f] bg-white text-[#0a1d35]"
                              >
                                <span className="inline-flex items-center gap-1"><Star size={14} /> Copertina</span>
                              </SmallButton>
                              <SmallButton
                                onClick={() => removeUnitPhoto(photo)}
                                className="border border-red-200 bg-red-50 text-red-800"
                              >
                                <span className="inline-flex items-center gap-1"><Trash2 size={14} /> Elimina</span>
                              </SmallButton>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <SmallButton
                                onClick={() => movePhoto(photo, -1)}
                                disabled={index === 0}
                                className="border border-[#d7c49f] bg-white text-[#0a1d35]"
                              >
                                â†‘ Prima
                              </SmallButton>
                              <SmallButton
                                onClick={() => movePhoto(photo, 1)}
                                disabled={index === (unitForm.photos || []).length - 1}
                                className="border border-[#d7c49f] bg-white text-[#0a1d35]"
                              >
                                â†“ Dopo
                              </SmallButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-[#d7c49f] bg-white p-5 text-sm leading-6 text-[#666]">
                      Nessuna foto Cloudinary collegata a questa unità. Lunarossa 1 continua a usare le foto attuali del sito finché non carichi nuove foto.
                    </div>
                  )}

                  <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-[#0a1d35]">
                    Dopo upload Cloudinary, eliminazione, copertina o ordine foto il sistema salva subito la galleria. Usa <strong>Salva unità</strong> solo se hai modificato anche testi, CIN/CIR o altri dati.
                  </p>
                </div>

                <FormField label="Descrizione interna">
                  <textarea
                    value={unitForm.description}
                    onChange={(event) => setUnitForm({ ...unitForm, description: event.target.value })}
                    className="min-h-28 w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <div className="flex flex-wrap items-end gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                  >
                    <Save size={18} />
                    Salva unità
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitForm(createUnitForm(selectedUnit))}
                    className="rounded-full border border-[#0a1d35] px-6 py-4 font-bold"
                  >
                    Annulla modifiche
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Building2 className="text-[#9b6b25]" />
                <h2 className="font-serif text-3xl">Unità abitativa</h2>
              </div>

              <div className="mt-6 grid gap-4">
                <DetailRow label="Unità attuale" value={selectedUnit.name} />
                <DetailRow label="ID tecnico" value={selectedUnit.id} />
                <p className="rounded-2xl bg-[#faf6ee] p-4 text-sm leading-7 text-[#555]">
                  La struttura è già preparata con <strong>unitId</strong>. In
                  futuro potremo aggiungere altre unità senza rifare il PMS da
                  zero.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Wifi className="text-[#9b6b25]" />
                <h2 className="font-serif text-3xl">Impostazioni ospiti</h2>
              </div>

              <form onSubmit={(event) => {
                event.preventDefault();
                saveSettings();
              }} className="mt-6 grid gap-4">
                <FormField label="Orario check-in">
                  <input
                    type="time"
                    value={settings.checkInTime}
                    onChange={(event) =>
                      setSettings({ ...settings, checkInTime: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Orario check-out">
                  <input
                    type="time"
                    value={settings.checkOutTime}
                    onChange={(event) =>
                      setSettings({ ...settings, checkOutTime: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Numero massimo ospiti">
                  <input
                    type="number"
                    min="1"
                    value={settings.maxGuests}
                    onChange={(event) =>
                      setSettings({ ...settings, maxGuests: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <div className="rounded-2xl border border-[#eadbbf] bg-[#faf6ee] p-5">
                  <h3 className="font-serif text-2xl text-[#0a1d35]">Tariffe sito diretto</h3>
                  <p className="mt-2 text-sm leading-6 text-[#666]">
                    Queste tariffe compaiono nella home e vengono usate per il totale stimato delle richieste dal sito.
                  </p>
                  <div
                    className={`mt-4 rounded-2xl border p-5 ${
                      settings.directPaymentEnabled
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9b6b25]">
                          Pagamento diretto dal sito
                        </p>
                        <h3 className="mt-1 font-serif text-2xl text-[#0a1d35]">
                          {settings.directPaymentEnabled ? "Pagamento ON" : "Pagamento OFF"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[#555]">
                          ON mostra all'ospite il pulsante per pagare subito la caparra con Stripe.
                          OFF lascia solo la richiesta senza pagamento.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            directPaymentEnabled: !Boolean(settings.directPaymentEnabled),
                          })
                        }
                        className={`rounded-full px-6 py-4 font-bold text-white ${
                          settings.directPaymentEnabled ? "bg-green-700" : "bg-red-800"
                        }`}
                      >
                        {settings.directPaymentEnabled ? "Pagamento ON" : "Pagamento OFF"}
                      </button>
                    </div>
                  </div>


                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <FormField label="Prezzo diretto per notte (€)">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.nightlyRate}
                        onChange={(event) =>
                          setSettings({ ...settings, nightlyRate: event.target.value })
                        }
                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                      />
                    </FormField>

                    <FormField label="Pulizie finali (€)">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.cleaningFee}
                        onChange={(event) =>
                          setSettings({ ...settings, cleaningFee: event.target.value })
                        }
                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                      />
                    </FormField>

                    <FormField label="Soggiorno minimo (notti)">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={settings.minimumNights}
                        onChange={(event) =>
                          setSettings({ ...settings, minimumNights: event.target.value })
                        }
                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                      />
                    </FormField>

                    <FormField label="Caparra indicativa (%)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={settings.depositPercent}
                        onChange={(event) =>
                          setSettings({ ...settings, depositPercent: event.target.value })
                        }
                        className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                      />
                    </FormField>
                  </div>

                  <FormField label="Testo tariffa diretto">
                    <input
                      value={settings.directRateText}
                      onChange={(event) =>
                        setSettings({ ...settings, directRateText: event.target.value })
                      }
                      className="w-full rounded-2xl border border-[#d7c49f] bg-white px-4 py-4"
                    />
                  </FormField>
                </div>

                <FormField label="Nome Wi-Fi">
                  <input
                    value={settings.wifiName}
                    onChange={(event) =>
                      setSettings({ ...settings, wifiName: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Password Wi-Fi">
                  <input
                    value={settings.wifiPassword}
                    onChange={(event) =>
                      setSettings({ ...settings, wifiPassword: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Email notifiche">
                  <input
                    value={settings.notificationEmail}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        notificationEmail: event.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                  >
                    <Save size={18} />
                    {settingsSavedAt ? "Impostazioni salvate" : "Salva impostazioni"}
                  </button>

                  {settingsSavedAt && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
                      Salvate alle {settingsSavedAt}. Tariffe, soggiorno minimo e contatti aggiornati.
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="font-serif text-3xl">Sincronizzazione calendari</h2>
              <p className="mt-2 leading-7 text-[#555]">
                Inserisci i link iCal di Booking e Airbnb. Il calendario del sito
                Gelone esporta automaticamente le date occupate verso i portali.
              </p>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <FormField label="iCal Booking">
                  <input
                    value={settings.bookingIcalUrl}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        bookingIcalUrl: event.target.value,
                      })
                    }
                    placeholder="https://ical.booking.com/..."
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="iCal Airbnb">
                  <input
                    value={settings.airbnbIcalUrl}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        airbnbIcalUrl: event.target.value,
                      })
                    }
                    placeholder="https://www.airbnb.it/calendar/ical/..."
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Link WelcoMate sito diretto">
                  <input
                    value={settings.welcomateUrl}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        welcomateUrl: event.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                  />
                </FormField>

                <FormField label="Calendario iCal del sito Gelone">
                  <div className="flex gap-3">
                    <input
                      readOnly
                      value={`https://www.gelone.it/api/ical/${selectedUnitId}.ics`}
                      className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `https://www.gelone.it/api/ical/${selectedUnitId}.ics`,
                          "Link calendario iCal copiato."
                        )
                      }
                      className="rounded-2xl bg-[#0a1d35] px-5 font-bold text-white"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </FormField>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                >
                  <Save size={18} />
                  Salva link
                </button>

                <button
                  type="button"
                  onClick={syncCalendars}
                  disabled={syncLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-6 py-4 font-bold text-white disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  {syncLoading ? "Sincronizzazione..." : "Sincronizza ora"}
                </button>
              </div>
              {syncResult && (() => {
                const totals = syncResult.totals || {};
                const sources = totals.sources || {};
                const bookingSync = sources.booking_ical || {};
                const airbnbSync = sources.airbnb_ical || {};

                return (
                  <div className="mt-6 rounded-2xl border border-[#d7c49f] bg-[#faf6ee] p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-[#9b6b25]">
                      Riepilogo sincronizzazione
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <DetailRow
                        label="Booking"
                        value={
                          (bookingSync.urlPresent ? "Link presente" : "Link assente") +
                          " · " +
                          (bookingSync.imported || 0) +
                          " importate · " +
                          (bookingSync.skippedConflict || 0) +
                          " conflitti protetti"
                        }
                      />
                      <DetailRow
                        label="Airbnb"
                        value={
                          (airbnbSync.urlPresent ? "Link presente" : "Link assente") +
                          " · " +
                          (airbnbSync.imported || 0) +
                          " importate · " +
                          (airbnbSync.skippedConflict || 0) +
                          " conflitti protetti"
                        }
                      />
                      <DetailRow
                        label="Eventi rimossi dai portali"
                        value={totals.cancelledStale || 0}
                      />
                      <DetailRow
                        label="Notti spostate liberate"
                        value={totals.movedNightsDeleted || 0}
                      />
                    </div>

                    <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
                      Sincronizzazione completata correttamente. I conflitti protetti non sono errori:
                      indicano date già occupate che il sistema non ha sovrascritto.
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}


