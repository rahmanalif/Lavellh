Firebase setup (backend + frontend)
===================================

Backend (this repo)
-------------------
This backend already uses Firebase Admin SDK via env vars in `src/config/firebase.js`.

Required env vars (in `.env`):
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=service-account-email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Notes:
- Keep the Admin SDK JSON file **out of the repo** (it is already git‑ignored).
- If you prefer using the JSON file directly, export it as an env var instead:
  - `GOOGLE_APPLICATION_CREDENTIALS=absolute/path/to/service-account.json`
  - Then update `src/config/firebase.js` to use `applicationDefault()` (optional).

Frontend (Vite/React)
---------------------
The Admin SDK JSON file is **NOT** used in frontend.
Create a **Web App** in Firebase Console and use the **Web config**.

1) Firebase Console → Project Settings → General → Your apps → **Web app**
2) Copy the config values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
3) Put them in frontend `.env`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...   # required for web push
```

Example frontend initialization:
```
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
```

For push notifications:
- Enable **Cloud Messaging** in Firebase.
- Generate a **Web Push certificate (VAPID key)** and set `VITE_FIREBASE_VAPID_KEY`.
- Frontend must request permission and send the FCM token to backend:
  - POST `/api/notifications/token` or include `fcmToken` on login (optional).
