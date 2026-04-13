const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const EMAILS = [
  "tas.studio2026@gmail.com",
  "satoki4438@gmail.com",
];

async function run() {
  for (const email of EMAILS) {
    try {
      const user = await auth.getUserByEmail(email);
      await db.collection("users").doc(user.uid).set(
        { isPremium: true },
        { merge: true }
      );
      console.log(`OK: ${email} (${user.uid})`);
    } catch (e) {
      console.error(`FAIL: ${email} — ${e.message}`);
    }
  }
  process.exit(0);
}

run();
