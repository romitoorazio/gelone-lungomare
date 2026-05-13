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
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Building2,
  CalendarDays,
  Copy,
  CreditCard,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { auth, db, ADMIN_EMAILS, UNIT_ID, UNIT_NAME } from "./firebase";

const UNITS = [
  {
    id: UNIT_ID,
    name: UNIT_NAME,
    publicName: "Gelone Lungomare",
    maxGuests: 2,
  },
];

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
};

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
  { value: "deposit_paid", label: "Caparra pagata" },
  { value: "paid", label: "Pagato" },
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
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedUnitId, setSelectedUnitId] = useState(UNIT_ID);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [manualCopy, setManualCopy] = useState({ title: "", text: "" });

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
    UNITS.find((unit) => unit.id === selectedUnitId) || UNITS[0];

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

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("unitId", "==", selectedUnitId),
      orderBy("checkIn", "asc")
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setBookings(rows);
      },
      (err) => {
        console.error("Errore lettura prenotazioni:", err);
        setError(
          "Non riesco a leggere le prenotazioni. Controlla indici e regole Firestore."
        );
      }
    );

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "pms"), (snap) => {
      if (snap.exists()) {
        setSettings((currentSettings) => ({
          ...defaultSettings,
          ...currentSettings,
          ...snap.data(),
        }));
      }
    });

    const unsubscribePrivateSettings = onSnapshot(
      doc(db, "privateSettings", "pms"),
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
    const paid = active.filter((item) => item.paymentStatus === "paid");
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

  function clearMessages() {
    setMessage("");
    setError("");
    setSyncResult(null);
    setManualCopy({ title: "", text: "" });
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

      batch.set(doc(db, "settings", "pms"), {
        checkInTime: settings.checkInTime || defaultSettings.checkInTime,
        checkOutTime: settings.checkOutTime || defaultSettings.checkOutTime,
        maxGuests: Number(settings.maxGuests || defaultSettings.maxGuests),
        wifiName: settings.wifiName || "",
        wifiPassword: settings.wifiPassword || "",
        unitId: selectedUnitId,
        unitName: selectedUnit.name,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, "privateSettings", "pms"), {
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
        setMessage("Impostazioni salvate.");
      }

      return true;
    } catch (err) {
      console.error(err);
      if (!options.silent) {
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
      setMessage("Prenotazione confermata.");
    } catch (err) {
      console.error(err);
      setError("Errore durante la conferma della prenotazione.");
    }
  }

  async function cancelBooking(booking) {
    clearMessages();

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "bookings", booking.id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const nights = getNightDates(booking.checkIn, booking.checkOut);
      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${booking.unitId || selectedUnitId}_${night}`));
      });

      await batch.commit();
      setMessage("Prenotazione annullata e notti liberate.");
    } catch (err) {
      console.error(err);
      setError("Errore durante l'annullamento.");
    }
  }

  async function deleteBookingForever(booking) {
    clearMessages();

    try {
      const batch = writeBatch(db);
      const nights = getNightDates(booking.checkIn, booking.checkOut);

      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${booking.unitId || selectedUnitId}_${night}`));
      });

      batch.delete(doc(db, "bookings", booking.id));

      await batch.commit();

      if (selectedBookingId === booking.id) {
        setSelectedBookingId("");
      }

      setMessage("Prenotazione eliminata definitivamente.");
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

      setMessage("Dettagli prenotazione aggiornati.");
    } catch (err) {
      console.error(err);
      setError("Errore durante il salvataggio dei dettagli.");
    }
  }

  async function setPaymentStatus(booking, paymentStatus) {
    clearMessages();

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        paymentStatus,
        updatedAt: serverTimestamp(),
      });

      setMessage(`Stato pagamento aggiornato: ${getPaymentLabel(paymentStatus)}.`);
    } catch (err) {
      console.error(err);
      setError("Errore durante l'aggiornamento del pagamento.");
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
              {UNITS.map((unit) => (
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
          <TabButton active={activeTab === "block"} onClick={() => setActiveTab("block")}>
            Blocca date
          </TabButton>
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
            Impostazioni
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
                      onClick={() => setPaymentStatus(selectedBooking, "deposit_paid")}
                      className="bg-[#f5c84b] px-6 py-4 text-[#0a1d35]"
                    >
                      Caparra pagata
                    </SmallButton>

                    <SmallButton
                      onClick={() => setPaymentStatus(selectedBooking, "paid")}
                      className="bg-green-700 px-6 py-4 text-white"
                    >
                      Pagato
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
                        )}?text=${buildWhatsAppMessage(selectedBooking, settings)}`}
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

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a1d35] px-6 py-4 font-bold text-white"
                >
                  <Save size={18} />
                  Salva impostazioni
                </button>
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

              {syncResult && (
                <pre className="mt-6 overflow-auto rounded-2xl bg-[#0a1d35] p-4 text-sm text-white">
                  {JSON.stringify(syncResult, null, 2)}
                </pre>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
