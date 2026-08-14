// Reuses the Firebase Web App that was already configured in the source Werewolf repo.
// Insider rooms use 6-character codes beginning with "I" so they do not overlap the old 5-character rooms.
// You can replace this config with a separate Firebase project at any time.
export const firebaseConfig = {
  apiKey: "AIzaSyBSjNbLUsrJ0oFOBebIDW2YFkfgNO26j2I",
  authDomain: "werewolf-board-game-9b361.firebaseapp.com",
  databaseURL: "https://werewolf-board-game-9b361-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "werewolf-board-game-9b361",
  storageBucket: "werewolf-board-game-9b361.firebasestorage.app",
  messagingSenderId: "874116696252",
  appId: "1:874116696252:web:4a5cd6e45f745f9adba8b9"
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}
