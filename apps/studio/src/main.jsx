import process from "process";
window.process = process;

import React from "react";
import ReactDOM from "react-dom/client";
import { Studio } from "sanity";
import config from "../sanity.config.ts";
import "../sanity/studio.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Studio config={config} />
  </React.StrictMode>
);
