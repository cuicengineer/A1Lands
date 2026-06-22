/**
 * KPI Overview — enterprise analytics dashboard (property-summary API).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CurrencyLoading from "components/CurrencyLoading";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import InputAdornment from "@mui/material/InputAdornment";
import MDTypography from "components/MDTypography";
import DashboardPageShell from "layouts/dashboard/components/DashboardPageShell";
import DashboardKpiCard from "components/DashboardKpiCard";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import { CHART_PRIMARY, CHART_SECONDARY } from "utils/executiveChartConfigs";
import { mergeKpiCardSx } from "utils/kpiCardSx";
import { useMaterialUIController } from "context";
import api from "services/api.service";
import "assets/css/all.min.css";

import KpiCharts, { getEnterpriseCardSx } from "./components/KpiCharts";
import ChartExportButton from "./components/ChartExportButton";
import FiscalKpiGrid from "./components/FiscalKpiGrid";
import { exportSingleSeriesBarChartToExcel } from "utils/kpiChartExcelExport";
import propertyGroupingApi from "services/api.propertygrouping.service";
import {
  buildAssetCards,
  buildGroupedAssetCards,
  buildAhqApproval,
  buildContractHealth,
  buildContractStatus,
  buildExecutiveKpis,
  buildFinancialShares,
  buildOutstandingRentsStickers,
  buildFiscalKpiGridRows,
  buildKpiCommandFinancialBarChart,
  extractContractsSummaryRows,
  extractGovtPafShareRows,
  extractPropertyGroupSummaryRows,
  extractPropertySummaryRows,
  filterKpiRowsByRacBase,
  formatKpiMoneyLabel,
  getFiscalYearPeriods,
} from "./kpiDataUtils";
import { getBaseDropdownLabel } from "./kpiOverviewNavigation";
function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return (
    <MDBox className="erp-kpi-tab-panel" pt={2} sx={{ width: "100%" }}>
      {children}
    </MDBox>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
};

function KpiHomeSection({ title, children }) {
  return (
    <MDBox className="erp-kpi-home-section" mb={1}>
      <p className="erp-dashboard-section-title">{title}</p>
      {children}
    </MDBox>
  );
}

KpiHomeSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

const DEFAULT_MIL = {
  incomePA: 0,
  govt: 0,
  paf: 0,
  ahq: 0,
  rac: 0,
  base: 0,
};

const SHARE_MIL_ROWS = [
  { key: "govt", label: "Govt" },
  { key: "paf", label: "PAF" },
  { key: "ahq", label: "AHQ" },
  { key: "rac", label: "RAC" },
  { key: "base", label: "Base" },
];

const TENURE_OPTIONS = [
  { value: "Annual", label: "Annual" },
  { value: "Biannual", label: "Six Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Monthly", label: "Monthly" },
];
const KPI_FILTER_ALL_VALUE = "__all__";

const KPI_DATE_FILTER_WIDTH = "9.5rem";

const KPI_HEADER_FILTER_INPUT_SX = {
  "& .MuiInputBase-root": {
    minHeight: 32,
    maxHeight: 32,
    fontSize: "0.8125rem",
    borderRadius: "8px",
  },
  "& .MuiInputLabel-root": {
    fontSize: "0.8125rem",
  },
  "& .MuiSelect-select": {
    fontSize: "0.8125rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    py: 0.5,
    display: "flex",
    alignItems: "center",
  },
};

function estimateKpiFilterWidth(labels, { minRem = 9.5, maxRem = 18 } = {}) {
  if (!Array.isArray(labels) || labels.length === 0) return `${minRem}rem`;
  const longest = labels.reduce((max, label) => {
    const text = String(label || "").trim();
    return text.length > max.length ? text : max;
  }, "");
  const rem = Math.min(maxRem, Math.max(minRem, 4.25 + longest.length * 0.42));
  return `${rem}rem`;
}

function buildKpiFilterControlSx(widthRem) {
  return {
    flexShrink: 0,
    width: { xs: "100%", sm: widthRem },
    minWidth: { xs: "100%", sm: widthRem },
    ...KPI_HEADER_FILTER_INPUT_SX,
  };
}

/** Above MUI AppBar (~1100); header strip and menus share this stack. */
const KPI_HEADER_Z_INDEX = 1200;

const KPI_FILTER_MENU_PAPER_SX = {
  width: "max-content",
  minWidth: KPI_DATE_FILTER_WIDTH,
  maxWidth: "min(20rem, 92vw)",
  "& .MuiMenuItem-root": {
    minHeight: 32,
    py: 0.5,
    px: 1.25,
    fontSize: "0.8125rem",
    alignItems: "flex-start",
    whiteSpace: "normal",
  },
  "& .MuiListItemText-primary": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: 1.35,
  },
};

const KPI_FILTER_SELECT_MENU_PROPS = {
  MenuProps: {
    sx: { zIndex: KPI_HEADER_Z_INDEX + 1 },
    PaperProps: {
      sx: KPI_FILTER_MENU_PAPER_SX,
    },
  },
};

const KPI_COMPACT_MULTI_SELECT_MENU_PROPS = KPI_FILTER_SELECT_MENU_PROPS;

const KPI_COMPACT_CHECKBOX_SX = { p: 0.35, mr: 0.5, mt: 0.15 };
const KPI_COMPACT_LIST_TEXT_PROPS = {
  primaryTypographyProps: {
    fontSize: "0.8125rem",
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: 1.35,
  },
};

function getTodayDateInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toKpiDisplayDate(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return "";
  const trimmed = isoDateStr.trim();
  if (!trimmed) return "";
  try {
    const d = parseISO(trimmed);
    return isValid(d) ? format(d, "dd-MMM-yyyy") : trimmed;
  } catch {
    return trimmed;
  }
}

function openKpiDatePicker(ref) {
  const el = ref?.current;
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  } catch (_) {
    try {
      el.click();
    } catch (_e) {
      // ignore
    }
  }
}

function toKpiFilterId(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function getKpiOptionName(option) {
  return String(
    option?.name ??
      option?.Name ??
      option?.cmdName ??
      option?.CmdName ??
      option?.baseName ??
      option?.BaseName ??
      ""
  ).trim();
}

const EXTRA_ASSET_CARD_COLORS = [
  "info",
  "primary",
  "success",
  "warning",
  "error",
  "secondary",
  "dark",
];
const EXTRA_ASSET_CARD_ICONS = [
  "category",
  "layers",
  "apartment",
  "business",
  "domain",
  "inventory_2",
  "square_foot",
];

function getExtraAssetCardColor(classId) {
  const n = Number(classId);
  if (!Number.isFinite(n)) return "info";
  return EXTRA_ASSET_CARD_COLORS[Math.abs(n) % EXTRA_ASSET_CARD_COLORS.length];
}

function getExtraAssetCardIcon(classId) {
  const n = Number(classId);
  if (!Number.isFinite(n)) return "category";
  return EXTRA_ASSET_CARD_ICONS[Math.abs(n) % EXTRA_ASSET_CARD_ICONS.length];
}

function resolveAssetCardColor(card) {
  if (card.key === "total") return "dark";
  if (card.isExtraClass) return getExtraAssetCardColor(card.classId);
  const map = {
    lands: "info",
    categoryA: "primary",
    categoryB: "success",
    categoryC: "warning",
    bts: "error",
    hb: "dark",
  };
  return map[card.key] || "info";
}

function resolveAssetCardIcon(card) {
  if (card.key === "total") return "dashboard";
  if (card.isExtraClass) return getExtraAssetCardIcon(card.classId);
  const map = {
    lands: "dashboard",
    categoryA: "category",
    categoryB: "category",
    categoryC: "category",
    bts: "signal_cellular_alt",
    hb: "home",
  };
  return map[card.key] || "dashboard";
}

const ASSET_CARDS_VISIBLE_COUNT = 6;
const ASSET_CARD_GAP_PX = 12;
const ASSET_CARD_SLOT_WIDTH = `calc((100% - ${
  (ASSET_CARDS_VISIBLE_COUNT - 1) * ASSET_CARD_GAP_PX
}px) / ${ASSET_CARDS_VISIBLE_COUNT})`;

const ASSET_CARD_CORNER_ICONS = {
  categoryA: `${process.env.PUBLIC_URL || ""}/login_page/assets/img/icons/Cat%20A.png`,
  categoryB: `${process.env.PUBLIC_URL || ""}/login_page/assets/img/icons/Cat%20B.png`,
  categoryC: `${process.env.PUBLIC_URL || ""}/login_page/assets/img/icons/Cat%20C.png`,
  bts: `${process.env.PUBLIC_URL || ""}/login_page/assets/img/icons/BTS.png`,
  hb: `${process.env.PUBLIC_URL || ""}/login_page/assets/img/icons/HB.png`,
};

const ASSET_CARD_STICKER_KEYWORDS = {
  total: "Total Properties",
  categoryA: "Cat A",
  categoryB: "Cat B",
  categoryC: "Cat C",
  bts: "BTS",
  hb: "HB",
};

const ASSET_CORNER_BADGE_ICON_SIZE = 48;
/** ~25% of badge height — overlaps top border only, stays clear of neighboring cards */
const ASSET_CORNER_BADGE_TOP_OFFSET = -12;
const ASSET_CORNER_BADGE_RIGHT_INSET = 8;

function AssetCardCornerBadge({ src, keyword, compact = false }) {
  if (compact && keyword) {
    return (
      <MDBox
        className="erp-asset-card-corner-badge erp-asset-card-corner-badge--keyword"
        aria-label={keyword}
        sx={{
          position: "absolute",
          top: ASSET_CORNER_BADGE_TOP_OFFSET,
          right: ASSET_CORNER_BADGE_RIGHT_INSET,
          minWidth: 48,
          height: 28,
          px: 1,
          borderRadius: "8px",
          bgcolor: "#c8c6c0",
          border: "1px solid #dce6e7",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <MDBox
          component="span"
          className="erp-asset-card-corner-badge__keyword"
          sx={{
            fontSize: "11px",
            fontWeight: 700,
            lineHeight: 1,
            color: "#111827",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}
        >
          {keyword}
        </MDBox>
      </MDBox>
    );
  }

  return (
    <MDBox
      className="erp-asset-card-corner-badge erp-asset-card-corner-badge--icon"
      aria-hidden
      sx={{
        position: "absolute",
        top: ASSET_CORNER_BADGE_TOP_OFFSET,
        right: ASSET_CORNER_BADGE_RIGHT_INSET,
        width: ASSET_CORNER_BADGE_ICON_SIZE,
        height: ASSET_CORNER_BADGE_ICON_SIZE,
        bgcolor: "transparent",
        border: "none",
        boxShadow: "none",
        borderRadius: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <MDBox
        component="img"
        src={src}
        alt=""
        aria-hidden
        sx={{
          width: ASSET_CORNER_BADGE_ICON_SIZE,
          height: ASSET_CORNER_BADGE_ICON_SIZE,
          objectFit: "contain",
          display: "block",
        }}
      />
    </MDBox>
  );
}

AssetCardCornerBadge.propTypes = {
  src: PropTypes.string,
  keyword: PropTypes.string,
  compact: PropTypes.bool,
};

AssetCardCornerBadge.defaultProps = {
  src: undefined,
  keyword: undefined,
  compact: false,
};

function AssetCardsScroller({ cards, loading, darkMode, cardSx, onCardClick, compact = false }) {
  const scrollRef = useRef(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollBack(false);
      setCanScrollForward(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollBack(el.scrollLeft > 4);
    setCanScrollForward(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [cards, loading, updateScrollState]);

  const getScrollStep = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 0;
    const firstCard = el.querySelector("[data-asset-card]");
    return firstCard
      ? firstCard.getBoundingClientRect().width + ASSET_CARD_GAP_PX
      : el.clientWidth / ASSET_CARDS_VISIBLE_COUNT;
  }, []);

  const scrollNext = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = getScrollStep();
    if (step > 0) el.scrollBy({ left: step, behavior: "smooth" });
  }, [getScrollStep]);

  const scrollPrev = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = getScrollStep();
    if (step > 0) el.scrollBy({ left: -step, behavior: "smooth" });
  }, [getScrollStep]);

  const showScrollArrow = canScrollBack || canScrollForward;
  const useLeftArrow = !canScrollForward && canScrollBack;

  return (
    <MDBox
      className={["erp-asset-cards-scroller", compact ? "erp-asset-cards-scroller--compact" : ""]
        .filter(Boolean)
        .join(" ")}
      display="flex"
      alignItems="stretch"
      gap={0.5}
      sx={{ overflow: "visible", flex: 1, minWidth: 0 }}
    >
      <MDBox
        ref={scrollRef}
        className={["erp-asset-cards-track", compact ? "erp-asset-cards-track--compact" : ""]
          .filter(Boolean)
          .join(" ")}
        sx={{
          display: "flex",
          gap: `${ASSET_CARD_GAP_PX}px`,
          flex: 1,
          minWidth: 0,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": {
            display: "none",
            width: 0,
            height: 0,
          },
        }}
      >
        {cards.map((a, cardIndex) => (
          <MDBox
            key={a.key}
            data-asset-card
            sx={{
              flex: `0 0 ${ASSET_CARD_SLOT_WIDTH}`,
              width: ASSET_CARD_SLOT_WIDTH,
              maxWidth: ASSET_CARD_SLOT_WIDTH,
              minWidth: 0,
              boxSizing: "border-box",
              position: "relative",
              overflow: "visible",
            }}
          >
            <AssetCard
              label={a.label}
              count={a.count}
              areaLine={a.areaLine}
              showArea={a.key !== "total"}
              mil={a.mil}
              cardSx={cardSx}
              primary={cardIndex === 0}
              compact={compact}
              onClick={onCardClick ? () => onCardClick(a) : undefined}
            />
            {compact && ASSET_CARD_STICKER_KEYWORDS[a.key] ? (
              <AssetCardCornerBadge keyword={ASSET_CARD_STICKER_KEYWORDS[a.key]} compact />
            ) : ASSET_CARD_CORNER_ICONS[a.key] ? (
              <AssetCardCornerBadge src={ASSET_CARD_CORNER_ICONS[a.key]} />
            ) : null}
          </MDBox>
        ))}
      </MDBox>
      {showScrollArrow && (
        <IconButton
          size="small"
          onClick={useLeftArrow ? scrollPrev : scrollNext}
          aria-label={
            useLeftArrow ? "Scroll to previous asset cards" : "Scroll to next asset cards"
          }
          sx={{ alignSelf: "center", flexShrink: 0, ml: 0.25 }}
        >
          <Icon>{useLeftArrow ? "chevron_left" : "chevron_right"}</Icon>
        </IconButton>
      )}
    </MDBox>
  );
}

AssetCardsScroller.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  darkMode: PropTypes.bool.isRequired,
  cardSx: PropTypes.object.isRequired,
  onCardClick: PropTypes.func,
  compact: PropTypes.bool,
};

AssetCardsScroller.defaultProps = {
  compact: false,
};

function AssetCard({
  label,
  count,
  areaLine,
  showArea = true,
  mil,
  cardSx,
  primary,
  compact = false,
  onClick,
}) {
  const displayCount = Number(count) || 0;
  const hasCount = displayCount > 0;
  const m = hasCount && mil && typeof mil === "object" ? { ...DEFAULT_MIL, ...mil } : DEFAULT_MIL;
  const displayAreaLine = hasCount ? areaLine : "—";

  return (
    <MDBox
      className={[
        "erp-kpi-card",
        "erp-kpi-card--asset",
        compact ? "erp-kpi-card--asset-compact" : "",
        primary ? "erp-kpi-card--primary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      sx={mergeKpiCardSx(cardSx, {
        primary,
        onClick: Boolean(onClick),
      })}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {!compact && <p className="erp-kpi-card__label">{label}</p>}
      <div className="erp-kpi-card__metric">{displayCount.toLocaleString()}</div>
      {showArea && <p className="erp-kpi-card__trend">Area: {displayAreaLine}</p>}
      {!compact && (
        <div className="erp-kpi-card__details">
          <MDBox
            className="erp-kpi-card__stat-row erp-kpi-card__stat-row--income"
            display="flex"
            justifyContent="space-between"
            alignItems="baseline"
            gap={0.5}
          >
            <span>Income</span>
            <span className="erp-kpi-card__detail-value">
              {formatKpiMoneyLabel(m.incomePA, { fixedDecimals: 2 })}
            </span>
          </MDBox>
          {SHARE_MIL_ROWS.map((row) => (
            <MDBox
              key={row.key}
              className={[
                "erp-kpi-card__stat-row",
                row.key === "paf" && "erp-kpi-card__stat-row--after-paf",
              ]
                .filter(Boolean)
                .join(" ")}
              display="flex"
              justifyContent="space-between"
              alignItems="baseline"
              gap={0.5}
            >
              <span>{row.label}</span>
              <span className="erp-kpi-card__detail-value">
                {formatKpiMoneyLabel(m[row.key], { fixedDecimals: 2 })}
              </span>
            </MDBox>
          ))}
        </div>
      )}
    </MDBox>
  );
}

AssetCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  areaLine: PropTypes.string.isRequired,
  showArea: PropTypes.bool,
  mil: PropTypes.shape({
    incomePA: PropTypes.number,
    govt: PropTypes.number,
    paf: PropTypes.number,
    ahq: PropTypes.number,
    rac: PropTypes.number,
    base: PropTypes.number,
  }),
  cardSx: PropTypes.object.isRequired,
  primary: PropTypes.bool,
  compact: PropTypes.bool,
  onClick: PropTypes.func,
};

AssetCard.defaultProps = {
  mil: DEFAULT_MIL,
  primary: false,
  compact: false,
  onClick: undefined,
};

function ContractHealthCard({ label, count, pct, worth, cardSx, primary, onClick }) {
  return (
    <MDBox
      className={["erp-kpi-card", "erp-status-card", primary ? "erp-kpi-card--primary" : ""]
        .filter(Boolean)
        .join(" ")}
      sx={mergeKpiCardSx(cardSx, { primary, onClick: Boolean(onClick), minHeight: 140 })}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      <p className="erp-kpi-card__label">{label}</p>
      <div className="erp-kpi-card__metric">{count.toLocaleString()}</div>
      <p className="erp-kpi-card__trend">{pct}%</p>
      <p className="erp-kpi-card__trend">Worth: {formatKpiMoneyLabel(worth)}</p>
    </MDBox>
  );
}

ContractHealthCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  pct: PropTypes.number.isRequired,
  worth: PropTypes.number,
  cardSx: PropTypes.object.isRequired,
  primary: PropTypes.bool,
  onClick: PropTypes.func,
};

ContractHealthCard.defaultProps = {
  primary: false,
  onClick: undefined,
};

function KpiOverview({ embedded = false, onShellProps }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [propertyRows, setPropertyRows] = useState([]);
  const [propertyGroupSummaryRows, setPropertyGroupSummaryRows] = useState([]);
  const [propertyGroups, setPropertyGroups] = useState([]);
  const [contractRows, setContractRows] = useState([]);
  const [shareRows, setShareRows] = useState([]);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(true);
  const [racIds, setRacIds] = useState([]);
  const [baseIds, setBaseIds] = useState([]);
  const [asOfDate, setAsOfDate] = useState(getTodayDateInputValue);
  const [tenure, setTenure] = useState("Annual");
  const [racOptions, setRacOptions] = useState([]);
  const [allBases, setAllBases] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [loadingRacOptions, setLoadingRacOptions] = useState(false);
  const [loadingBaseOptions, setLoadingBaseOptions] = useState(false);
  const [financialZoomChart, setFinancialZoomChart] = useState(null);
  const asOfDateInputRef = useRef(null);

  const fiscalPeriods = useMemo(() => getFiscalYearPeriods(6), []);
  const cardSx = useMemo(() => getEnterpriseCardSx(), []);
  const closeFinancialZoom = useCallback(() => setFinancialZoomChart(null), []);

  const racFilterWidth = useMemo(
    () => estimateKpiFilterWidth(["All", "RAC", ...racOptions.map(getKpiOptionName)]),
    [racOptions]
  );
  const baseFilterWidth = useMemo(
    () => estimateKpiFilterWidth(["All", "Base", ...baseOptions.map(getBaseDropdownLabel)]),
    [baseOptions]
  );
  const tenureFilterWidth = useMemo(
    () => estimateKpiFilterWidth(["Tenure", ...TENURE_OPTIONS.map((option) => option.label)]),
    []
  );
  const racFilterControlSx = useMemo(
    () => buildKpiFilterControlSx(racFilterWidth),
    [racFilterWidth]
  );
  const baseFilterControlSx = useMemo(
    () => buildKpiFilterControlSx(baseFilterWidth),
    [baseFilterWidth]
  );
  const tenureFilterControlSx = useMemo(
    () => buildKpiFilterControlSx(tenureFilterWidth),
    [tenureFilterWidth]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summaryData, groups] = await Promise.all([
          api.request("GET", "/api/Dashboards/property-summary"),
          propertyGroupingApi.getAllRecords(),
        ]);
        if (!cancelled) {
          setPropertyRows(extractPropertySummaryRows(summaryData));
          setPropertyGroupSummaryRows(extractPropertyGroupSummaryRows(summaryData));
          setContractRows(extractContractsSummaryRows(summaryData));
          setShareRows(extractGovtPafShareRows(summaryData));
          setPropertyGroups(Array.isArray(groups) ? groups : []);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRacOptions(true);
      try {
        const response = await api.list("command");
        if (!cancelled) {
          setRacOptions(Array.isArray(response) ? response : []);
        }
      } catch (e) {
        if (!cancelled) console.error("KPI Overview command list:", e);
      } finally {
        if (!cancelled) setLoadingRacOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBaseOptions(true);
      try {
        const response = await api.list("base");
        if (!cancelled) {
          setAllBases(Array.isArray(response) ? response : []);
        }
      } catch (e) {
        if (!cancelled) console.error("KPI Overview base list:", e);
      } finally {
        if (!cancelled) setLoadingBaseOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedRacs = new Set((racIds || []).map(String));
    const filtered =
      selectedRacs.size > 0
        ? allBases.filter((base) => selectedRacs.has(String(base.cmd ?? base.CmdId ?? base.cmdId)))
        : allBases;
    setBaseOptions(filtered);
    setBaseIds((prev) => {
      const validIds = new Set(filtered.map((b) => String(b.id ?? b.Id)));
      return (prev || []).filter((id) => validIds.has(String(id)));
    });
  }, [racIds, allBases]);

  const handleRacChange = useCallback((event) => {
    const value = Array.isArray(event.target.value) ? event.target.value : [];
    setRacIds(value.includes(KPI_FILTER_ALL_VALUE) ? [] : value.map(String));
    setBaseIds([]);
  }, []);

  const handleBaseChange = useCallback((event) => {
    const value = Array.isArray(event.target.value) ? event.target.value : [];
    setBaseIds(value.includes(KPI_FILTER_ALL_VALUE) ? [] : value.map(String));
  }, []);

  const racId = racIds.length === 1 ? racIds[0] : "";
  const baseId = baseIds.length === 1 ? baseIds[0] : "";

  const filteredPropertyRows = useMemo(
    () => filterKpiRowsByRacBase(propertyRows, racIds, baseIds),
    [propertyRows, racIds, baseIds]
  );
  const filteredContractRows = useMemo(
    () => filterKpiRowsByRacBase(contractRows, racIds, baseIds),
    [contractRows, racIds, baseIds]
  );
  const filteredShareRows = useMemo(
    () => filterKpiRowsByRacBase(shareRows, racIds, baseIds),
    [shareRows, racIds, baseIds]
  );

  const executive = useMemo(
    () => buildExecutiveKpis(filteredPropertyRows, filteredContractRows, filteredShareRows),
    [filteredPropertyRows, filteredContractRows, filteredShareRows]
  );
  const assetCards = useMemo(
    () => buildAssetCards(filteredPropertyRows, filteredShareRows, filteredContractRows),
    [filteredPropertyRows, filteredShareRows, filteredContractRows]
  );
  const groupedAssetCards = useMemo(
    () =>
      buildGroupedAssetCards(filteredPropertyRows, filteredShareRows, filteredContractRows, {
        propertyGroupSummaryRows,
        propertyGroups,
        racIds,
        baseIds,
      }),
    [
      filteredPropertyRows,
      filteredShareRows,
      filteredContractRows,
      propertyGroupSummaryRows,
      propertyGroups,
      racIds,
      baseIds,
    ]
  );
  const health = useMemo(() => buildContractHealth(filteredContractRows), [filteredContractRows]);
  const contractStatus = useMemo(
    () => buildContractStatus(filteredContractRows),
    [filteredContractRows]
  );
  const ahqApproval = useMemo(() => buildAhqApproval(filteredContractRows), [filteredContractRows]);
  const shares = useMemo(
    () => buildFinancialShares(filteredShareRows, "all", filteredContractRows),
    [filteredShareRows, filteredContractRows]
  );
  const financialShareStickersRow = useMemo(
    () => (
      <Grid container spacing={1.5} mt={1} className="erp-kpi-financial-share-stickers">
        {shares.map((s) => (
          <Grid item xs={6} sm={4} md={2.4} key={s.id}>
            <Card sx={{ ...cardSx, p: 1.5, textAlign: "center" }}>
              <MDTypography variant="caption" color="text">
                {s.label}
              </MDTypography>
              <MDTypography variant="h5" fontWeight="bold" color={darkMode ? "white" : "dark"}>
                {s.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </MDTypography>
            </Card>
          </Grid>
        ))}
      </Grid>
    ),
    [shares, cardSx, darkMode]
  );
  const outstandingRentsStickers = useMemo(
    () => buildOutstandingRentsStickers(filteredPropertyRows),
    [filteredPropertyRows]
  );
  const outstandingRentsStickersRow = useMemo(
    () => (
      <>
        <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
          Outstanding Rents
        </p>
        <Grid container spacing={1.5} className="erp-kpi-outstanding-rents-stickers">
          {outstandingRentsStickers.map((s) => (
            <Grid item xs={6} sm={4} md={2.4} key={s.id}>
              <Card sx={{ ...cardSx, p: 1.5, textAlign: "center" }}>
                <MDTypography
                  variant="caption"
                  fontWeight="bold"
                  color={darkMode ? "white" : "dark"}
                >
                  {s.label}
                </MDTypography>
                <MDTypography variant="h5" fontWeight="bold" color={darkMode ? "white" : "dark"}>
                  {formatKpiMoneyLabel(s.value)}
                </MDTypography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </>
    ),
    [outstandingRentsStickers, cardSx, darkMode]
  );
  const fiscalRows = useMemo(
    () =>
      buildFiscalKpiGridRows(
        filteredPropertyRows,
        filteredContractRows,
        filteredShareRows,
        fiscalPeriods
      ),
    [filteredPropertyRows, filteredContractRows, filteredShareRows, fiscalPeriods]
  );

  const healthTotal =
    health.active.count +
      health.premature.count +
      health.expiring.count +
      health.terminated.count +
      health.vacant.count || 1;

  const healthCards = useMemo(() => {
    const items = [
      { key: "active", label: "Valid", color: "success", ...health.active },
      { key: "premature", label: "Premature", color: "info", ...health.premature },
      { key: "expiring", label: "Expiring", color: "warning", ...health.expiring },
      { key: "terminated", label: "Terminated", color: "error", ...health.terminated },
      { key: "vacant", label: "Expired", color: "dark", ...health.vacant },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / healthTotal) * 100);
      return { ...item, pct };
    });
  }, [health, healthTotal]);

  const contractStatusTotal =
    contractStatus.viable.count +
      contractStatus.unviable.count +
      contractStatus.active.count +
      contractStatus.inactive.count || 1;

  const contractStatusCards = useMemo(() => {
    const items = [
      { key: "viable", label: "Viable", color: "success", ...contractStatus.viable },
      { key: "unviable", label: "Unviable", color: "error", ...contractStatus.unviable },
      { key: "active", label: "Active", color: "info", ...contractStatus.active },
      { key: "inactive", label: "Inactive", color: "dark", ...contractStatus.inactive },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / contractStatusTotal) * 100);
      return { ...item, pct };
    });
  }, [contractStatus, contractStatusTotal]);

  const ahqApprovalTotal = ahqApproval.approved.count + ahqApproval.pending.count || 1;

  const ahqApprovalCards = useMemo(() => {
    const items = [
      { key: "approved", label: "Approved", color: "success", ...ahqApproval.approved },
      { key: "pending", label: "Pending", color: "warning", ...ahqApproval.pending },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / ahqApprovalTotal) * 100);
      return { ...item, pct };
    });
  }, [ahqApproval, ahqApprovalTotal]);

  /** Align with dashboard/summary contract status row icons */
  const contractHealthIcons = {
    active: "check_circle",
    premature: "schedule",
    expiring: "schedule",
    terminated: "close",
    vacant: "warning",
  };

  const contractStatusIcons = {
    viable: "check_circle",
    unviable: "close",
    active: "check_circle",
    inactive: "schedule",
  };

  const ahqApprovalIcons = {
    approved: "check_circle",
    pending: "schedule",
  };

  const handleTabChange = useCallback((_, v) => setTab(v), []);

  const overviewContent = (
    <>
      {loading ? (
        <MDBox
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={260}
          width="100%"
        >
          <CurrencyLoading size={56} />
        </MDBox>
      ) : (
        <MDBox className="erp-asset-cards-stack">
          <AssetCardsScroller
            cards={groupedAssetCards}
            loading={loading}
            darkMode={darkMode}
            cardSx={cardSx}
          />
          <AssetCardsScroller
            cards={assetCards}
            loading={loading}
            darkMode={darkMode}
            cardSx={cardSx}
            compact
          />
        </MDBox>
      )}

      <MDBox mt={1}>
        <KpiCharts
          shareRows={shareRows}
          contractRows={contractRows}
          propertyRows={propertyRows}
          racOptions={racOptions}
          racIds={racIds}
          assetCards={assetCards}
          loading={loading}
          chartZoomOnClick
        />
      </MDBox>
    </>
  );

  const contractsSectionContent = (
    <>
      <p className="erp-dashboard-section-title">Contract Health</p>
      <Grid container spacing={1} className="erp-dashboard-kpi-grid">
        {healthCards.map((h, index) => (
          <Grid item xs={12} sm={6} md={2.4} key={h.key}>
            <ContractHealthCard
              label={h.label}
              count={h.count}
              pct={h.pct}
              worth={h.worth}
              cardSx={cardSx}
              primary={index === 0}
            />
          </Grid>
        ))}
      </Grid>

      <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
        Contract Status
      </p>
      <Grid container spacing={1} className="erp-dashboard-kpi-grid">
        {contractStatusCards.map((s, index) => (
          <Grid item xs={12} sm={6} md={3} key={s.key}>
            <ContractHealthCard
              label={s.label}
              count={s.count}
              pct={s.pct}
              worth={s.worth}
              cardSx={cardSx}
              primary={index === 0}
            />
          </Grid>
        ))}
      </Grid>

      <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
        AHQ Approval
      </p>
      <Grid container spacing={1} className="erp-dashboard-kpi-grid">
        {ahqApprovalCards.map((a, index) => (
          <Grid item xs={12} sm={6} md={3} key={a.key}>
            <ContractHealthCard
              label={a.label}
              count={a.count}
              pct={a.pct}
              worth={a.worth}
              cardSx={cardSx}
              primary={index === 0}
            />
          </Grid>
        ))}
      </Grid>

      {outstandingRentsStickersRow}
    </>
  );

  const pafAnnualRentChart = useMemo(() => {
    const chart = buildKpiCommandFinancialBarChart({
      shareRows: filteredShareRows,
      propertyRows: filteredPropertyRows,
      racOptions,
      baseOptions,
      racIds,
      baseIds,
      usePropertyFallback: true,
    });
    return {
      labels: chart.labels,
      datasets: { label: "Annual Rent", data: chart.data },
    };
  }, [filteredShareRows, filteredPropertyRows, racOptions, baseOptions, racIds, baseIds]);

  const govtShareChart = useMemo(() => {
    const chart = buildKpiCommandFinancialBarChart({
      shareRows: filteredShareRows,
      propertyRows: filteredPropertyRows,
      racOptions,
      baseOptions,
      racIds,
      baseIds,
      shareFieldKeys: ["GovtShare", "govtShare", "GovtShare_Million", "govtShare_Million"],
      usePropertyFallback: false,
    });
    return {
      labels: chart.labels,
      datasets: { label: "Govt Share", data: chart.data },
    };
  }, [filteredShareRows, filteredPropertyRows, racOptions, baseOptions, racIds, baseIds]);

  const financialZoomConfig = useMemo(() => {
    const configs = {
      pafAnnualRent: {
        color: "info",
        title: "PAF Annual Rent",
        description: "As per selected RAC / Base",
        chart: pafAnnualRentChart,
      },
      govtShare: {
        color: "dark",
        title: "Govt Share",
        description: "As per selected RAC / Base",
        chart: govtShareChart,
      },
    };
    return configs[financialZoomChart] || null;
  }, [financialZoomChart, pafAnnualRentChart, govtShareChart]);

  const renderZoomableFinancialBarChart = ({ zoomKey, color, title, description, chart }) => (
    <Card sx={{ ...cardSx, p: 2, height: "100%" }}>
      <MDBox display="flex" alignItems="flex-start" justifyContent="space-between" gap={0.5} mb={1}>
        <MDBox minWidth={0}>
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {title}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {description}
          </MDTypography>
        </MDBox>
        <ChartExportButton
          disabled={loading}
          ariaLabel={`Export ${title} to Excel`}
          onExport={() => exportSingleSeriesBarChartToExcel(title, chart)}
        />
      </MDBox>
      <MDBox
        role="button"
        tabIndex={loading ? -1 : 0}
        onClick={() => {
          if (!loading) setFinancialZoomChart(zoomKey);
        }}
        onKeyDown={(e) => {
          if (!loading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setFinancialZoomChart(zoomKey);
          }
        }}
        sx={{
          height: "100%",
          cursor: loading ? "default" : "zoom-in",
          borderRadius: 2,
          position: "relative",
          outline: "none",
          "&:focus-visible": {
            boxShadow: (theme) => `0 0 0 2px ${theme.palette.info.main}`,
          },
          "&:hover .kpi-financial-chart-zoom-hint": {
            opacity: loading ? 0 : 1,
          },
        }}
        aria-label={`Click to enlarge ${title} chart`}
      >
        <ReportsBarChart
          flat
          wideBars
          seriesColor={color === "dark" ? CHART_SECONDARY : CHART_PRIMARY}
          title={title}
          description={description}
          date="Updated just now"
          chart={chart}
          chartHeight="220px"
        />
        <MDBox
          className="kpi-financial-chart-zoom-hint"
          display="flex"
          alignItems="center"
          gap={0.25}
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            opacity: 0,
            transition: "opacity 0.2s ease",
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)",
            boxShadow: 1,
            pointerEvents: "none",
          }}
        >
          <Icon sx={{ fontSize: "1rem", color: "info.main" }}>zoom_in</Icon>
          <MDTypography variant="caption" color="text" sx={{ lineHeight: 1.2 }}>
            Click to enlarge
          </MDTypography>
        </MDBox>
      </MDBox>
    </Card>
  );

  const financialsSectionContent = (
    <>
      <Grid container spacing={1} mb={2}>
        <Grid item xs={12} md={6}>
          {renderZoomableFinancialBarChart({
            zoomKey: "pafAnnualRent",
            color: "info",
            title: "PAF Annual Rent",
            description: "As per selected RAC / Base",
            chart: pafAnnualRentChart,
          })}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderZoomableFinancialBarChart({
            zoomKey: "govtShare",
            color: "dark",
            title: "Govt Share",
            description: "As per selected RAC / Base",
            chart: govtShareChart,
          })}
        </Grid>
      </Grid>
      <KpiCharts
        shareRows={filteredShareRows}
        contractRows={filteredContractRows}
        assetCards={assetCards}
        loading={loading}
        chartZoomOnClick
        chartLayout="financials"
      />
      {financialShareStickersRow}
    </>
  );

  const fiscalSectionContent = (
    <FiscalKpiGrid
      rows={fiscalRows}
      fiscalPeriods={fiscalPeriods}
      expanded={analyticsExpanded}
      onToggleExpanded={() => setAnalyticsExpanded((e) => !e)}
      loading={loading}
      chartZoomOnClick
    />
  );

  const kpiFilters = (
    <MDBox
      display="flex"
      flexWrap={{ xs: "wrap", md: "nowrap" }}
      alignItems="center"
      justifyContent="flex-end"
      gap={1}
      sx={{
        position: "relative",
        zIndex: KPI_HEADER_Z_INDEX,
        pointerEvents: "auto",
        flexShrink: 0,
        minWidth: 0,
      }}
      className="erp-dashboard-filter erp-kpi-overview-header-filters"
    >
      <FormControl size="small" sx={racFilterControlSx}>
        <InputLabel id="kpi-filter-rac-label">RAC</InputLabel>
        <SearchableSelect
          labelId="kpi-filter-rac-label"
          label="RAC"
          multiple
          value={racIds}
          onChange={handleRacChange}
          disabled={loadingRacOptions}
          MenuProps={KPI_COMPACT_MULTI_SELECT_MENU_PROPS.MenuProps}
          renderValue={(selected) =>
            selected.length > 1
              ? `${selected.length} selected`
              : selected.length
              ? selected
                  .map((id) => {
                    const match = racOptions.find((o) => String(o.id ?? o.Id) === String(id));
                    return getKpiOptionName(match) || id;
                  })
                  .join(", ")
              : "All"
          }
        >
          <MenuItem value={KPI_FILTER_ALL_VALUE}>
            <Checkbox checked={racIds.length === 0} size="small" sx={KPI_COMPACT_CHECKBOX_SX} />
            <ListItemText primary="All" {...KPI_COMPACT_LIST_TEXT_PROPS} />
          </MenuItem>
          {racOptions.map((o) => (
            <MenuItem key={o.id ?? o.Id} value={String(o.id ?? o.Id)}>
              <Checkbox
                checked={racIds.includes(String(o.id ?? o.Id))}
                size="small"
                sx={KPI_COMPACT_CHECKBOX_SX}
              />
              <ListItemText primary={getKpiOptionName(o)} {...KPI_COMPACT_LIST_TEXT_PROPS} />
            </MenuItem>
          ))}
        </SearchableSelect>
      </FormControl>
      <FormControl size="small" sx={baseFilterControlSx} disabled={loadingBaseOptions}>
        <InputLabel id="kpi-filter-base-label">Base</InputLabel>
        <SearchableSelect
          labelId="kpi-filter-base-label"
          label="Base"
          multiple
          value={baseIds}
          onChange={handleBaseChange}
          MenuProps={KPI_COMPACT_MULTI_SELECT_MENU_PROPS.MenuProps}
          renderValue={(selected) =>
            selected.length > 1
              ? `${selected.length} selected`
              : selected.length
              ? selected
                  .map((id) => {
                    const match = baseOptions.find((o) => String(o.id ?? o.Id) === String(id));
                    return getBaseDropdownLabel(match) || id;
                  })
                  .join(", ")
              : "All"
          }
        >
          <MenuItem value={KPI_FILTER_ALL_VALUE}>
            <Checkbox checked={baseIds.length === 0} size="small" sx={KPI_COMPACT_CHECKBOX_SX} />
            <ListItemText primary="All" {...KPI_COMPACT_LIST_TEXT_PROPS} />
          </MenuItem>
          {baseOptions.map((o) => (
            <MenuItem key={o.id ?? o.Id} value={String(o.id ?? o.Id)}>
              <Checkbox
                checked={baseIds.includes(String(o.id ?? o.Id))}
                size="small"
                sx={KPI_COMPACT_CHECKBOX_SX}
              />
              <ListItemText primary={getBaseDropdownLabel(o)} {...KPI_COMPACT_LIST_TEXT_PROPS} />
            </MenuItem>
          ))}
        </SearchableSelect>
      </FormControl>
      <MDBox
        width={{ xs: "100%", sm: KPI_DATE_FILTER_WIDTH }}
        sx={{ position: "relative", flexShrink: 0, ...KPI_HEADER_FILTER_INPUT_SX }}
      >
        <input
          type="date"
          ref={asOfDateInputRef}
          value={asOfDate || ""}
          onChange={(e) => setAsOfDate(e.target.value)}
          tabIndex={-1}
          style={{
            position: "absolute",
            opacity: 0,
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
        <MDInput
          placeholder="As of Date"
          value={toKpiDisplayDate(asOfDate)}
          onClick={() => openKpiDatePicker(asOfDateInputRef)}
          size="small"
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Icon
                  sx={{ cursor: "pointer", fontSize: "1rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openKpiDatePicker(asOfDateInputRef);
                  }}
                >
                  calendar_today
                </Icon>
              </InputAdornment>
            ),
          }}
          fullWidth
        />
      </MDBox>
      <FormControl size="small" sx={tenureFilterControlSx}>
        <InputLabel id="kpi-filter-tenure-label">Tenure</InputLabel>
        <SearchableSelect
          labelId="kpi-filter-tenure-label"
          label="Tenure"
          value={tenure}
          onChange={(e) => setTenure(e.target.value)}
          MenuProps={KPI_FILTER_SELECT_MENU_PROPS.MenuProps}
        >
          {TENURE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </SearchableSelect>
      </FormControl>
    </MDBox>
  );

  useLayoutEffect(() => {
    if (!embedded || !onShellProps) return;
    onShellProps({
      title: "KPI Overview",
      subtitle: "Property, contract, and financial analytics with RAC / Base filters",
      actions: kpiFilters,
    });
  }, [
    embedded,
    onShellProps,
    racIds,
    baseIds,
    asOfDate,
    tenure,
    loadingRacOptions,
    loadingBaseOptions,
    racOptions,
    baseOptions,
  ]);

  const pageContent = (
    <>
      <Card sx={{ ...cardSx, mb: 1 }}>
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            px: 1,
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "14px",
            },
            "& .MuiTab-root.Mui-selected": {
              color: "#ffffff !important",
            },
          }}
        >
          <Tab label="Home" />
          <Tab label="Assets" />
          <Tab label="Contracts" />
          <Tab label="Financials" />
          <Tab label="Fiscal Year Shares" />
        </Tabs>
      </Card>

      <TabPanel value={tab} index={0}>
        <KpiHomeSection title="Assets">{overviewContent}</KpiHomeSection>
        <KpiHomeSection title="Contracts">{contractsSectionContent}</KpiHomeSection>
        <KpiHomeSection title="Financials">
          <MDBox mt={2}>{financialsSectionContent}</MDBox>
        </KpiHomeSection>
        <KpiHomeSection title="Fiscal Year Shares">{fiscalSectionContent}</KpiHomeSection>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {overviewContent}
      </TabPanel>

      <TabPanel value={tab} index={2}>
        {contractsSectionContent}
      </TabPanel>

      <TabPanel value={tab} index={3}>
        {financialsSectionContent}
      </TabPanel>

      <TabPanel value={tab} index={4}>
        {fiscalSectionContent}
      </TabPanel>

      <TabPanel value={tab} index={5}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <DashboardKpiCard
              variant="primary"
              icon="inventory"
              label="Active Projects"
              value={loading ? "—" : executive.activeProjects.toLocaleString()}
              trend="From contracts & property summary datasets"
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ ...cardSx, p: 3 }}>
              <MDTypography variant="button" fontWeight="bold" mb={1} sx={{ fontSize: "18px" }}>
                Project KPIs (fiscal view)
              </MDTypography>
              <MDTypography variant="body2" sx={{ color: "#6b7280", fontSize: "14px" }}>
                Latest fiscal period ({fiscalPeriods[fiscalPeriods.length - 1]?.headerLabel ?? "—"}
                ): {loading ? "—" : executive.activeProjects.toLocaleString()} active projects
              </MDTypography>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Dialog
        fullScreen
        open={Boolean(financialZoomConfig)}
        onClose={closeFinancialZoom}
        PaperProps={{
          sx: {
            display: "flex",
            flexDirection: "column",
            m: 0,
            height: "100%",
            maxHeight: "100%",
            borderRadius: 0,
            bgcolor: "background.paper",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pr: 1,
            flexShrink: 0,
          }}
        >
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {financialZoomConfig?.title || ""}
          </MDTypography>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            {financialZoomConfig ? (
              <ChartExportButton
                disabled={loading}
                ariaLabel={`Export ${financialZoomConfig.title} to Excel`}
                onExport={() =>
                  exportSingleSeriesBarChartToExcel(
                    financialZoomConfig.title,
                    financialZoomConfig.chart
                  )
                }
              />
            ) : null}
            <IconButton onClick={closeFinancialZoom} size="small" aria-label="Close enlarged chart">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
            p: { xs: 1.5, sm: 2 },
          }}
        >
          {financialZoomConfig && (
            <MDBox
              sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ReportsBarChart
                flat
                wideBars
                zoomEnhanced
                seriesColor={financialZoomConfig.color === "dark" ? CHART_SECONDARY : CHART_PRIMARY}
                title={financialZoomConfig.title}
                description={financialZoomConfig.description}
                date="Updated just now"
                chart={financialZoomConfig.chart}
                chartHeight="calc(100dvh - 72px)"
              />
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return pageContent;
  }

  return (
    <DashboardPageShell
      title="KPI Overview"
      subtitle="Property, contract, and financial analytics with RAC / Base filters"
      actions={kpiFilters}
    >
      {pageContent}
    </DashboardPageShell>
  );
}

KpiOverview.propTypes = {
  embedded: PropTypes.bool,
  onShellProps: PropTypes.func,
};

KpiOverview.defaultProps = {
  embedded: false,
  onShellProps: null,
};

export default KpiOverview;
