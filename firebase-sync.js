(() => {
  const APP_KEY = "alphaPsiPointTrackerStateV1";
  const SESSION_KEY = "alphaPsiPointTrackerSessionV1";
  const CLIENT_ID_KEY = "alphaPsiFirebaseClientIdV1";
  const PENDING_KEY = "alphaPsiCloudPendingV2";
  const BASE_KEY = "alphaPsiCloudBaseV2";
  const firebaseAuth = window.firebase?.auth ? firebase.auth() : null;
  const firebaseDb = window.firebase?.firestore ? firebase.firestore() : null;
  if (!firebaseAuth || !firebaseDb) return;

  const cloudRef = firebaseDb.collection("chapters").doc("alpha-psi");
  const enrollmentIndexRef = firebaseDb.collection("chapterEnrollmentIndexes").doc("alpha-psi");
  const enrollmentsRef = firebaseDb.collection("chapterEnrollments");
  let applyingCloudState = false;
  let writeTimer = null;
  let unsubscribe = null;
  let writeInFlight = false;
  let initialized = false;

  let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const normalizeBuffId = (value) =>
    String(value || "")
      .trim()
      .replace(/[^a-z0-9]/gi, "");

  function hasAppSession() {
    return Boolean(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY),
    );
  }

  function readAppSession() {
    try {
      return JSON.parse(
        localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null",
      );
    } catch {
      return null;
    }
  }

  function readLocalState() {
    try {
      return JSON.parse(localStorage.getItem(APP_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeLocalState(nextState) {
    applyingCloudState = true;
    localStorage.setItem(APP_KEY, JSON.stringify(nextState));
    applyingCloudState = false;
  }

  function cloudComparableState(state) {
    if (!state) return null;
    return { ...state, loginCredentials: [] };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }


  function same(a, b) {
    return stableStringify(a) === stableStringify(b);
  }

  function baseline() {
    try { return JSON.parse(localStorage.getItem(BASE_KEY) || "null"); }
    catch { return null; }
  }

  function setBaseline(value) {
    if (value) localStorage.setItem(BASE_KEY, JSON.stringify(cloudComparableState(value)));
  }

  function isPending() {
    return localStorage.getItem(PENDING_KEY) === "1";
  }

  function markPending() {
    localStorage.setItem(PENDING_KEY, "1");
    setSyncIndicator("pending");
  }

  function setSyncIndicator(status, error) {
    let indicator = document.querySelector("#chapterSyncIndicator");
    if (!indicator && document.body) {
      indicator = document.createElement("div");
      indicator.id = "chapterSyncIndicator";
      indicator.setAttribute("role", "status");
      indicator.style.cssText = "position:fixed;left:12px;bottom:72px;z-index:10000;padding:8px 12px;border-radius:8px;font:13px system-ui,sans-serif;box-shadow:0 2px 10px #0002;max-width:min(90vw,430px)";
      document.body.appendChild(indicator);
    }
    if (!indicator) return;
    indicator.hidden = status === "synced";
    indicator.style.background = status === "error" ? "#fff0ee" : "#fff8da";
    indicator.style.color = status === "error" ? "#9b1c1c" : "#644500";
    indicator.textContent = status === "error"
      ? "Cloud save failed. Your changes are retained on this device; reconnect and retry. " + (error?.message || "")
      : status === "offline"
      ? "Offline — changes saved on this device, waiting to sync."
      : status === "pending" ? "Saving changes to cloud…" : "";
  }

  // Three-way merge: apply changes made since this device's last acknowledged
  // cloud state onto the newest server state. This protects independent edits
  // and attendance records saved on other devices from whole-document clobbering.
  const keyedCollections = new Set([
    "members", "attendanceRecords", "pointRecords", "functions",
    "fundraisers", "customBandEnsembles", "customCommittees",
    "extraBusinessMeetings", "alerts", "chapterGoals",
  ]);

  function mergeValue(base, local, remote, key = "") {
    if (same(local, base)) return remote;
    if (same(remote, base)) return local;
    if (same(local, remote)) return local;
    if (Array.isArray(local) && Array.isArray(remote) &&
        keyedCollections.has(key) && local.every(x => x && x.id) && remote.every(x => x && x.id)) {
      const old = new Map((Array.isArray(base) ? base : []).filter(x => x && x.id).map(x => [x.id, x]));
      const own = new Map(local.map(x => [x.id, x]));
      const their = new Map(remote.map(x => [x.id, x]));
      const merged = [];
      for (const id of new Set([...old.keys(), ...their.keys(), ...own.keys()])) {
        const original = old.get(id), ours = own.get(id), theirs = their.get(id);
        if (!own.has(id) && old.has(id)) {
          // Retain a concurrent remote edit rather than erasing it.
          if (their.has(id) && !same(theirs, original)) merged.push(theirs);
          continue;
        }
        if (!their.has(id) && old.has(id)) {
          if (own.has(id) && !same(ours, original)) merged.push(ours);
          continue;
        }
        if (!own.has(id)) { if (their.has(id)) merged.push(theirs); continue; }
        if (!their.has(id)) { merged.push(ours); continue; }
        merged.push(mergeValue(original, ours, theirs, ""));
      }
      return merged;
    }
    if (local && remote && typeof local === "object" && typeof remote === "object" &&
        !Array.isArray(local) && !Array.isArray(remote)) {
      const output = {};
      for (const field of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
        const original = base?.[field];
        const ours = local[field], theirs = remote[field];
        if (!(field in local) && field in (base || {})) {
          if (field in remote && !same(theirs, original)) output[field] = theirs;
          continue;
        }
        if (!(field in remote) && field in (base || {})) {
          if (field in local && !same(ours, original)) output[field] = ours;
          continue;
        }
        if (!(field in local)) { output[field] = theirs; continue; }
        if (!(field in remote)) { output[field] = ours; continue; }
        output[field] = mergeValue(original, ours, theirs, field);
      }
      return output;
    }
    // For a simultaneous edit of one scalar, prefer this device's explicit edit.
    return local;
  }

  function mergeChapterState(base, local, remote) {
    const merged = mergeValue(base || {}, cloudComparableState(local) || {}, cloudComparableState(remote) || {});
    return { ...merged, loginCredentials: local?.loginCredentials || [] };
  }

  function findMember(state, email, buffId) {
    return (state?.members || []).find(
      (member) =>
        normalizeEmail(member.email) === normalizeEmail(email) &&
        normalizeBuffId(member.buffId) === normalizeBuffId(buffId),
    ) || null;
  }

  function currentLocalMember(state) {
    const appSession = readAppSession();
    if (!appSession?.memberId) return null;
    return (state?.members || []).find((member) => member.id === appSession.memberId) || null;
  }

  function isLocalAdmin(state) {
    return currentLocalMember(state)?.role === "Admin";
  }

  async function enrollmentHash(email, buffId) {
    if (!window.crypto?.subtle || !window.TextEncoder) {
      throw new Error("This browser does not support secure enrollment verification.");
    }
    const value = `${normalizeEmail(email)}\n${normalizeBuffId(buffId)}`;
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function buildEnrollmentEntries(state) {
    const entries = [];
    for (const member of state?.members || []) {
      const email = normalizeEmail(member.email);
      const buffId = normalizeBuffId(member.buffId);
      if (!email || !buffId) continue;
      entries.push({
        hash: await enrollmentHash(email, buffId),
        memberId: member.id,
      });
    }
    return entries;
  }

  async function syncEnrollmentRegistry(state) {
    if (!firebaseAuth.currentUser || !hasAppSession() || !isLocalAdmin(state)) return;

    const entries = await buildEnrollmentEntries(state);
    const desiredHashes = entries.map((entry) => entry.hash);
    const desiredSet = new Set(desiredHashes);
    const indexSnapshot = await enrollmentIndexRef.get();
    const previousHashes = Array.isArray(indexSnapshot.data()?.hashes)
      ? indexSnapshot.data().hashes
      : [];

    const batch = firebaseDb.batch();
    entries.forEach((entry) => {
      batch.set(
        enrollmentsRef.doc(entry.hash),
        {
          chapterId: "alpha-psi",
          memberId: entry.memberId,
          active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    previousHashes
      .filter((hash) => !desiredSet.has(hash))
      .forEach((hash) => batch.delete(enrollmentsRef.doc(hash)));

    batch.set(
      enrollmentIndexRef,
      {
        hashes: desiredHashes,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: firebaseAuth.currentUser.uid,
      },
      { merge: true },
    );

    await batch.commit();
  }


  function queueCloudWrite() {
    if (applyingCloudState) return;
    // Mark a local edit as not yet acknowledged even while offline or signed out.
    markPending();
    if (!firebaseAuth.currentUser || !hasAppSession()) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => flushCloudWrite(), 500);
  }

  async function flushCloudWrite() {
    if (writeInFlight || !isPending() || !firebaseAuth.currentUser || !hasAppSession()) return;
    const submitted = readLocalState();
    if (!submitted) return;
    const prior = baseline();
    writeInFlight = true;
    try {
      // Transaction retries if another browser commits in between our read and
      // write, so our snapshot never blindly erases that browser's records.
      const merged = await firebaseDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(cloudRef);
        const remote = snapshot.data()?.state || {};
        const next = mergeChapterState(prior, submitted, remote);
        // Do not synchronize client-only authentication credentials.
        transaction.set(cloudRef, {
          state: cloudComparableState(next),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: firebaseAuth.currentUser.uid,
          updatedByClient: clientId,
        }, { merge: true });
        return next;
      });

      setBaseline(merged);
      const current = readLocalState();
      if (same(cloudComparableState(current), cloudComparableState(submitted))) {
        writeLocalState({ ...merged, loginCredentials: current?.loginCredentials || [] });
        localStorage.removeItem(PENDING_KEY);
        setSyncIndicator("synced");
        // The tracker also holds a live in-memory state. Refresh it whenever
        // the transaction incorporated records from another device.
        const receivedOtherChanges = !same(cloudComparableState(merged), cloudComparableState(submitted));
        // A new member may need an enrollment entry; failure there must not
        // misreport a successfully committed chapter state as a failed save.
        syncEnrollmentRegistry(readLocalState()).catch(error =>
          console.error("Enrollment sync failed:", error));
        if (receivedOtherChanges) window.location.reload();
      } else {
        // A new edit arrived during the transaction. Keep it and start another
        // transaction against the just-committed baseline.
        const rebased = mergeChapterState(submitted, current, merged);
        writeLocalState(rebased);
        markPending();
      }
    } catch (error) {
      console.error("Firebase state sync failed:", error);
      markPending();
      setSyncIndicator(navigator.onLine ? "error" : "offline", error);
    } finally {
      writeInFlight = false;
      if (isPending() && navigator.onLine && firebaseAuth.currentUser && hasAppSession()) {
        // Retry on the next reconnection/change instead of a tight failure loop.
        clearTimeout(writeTimer);
        writeTimer = setTimeout(() => flushCloudWrite(), 10000);
      }
    }
  }

  async function loadCloudState() {
    const snapshot = await cloudRef.get({ source: "server" });
    const cloudState = snapshot.data()?.state;
    if (!cloudState) return null;
    if (isPending()) {
      // An offline submission must survive a login or page refresh even if the
      // server still has the older chapter document.
      const combined = mergeChapterState(baseline(), readLocalState(), cloudState);
      writeLocalState(combined);
      return combined;
    }
    setBaseline(cloudState);
    const old = readLocalState();
    writeLocalState({ ...cloudState, loginCredentials: old?.loginCredentials || [] });
    return cloudState;
  }

  async function initializeRealtimeSync(user) {
    if (!user || !hasAppSession()) return;
    if (unsubscribe) unsubscribe();
    try {
      const cloudState = await loadCloudState();
      initialized = true;
      if (!cloudState || isPending()) {
        queueCloudWrite();
      } else {
        syncEnrollmentRegistry(readLocalState()).catch(error =>
          console.error("Enrollment sync failed:", error));
      }

      unsubscribe = cloudRef.onSnapshot(
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!hasAppSession()) return;
          if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
          const data = snapshot.data();
          const nextState = data?.state;
          if (!nextState) return;
          if (isPending() || writeInFlight) {
            // Pending local edits will be rebased on the newest remote state
            // in a transaction; never overwrite them with a notification.
            if (!writeInFlight) queueCloudWrite();
            return;
          }
          const currentState = readLocalState();
          if (same(cloudComparableState(currentState), cloudComparableState(nextState))) {
            setBaseline(nextState);
            return;
          }
          setBaseline(nextState);
          writeLocalState({ ...nextState, loginCredentials: currentState?.loginCredentials || [] });
          window.location.reload();
        },
        (error) => {
          console.error("Firebase realtime sync failed:", error);
          if (isPending()) setSyncIndicator("error", error);
        },
      );
    } catch (error) {
      console.error("Firebase cloud initialization failed:", error);
      if (isPending()) setSyncIndicator(navigator.onLine ? "error" : "offline", error);
    }
  }

  window.addEventListener("online", () => {
    if (isPending()) {
      setSyncIndicator("pending");
      if (firebaseAuth.currentUser && hasAppSession()) flushCloudWrite();
    }
  });
  window.addEventListener("offline", () => {
    if (isPending()) setSyncIndicator("offline");
  });
  if (isPending()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setSyncIndicator(navigator.onLine ? "pending" : "offline"), { once: true });
    } else {
      setSyncIndicator(navigator.onLine ? "pending" : "offline");
    }
  }

  function isCredentialError(error) {
    return (
      error?.code === "auth/invalid-credential" ||
      error?.code === "auth/wrong-password" ||
      error?.code === "auth/user-not-found"
    );
  }

  async function isApprovedEnrollment(email, buffId) {
    const hash = await enrollmentHash(email, buffId);
    const snapshot = await enrollmentsRef.doc(hash).get();
    return snapshot.exists && snapshot.data()?.active !== false;
  }

  async function authenticate(email, buffId) {
    try {
      await firebaseAuth.signInWithEmailAndPassword(email, buffId);
      return;
    } catch (signInError) {
      if (!isCredentialError(signInError)) throw signInError;

      const approved = await isApprovedEnrollment(email, buffId);
      if (!approved) throw signInError;

      try {
        await firebaseAuth.createUserWithEmailAndPassword(email, buffId);
      } catch (createError) {
        if (createError?.code === "auth/email-already-in-use") {
          throw signInError;
        }
        throw createError;
      }
    }
  }

  document.addEventListener(
    "submit",
    async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== "loginForm") return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const formData = new FormData(form);
      const email = normalizeEmail(formData.get("email"));
      const buffId = normalizeBuffId(formData.get("buffId"));
      const status = document.querySelector("#loginStatus");

      if (!email || !buffId) return;
      if (status) status.textContent = "Signing in…";

      try {
        await authenticate(email, buffId);
        const cloudState = await loadCloudState();
        const state = cloudState || readLocalState();
        const member = findMember(state, email, buffId);

        if (!member) {
          await firebaseAuth.signOut();
          if (status) {
            status.textContent =
              "This account is not matched to a chapter member. Contact an administrator.";
          }
          return;
        }

        const remember = formData.get("remember") === "on";
        const session = { memberId: member.id, remember };
        if (remember) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }

        if (!cloudState) queueCloudWrite();
        await initializeRealtimeSync(firebaseAuth.currentUser);
        window.location.reload();
      } catch (error) {
        console.error("Firebase login failed:", error);
        if (status) {
          if (isCredentialError(error)) {
            status.textContent =
              "Invalid school email or Buff ID, or this member has not been added by an administrator.";
          } else if (error.code === "auth/weak-password") {
            status.textContent =
              "This Buff ID cannot be used as a Firebase password because it is too short. Contact an administrator.";
          } else {
            status.textContent =
              `Cloud sign-in failed. ${error.message || "Please try again."} (code: ${error.code || "unknown"})`;
          }
        }
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    async (event) => {
      const logout = event.target.closest?.("[data-action='logout']");
      if (!logout) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (unsubscribe) unsubscribe();
        await firebaseAuth.signOut();
      } catch (error) {
        console.error("Firebase sign-out failed:", error);
      }

      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      window.location.reload();
    },
    true,
  );

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && key === APP_KEY) queueCloudWrite();
  };

  firebaseAuth.onAuthStateChanged(async (user) => {
    if (user && hasAppSession()) {
      await initializeRealtimeSync(user);
    }
  });
})();
