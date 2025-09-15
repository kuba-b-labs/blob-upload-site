import { useState, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { EventType, InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dstContainer, setDstContainer] = useState("");
  const [authStatus, setAuthStatus] = useState("Nie zalogowano");

  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const API = "http://localhost:8000";

  // 1) Bootstrap: jeśli są konta w cache, ustaw activeAccount
  useEffect(() => {
    const all = instance.getAllAccounts();
    if (all.length > 0 && !instance.getActiveAccount()) {
      instance.setActiveAccount(all[0]);
      // console.log("[MSAL] Bootstrap setActiveAccount:", all[0]?.username);
    }
  }, [instance]);

  // 2) Po LOGIN_SUCCESS (redirect wraca do SPA) ustaw activeAccount
  useEffect(() => {
    const cbId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        instance.setActiveAccount(event.payload.account);
        // console.log("[MSAL] LOGIN_SUCCESS setActiveAccount:", event.payload.account?.username);
      }
    });
    return () => { if (cbId) instance.removeEventCallback(cbId); };
  }, [instance]);

  // Pobiera access token z MSAL (silent), rzuca błąd jeśli brak sesji
  const getAccessToken = async () => {
    const active = instance.getActiveAccount();
    if (!active) throw new Error("Brak zalogowanego użytkownika");
    const resp = await instance.acquireTokenSilent({ ...loginRequest, account: active });
    return resp.accessToken;
  };

  // helper: fetch z Bearer z MSAL
  const authFetch = async (url, options = {}) => {
    try {
      const token = await getAccessToken();
      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) setAuthStatus("Sesja wygasła / 401");
      return res;
    } catch (e) {
      alert("Najpierw zaloguj się przez Microsoft.");
      throw e;
    }
  };

  // Logowanie / wylogowanie
  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  // --- Operacje plikowe (z tokenem) ---
  const fetchFiles = async () => {
    if (!dstContainer) return alert("Podaj nazwę folderu!");
    const res = await authFetch(`${API}/listblobs/${dstContainer}`);
    const data = await res.json();
    setFiles(data);
    setAuthStatus("Zalogowano ✅");
  };

  const uploadFile = async () => {
    if (!selectedFile) return alert("Nie wybrano pliku!");
    if (!dstContainer) return alert("Podaj nazwę folderu!");
    const formData = new FormData();
    formData.append("entry", selectedFile);

    await authFetch(`${API}/upload/${dstContainer}`, {
      method: "POST",
      body: formData,
    });

    setSelectedFile(null);
    fetchFiles();
  };

  const deleteFile = async (filename) => {
    if (!dstContainer) return alert("Podaj nazwę folderu!");
    await authFetch(`${API}/upload/delete/${dstContainer}/${filename}`, {
      method: "DELETE",
    });
    fetchFiles();
  };

  const downloadFile = async (filename) => {
    if (!dstContainer) return alert("Podaj nazwę folderu!");
    const res = await authFetch(`${API}/download/${dstContainer}/${filename}`);
    if (!res.ok) {
      alert(`Błąd pobierania: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activeUsername = instance.getActiveAccount()?.username;

  // 3) Gdy MSAL jest w trakcie interakcji (redirect/iframe), wstrzymaj UI
  if (inProgress !== InteractionStatus.None) {
    return <div style={{ padding: 16 }}>Trwa uwierzytelnianie…</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>📂 File Manager</h1>

        {/* --- Microsoft Login box --- */}
        <div style={styles.authBox}>
          {!isAuthenticated ? (
            <>
              <button onClick={login} style={styles.buttonBlue}>
                Zaloguj przez Microsoft
              </button>
              <div style={styles.authStatus}><b>Status:</b> {authStatus}</div>
              <div style={styles.tip}>
                Upewnij się, że Redirect URI w Entra = identyczny jak w authConfig (np. http://localhost:5173).
              </div>
            </>
          ) : (
            <>
              <div><b>Zalogowano:</b> {activeUsername}</div>
              <button onClick={logout} style={styles.buttonGray}>Wyloguj</button>
              <div style={styles.authStatus}><b>Status:</b> {authStatus}</div>
            </>
          )}
        </div>

        {/* --- Reszta UI --- */}
        <input
          type="text"
          placeholder="Podaj nazwę folderu..."
          value={dstContainer}
          onChange={(e) => setDstContainer(e.target.value)}
          style={styles.input}
        />

        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files[0])}
          style={styles.input}
        />

        <button onClick={uploadFile} style={styles.buttonBlue}>Wrzuc plik</button>
        <button onClick={fetchFiles} style={styles.buttonGray}>Wyświetl listę plików</button>

        <ul style={{ listStyle: "none", padding: 0, marginTop: "10px" }}>
          {files.map((file, idx) => (
            <li key={idx} style={styles.fileItemColumn}>
              <span style={{ wordBreak: "break-all" }}>{file}</span>
              <div style={styles.fileButtons}>
                <button onClick={() => downloadFile(file)} style={styles.buttonGreen}>Pobierz</button>
                <button onClick={() => deleteFile(file)} style={styles.buttonRed}>Usuń</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------- Style CSS w JS ----------------
const styles = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f3f3f3",
  },
  container: {
    padding: "20px",
    width: "420px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  title: {
    textAlign: "center",
    marginBottom: "10px",
    fontSize: "20px",
    fontWeight: "bold",
  },
  authBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px",
    background: "#fafafa",
  },
  authRow: { display: "flex", gap: "8px", marginBottom: "8px" },
  authStatus: { fontSize: "12px", color: "#374151", marginTop: "6px" },
  tip: { fontSize: "12px", color: "#6b7280", marginTop: "6px" },
  input: {
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    marginBottom: "10px",
    width: "100%",
    boxSizing: "border-box",
  },
  buttonBlue: {
    padding: "10px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginBottom: "10px",
    width: "100%",
  },
  buttonGray: {
    padding: "10px",
    backgroundColor: "#6b7280",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    width: "100%",
    marginBottom: "10px",
  },
  buttonGreen: {
    padding: "6px 10px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "5px",
  },
  buttonRed: {
    padding: "6px 10px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  fileItemColumn: {
    display: "flex",
    flexDirection: "column",
    padding: "6px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    marginBottom: "5px",
  },
  fileButtons: {
    marginTop: "5px",
    display: "flex",
    gap: "5px",
  },
};
