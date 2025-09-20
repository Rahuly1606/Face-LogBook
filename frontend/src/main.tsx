import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeApiClient } from "./api/apiClient";

// Initialize the API client before rendering
initializeApiClient().then(() => {
    console.log("API client initialized, rendering app...");
    createRoot(document.getElementById("root")!).render(<App />);
}).catch(error => {
    console.error("Failed to initialize API client:", error);
    // Render app anyway to show at least something to the user
    createRoot(document.getElementById("root")!).render(<App />);
});
