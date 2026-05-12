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
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  CalendarDays,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Save,
  Wifi,
  Home,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { auth, db, ADMIN_EMAILS, UNIT_ID, UNIT_NAME } from "./firebase";

const defaultSettings = {
  checkInTime: "15:00",
  checkOutTime: "10:00",
  maxGuests: 2,
  wifiName: "lunarossa",
  wifiPassword: "gelone123",
  bookingIcalUrl: "",
  airbnbIcalUrl: "",
};

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getToday() {
  return toDateInputValue(new Date());
}

function getNightDates(checkIn, checkOut) {
  const nights = [];
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  const cursor = new Date(start);

  while (cursor < end) {
    nights.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return nights;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
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
            Accedi per gestire prenotazioni, blocchi date e impostazioni di
            Lunarossa 1.
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

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#e4d8c2] bg-white p-5 shadow-sm">
      <Icon className="text-[#9b6b25]" size={28} />
      <p className="mt-3 text-sm uppercase tracking-[0.2em] text-[#9b6b25]">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#0a1d35]">{value}</p>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState("calendar");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

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
    notes: "",
  });

  const [blockForm, setBlockForm] = useState({
    checkIn: getToday(),
    checkOut: "",
    notes: "",
  });

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
      where("unitId", "==", UNIT_ID),
      orderBy("checkIn", "asc")
    );

    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const rows = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      setBookings(rows);
    });

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
            ...currentSettings,
            bookingIcalUrl: snap.data().bookingIcalUrl || "",
            airbnbIcalUrl: snap.data().airbnbIcalUrl || "",
          }));
        }
      }
    );

    return () => {
      unsubscribeBookings();
      unsubscribeSettings();
      unsubscribePrivateSettings();
    };
  }, [isAdmin]);

  const stats = useMemo(() => {
    const active = bookings.filter((item) => item.status !== "cancelled");
    const confirmed = active.filter(
      (item) =>
        item.status === "confirmed_direct" ||
        item.status === "booking" ||
        item.status === "manual"
    );
    const blocked = active.filter((item) => item.status === "blocked");
    const pending = active.filter((item) => item.status === "pending");

    return {
      active: active.length,
      confirmed: confirmed.length,
      blocked: blocked.length,
      pending: pending.length,
    };
  }, [bookings]);

  function clearMessages() {
    setMessage("");
    setError("");
    setSyncResult(null);
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
        unitId: UNIT_ID,
        unitName: UNIT_NAME,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, "privateSettings", "pms"), {
        bookingIcalUrl: settings.bookingIcalUrl || "",
        airbnbIcalUrl: settings.airbnbIcalUrl || "",
        unitId: UNIT_ID,
        unitName: UNIT_NAME,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      if (!options.silent) {
        setMessage("Impostazioni salvate.");
      }

      return true;
    } catch (err) {
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
        body: JSON.stringify({ unitId: UNIT_ID }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(
          data?.message ||
            "Errore durante la sincronizzazione dei calendari esterni."
        );
        return;
      }

      setSyncResult(data);
      setMessage(
        `Sincronizzazione completata: ${data.totals.imported} eventi importati, ${data.totals.skippedDuplicate} duplicati evitati, ${data.totals.skippedConflict} conflitti protetti.`
      );
    } catch (err) {
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
      const nightsSnapshot = await getDocs(
        query(
          collection(db, "nights"),
          where("unitId", "==", UNIT_ID),
          where("date", "in", nights.slice(0, 30))
        )
      );

      const occupied = nightsSnapshot.docs
        .map((item) => item.data())
        .filter((item) => item.status !== "cancelled");

      if (occupied.length > 0) {
        setError("Almeno una notte risulta già occupata. Controlla il calendario.");
        return;
      }

      const bookingRef = await addDoc(collection(db, "bookings"), {
        unitId: UNIT_ID,
        unitName: UNIT_NAME,
        guestName: newBooking.guestName || "Prenotazione manuale",
        guestEmail: newBooking.guestEmail || "",
        guestPhone: newBooking.guestPhone || "",
        checkIn: newBooking.checkIn,
        checkOut: newBooking.checkOut,
        guests: Number(newBooking.guests || 1),
        source: newBooking.source,
        status: newBooking.status,
        totalPrice: newBooking.totalPrice ? Number(newBooking.totalPrice) : null,
        notes: newBooking.notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);

      nights.forEach((night) => {
        batch.set(doc(db, "nights", `${UNIT_ID}_${night}`), {
          unitId: UNIT_ID,
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
        notes: "",
      });

      setMessage("Prenotazione inserita e notti bloccate.");
    } catch (err) {
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
      const bookingRef = await addDoc(collection(db, "bookings"), {
        unitId: UNIT_ID,
        unitName: UNIT_NAME,
        guestName: "Blocco manuale",
        guestEmail: "",
        guestPhone: "",
        checkIn: blockForm.checkIn,
        checkOut: blockForm.checkOut,
        guests: 0,
        source: "manual",
        status: "blocked",
        totalPrice: null,
        notes: blockForm.notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);

      nights.forEach((night) => {
        batch.set(doc(db, "nights", `${UNIT_ID}_${night}`), {
          unitId: UNIT_ID,
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
    } catch (err) {
      setError("Errore durante il blocco date.");
    }
  }

  async function cancelBooking(booking) {
    clearMessages();

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "bookings", booking.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });

      const nights = getNightDates(booking.checkIn, booking.checkOut);
      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${UNIT_ID}_${night}`));
      });

      await batch.commit();
      setMessage("Prenotazione annullata e notti liberate.");
    } catch (err) {
      setError("Errore durante l'annullamento.");
    }
  }

  async function deleteBookingForever(booking) {
    clearMessages();

    try {
      const batch = writeBatch(db);
      const nights = getNightDates(booking.checkIn, booking.checkOut);

      nights.forEach((night) => {
        batch.delete(doc(db, "nights", `${UNIT_ID}_${night}`));
      });

      batch.delete(doc(db, "bookings", booking.id));

      await batch.commit();
      setMessage("Prenotazione eliminata definitivamente.");
    } catch (err) {
      setError("Errore durante l'eliminazione.");
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
              Admin: {user.email} · Unità: {UNIT_NAME}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Attive" value={stats.active} icon={CalendarDays} />
          <StatCard title="Confermate" value={stats.confirmed} icon={ShieldCheck} />
          <StatCard title="Blocchi" value={stats.blocked} icon={Lock} />
          <StatCard title="Richieste" value={stats.pending} icon={RefreshCcw} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`rounded-full px-5 py-3 font-bold ${
              activeTab === "calendar"
                ? "bg-[#0a1d35] text-white"
                : "bg-white text-[#0a1d35]"
            }`}
          >
            Prenotazioni
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`rounded-full px-5 py-3 font-bold ${
              activeTab === "new"
                ? "bg-[#0a1d35] text-white"
                : "bg-white text-[#0a1d35]"
            }`}
          >
            Nuova prenotazione
          </button>
          <button
            onClick={() => setActiveTab("block")}
            className={`rounded-full px-5 py-3 font-bold ${
              activeTab === "block"
                ? "bg-[#0a1d35] text-white"
                : "bg-white text-[#0a1d35]"
            }`}
          >
            Blocca date
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`rounded-full px-5 py-3 font-bold ${
              activeTab === "settings"
                ? "bg-[#0a1d35] text-white"
                : "bg-white text-[#0a1d35]"
            }`}
          >
            Impostazioni
          </button>
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

        {activeTab === "calendar" && (
          <section className="mt-8 rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-3xl">Prenotazioni e blocchi</h2>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e4d8c2] text-sm uppercase tracking-[0.15em] text-[#9b6b25]">
                    <th className="py-3">Arrivo</th>
                    <th className="py-3">Partenza</th>
                    <th className="py-3">Ospite</th>
                    <th className="py-3">Telefono</th>
                    <th className="py-3">Origine</th>
                    <th className="py-3">Stato</th>
                    <th className="py-3">Prezzo</th>
                    <th className="py-3">Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-[#555]">
                        Nessuna prenotazione inserita.
                      </td>
                    </tr>
                  )}

                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-[#f0e6d5]">
                      <td className="py-4">{formatDate(booking.checkIn)}</td>
                      <td className="py-4">{formatDate(booking.checkOut)}</td>
                      <td className="py-4 font-semibold">
                        {booking.guestName || "-"}
                      </td>
                      <td className="py-4">{booking.guestPhone || "-"}</td>
                      <td className="py-4">{booking.source || "-"}</td>
                      <td className="py-4">
                        <span className="rounded-full bg-[#faf6ee] px-3 py-1 text-sm font-semibold">
                          {booking.status || "-"}
                        </span>
                      </td>
                      <td className="py-4">
                        {booking.totalPrice ? `€ ${booking.totalPrice}` : "-"}
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          {booking.status !== "cancelled" && (
                            <button
                              onClick={() => cancelBooking(booking)}
                              className="rounded-full bg-[#f5c84b] px-4 py-2 text-sm font-bold text-[#0a1d35]"
                            >
                              Annulla
                            </button>
                          )}
                          <button
                            onClick={() => deleteBookingForever(booking)}
                            className="rounded-full bg-red-900 px-4 py-2 text-sm font-bold text-white"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "new" && (
          <section className="mt-8 rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-3xl">Nuova prenotazione</h2>

            <form onSubmit={createBooking} className="mt-6 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Nome ospite</span>
                <input
                  value={newBooking.guestName}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestName: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Telefono</span>
                <input
                  value={newBooking.guestPhone}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestPhone: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Email</span>
                <input
                  type="email"
                  value={newBooking.guestEmail}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guestEmail: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Ospiti</span>
                <input
                  type="number"
                  min="1"
                  max="2"
                  value={newBooking.guests}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, guests: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Arrivo</span>
                <input
                  type="date"
                  value={newBooking.checkIn}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, checkIn: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Partenza</span>
                <input
                  type="date"
                  value={newBooking.checkOut}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, checkOut: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Origine</span>
                <select
                  value={newBooking.source}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, source: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  <option value="manual">Manuale</option>
                  <option value="direct_site">Sito</option>
                  <option value="booking">Booking</option>
                  <option value="airbnb">Airbnb</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Stato</span>
                <select
                  value={newBooking.status}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, status: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                >
                  <option value="confirmed_direct">Confermata diretta</option>
                  <option value="pending">Richiesta</option>
                  <option value="booking">Booking</option>
                  <option value="blocked">Bloccata</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Prezzo totale</span>
                <input
                  type="number"
                  value={newBooking.totalPrice}
                  onChange={(event) =>
                    setNewBooking({ ...newBooking, totalPrice: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

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
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-bold text-white"
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

            <form onSubmit={createBlock} className="mt-6 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Data inizio</span>
                <input
                  type="date"
                  value={blockForm.checkIn}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, checkIn: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Data fine</span>
                <input
                  type="date"
                  value={blockForm.checkOut}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, checkOut: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Note blocco</span>
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
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-bold text-white"
                >
                  <Lock size={18} />
                  Blocca date
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="mt-8 rounded-[2rem] border border-[#e4d8c2] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-3xl">Impostazioni PMS</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Check-in standard
                </span>
                <input
                  type="time"
                  value={settings.checkInTime}
                  onChange={(event) =>
                    setSettings({ ...settings, checkInTime: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Check-out standard
                </span>
                <input
                  type="time"
                  value={settings.checkOutTime}
                  onChange={(event) =>
                    setSettings({ ...settings, checkOutTime: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Ospiti massimi
                </span>
                <input
                  type="number"
                  min="1"
                  max="2"
                  value={settings.maxGuests}
                  onChange={(event) =>
                    setSettings({ ...settings, maxGuests: Number(event.target.value) })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Nome rete Wi-Fi
                </span>
                <input
                  value={settings.wifiName}
                  onChange={(event) =>
                    setSettings({ ...settings, wifiName: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Password Wi-Fi
                </span>
                <input
                  value={settings.wifiPassword}
                  onChange={(event) =>
                    setSettings({ ...settings, wifiPassword: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">
                  Link calendario Booking iCal in entrata
                </span>
                <input
                  value={settings.bookingIcalUrl}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      bookingIcalUrl: event.target.value,
                    })
                  }
                  placeholder="Incolla qui il link iCal esportato da Booking"
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold">
                  Link calendario Airbnb iCal in entrata
                </span>
                <input
                  value={settings.airbnbIcalUrl}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      airbnbIcalUrl: event.target.value,
                    })
                  }
                  placeholder="Incolla qui il link iCal esportato da Airbnb"
                  className="w-full rounded-2xl border border-[#d7c49f] bg-[#faf6ee] px-4 py-4"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => saveSettings()}
                className="inline-flex items-center gap-2 rounded-full bg-[#0a1d35] px-7 py-4 font-bold text-white"
              >
                <Save size={18} />
                Salva impostazioni
              </button>

              <button
                onClick={syncCalendars}
                disabled={syncLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[#9b6b25] px-7 py-4 font-bold text-white disabled:opacity-60"
              >
                <RefreshCcw size={18} className={syncLoading ? "animate-spin" : ""} />
                {syncLoading ? "Sincronizzazione..." : "Sincronizza calendari"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e4d8c2] bg-[#faf6ee] p-5">
              <RefreshCcw className="text-[#9b6b25]" size={28} />
              <p className="mt-3 font-semibold">Import automatico Booking/Airbnb → PMS</p>
              <p className="mt-2 leading-7 text-[#555]">
                I link iCal esterni vengono salvati in un documento privato admin,
                poi l'API importa solo le notti occupate esterne senza cancellare
                prenotazioni manuali o richieste arrivate dal sito.
              </p>
            </div>

            {syncResult && (
              <div className="mt-6 rounded-2xl border border-[#e4d8c2] bg-white p-5">
                <h3 className="font-serif text-2xl">Ultima sincronizzazione</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-[#faf6ee] p-4">
                    <p className="text-sm text-[#555]">Importati</p>
                    <p className="text-2xl font-bold">{syncResult.totals.imported}</p>
                  </div>
                  <div className="rounded-2xl bg-[#faf6ee] p-4">
                    <p className="text-sm text-[#555]">Creati</p>
                    <p className="text-2xl font-bold">{syncResult.totals.created}</p>
                  </div>
                  <div className="rounded-2xl bg-[#faf6ee] p-4">
                    <p className="text-sm text-[#555]">Aggiornati</p>
                    <p className="text-2xl font-bold">{syncResult.totals.updated}</p>
                  </div>
                  <div className="rounded-2xl bg-[#faf6ee] p-4">
                    <p className="text-sm text-[#555]">Duplicati evitati</p>
                    <p className="text-2xl font-bold">
                      {syncResult.totals.skippedDuplicate}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {syncResult.results.map((item) => (
                    <div key={item.source} className="rounded-2xl bg-[#faf6ee] p-4">
                      <p className="font-bold">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-[#555]">
                        Configurato: {item.configured ? "sì" : "no"} · Importati: {item.imported} ·
                        Creati: {item.created} · Aggiornati: {item.updated} · Duplicati evitati: {item.skippedDuplicate} ·
                        Conflitti protetti: {item.skippedConflict} · Vecchi rimossi: {item.staleCancelled}
                      </p>
                      {item.errors.length > 0 && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                          {item.errors.map((syncError, index) => (
                            <p key={`${item.source}_${index}`}>
                              {syncError.checkIn} → {syncError.checkOut}: {syncError.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-[#faf6ee] p-5">
              <Wifi className="text-[#9b6b25]" size={28} />
              <p className="mt-3 font-semibold">Pagina QR ospiti</p>
              <p className="mt-2 leading-7 text-[#555]">
                Nel prossimo step colleghiamo queste impostazioni alla pagina QR
                ospiti, così Wi-Fi e regole saranno modificabili da admin.
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}