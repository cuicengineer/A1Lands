import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import IconButton from "@mui/material/IconButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { withGridValueChip } from "utils/gridValueChipCell";
import CurrencyLoading from "components/CurrencyLoading";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import AccountsModuleTabs from "layouts/accounts/components/AccountsModuleTabs";
import BankAccountForm from "layouts/accounts/bank-account/BankAccountForm";
import bankAccountApi, {
  UPLOAD_TABLE_NAME,
  fetchBankListsForDropdown,
} from "services/api.bankAccount.service";
import uploadApi from "services/api.upload.service";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import PropTypes from "prop-types";
import { format, parseISO, isValid } from "date-fns";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import { useMaterialUIController } from "context";

/** Keeps MUI `Select` and native date inputs the same vertical size in the filter popover. */
const BANK_ACC_FILTER_CONTROL_HEIGHT = 40;

const BANK_ACCOUNTS_GRID_DATE_FALLBACK_KEYS = {
  openingDate: ["openingDate", "OpeningDate"],
};

function parseBankAccountsGridDateYyyyMmDd(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = BANK_ACCOUNTS_GRID_DATE_FALLBACK_KEYS[columnId] || [];
  if ((raw === undefined || raw === null || String(raw).trim() === "") && o && fallbacks.length) {
    for (let i = 0; i < fallbacks.length; i += 1) {
      const v = o[fallbacks[i]];
      if (v != null && String(v).trim() !== "") {
        raw = v;
        break;
      }
    }
  }
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  const isoHead = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoHead) return isoHead[1];
  try {
    const parsed = parseISO(s);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return null;
}

function bankAccountsGridDateCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowD = parseBankAccountsGridDateYyyyMmDd(row, columnId);
    if (!rowD) return false;
    const { mode } = filterValue;
    if (mode === "gt") return Boolean(filterValue.date) && rowD > filterValue.date;
    if (mode === "lt") return Boolean(filterValue.date) && rowD < filterValue.date;
    if (mode === "between") {
      const { dateFrom, dateTo } = filterValue;
      if (!dateFrom || !dateTo) return false;
      const start = dateFrom <= dateTo ? dateFrom : dateTo;
      const end = dateFrom <= dateTo ? dateTo : dateFrom;
      return rowD >= start && rowD <= end;
    }
    return true;
  });
}

function BankAccountsDateColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Date";
  const modeLabelId = `bank-accounts-date-filter-mode-${column.id || "col"}`;

  const [anchorEl, setAnchorEl] = useState(null);
  const [mode, setMode] = useState("none");
  const [refDate, setRefDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;
    const fv = column.filterValue;
    if (!fv || fv.mode === undefined || fv.mode === "none") {
      setMode("none");
      setRefDate("");
      setEndDate("");
      return;
    }
    if (fv.mode === "between") {
      setMode("between");
      setRefDate(fv.dateFrom || "");
      setEndDate(fv.dateTo || "");
    } else {
      setMode(fv.mode === "gt" || fv.mode === "lt" ? fv.mode : "none");
      setRefDate(fv.date || "");
      setEndDate("");
    }
  }, [open, column.filterValue]);

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setAnchorEl(null);
  };

  const hasActiveFilter = Boolean(column.filterValue && column.filterValue.mode !== "none");

  const commit = () => {
    if (mode === "none") column.setFilter(undefined);
    else if (mode === "gt" || mode === "lt") {
      if (!refDate.trim()) return;
      column.setFilter({ mode, date: refDate });
    } else if (mode === "between") {
      if (!refDate.trim() || !endDate.trim()) return;
      const start = refDate <= endDate ? refDate : endDate;
      const finish = refDate <= endDate ? endDate : refDate;
      column.setFilter({ mode: "between", dateFrom: start, dateTo: finish });
    }
    handleClose();
  };

  const clearFilter = () => {
    column.setFilter(undefined);
    setMode("none");
    setRefDate("");
    setEndDate("");
    handleClose();
  };

  const filterFormControlSx = {
    mb: 1.5,
    "& .MuiOutlinedInput-root": {
      minHeight: BANK_ACC_FILTER_CONTROL_HEIGHT,
    },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      minHeight: BANK_ACC_FILTER_CONTROL_HEIGHT - 2,
    },
  };

  const filterDateInputStyle = {
    width: "100%",
    height: BANK_ACC_FILTER_CONTROL_HEIGHT,
    minHeight: BANK_ACC_FILTER_CONTROL_HEIGHT,
    boxSizing: "border-box",
    padding: "0 14px",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    border: "1px solid rgba(0, 0, 0, 0.23)",
    borderRadius: "4px",
    color: "rgba(0, 0, 0, 0.87)",
    WebkitAppearance: "none",
    appearance: "none",
    backgroundColor: "#fff",
  };

  return (
    <>
      <Tooltip title={`Filter by ${colLabel} date`}>
        <IconButton
          size="small"
          onClick={handleOpen}
          onMouseDown={(ev) => ev.stopPropagation()}
          sx={{
            fontSize: "10px",
            padding: "0px",
            minWidth: "14px",
            color: hasActiveFilter ? "#1A73E8" : "#111111",
          }}
        >
          <Icon fontSize="inherit">filter_alt</Icon>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: 300, px: 0.5 } }}
        MenuListProps={{ dense: true, onClick: (ev) => ev.stopPropagation(), autoFocus: false }}
      >
        <MDBox px={1.5} pt={1.5} pb={1} onClick={(ev) => ev.stopPropagation()}>
          <MDTypography variant="button" fontWeight="bold" display="block" sx={{ mb: 1 }}>
            {colLabel} filter
          </MDTypography>
          <FormControl size="small" fullWidth sx={filterFormControlSx}>
            <InputLabel id={modeLabelId}>Comparison</InputLabel>
            <SearchableSelect
              labelId={modeLabelId}
              label="Comparison"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <MenuItem value="none">No date filter</MenuItem>
              <MenuItem value="gt">Greater than (after)</MenuItem>
              <MenuItem value="lt">Less than (before)</MenuItem>
              <MenuItem value="between">Date range</MenuItem>
            </SearchableSelect>
          </FormControl>
          {(mode === "gt" || mode === "lt") && (
            <Box sx={{ mb: 1.5 }}>
              <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                Reference date
              </MDTypography>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                style={filterDateInputStyle}
              />
            </Box>
          )}
          {mode === "between" && (
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1,
                mb: 1.5,
                alignItems: "stretch",
              }}
            >
              <Box
                sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}
              >
                <MDTypography variant="caption" color="text" display="block">
                  From date
                </MDTypography>
                <input
                  type="date"
                  value={refDate}
                  onChange={(e) => setRefDate(e.target.value)}
                  style={filterDateInputStyle}
                />
              </Box>
              <Box
                sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}
              >
                <MDTypography variant="caption" color="text" display="block">
                  To date
                </MDTypography>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={filterDateInputStyle}
                />
              </Box>
            </Box>
          )}
          <Divider sx={{ my: 1.5 }} />
          <MDBox display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="outlined" color="secondary" size="small" onClick={clearFilter}>
              Clear
            </MDButton>
            <MDButton variant="gradient" color="info" size="small" onClick={commit}>
              Apply
            </MDButton>
          </MDBox>
        </MDBox>
      </Menu>
    </>
  );
}

BankAccountsDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const BANK_ACCOUNTS_DATATABLE_DATE_FILTER_TYPES = Object.freeze({
  bankAccountsDateCompare: bankAccountsGridDateCompare,
});

/** Horizontal scroll element for the bank accounts DataTable (sticky toolbar layout). */
function findBankAccountsMainHorizontalScrollEl(root) {
  if (!root || typeof root.querySelector !== "function") return null;
  const table = root.querySelector("table.MuiTable-root") || root.querySelector("table");
  if (!table) return null;
  let el = table.parentElement;
  while (el && root.contains(el)) {
    const { overflowX } = getComputedStyle(el);
    if (
      (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      return el;
    }
    el = el.parentElement;
  }
  el = table.parentElement;
  while (el && root.contains(el)) {
    const { overflowX } = getComputedStyle(el);
    if (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") {
      return el;
    }
    el = el.parentElement;
  }
  return table.parentElement;
}

const BANK_ACC_HSCROLL_HIDE_MS = 1800;
const BANK_ACC_HSCROLL_THUMB_MIN_PX = 28;
const BANK_ACC_HSCROLL_RAIL_H = 6;

/**
 * Custom slim horizontal scroll rail (same pattern as tenants.js); synced with DataTable body scroll.
 */
function BankAccountsTableTopScrollRail({ gridHostRef, syncKey, darkMode }) {
  const stripRef = useRef(null);
  const railRef = useRef(null);
  const mainElRef = useRef(null);
  const hideTimerRef = useRef(null);
  const dragRef = useRef({
    dragging: false,
    startClientX: 0,
    startScrollLeft: 0,
    railWidth: 0,
    thumbWidth: 0,
    maxScroll: 0,
  });

  const [metrics, setMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const [railWidth, setRailWidth] = useState(0);
  const [railHot, setRailHot] = useState(false);
  const [thumbDragging, setThumbDragging] = useState(false);

  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  const overflow = scrollWidth > clientWidth + 1;
  const maxScroll = Math.max(1, scrollWidth - clientWidth);

  const bumpHot = useCallback(() => {
    setRailHot(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setRailHot(false);
    }, BANK_ACC_HSCROLL_HIDE_MS);
  }, []);

  const readMetrics = useCallback(() => {
    const m = findBankAccountsMainHorizontalScrollEl(gridHostRef.current) || mainElRef.current;
    if (!m) return;
    mainElRef.current = m;
    setMetrics((prev) => {
      const next = {
        scrollLeft: m.scrollLeft,
        scrollWidth: m.scrollWidth,
        clientWidth: m.clientWidth,
      };
      if (
        prev.scrollLeft === next.scrollLeft &&
        prev.scrollWidth === next.scrollWidth &&
        prev.clientWidth === next.clientWidth
      ) {
        return prev;
      }
      return next;
    });
  }, [gridHostRef]);

  useLayoutEffect(() => {
    const root = gridHostRef.current;
    if (!root) return undefined;

    let cancelled = false;
    let rafId = 0;
    let detach = () => {};

    const tryAttach = () => {
      if (cancelled) return;
      const main = findBankAccountsMainHorizontalScrollEl(root);
      if (!main) {
        rafId = window.requestAnimationFrame(tryAttach);
        return;
      }
      mainElRef.current = main;

      let lastMainLeft = main.scrollLeft;
      const onScroll = () => {
        if (main.scrollLeft !== lastMainLeft) {
          lastMainLeft = main.scrollLeft;
          bumpHot();
        }
        readMetrics();
      };

      main.addEventListener("scroll", onScroll, { passive: true });
      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              readMetrics();
            })
          : null;
      if (ro) {
        ro.observe(main);
        const table = root.querySelector("table.MuiTable-root") || root.querySelector("table");
        if (table) ro.observe(table);
      }
      readMetrics();

      detach = () => {
        main.removeEventListener("scroll", onScroll);
        if (ro) ro.disconnect();
      };
    };

    tryAttach();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      detach();
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [gridHostRef, syncKey, bumpHot, readMetrics]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || !overflow) return undefined;
    const ro = new ResizeObserver(() => {
      setRailWidth(rail.clientWidth);
    });
    ro.observe(rail);
    setRailWidth(rail.clientWidth);
    return () => ro.disconnect();
  }, [syncKey, scrollWidth, clientWidth, overflow]);

  const rw = railWidth || railRef.current?.clientWidth || 0;
  const thumbW =
    rw > 0
      ? Math.max(
          BANK_ACC_HSCROLL_THUMB_MIN_PX,
          Math.round((clientWidth / Math.max(scrollWidth, 1)) * rw)
        )
      : BANK_ACC_HSCROLL_THUMB_MIN_PX;
  const thumbMaxLeft = Math.max(0, rw - thumbW);
  const thumbLeft = overflow && rw > 0 ? Math.round((scrollLeft / maxScroll) * thumbMaxLeft) : 0;

  const headerBg = darkMode ? "#202940" : "#ffffff";
  const headerBorder = darkMode ? "rgba(255,255,255,0.08)" : "#e0e0e0";
  const fadeL = darkMode
    ? "linear-gradient(90deg, #202940 0%, rgba(32,41,64,0) 100%)"
    : "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0) 100%)";
  const fadeR = darkMode
    ? "linear-gradient(270deg, #202940 0%, rgba(32,41,64,0) 100%)"
    : "linear-gradient(270deg, #ffffff 0%, rgba(255,255,255,0) 100%)";
  const trackBg = darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.06)";
  const thumbBg = darkMode ? "rgba(255,255,255,0.38)" : "rgba(15, 23, 42, 0.28)";
  const thumbBgHover = darkMode ? "rgba(255,255,255,0.52)" : "rgba(15, 23, 42, 0.42)";

  const applyScrollLeft = (nextLeft, smooth) => {
    const m = mainElRef.current;
    if (!m) return;
    const max = Math.max(0, m.scrollWidth - m.clientWidth);
    const clamped = Math.min(max, Math.max(0, nextLeft));
    if (smooth) m.scrollTo({ left: clamped, behavior: "smooth" });
    else m.scrollLeft = clamped;
    bumpHot();
  };

  const onRailPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-bankacc-hscroll-thumb='1']")) return;
    e.preventDefault();
    const rail = railRef.current;
    const m = mainElRef.current;
    if (!rail || !m || !overflow) return;
    const rect = rail.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const railInnerW = rail.clientWidth;
    const tw = Math.max(
      BANK_ACC_HSCROLL_THUMB_MIN_PX,
      Math.round((m.clientWidth / Math.max(m.scrollWidth, 1)) * railInnerW)
    );
    const tMax = Math.max(0, railInnerW - tw);
    const maxS = Math.max(1, m.scrollWidth - m.clientWidth);
    const targetLeft = Math.min(tMax, Math.max(0, x - tw / 2));
    const nextScroll = (targetLeft / Math.max(1, tMax)) * maxS;
    applyScrollLeft(nextScroll, true);
  };

  const onThumbPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rail = railRef.current;
    const m = mainElRef.current;
    if (!rail || !m || !overflow) return;
    const rwi = rail.clientWidth;
    const tw = Math.max(
      BANK_ACC_HSCROLL_THUMB_MIN_PX,
      Math.round((m.clientWidth / Math.max(m.scrollWidth, 1)) * rwi)
    );
    const maxS = m.scrollWidth - m.clientWidth;
    dragRef.current = {
      dragging: true,
      startClientX: e.clientX,
      startScrollLeft: m.scrollLeft,
      railWidth: rwi,
      thumbWidth: tw,
      maxScroll: Math.max(1, maxS),
    };
    setThumbDragging(true);
    bumpHot();

    const onMove = (ev) => {
      if (!dragRef.current.dragging) return;
      const d = dragRef.current;
      const delta = ev.clientX - d.startClientX;
      const travel = Math.max(1, d.railWidth - d.thumbWidth);
      const next = d.startScrollLeft + (delta / travel) * d.maxScroll;
      applyScrollLeft(next, false);
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      setThumbDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    const fn = (e) => {
      const m = mainElRef.current;
      if (!m || m.scrollWidth <= m.clientWidth + 1) return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      m.scrollLeft += dx * 0.88;
      bumpHot();
      readMetrics();
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [syncKey, bumpHot, readMetrics]);

  if (!overflow && scrollWidth > 0) {
    return (
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          height: 2,
          bgcolor: headerBg,
          borderBottom: `1px solid ${headerBorder}`,
        }}
      />
    );
  }

  if (scrollWidth === 0) {
    return (
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          height: 2,
          bgcolor: headerBg,
          borderBottom: `1px solid ${headerBorder}`,
        }}
      />
    );
  }

  return (
    <Box
      ref={stripRef}
      role="presentation"
      tabIndex={-1}
      onMouseEnter={bumpHot}
      onPointerDownCapture={(e) => {
        if (e.button === 0) e.preventDefault();
      }}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 6,
        flexShrink: 0,
        minHeight: 12,
        display: "flex",
        alignItems: "center",
        px: 0,
        bgcolor: headerBg,
        borderBottom: `1px solid ${headerBorder}`,
        boxSizing: "border-box",
        transition: "opacity 0.35s ease",
        opacity: railHot ? 1 : 0,
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        caretColor: "transparent",
        outline: "none",
        cursor: "default",
        "&:hover": {
          opacity: 1,
          transition: "opacity 0.2s ease",
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 28,
          zIndex: 2,
          pointerEvents: "none",
          background: fadeL,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 28,
          zIndex: 2,
          pointerEvents: "none",
          background: fadeR,
        }}
      />
      <Box
        ref={railRef}
        onPointerDown={onRailPointerDown}
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          mx: 2,
          height: BANK_ACC_HSCROLL_RAIL_H,
          borderRadius: 999,
          bgcolor: trackBg,
          cursor: overflow ? "pointer" : "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          caretColor: "transparent",
        }}
      >
        <Box
          data-bankacc-hscroll-thumb="1"
          onPointerDown={onThumbPointerDown}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            height: BANK_ACC_HSCROLL_RAIL_H,
            width: `${thumbW}px`,
            transform: `translateX(${thumbLeft}px)`,
            borderRadius: 999,
            bgcolor: thumbBg,
            boxShadow: darkMode ? "0 0 0 1px rgba(255,255,255,0.06)" : "0 0 0 1px rgba(0,0,0,0.04)",
            cursor: overflow ? "grab" : "default",
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            caretColor: "transparent",
            transition: thumbDragging
              ? "none"
              : "transform 0.08s ease-out, background-color 0.15s ease, box-shadow 0.15s ease",
            "&:hover": {
              bgcolor: thumbBgHover,
            },
            "&:active": {
              cursor: "grabbing",
            },
          }}
        />
      </Box>
    </Box>
  );
}

BankAccountsTableTopScrollRail.propTypes = {
  gridHostRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  syncKey: PropTypes.string.isRequired,
  darkMode: PropTypes.bool.isRequired,
};

function BranchAddressGridCell({ value }) {
  const text = value != null && String(value).trim() !== "" ? String(value).trim() : "";
  const [anchorEl, setAnchorEl] = useState(null);
  const textRef = useRef(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !text) {
      setTruncated(false);
      return;
    }
    const measure = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  if (!text) return "-";

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.25, maxWidth: "100%" }}>
      <Box
        ref={textRef}
        component="span"
        sx={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          textOverflow: "clip",
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        {text}
      </Box>
      {truncated && (
        <>
          <Box
            component="button"
            type="button"
            aria-label="Show full branch address"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              border: "none",
              background: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              color: "primary.main",
              font: "inherit",
              lineHeight: "inherit",
              flexShrink: 0,
              alignSelf: "flex-end",
            }}
          >
            ...
          </Box>
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            PaperProps={{
              sx: { maxWidth: "min(92vw, 420px)", p: 1.5, boxShadow: 3, bgcolor: "#ffffff" },
            }}
          >
            <MDTypography
              variant="body"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", bgcolor: "black" }}
            >
              {text}
            </MDTypography>
          </Popover>
        </>
      )}
    </Box>
  );
}

BranchAddressGridCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default function BankAccounts() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [racById, setRacById] = useState({});
  const [baseById, setBaseById] = useState({});
  const [bankList, setBankList] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [paginationHost, setPaginationHost] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentsForId, setAttachmentsForId] = useState(null);
  const requestedRacIdsRef = useRef(new Set());
  const requestedBaseIdsRef = useRef(new Set());
  const bankAccountsGridHostRef = useRef(null);
  const [controller] = useMaterialUIController();
  const darkMode = Boolean(controller?.darkMode);

  const toIdKey = (value) => {
    if (value == null) return "";
    const key = String(value).trim();
    return key;
  };

  const getAttachmentPath = (file) =>
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.file_path ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    "";

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, UPLOAD_TABLE_NAME);
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    const normalized = filesArray
      .map((f) => {
        if (typeof f === "string") {
          return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl =
          f?.Path || f?.path || f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || "";
        return { ...f, fileName, downloadUrl };
      })
      .filter((f) => getAttachmentPath(f));
    setAttachmentsFiles(normalized);
  };

  const fetchBankAccounts = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await bankAccountApi.getAll(page, size);
      if (Array.isArray(response)) {
        setTableRows(response);
        setTotalCount(response.length);
        return;
      }
      const data = response?.data ?? [];
      const pagination = response?.pagination;
      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount ?? 0));
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const banks = await fetchBankListsForDropdown().catch(() => []);
        if (!alive) return;
        setBankList(Array.isArray(banks) ? banks : []);
      } catch (error) {
        console.error("Error loading bank account display lists:", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    fetchBankAccounts(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const parseAccRacBase = (res, fallbackId) => {
      const row = Array.isArray(res?.data)
        ? res.data[0]
        : res?.data && typeof res.data === "object"
        ? res.data
        : res && typeof res === "object"
        ? res
        : null;
      if (!row) return null;
      const id = toIdKey(row.id ?? row.Id ?? fallbackId);
      const name = String(row.name ?? row.Name ?? row.value ?? row.Value ?? "").trim();
      if (id === "" || !name) return null;
      return { id, name };
    };
    const racIds = Array.from(
      new Set(
        tableRows
          .map((row) => toIdKey(row?.racId ?? row?.RacId ?? row?.cmdId ?? row?.CmdId))
          .filter((id) => id && !racById[id] && !requestedRacIdsRef.current.has(id))
      )
    );
    const baseIds = Array.from(
      new Set(
        tableRows
          .map((row) => toIdKey(row?.baseId ?? row?.BaseId ?? row?.formationId ?? row?.FormationId))
          .filter((id) => id && !baseById[id] && !requestedBaseIdsRef.current.has(id))
      )
    );
    if (!racIds.length && !baseIds.length) return undefined;
    racIds.forEach((id) => requestedRacIdsRef.current.add(id));
    baseIds.forEach((id) => requestedBaseIdsRef.current.add(id));
    (async () => {
      try {
        const [racResults, baseResults] = await Promise.all([
          Promise.all(racIds.map((id) => api.get("AccRacBase", id).catch(() => null))),
          Promise.all(baseIds.map((id) => api.get("AccRacBase", id).catch(() => null))),
        ]);
        if (cancelled) return;
        if (racResults.length) {
          setRacById((prev) => {
            const next = { ...prev };
            racResults.forEach((res, idx) => {
              const parsed = parseAccRacBase(res, racIds[idx]);
              if (parsed) next[parsed.id] = parsed.name;
            });
            return next;
          });
        }
        if (baseResults.length) {
          setBaseById((prev) => {
            const next = { ...prev };
            baseResults.forEach((res, idx) => {
              const parsed = parseAccRacBase(res, baseIds[idx]);
              if (parsed) next[parsed.id] = parsed.name;
            });
            return next;
          });
        }
      } catch (error) {
        if (!cancelled) console.error("Error loading AccRacBases names:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableRows]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!record) {
      console.error("Record not found for id:", id);
      return;
    }
    setCurrentRecord({
      ...record,
      racId: record?.racId ?? record?.RacId ?? record?.cmdId ?? record?.CmdId ?? "",
      baseId:
        record?.baseId ??
        record?.BaseId ??
        record?.unitId ??
        record?.UnitId ??
        record?.formationId ??
        record?.FormationId ??
        "",
    });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await bankAccountApi.remove(recordToDelete);
      fetchBankAccounts(pageNumber, pageSize);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting bank account:", error);
      window.alert("Failed to delete bank account. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (recordId) => {
    if (!recordId) return;
    setAttachmentsForId(recordId);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      await refreshAttachments(recordId);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsFiles([]);
    setAttachmentsForId(null);
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await bankAccountApi.update(existingId, payload);
      await fetchBankAccounts(pageNumber, pageSize);
      handleCloseForm();
      return { id: existingId, ids: [existingId] };
    }
    const res = await bankAccountApi.create(payload);
    const newId =
      res?.id ||
      res?.Id ||
      res?.data?.id ||
      res?.data?.Id ||
      (Array.isArray(res?.data) && res.data[0] ? res.data[0].id || res.data[0].Id : null);
    await fetchBankAccounts(pageNumber, pageSize);
    handleCloseForm();
    return { id: newId, ids: newId ? [newId] : [] };
  };

  const formatDateDDMMMYYYY = (dateString) => {
    if (!dateString) return "";
    const raw = String(dateString).trim();
    if (!raw) return "";
    const monthShort = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    try {
      const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
      let day = "";
      let month = "";
      let year = "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
        [day, month, year] = datePart.split("-");
      } else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return raw;
        day = String(parsed.getDate()).padStart(2, "0");
        month = String(parsed.getMonth() + 1).padStart(2, "0");
        year = String(parsed.getFullYear());
      }
      const monthIndex = Number(month) - 1;
      const monthText = monthShort[monthIndex] || month;
      return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || column?.accessor || "").toLowerCase();
    if (["openingdate", "signatorydate", "statusdate"].includes(colId)) {
      return formatDateDDMMMYYYY(value);
    }
    return value;
  };

  const txt = (v) => (v != null && String(v).trim() !== "" ? String(v) : "-");

  const renderStatusLabel = (value) => {
    const label = value != null && String(value).trim() !== "" ? String(value).trim() : "-";
    const key = label.toLowerCase();
    const palette =
      key === "active"
        ? { bg: "#d4edda", fg: "#155724" }
        : key === "dormant" || key === "dormat"
        ? { bg: "#fff3cd", fg: "#856404" }
        : key === "closed"
        ? { bg: "#f8d7da", fg: "#721c24" }
        : null;

    if (!palette) return label;
    return (
      <MDBox
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          px: 1,
          py: 0.35,
          borderRadius: "999px",
          minWidth: 76,
          fontWeight: 600,
          backgroundColor: palette.bg,
          color: palette.fg,
        }}
      >
        {label}
      </MDBox>
    );
  };

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        Cell: ({ row }) => row?.original?.attachments,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        Cell: ({ row }) => {
          const s = row?.original?.sno;
          return s != null && s !== "" ? s : "-";
        },
      },
      {
        id: "openingDate",
        Header: "Opening Date",
        accessor: "openingDate",
        align: "left",
        filter: "bankAccountsDateCompare",
        Filter: BankAccountsDateColumnFilter,
        Cell: ({ value, row }) => {
          const v = value || row?.original?.OpeningDate || row?.original?.openingDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "racDisplay",
        Header: "RAC",
        accessor: "racDisplay",
        align: "left",
        Cell: ({ value, row }) => withGridValueChip(txt(value), "rac", { row }),
      },
      {
        id: "baseDisplay",
        Header: "Base",
        accessor: "baseDisplay",
        align: "left",
        Cell: ({ value, row }) => withGridValueChip(txt(value), "base", { row }),
      },
      {
        id: "fundingSource",
        Header: "Funding Source",
        accessor: "fundingSource",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "fundName",
        Header: "Fund Name",
        accessor: "fundName",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "titleOfAccount",
        Header: "Title of Account",
        accessor: "titleOfAccount",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "bankDisplay",
        Header: "Bank Name",
        accessor: "bankDisplay",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "branchCode",
        Header: "Branch Code",
        accessor: "branchCode",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "branchAddress",
        Header: "Branch Address",
        accessor: "branchAddress",
        align: "left",
        Cell: BranchAddressGridCell,
      },
      {
        id: "accountNoIban",
        Header: "Account No (IBAN)",
        accessor: "accountNoIban",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "currency",
        Header: "Currency",
        accessor: "currency",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "accountType",
        Header: "Type",
        accessor: "accountType",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatoryDate",
        Header: "Signatory Date",
        accessor: "signatoryDate",
        align: "left",
        Cell: ({ value, row }) => {
          const v = value || row?.original?.SignatoryDate || row?.original?.signatoryDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "signatory1",
        Header: "Signatory-1",
        accessor: "signatory1",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatory2",
        Header: "Signatory-2",
        accessor: "signatory2",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatory3",
        Header: "Signatory-3",
        accessor: "signatory3",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "left",
        Cell: ({ value, row }) => {
          const s =
            value ??
            row?.original?.AccStatus ??
            row?.original?.accStatus ??
            row?.original?.Status ??
            row?.original?.status;
          return renderStatusLabel(s);
        },
      },
      {
        id: "statusDate",
        Header: "Status Date",
        accessor: "statusDate",
        align: "left",
        Cell: ({ value, row }) => {
          const v = value || row?.original?.StatusDate || row?.original?.statusDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "remarks",
        Header: "Remarks",
        accessor: "remarks",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "authority",
        Header: "Authority",
        accessor: "authority",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "reference",
        Header: "Reference",
        accessor: "reference",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
    ],
    []
  );

  const computedRows = tableRows.map((row, index) => {
    const normalizedId = row?.id ?? row?.Id;
    const sno = (pageNumber - 1) * pageSize + index + 1;
    const racId = row.racId ?? row.RacId ?? row.cmdId ?? row.CmdId;
    const baseId = row.baseId ?? row.BaseId ?? row.unitId ?? row.UnitId;
    const bankId = row.bankId ?? row.BankId;

    const racDisplay =
      String(racById[toIdKey(racId)] || "").trim() ||
      String(row.cmdName ?? row.CmdName ?? "").trim() ||
      (racId != null && racId !== "" ? String(racId) : "-");

    const baseDisplay =
      String(baseById[toIdKey(baseId)] || "").trim() ||
      String(row.baseName ?? row.BaseName ?? "").trim() ||
      (baseId != null && baseId !== "" ? String(baseId) : "-");

    const bankItem = bankList.find((bk) => Number(bk.id) === Number(bankId));
    const bankDisplay =
      row.BankName ??
      row.bankName ??
      bankItem?.label ??
      (bankId != null && bankId !== "" ? String(bankId) : "-");

    const typeVal = row.type ?? row.Type ?? row.accountType ?? row.AccountType ?? "";

    const rawIsAttachment = row?.IsAttachment ?? row?.isAttachment;
    const countValue =
      row?.attachmentCount ??
      row?.attachmentsCount ??
      row?.filesCount ??
      row?.AttachmentCount ??
      row?.AttachmentsCount ??
      row?.FilesCount;
    const hasAttachmentByCount = Number(countValue || 0) > 0;
    const hasAttachmentData =
      rawIsAttachment === true ||
      rawIsAttachment === 1 ||
      rawIsAttachment === "1" ||
      String(rawIsAttachment || "")
        .trim()
        .toLowerCase() === "true" ||
      hasAttachmentByCount;

    return {
      ...row,
      id: normalizedId,
      sno,
      recordId: normalizedId != null && normalizedId !== "" ? String(normalizedId) : "-",
      cmdId: racId,
      racDisplay,
      baseDisplay,
      bankDisplay,
      openingDate: row.openingDate ?? row.OpeningDate ?? "",
      fundingSource: row.fundingSource ?? row.FundingSource ?? "",
      fundName: row.fundName ?? row.FundName ?? "",
      titleOfAccount: row.titleOfAccount ?? row.TitleOfAccount ?? "",
      branchCode: row.branchCode ?? row.BranchCode ?? "",
      branchAddress: row.branchAddress ?? row.BranchAddress ?? "",
      accountNoIban: row.accountNoIban ?? row.AccountNoIban ?? row.IBAN ?? "",
      currency: row.currency ?? row.Currency ?? "",
      accountType: typeVal,
      signatoryDate: row.signatoryDate ?? row.SignatoryDate ?? "",
      signatory1: row.signatory1 ?? row.Signatory1 ?? "",
      signatory2: row.signatory2 ?? row.Signatory2 ?? "",
      signatory3: row.signatory3 ?? row.Signatory3 ?? "",
      status: row.accStatus ?? row.AccStatus ?? row.status ?? row.Status ?? "",
      statusDate: row.statusDate ?? row.StatusDate ?? "",
      remarks: row.remarks ?? row.Remarks ?? "",
      authority: row.authority ?? row.Authority ?? "",
      reference: row.reference ?? row.Reference ?? "",
      attachments: (
        <IconButton
          size="small"
          color={hasAttachmentData ? "success" : "error"}
          onClick={() => handleOpenAttachments(normalizedId)}
          title="View Attachments"
          sx={{ padding: "1px" }}
        >
          <Icon>visibility</Icon>
        </IconButton>
      ),
      actions: (
        <MDBox
          alignItems="left"
          justifyContent="left"
          sx={{
            backgroundColor: "#f8f9fa",
            gap: "2px",
            padding: "2px 2px",
            borderRadius: "2px",
          }}
        >
          {canEditCurrentMenu() && (
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditRecord(normalizedId)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
          )}
          {canDeleteCurrentMenu() && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteRecord(normalizedId)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          )}
        </MDBox>
      ),
    };
  });

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
        page: pageNumber,
        pageSize,
      }),
    [displayTotal, pageNumber, pageSize]
  );

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={pageNumber}
        totalCount={displayTotal}
        pageSize={pageSize}
        onPageChange={setPageNumber}
      />
    ),
    [displayTotal, pageNumber, pageSize]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Inst Bank Accounts"
        subtitle="Manage institutional bank account records"
        metadata={workspaceMetadata}
        tabs={<AccountsModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
          },
          "& .MuiTableContainer-root > .saas-settings-table-scroll": {
            scrollBehavior: "smooth",
            scrollbarWidth: "thin",
            scrollbarColor: darkMode
              ? "rgba(255,255,255,0.24) rgba(255,255,255,0.04)"
              : "rgba(15, 23, 42, 0.28) transparent",
            "&::-webkit-scrollbar": { width: "8px", height: "8px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: darkMode ? "rgba(255,255,255,0.26)" : "rgba(15, 23, 42, 0.3)",
              borderRadius: "100px",
              border: "2px solid transparent",
              backgroundClip: "padding-box",
              "&:hover": {
                backgroundColor: darkMode ? "rgba(255,255,255,0.42)" : "rgba(15, 23, 42, 0.45)",
              },
            },
            "&::-webkit-scrollbar-button": { display: "none", width: 0, height: 0 },
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.875rem !important",
            fontWeight: "700 !important",
            width: "auto !important",
            minWidth: "0 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            width: "auto !important",
            minWidth: "0 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
          },
        }}
      >
        <MDBox
          ref={bankAccountsGridHostRef}
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <BankAccountsTableTopScrollRail
            gridHostRef={bankAccountsGridHostRef}
            syncKey={`${loading}-${tableRows.length}-${pageNumber}-${pageSize}-${totalCount}`}
            darkMode={Boolean(darkMode)}
          />

          <MDBox
            ref={setPaginationHost}
            className="saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
            }}
          />

          <DataTable
            table={{
              columns,
              rows: computedRows,
            }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 20,
              entries: [10, 25, 50, 100, 500, 1000],
            }}
            page={pageNumber - 1}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setPageNumber(newPage + 1);
              fetchBankAccounts(newPage + 1, pageSize);
            }}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageNumber(1);
              fetchBankAccounts(1, value);
            }}
            showTotalEntries={false}
            noEndBorder
            canSearch
            exportFileName="Bank-Accounts"
            exportCellFormatter={exportCellFormatter}
            extraFilterTypes={BANK_ACCOUNTS_DATATABLE_DATE_FILTER_TYPES}
            contentFitTable
            disableHeaderMetrics
            paginationFooter={serverPaginationFooter}
            paginationHost={paginationHost}
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <BankAccountForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        onUploadSuccess={() => {
          fetchBankAccounts(pageNumber, pageSize);
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>Attachments {attachmentsForId ? `(#${attachmentsForId})` : ""}</DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((f, idx) => (
                <MDBox
                  key={`${f.fileName || "file"}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      uploadApi
                        .downloadFile(f, f.fileName || `File-${idx + 1}`)
                        .catch((e) => window.alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {f.fileName || `File ${idx + 1}`}
                  </MDButton>
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              No attachments found for this record.
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments} variant="gradient" color="info">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
