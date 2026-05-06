# Clock In System MVP

A static HTML, CSS, and JavaScript MVP for worker attendance tracking with Firebase Authentication and Cloud Firestore.

## What is included

- Email/password login using Firebase Authentication
- Role-based access for `admin` and `worker`
- Worker clock in / clock out flow
- Admin dashboard overview
- Admin CRUD-style management for departments and job titles
- Admin worker account creation using a secondary Firebase app instance
- Worker activation/deactivation
- Attendance tables and basic filters
- Starter Firestore security rules
- GitHub Pages-compatible static frontend

## Project structure

```txt
clock-in-system-mvp/
├── index.html
├── styles.css
├── app.js
├── firebase-config.example.js
├── firestore.rules
└── README.md
```

## Firebase setup

1. Create a Firebase project.
2. Add a Web App in Firebase Console.
3. Enable **Authentication > Sign-in method > Email/Password**.
4. Create a **Cloud Firestore** database.
5. Copy `firebase-config.example.js` to `firebase-config.js`.
6. Paste your Firebase web app config into `firebase-config.js`. (Note: This file is ignored by Git to keep your API key secure).
7. Publish `firestore.rules` to Firestore Rules.

## Create the first admin

This MVP intentionally does not allow public self-registration.

1. In Firebase Console, create an Authentication user manually.
2. Copy that user's UID.
3. In Cloud Firestore, create a document:

```txt
Collection: users
Document ID: <ADMIN_AUTH_UID>
```

Use this document data:

```json
{
  "email": "admin@company.com",
  "role": "admin",
  "active": true
}
```

4. Log in to the app with that admin email/password.
5. Add departments and titles.
6. Add workers. The admin dashboard will create worker Auth accounts and worker profile documents.

## Firestore collections

### users/{uid}

```json
{
  "email": "worker@company.com",
  "role": "worker",
  "workerId": "workersDocId",
  "active": true,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### workers/{workerId}

```json
{
  "name": "Jane Worker",
  "email": "jane@company.com",
  "departmentId": "departmentDocId",
  "titleId": "titleDocId",
  "userId": "firebaseAuthUid",
  "active": true,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### departments/{departmentId}

```json
{
  "name": "Operations",
  "active": true,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### titles/{titleId}

```json
{
  "name": "Warehouse Associate",
  "active": true,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### attendance/{attendanceId}

```json
{
  "workerId": "workerDocId",
  "userId": "firebaseAuthUid",
  "workerName": "Jane Worker",
  "departmentId": "departmentDocId",
  "titleId": "titleDocId",
  "clockInAt": "serverTimestamp",
  "clockOutAt": null,
  "dateKey": "2026-05-06",
  "status": "clocked-in",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## Run locally

Because the app uses JavaScript modules, run it through a local server rather than opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Open:

```txt
http://localhost:8080
```

## Deploy to GitHub Pages

This project uses GitHub Actions to deploy automatically while keeping your API key secret.

1. **Add Secret**: Go to your GitHub Repository > **Settings** > **Secrets and variables** > **Actions**.
2. **New Secret**: Click "New repository secret".
   - Name: `FIREBASE_CONFIG`
   - Value: The entire contents of your `firebase-config.js` file.
3. **Commit and Push**: Push your changes to the `main` branch.
4. **Automatic Deploy**: GitHub Actions will automatically create the config file from the secret and deploy to the `gh-pages` branch.
5. **Enable Pages**: If it's your first time, go to **Settings** > **Pages** and ensure "Build and deployment" is set to "Deploy from a branch" and the branch is `gh-pages`.

## Important MVP notes

- Firebase web config is not a secret, but Firestore Rules are security-critical.
- A production system should move user creation to a trusted backend such as Cloud Functions or an admin-only server because client-side account creation is limited by frontend trust boundaries.
- Attendance edit/export, password reset, audit logs, geolocation, shift schedules, and payroll reports are natural next features.
