/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "App";

// Local fonts/icons for offline environments (no CDN)
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "material-icons/iconfont/material-icons.css";
import "material-icons/iconfont/outlined.css";

// Custom scrollbar styles
import "assets/css/scrollbar.css";

// Enterprise visual theme (scoped to dashboard pages via body.enterprise-ui)
import "assets/css/enterprise-theme.css";

// PrimeStay-style SaaS workspace shell
import "assets/css/saas-workspace.css";

// Settings-first theme (Stripe / Vercel / GitHub / Linear)
import "assets/css/saas-settings.css";

// Premium micro-interactions & chip visualization
import "assets/css/saas-polish.css";

// ERP Dashboard v1.0 layout & KPI/chart panels
import "assets/css/dashboard-redesign.css";

// ERP v1.0 sidebar (252px, teal active nav, branding)
import "assets/css/erp-sidenav.css";

// ERP v1.0 global buttons (#025B64 / white text)
import "assets/css/erp-buttons.css";

// Material Dashboard 2 React Context Provider
import { MaterialUIControllerProvider } from "context";

const container = document.getElementById("app");
const root = createRoot(container);

root.render(
  <BrowserRouter>
    <MaterialUIControllerProvider>
      <App />
    </MaterialUIControllerProvider>
  </BrowserRouter>
);
