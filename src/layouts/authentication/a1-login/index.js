import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageLayout from "examples/LayoutContainers/PageLayout";
import api, { notifyAuthSessionChanged, canViewMenu } from "services/api.service";

import "./login-overrides.css";

const DEFAULT_LANDING_ROUTE = "/dashboard/kpi-overview";
const PUBLIC = process.env.PUBLIC_URL || "";
const CAROUSEL_INTERVAL_MS = 5000;

const asset = (path) => `${PUBLIC}/login_page/assets/${path}`;

const LOGIN_STYLESHEETS = [
  asset("css/bootstrap.min.css"),
  asset("fonts/custom-fonts.css"),
  asset("css/bootstrap-icons.css"),
  asset("css/style.css"),
];

const CAROUSEL_IMAGES = [
  "img/agri-land.jpg",
  "img/bilboard2.jpg",
  "img/petrol-station.jpg",
  "img/mall.jpg",
  "img/mall2.jpg",
  "img/plot.jpg",
];

const SLIDES = [
  {
    icon: "bi-tree",
    title: "Agricultural Land<br>Management",
    desc: "Manage agricultural land holdings, cultivation agreements, lease contracts, revenue and performance metrics.",
  },
  {
    icon: "bi-signpost",
    title: "Billboard Asset<br>Management",
    desc: "Manage billboard locations, contracts and revenue records.",
  },
  {
    icon: "bi-fuel-pump",
    title: "Petrol Station<br>Management",
    desc: "Track petrol station assets and lease agreements.",
  },
  {
    icon: "bi-buildings",
    title: "Mall Property<br>Management",
    desc: "Manage commercial mall assets and rental records.",
  },
  {
    icon: "bi-building",
    title: "Tower Asset<br>Management",
    desc: "Monitor tower assets and infrastructure revenue.",
  },
  {
    icon: "bi-map",
    title: "Vacant Plot<br>Management",
    desc: "Track vacant plots, ownership and development plans.",
  },
];

function clearLoginPendingState() {
  document.documentElement.classList.remove("a1-login-pending");
}

function useLoginStylesheets() {
  const [stylesReady, setStylesReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("a1-login-active");
    document.body.classList.add("a1-login-active");

    let pending = LOGIN_STYLESHEETS.length;
    const injectedLinks = [];

    const markSheetReady = () => {
      if (pending <= 0) return;
      pending -= 1;
      if (pending <= 0) {
        clearLoginPendingState();
        setStylesReady(true);
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      clearLoginPendingState();
      setStylesReady(true);
    }, 4000);

    LOGIN_STYLESHEETS.forEach((href) => {
      const selector = `link[data-a1-login-stylesheet][href="${href}"]`;
      let link = document.querySelector(selector);

      if (!link) {
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute("data-a1-login-stylesheet", "true");
        link.addEventListener("load", markSheetReady);
        link.addEventListener("error", markSheetReady);
        document.head.appendChild(link);
        injectedLinks.push(link);
        return;
      }

      if (link.sheet) {
        markSheetReady();
        return;
      }

      link.addEventListener("load", markSheetReady);
      link.addEventListener("error", markSheetReady);
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      setStylesReady(false);
      root.classList.remove("a1-login-active", "a1-login-pending");
      document.body.classList.remove("a1-login-active");
      injectedLinks.forEach((link) => {
        if (link.parentNode) link.parentNode.removeChild(link);
      });
    };
  }, []);

  return stylesReady;
}

function A1Login() {
  const stylesReady = useLoginStylesheets();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const intervalRef = useRef(null);

  const clearCarouselInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCarouselInterval = useCallback(() => {
    clearCarouselInterval();
    intervalRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, CAROUSEL_INTERVAL_MS);
  }, [clearCarouselInterval]);

  useEffect(() => {
    if (isCarouselPaused) {
      clearCarouselInterval();
      return undefined;
    }
    startCarouselInterval();
    return clearCarouselInterval;
  }, [isCarouselPaused, startCarouselInterval, clearCarouselInterval]);

  const goToSlide = (index) => {
    setActiveSlide(index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = String(username || "").trim();
    const p = String(password || "");

    if (!u || !p) {
      setAuthError("Username and password are required");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    try {
      const res = await api.login({ username: u, password: p, Username: u, Password: p });

      const permissions = Array.isArray(res?.permissions)
        ? res.permissions
        : Array.isArray(res?.Permissions)
        ? res.Permissions
        : [];

      const normalizeLoginValue = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "");
      const privilegedValues = new Set(["ahq", "superuser"]);
      const isPrivilegedUser =
        privilegedValues.has(normalizeLoginValue(u)) ||
        privilegedValues.has(normalizeLoginValue(res?.username)) ||
        privilegedValues.has(normalizeLoginValue(res?.Username)) ||
        privilegedValues.has(normalizeLoginValue(res?.userName)) ||
        privilegedValues.has(normalizeLoginValue(res?.UserName)) ||
        privilegedValues.has(normalizeLoginValue(res?.roleName)) ||
        privilegedValues.has(normalizeLoginValue(res?.RoleName));
      const hasValidPermissions = Array.isArray(permissions) && permissions.length > 0;

      if (!hasValidPermissions && !isPrivilegedUser) {
        alert("No rights assigned. Please contact administrator.");
        setAuthError("No rights assigned. Please contact administrator.");
        return;
      }

      const token =
        res?.token || res?.Token || res?.accessToken || res?.AccessToken || res?.jwt || res?.Jwt;
      if (token) {
        api.storeAccessToken(token);
      }

      try {
        localStorage.setItem("auth", JSON.stringify(res || {}));
      } catch (storageErr) {
        // ignore
      }
      notifyAuthSessionChanged();

      const canView = (perm) =>
        perm?.canView === true ||
        perm?.CanView === true ||
        perm?.canView === 1 ||
        perm?.CanView === 1 ||
        String(perm?.canView ?? perm?.CanView ?? "")
          .trim()
          .toLowerCase() === "true";

      if (isPrivilegedUser || canViewMenu("Dashboard")) {
        navigate(DEFAULT_LANDING_ROUTE);
        return;
      }

      const firstVisibleMenu = permissions.find(canView);
      const menuName = String(
        firstVisibleMenu?.menuName ?? firstVisibleMenu?.MenuName ?? ""
      ).trim();
      const routeByMenu = {
        Configuration: "/configuration/class",
        "Contracts Mgmt": "/contracts/tenants",
        Accounts: "/accounts/bank-account",
      };
      navigate(routeByMenu[menuName] || DEFAULT_LANDING_ROUTE);
    } catch (err) {
      setAuthError(err?.message ? String(err.message) : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSlide = SLIDES[activeSlide];

  return (
    <PageLayout background="transparent">
      <div className={`a1-login-page${stylesReady ? "" : " a1-login-page--loading"}`}>
        <div className="login-layout">
          <div
            className="left-wrapper"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
          >
            <div id="landCarousel" className="carousel slide carousel-fade" data-bs-touch="true">
              <div className="carousel-inner">
                {CAROUSEL_IMAGES.map((src, index) => (
                  <div
                    key={src}
                    className={`carousel-item${index === activeSlide ? " active" : ""}`}
                  >
                    <img src={asset(src)} alt="" />
                  </div>
                ))}
              </div>
            </div>

            <div className="overlay" />

            <div className="logo-placeholder">
              <img src={asset("img/PAF-Logo.gif")} alt="PAF Logo" />
            </div>

            <div className="slide-content">
              <div id="slideIcon" className="slide-icon">
                <i className={`bi ${currentSlide.icon}`} />
              </div>
              <div
                id="slideTitle"
                className="slide-title"
                dangerouslySetInnerHTML={{ __html: currentSlide.title }}
              />
              <div id="slideDesc" className="slide-desc">
                {currentSlide.desc}
              </div>

              <div className="carousel-indicators custom-dots">
                {SLIDES.map((_, index) => (
                  <button
                    key={SLIDES[index].icon}
                    type="button"
                    data-bs-target="#landCarousel"
                    data-bs-slide-to={index}
                    className={index === activeSlide ? "active" : ""}
                    aria-label={`Slide ${index + 1}`}
                    onClick={() => goToSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="right-wrapper">
            <div className="a1-header">
              <div className="big-a1">A1</div>
              <div className="v-line" />

              <div className="system-title">
                <small>PAKISTAN AIR FORCE</small>
                <h1>LAND&apos;s ACTIVITIES MANAGEMENT SYSTEM</h1>
              </div>
            </div>

            <hr />

            <div className="pointer">-</div>

            <div className="main-heading">
              A Unified Solution for
              <br />
              Land Assets and Financial
              <br />
              Excellence
            </div>

            <div className="main-description">
              A centralized solution to manage land records, contracts, revenues and financial
              performance, providing actionable insights and analytics for effective planning and
              governance.
            </div>

            <hr />

            <div className="login-title">Login Here</div>
            <div className="login-sub">Enter Your Credentials to login</div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="input-group">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      className="form-control"
                      placeholder="Enter User Name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      disabled={isSubmitting}
                    />
                    <span className="input-group-text">
                      <i className="bi bi-person-circle" />
                    </span>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="input-group">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="form-control"
                      placeholder="Enter Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                    />
                    <span className="input-group-text">
                      <i className="bi bi-key-fill" />
                    </span>
                  </div>
                </div>
              </div>

              {authError ? <div className="auth-error">{authError}</div> : null}

              <button
                type="submit"
                className="btn btn-login sm-btn text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="company">Dte. of CNPF / Audit & Accounts Sub Branch</div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default A1Login;
