// entry point: starts react
// strict mode = extra checks while developing
import { StrictMode } from "react";
// connects react to the page
import { createRoot } from "react-dom/client";
// our app
import App from "./App";

// draw app into element with id root (index.html), ! = we know it exists
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
