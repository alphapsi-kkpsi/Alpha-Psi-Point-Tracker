(() => {
  const APP_KEY = "alphaPsiPointTrackerStateV1";
  const SESSION_KEY = "alphaPsiPointTrackerSessionV1";
  const firebaseAuth = window.firebase?.auth ? firebase.auth() : null;
  const firebaseDb = window.firebase?.firestore ? firebase.firestore() : null;
  if (!firebaseAuth || !firebaseDb) return;

  const cloudRef = firebaseDb.collection("chapters").doc("alpha-psi");
  let applyingCloudState = false;
  let writeTimer = null;
  let unsubscribe = null;

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const normalizeBuffId = (value) => String(value || "").trim();

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

  function findMember(state, email, buffId) {
    return (state?.members || []).find(
      (member) =>
        normalizeEmail(member.email) === normalizeEmail(email) &&
        normalizeBuffId(member.buffId) === normalizeBuffId(buffId),
    ) || null;
  }

  function queueCloudWrite() {
    if (applyingCloudState || !firebaseAuth.currentUser) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      const localState = readLocalState();
      if (!localState) return;
      try {
        await cloudRef.set(
          {
            state: { ...localState, loginCredentials: [] },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebaseAuth.currentUser.uid,
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
    if (!user) return;
    if (unsubscribe) unsubscribe();

    try {
      const cloudState = await loadCloudState();
      if (!cloudState) queueCloudWrite();

      unsubscribe = cloudRef.onSnapshot(
        (snapshot) => {
          const nextState = snapshot.data()?.state;
          if (!nextState) return;
          const current = localStorage.getItem(APP_KEY);
          const incoming = JSON.stringify(nextState);
          if (current === incoming) return;
          writeLocalState(nextState);
          window.location.reload();
        },
        (error) => console.error("Firebase realtime sync failed:", error),
      );
    } catch (error) {
      console.error("Firebase cloud initialization failed:", error);
      throw error;
    }
  }

  async function authenticate(email, buffId) {
    try {
      await firebaseAuth.signInWithEmailAndPassword(email, buffId);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        await firebaseAuth.createUserWithEmailAndPassword(email, buffId);
      } else {
        throw error;
      }
    }
  }

  function describeFirebaseError(error) {
    const code = error?.code || "unknown";
    const messages = {
      "auth/invalid-email": "The school email address is not valid.",
      "auth/invalid-credential": "The Firebase account exists, but the Buff ID is not its current password.",
      "auth/wrong-password": "The Firebase account exists, but the Buff ID is not its current password.",
      "auth/user-disabled": "This Firebase account has been disabled.",
      "auth/weak-password": "The Buff ID is too short to use as a Firebase password. This member needs an account setup password.",
      "auth/email-already-in-use": "A Firebase account already exists for this email, but it could not be signed in with the supplied Buff ID.",
      "auth/operation-not-allowed": "Firebase Email/Password sign-in is not enabled for this project.",
      "permission-denied": "Firebase reached Firestore, but the current security rules denied access. Make sure the published rules allow authenticated users to read/write chapters/alpha-psi.",
      "failed-precondition": "Firestore is not ready for this request yet. Check that the Firestore database was created successfully.",
      "unavailable": "Firebase is temporarily unavailable. Check the internet connection and try again.",
    };
    return `${messages[code] || `Firebase error: ${code}.`} (code: ${code})`;
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

        if (!cloudState) queueCloudWrite();

        const remember = formData.get("remember") === "on";
        const session = { memberId: member.id, remember };
        if (remember) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }

        await initializeRealtimeSync(firebaseAuth.currentUser);
        window.location.reload();
      } catch (error) {
        console.error("Firebase login failed:", error);
        if (status) status.textContent = describeFirebaseError(error);
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
    if (user) {
      try {
        await initializeRealtimeSync(user);
      } catch (error) {
        console.error("Firebase auth-state initialization failed:", error);
      }
    }
  });
})();
