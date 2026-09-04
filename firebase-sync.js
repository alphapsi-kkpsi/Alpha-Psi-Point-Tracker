(() => {
  const APP_KEY = "alphaPsiPointTrackerStateV1";
  const SESSION_KEY = "alphaPsiPointTrackerSessionV1";
  const CLIENT_ID_KEY = "alphaPsiFirebaseClientIdV1";
  const firebaseAuth = window.firebase?.auth ? firebase.auth() : null;
  const firebaseDb = window.firebase?.firestore ? firebase.firestore() : null;
  if (!firebaseAuth || !firebaseDb) return;

  const cloudRef = firebaseDb.collection("chapters").doc("alpha-psi");
  let applyingCloudState = false;
  let writeTimer = null;
  let unsubscribe = null;

  let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const normalizeBuffId = (value) => String(value || "").trim();

  function hasAppSession() {
    return Boolean(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY),
    );
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

  function findMember(state, email, buffId) {
    return (state?.members || []).find(
      (member) =>
        normalizeEmail(member.email) === normalizeEmail(email) &&
        normalizeBuffId(member.buffId) === normalizeBuffId(buffId),
    ) || null;
  }

  function queueCloudWrite() {
    if (applyingCloudState || !firebaseAuth.currentUser || !hasAppSession()) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      const localState = readLocalState();
      if (!localState) return;
      try {
        await cloudRef.set(
          {
            state: cloudComparableState(localState),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebaseAuth.currentUser.uid,
            updatedByClient: clientId,
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Firebase state sync failed:", error);
      }
    }, 400);
  }

  async function loadCloudState() {
    const snapshot = await cloudRef.get();
    const cloudState = snapshot.data()?.state;
    if (cloudState) {
      writeLocalState(cloudState);
      return cloudState;
    }
    return null;
  }

  async function initializeRealtimeSync(user) {
    if (!user || !hasAppSession()) return;
    if (unsubscribe) unsubscribe();

    try {
      const cloudState = await loadCloudState();
      if (!cloudState) queueCloudWrite();

      unsubscribe = cloudRef.onSnapshot(
        (snapshot) => {
          if (!hasAppSession()) return;

          const data = snapshot.data();
          const nextState = data?.state;
          if (!nextState) return;

          // Never reload for this browser tab's own write. Firestore listeners
          // fire for local writes as well as remote updates, which otherwise can
          // create a save -> snapshot -> reload loop.
          if (snapshot.metadata.hasPendingWrites || data?.updatedByClient === clientId) {
            return;
          }

          const currentState = readLocalState();
          const currentComparable = stableStringify(cloudComparableState(currentState));
          const incomingComparable = stableStringify(cloudComparableState(nextState));
          if (currentComparable === incomingComparable) return;

          writeLocalState(nextState);
          window.location.reload();
        },
        (error) => console.error("Firebase realtime sync failed:", error),
      );
    } catch (error) {
      console.error("Firebase cloud initialization failed:", error);
    }
  }

  // Firebase accounts are created by an administrator. Members never create
  // accounts from the login screen. Their school email is the username and
  // their Buff ID is the password set by the administrator in Firebase Auth.
  async function authenticate(email, buffId) {
    await firebaseAuth.signInWithEmailAndPassword(email, buffId);
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
          if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
          ) {
            status.textContent =
              "Invalid school email or Buff ID. If this is a new member, an administrator must create their Firebase account first.";
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
    // Firebase Auth can remain signed in after the app's own session has ended.
    // Do not start Firestore sync on the login screen.
    if (user && hasAppSession()) {
      await initializeRealtimeSync(user);
    }
  });
})();
