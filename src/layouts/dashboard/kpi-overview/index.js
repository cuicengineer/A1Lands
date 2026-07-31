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
import useDashboardChartColors from "hooks/useDashboardChartColors";
import { mergeKpiCardSx } from "utils/kpiCardSx";
import { useMaterialUIController } from "context";
import api from "services/api.service";
import "assets/css/all.min.css";

import KpiCharts, { getEnterpriseCardSx } from "./components/KpiCharts";
import FiscalKpiGrid from "./components/FiscalKpiGrid";
import FiscalRacCharts from "./components/FiscalRacCharts";
import OutstandingRentsChart from "./components/OutstandingRentsChart";
import FinancialMetricDrillChart from "./components/FinancialMetricDrillChart";
import propertyGroupingApi from "services/api.propertygrouping.service";
import contractApi from "services/api.contract.service";
import {
  buildAssetCards,
  buildGroupedAssetCards,
  buildExecutiveKpis,
  buildOutstandingRentsStickers,
  buildFiscalKpiGridRows,
  KPI_FINANCIAL_DRILL_INITIAL,
  KPI_PAF_ANNUAL_RENT_METRIC,
  KPI_GOVT_SHARE_METRIC,
  buildPropertySummaryApiPath,
  buildGovtPafShareRowsFromAsOfContracts,
  buildContractMetaLookup,
  buildAgreementContractRowsForCharts,
  enrichAsOfContractRowsWithMeta,
  applyTenureToAssetCards,
  applyContractMilToAssetCards,
  extractContractsSummaryRows,
  extractGovtPafShareRows,
  extractPropertyGroupSummaryRows,
  extractPropertySummaryRows,
  filterKpiRowsByRacBase,
  formatKpiMoneyLabel,
  getFiscalYearPeriods,
  unwrapKpiApiList,
} from "./kpiDataUtils";
import {
  buildContractsUrlFromKpi,
  buildContractStickersFromContractRows,
  getBaseDropdownLabel,
  openKpiTargetInNewTab,
} from "./kpiOverviewNavigation";
import {
  filterKpiBaseCatalogForUser,
  filterKpiRacOptionsForUser,
  getKpiOverviewUserScope,
  isKpiBaseFilterLocked,
  isKpiRacFilterLocked,
  resolveKpiEffectiveRacBaseFilters,
} from "./kpiOverviewAccess";
function TabPanel({ children, value, index, dense = false, className = "" }) {
  if (value !== index) return null;
  return (
    <MDBox
      className={["erp-kpi-tab-panel", dense ? "erp-kpi-tab-panel--dense" : "", className]
        .filter(Boolean)
        .join(" ")}
      pt={0}
      sx={{ width: "100%" }}
    >
      {children}
    </MDBox>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  dense: PropTypes.bool,
  className: PropTypes.string,
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

function getKpiTenureLabel(tenure) {
  const match = TENURE_OPTIONS.find((option) => option.value === tenure);
  return match?.label || tenure || "Annual";
}

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

const KPI_BASE_FILTER_MENU_PAPER_SX = {
  width: "max-content",
  minWidth: KPI_DATE_FILTER_WIDTH,
  maxWidth: "min(28rem, 92vw)",
  "& .MuiMenuItem-root": {
    minHeight: 28,
    py: 0.35,
    px: 1,
    fontSize: "0.8125rem",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  "& .MuiListItemText-root": {
    margin: 0,
    minWidth: 0,
    flex: 1,
  },
  "& .MuiListItemText-primary": {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.25,
    wordBreak: "normal",
  },
};

const KPI_BASE_MULTI_SELECT_MENU_PROPS = {
  MenuProps: {
    sx: { zIndex: KPI_HEADER_Z_INDEX + 1 },
    PaperProps: {
      sx: KPI_BASE_FILTER_MENU_PAPER_SX,
    },
  },
};

const KPI_BASE_CHECKBOX_SX = {
  p: 0.15,
  mr: 0.25,
  flexShrink: 0,
  alignSelf: "center",
  "& .MuiSvgIcon-root": { fontSize: "1rem" },
};

const KPI_BASE_LIST_TEXT_PROPS = {
  primaryTypographyProps: {
    fontSize: "0.8125rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.25,
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

function AssetCardsScroller({
  cards,
  loading,
  darkMode,
  cardSx,
  onCardClick,
  compact = false,
  tenure,
}) {
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
              cardKey={a.key}
              label={a.label}
              count={a.count}
              areaLine={a.areaLine}
              showArea={a.key !== "total"}
              mil={a.mil}
              cardSx={cardSx}
              primary={cardIndex === 0}
              compact={compact}
              tenureLabel={getKpiTenureLabel(tenure)}
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
  tenure: PropTypes.oneOf(["Annual", "Biannual", "Quarterly", "Monthly"]),
};

AssetCardsScroller.defaultProps = {
  compact: false,
  tenure: "Annual",
};

function AssetCard({
  cardKey,
  label,
  count,
  areaLine,
  showArea = true,
  mil,
  cardSx,
  primary,
  compact = false,
  tenureLabel,
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
          {cardKey === "total" ? (
            <MDTypography
              component="p"
              variant="caption"
              color="text"
              className="erp-kpi-card__tenure-caption"
              sx={{ textAlign: "right", mt: 0.25, mb: 0.5, lineHeight: 1.3 }}
            >
              Tenure: {tenureLabel}
            </MDTypography>
          ) : null}
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
  cardKey: PropTypes.string,
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
  tenureLabel: PropTypes.string,
  onClick: PropTypes.func,
};

AssetCard.defaultProps = {
  cardKey: "",
  mil: DEFAULT_MIL,
  primary: false,
  compact: false,
  tenureLabel: "Annual",
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
  const chartColors = useDashboardChartColors();
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
  const [asOfRefreshToken, setAsOfRefreshToken] = useState(0);
  const [asOfApplied, setAsOfApplied] = useState(false);
  const [asOfRefreshing, setAsOfRefreshing] = useState(false);
  const [asOfContractRows, setAsOfContractRows] = useState([]);
  const [defaultAsOfContractRows, setDefaultAsOfContractRows] = useState([]);
  const [contractCatalogRows, setContractCatalogRows] = useState([]);
  const [contractMetaById, setContractMetaById] = useState(() => new Map());
  const [tenure, setTenure] = useState("Annual");
  const [racOptions, setRacOptions] = useState([]);
  const [allBases, setAllBases] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [loadingRacOptions, setLoadingRacOptions] = useState(false);
  const [loadingBaseOptions, setLoadingBaseOptions] = useState(false);
  const [financialZoomChart, setFinancialZoomChart] = useState(null);
  const [pafAnnualRentDrill, setPafAnnualRentDrill] = useState(KPI_FINANCIAL_DRILL_INITIAL);
  const [govtShareDrill, setGovtShareDrill] = useState(KPI_FINANCIAL_DRILL_INITIAL);
  const asOfDateInputRef = useRef(null);
  const asOfFetchGenRef = useRef(0);

  const fiscalPeriods = useMemo(() => getFiscalYearPeriods(6), []);
  const cardSx = useMemo(() => getEnterpriseCardSx(), []);
  const closeFinancialZoom = useCallback(() => setFinancialZoomChart(null), []);
  const kpiUserScope = useMemo(() => getKpiOverviewUserScope(), []);
  const racFilterLocked = isKpiRacFilterLocked(kpiUserScope);
  const baseFilterLocked = isKpiBaseFilterLocked(kpiUserScope);

  const accessibleRacOptions = useMemo(
    () => filterKpiRacOptionsForUser(racOptions, kpiUserScope),
    [racOptions, kpiUserScope]
  );

  const { racIds: effectiveRacIds, baseIds: effectiveBaseIds } = useMemo(
    () => resolveKpiEffectiveRacBaseFilters(racIds, baseIds, kpiUserScope),
    [racIds, baseIds, kpiUserScope]
  );

  const racFilterWidth = useMemo(
    () => estimateKpiFilterWidth(["All", "RAC", ...accessibleRacOptions.map(getKpiOptionName)]),
    [accessibleRacOptions]
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
        const todayAsOf = getTodayDateInputValue();
        const [summaryData, contractRecords, defaultAsOfResponse] = await Promise.all([
          api.request("GET", buildPropertySummaryApiPath("")),
          contractApi.getAllRecords().catch(() => []),
          contractApi.getActiveByAsOfDate(todayAsOf).catch(() => []),
        ]);
        if (cancelled) return;

        const catalogRows = unwrapKpiApiList(contractRecords);
        setPropertyRows(extractPropertySummaryRows(summaryData));
        setPropertyGroupSummaryRows(extractPropertyGroupSummaryRows(summaryData));
        setContractRows(extractContractsSummaryRows(summaryData));
        setShareRows(extractGovtPafShareRows(summaryData));
        setContractCatalogRows(catalogRows);
        setContractMetaById(buildContractMetaLookup(catalogRows));
        setDefaultAsOfContractRows(unwrapKpiApiList(defaultAsOfResponse));
        setAsOfContractRows([]);
        setAsOfApplied(false);
      } catch (e) {
        if (!cancelled) console.error("KPI Overview initial load:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (kpiUserScope.canSeeAll) return;
    const nextRac =
      kpiUserScope.userCmdId != null && kpiUserScope.userCmdId !== ""
        ? [String(kpiUserScope.userCmdId)]
        : [];
    const nextBase =
      Number(kpiUserScope.userLevelId) === 3 && kpiUserScope.userBaseId != null
        ? [String(kpiUserScope.userBaseId)]
        : [];
    setRacIds(nextRac);
    setBaseIds(nextBase);
  }, [kpiUserScope]);

  useEffect(() => {
    if (!asOfRefreshToken) return;

    let cancelled = false;
    const myGen = ++asOfFetchGenRef.current;

    const finishAsOfRefreshUi = () => {
      if (myGen !== asOfFetchGenRef.current || cancelled) return;
      setAsOfRefreshing(false);
    };

    (async () => {
      try {
        const summaryPath = buildPropertySummaryApiPath(asOfDate);
        const summaryPromise = api.request("GET", summaryPath);
        const asOfPromise =
          asOfDate && String(asOfDate).trim()
            ? contractApi.getActiveByAsOfDate(asOfDate)
            : Promise.resolve(null);
        const metaPromise =
          asOfDate && String(asOfDate).trim()
            ? contractApi.getAllRecords().catch(() => [])
            : Promise.resolve([]);

        const [summaryData, asOfResponse, contractRecords] = await Promise.all([
          summaryPromise,
          asOfPromise,
          metaPromise,
        ]);

        if (cancelled) return;

        setPropertyRows(extractPropertySummaryRows(summaryData));
        setPropertyGroupSummaryRows(extractPropertyGroupSummaryRows(summaryData));
        setContractRows(extractContractsSummaryRows(summaryData));
        setShareRows(extractGovtPafShareRows(summaryData));
        setAsOfApplied(true);

        if (asOfDate && String(asOfDate).trim()) {
          const catalogRows = unwrapKpiApiList(contractRecords);
          setAsOfContractRows(unwrapKpiApiList(asOfResponse));
          setContractCatalogRows(catalogRows);
          setContractMetaById(buildContractMetaLookup(catalogRows));
        } else {
          setAsOfContractRows([]);
        }
      } catch (e) {
        if (!cancelled) console.error("KPI Overview as-of refresh:", e);
      } finally {
        finishAsOfRefreshUi();
      }
    })();

    return () => {
      cancelled = true;
    };
    // asOfDate is read when refresh token bumps (contracts.js pattern), not as a dep.
  }, [asOfRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await propertyGroupingApi.getAllRecords();
        if (!cancelled) {
          setPropertyGroups(Array.isArray(groups) ? groups : []);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
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
    const scopedBases = filterKpiBaseCatalogForUser(allBases, kpiUserScope);
    const selectedRacs = new Set((racIds || []).map(String));
    const filtered =
      selectedRacs.size > 0
        ? scopedBases.filter((base) =>
            selectedRacs.has(String(base.cmd ?? base.CmdId ?? base.cmdId))
          )
        : scopedBases;
    setBaseOptions(filtered);
    setBaseIds((prev) => {
      const validIds = new Set(filtered.map((b) => String(b.id ?? b.Id)));
      return (prev || []).filter((id) => validIds.has(String(id)));
    });
  }, [racIds, allBases, kpiUserScope]);

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
  const hasAsOfContext = Boolean(
    asOfApplied && asOfDate && String(asOfDate).trim() && asOfContractRows.length > 0
  );
  const dataBusy = loading || asOfRefreshing;

  const enrichedAsOfContractRows = useMemo(
    () => enrichAsOfContractRowsWithMeta(asOfContractRows, contractMetaById),
    [asOfContractRows, contractMetaById]
  );

  const asOfDerivedShareRows = useMemo(() => {
    if (!hasAsOfContext) return null;
    return buildGovtPafShareRowsFromAsOfContracts(enrichedAsOfContractRows, contractMetaById);
  }, [hasAsOfContext, enrichedAsOfContractRows, contractMetaById]);

  const effectiveShareRows = useMemo(() => {
    if (asOfDerivedShareRows?.length) return asOfDerivedShareRows;
    return shareRows;
  }, [shareRows, asOfDerivedShareRows]);

  const filteredPropertyRows = useMemo(
    () => filterKpiRowsByRacBase(propertyRows, effectiveRacIds, effectiveBaseIds),
    [propertyRows, effectiveRacIds, effectiveBaseIds]
  );
  const filteredContractRows = useMemo(
    () => filterKpiRowsByRacBase(contractRows, effectiveRacIds, effectiveBaseIds),
    [contractRows, effectiveRacIds, effectiveBaseIds]
  );
  const filteredShareRows = useMemo(
    () => filterKpiRowsByRacBase(effectiveShareRows, effectiveRacIds, effectiveBaseIds),
    [effectiveShareRows, effectiveRacIds, effectiveBaseIds]
  );
  /** GovtPAFShare rows from GetPropertyDashboardSummary — used on Financials tab charts. */
  const filteredSpShareRows = useMemo(
    () => filterKpiRowsByRacBase(shareRows, effectiveRacIds, effectiveBaseIds),
    [shareRows, effectiveRacIds, effectiveBaseIds]
  );
  const filteredAsOfContractRows = useMemo(
    () => filterKpiRowsByRacBase(enrichedAsOfContractRows, effectiveRacIds, effectiveBaseIds),
    [enrichedAsOfContractRows, effectiveRacIds, effectiveBaseIds]
  );

  useEffect(() => {
    setPafAnnualRentDrill(KPI_FINANCIAL_DRILL_INITIAL);
    setGovtShareDrill(KPI_FINANCIAL_DRILL_INITIAL);
  }, [
    filteredShareRows,
    filteredPropertyRows,
    filteredContractRows,
    effectiveRacIds,
    effectiveBaseIds,
    tenure,
  ]);

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
        racIds: effectiveRacIds,
        baseIds: effectiveBaseIds,
      }),
    [
      filteredPropertyRows,
      filteredShareRows,
      filteredContractRows,
      propertyGroupSummaryRows,
      propertyGroups,
      effectiveRacIds,
      effectiveBaseIds,
    ]
  );
  const tenureScaledGroupedAssetCards = useMemo(
    () => applyTenureToAssetCards(groupedAssetCards, tenure),
    [groupedAssetCards, tenure]
  );
  const financialAssetCards = useMemo(
    () => buildAssetCards(filteredPropertyRows, filteredSpShareRows, filteredContractRows),
    [filteredPropertyRows, filteredSpShareRows, filteredContractRows]
  );
  const outstandingRentsStickers = useMemo(
    () => buildOutstandingRentsStickers(filteredPropertyRows),
    [filteredPropertyRows]
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

  const racChartPropertyRows = useMemo(() => {
    const racFilter = kpiUserScope.canSeeAll ? [] : effectiveRacIds;
    return filterKpiRowsByRacBase(propertyRows, racFilter, effectiveBaseIds);
  }, [propertyRows, effectiveRacIds, effectiveBaseIds, kpiUserScope.canSeeAll]);
  const racChartContractRows = useMemo(() => {
    const racFilter = kpiUserScope.canSeeAll ? [] : effectiveRacIds;
    return filterKpiRowsByRacBase(contractRows, racFilter, effectiveBaseIds);
  }, [contractRows, effectiveRacIds, effectiveBaseIds, kpiUserScope.canSeeAll]);
  const racChartShareRows = useMemo(() => {
    const racFilter = kpiUserScope.canSeeAll ? [] : effectiveRacIds;
    return filterKpiRowsByRacBase(effectiveShareRows, racFilter, effectiveBaseIds);
  }, [effectiveShareRows, effectiveRacIds, effectiveBaseIds, kpiUserScope.canSeeAll]);
  const racChartAsOfContractRows = useMemo(
    () => filterKpiRowsByRacBase(enrichedAsOfContractRows, effectiveRacIds, effectiveBaseIds),
    [enrichedAsOfContractRows, effectiveRacIds, effectiveBaseIds]
  );
  const racChartContractCatalogRows = useMemo(
    () => filterKpiRowsByRacBase(contractCatalogRows, effectiveRacIds, effectiveBaseIds),
    [contractCatalogRows, effectiveRacIds, effectiveBaseIds]
  );
  const contractStickerSourceRows = useMemo(
    () => (hasAsOfContext ? filteredAsOfContractRows : racChartContractCatalogRows),
    [hasAsOfContext, filteredAsOfContractRows, racChartContractCatalogRows]
  );
  const contractStickers = useMemo(
    () =>
      buildContractStickersFromContractRows(contractStickerSourceRows, {
        useAsOf: hasAsOfContext,
      }),
    [contractStickerSourceRows, hasAsOfContext]
  );
  const health = contractStickers.health;
  const contractStatus = contractStickers.contractStatus;
  const ahqApproval = contractStickers.ahqApproval;
  const contractMilSourceRows = useMemo(
    () => (hasAsOfContext ? filteredAsOfContractRows : racChartContractCatalogRows),
    [hasAsOfContext, filteredAsOfContractRows, racChartContractCatalogRows]
  );
  const { rows: agreementContractRowsForCharts, useAsOf: useAgreementAsOfForCharts } =
    useMemo(() => {
      const asOfRows = hasAsOfContext ? filteredAsOfContractRows : defaultAsOfContractRows;
      return buildAgreementContractRowsForCharts({
        catalogRows: racChartContractCatalogRows,
        asOfRows,
        hasAsOfContext,
        contractMetaById,
      });
    }, [
      hasAsOfContext,
      filteredAsOfContractRows,
      defaultAsOfContractRows,
      racChartContractCatalogRows,
      contractMetaById,
    ]);
  const assetsTabGroupedAssetCards = useMemo(
    () =>
      applyContractMilToAssetCards(
        groupedAssetCards,
        agreementContractRowsForCharts,
        contractMetaById,
        {
          activeOnly: !useAgreementAsOfForCharts,
          ahqApprovedOnly: true,
        }
      ),
    [groupedAssetCards, agreementContractRowsForCharts, contractMetaById, useAgreementAsOfForCharts]
  );
  const assetsTabAssetCards = useMemo(
    () =>
      applyContractMilToAssetCards(assetCards, agreementContractRowsForCharts, contractMetaById, {
        activeOnly: !useAgreementAsOfForCharts,
        ahqApprovedOnly: true,
      }),
    [assetCards, agreementContractRowsForCharts, contractMetaById, useAgreementAsOfForCharts]
  );
  const tenureScaledAssetsTabGroupedAssetCards = useMemo(
    () => applyTenureToAssetCards(assetsTabGroupedAssetCards, tenure),
    [assetsTabGroupedAssetCards, tenure]
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

  const kpiContractsLinkRacId = effectiveRacIds.length === 1 ? effectiveRacIds[0] : "";
  const kpiContractsLinkBaseId = effectiveBaseIds.length === 1 ? effectiveBaseIds[0] : "";

  const kpiContractsLinkAsOfDate =
    hasAsOfContext && asOfApplied && asOfDate ? String(asOfDate).trim() : "";

  const openContractHealthSticker = useCallback(
    (healthKey) => {
      if (!healthKey) return;
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId: kpiContractsLinkRacId,
          baseId: kpiContractsLinkBaseId,
          kpiContractHealth: healthKey,
          asOfDate: kpiContractsLinkAsOfDate,
        })
      );
    },
    [kpiContractsLinkRacId, kpiContractsLinkBaseId, kpiContractsLinkAsOfDate]
  );

  const openContractStatusSticker = useCallback(
    (statusKey) => {
      if (!statusKey) return;
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId: kpiContractsLinkRacId,
          baseId: kpiContractsLinkBaseId,
          kpiContractStatus: statusKey,
          asOfDate: kpiContractsLinkAsOfDate,
        })
      );
    },
    [kpiContractsLinkRacId, kpiContractsLinkBaseId, kpiContractsLinkAsOfDate]
  );

  const openContractApprovalSticker = useCallback(
    (approvalKey) => {
      if (!approvalKey) return;
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId: kpiContractsLinkRacId,
          baseId: kpiContractsLinkBaseId,
          kpiApproval: approvalKey,
          asOfDate: kpiContractsLinkAsOfDate,
        })
      );
    },
    [kpiContractsLinkRacId, kpiContractsLinkBaseId, kpiContractsLinkAsOfDate]
  );

  const handleTabChange = useCallback((_, v) => setTab(v), []);

  const renderAssetsOverview = ({
    showShareDistributionCharts = true,
    showGovtPafCharts = true,
    assetsOnly = false,
    useContractMil = false,
  } = {}) => {
    const showKpiCharts = showShareDistributionCharts || showGovtPafCharts;
    const displayGroupedAssetCards = useContractMil
      ? tenureScaledAssetsTabGroupedAssetCards
      : tenureScaledGroupedAssetCards;
    const displayAssetCards = useContractMil ? assetsTabAssetCards : assetCards;

    return (
      <MDBox className={assetsOnly ? "erp-kpi-assets-only-overview" : undefined}>
        {dataBusy ? (
          <MDBox
            display="flex"
            justifyContent="center"
            alignItems="center"
            width="100%"
            py={assetsOnly ? 1.5 : 0}
            minHeight={assetsOnly ? 0 : 260}
          >
            <CurrencyLoading size={assetsOnly ? 40 : 56} />
          </MDBox>
        ) : (
          <MDBox className="erp-asset-cards-stack">
            <AssetCardsScroller
              cards={displayGroupedAssetCards}
              loading={dataBusy}
              darkMode={darkMode}
              cardSx={cardSx}
              tenure={tenure}
            />
            <AssetCardsScroller
              cards={displayAssetCards}
              loading={dataBusy}
              darkMode={darkMode}
              cardSx={cardSx}
              compact
              tenure={tenure}
            />
          </MDBox>
        )}

        {showKpiCharts ? (
          <MDBox mt={1}>
            <KpiCharts
              shareRows={effectiveShareRows}
              contractRows={contractRows}
              propertyRows={propertyRows}
              racOptions={accessibleRacOptions}
              racIds={effectiveRacIds}
              baseOptions={baseOptions}
              allBases={filterKpiBaseCatalogForUser(allBases, kpiUserScope)}
              assetCards={assetCards}
              loading={dataBusy}
              chartZoomOnClick
              showShareDistributionCharts={showShareDistributionCharts}
              showGovtPafCharts={showGovtPafCharts}
              tenure={tenure}
            />
          </MDBox>
        ) : null}
      </MDBox>
    );
  };

  const homeAssetsOverview = renderAssetsOverview({
    showShareDistributionCharts: false,
    showGovtPafCharts: false,
    assetsOnly: true,
    useContractMil: true,
  });
  const assetsTabOverview = renderAssetsOverview({
    showShareDistributionCharts: false,
    showGovtPafCharts: false,
    assetsOnly: true,
    useContractMil: true,
  });
  const overviewContent = homeAssetsOverview;
  const assetsTabContent = assetsTabOverview;

  const renderContractsSection = ({ stickersClickable = false } = {}) => (
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
              onClick={stickersClickable ? () => openContractHealthSticker(h.key) : undefined}
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
              onClick={stickersClickable ? () => openContractStatusSticker(s.key) : undefined}
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
              onClick={stickersClickable ? () => openContractApprovalSticker(a.key) : undefined}
            />
          </Grid>
        ))}
      </Grid>

      <OutstandingRentsChart
        stickers={outstandingRentsStickers}
        cardSx={cardSx}
        loading={dataBusy}
      />
    </>
  );

  const contractsSectionContent = renderContractsSection({ stickersClickable: true });

  const accessibleAllBases = useMemo(
    () => filterKpiBaseCatalogForUser(allBases, kpiUserScope),
    [allBases, kpiUserScope]
  );

  const financialZoomConfig = useMemo(() => {
    if (financialZoomChart === "pafAnnualRent") {
      return {
        metricConfig: KPI_PAF_ANNUAL_RENT_METRIC,
        drill: pafAnnualRentDrill,
        onDrillChange: setPafAnnualRentDrill,
        title: "PAF Annual Rent",
        seriesColor: chartColors.barPrimary,
      };
    }
    if (financialZoomChart === "govtShare") {
      return {
        metricConfig: KPI_GOVT_SHARE_METRIC,
        drill: govtShareDrill,
        onDrillChange: setGovtShareDrill,
        title: "Govt Share",
        seriesColor: chartColors.barSecondary,
      };
    }
    return null;
  }, [financialZoomChart, pafAnnualRentDrill, govtShareDrill, chartColors]);

  const financialMetricDrillSharedProps = {
    shareRows: filteredSpShareRows,
    propertyRows: filteredPropertyRows,
    contractRows: filteredContractRows,
    agreementContractRows: [],
    useAsOfContracts: false,
    contractMetaById,
    racOptions: accessibleRacOptions,
    baseOptions,
    allBases: accessibleAllBases,
    racIds: effectiveRacIds,
    tenure,
    cardSx,
    loading: dataBusy,
    darkMode,
    onZoom: setFinancialZoomChart,
    preferSpGovtPafShare: true,
  };

  const financialsSectionContent = (
    <>
      <Grid container spacing={1} mb={2}>
        <Grid item xs={12} md={6}>
          <FinancialMetricDrillChart
            {...financialMetricDrillSharedProps}
            metricConfig={KPI_PAF_ANNUAL_RENT_METRIC}
            title="PAF Annual Rent"
            description="Property groups · RAC / Base"
            seriesColor={chartColors.barPrimary}
            zoomKey="pafAnnualRent"
            drill={pafAnnualRentDrill}
            onDrillChange={setPafAnnualRentDrill}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FinancialMetricDrillChart
            {...financialMetricDrillSharedProps}
            metricConfig={KPI_GOVT_SHARE_METRIC}
            title="Govt Share"
            description="Property groups · RAC / Base"
            seriesColor={chartColors.barSecondary}
            zoomKey="govtShare"
            drill={govtShareDrill}
            onDrillChange={setGovtShareDrill}
          />
        </Grid>
      </Grid>
      <KpiCharts
        shareRows={filteredSpShareRows}
        contractRows={filteredContractRows}
        propertyRows={filteredPropertyRows}
        agreementContractRows={[]}
        useAsOfContracts={false}
        contractMetaById={contractMetaById}
        racOptions={accessibleRacOptions}
        racIds={effectiveRacIds}
        baseOptions={baseOptions}
        allBases={filterKpiBaseCatalogForUser(allBases, kpiUserScope)}
        assetCards={financialAssetCards}
        loading={dataBusy}
        chartZoomOnClick
        chartLayout="financials"
        tenure={tenure}
        preferSpGovtPafShare
      />
    </>
  );

  const fiscalSectionContent = (
    <>
      <FiscalKpiGrid
        rows={fiscalRows}
        fiscalPeriods={fiscalPeriods}
        expanded={analyticsExpanded}
        onToggleExpanded={() => setAnalyticsExpanded((e) => !e)}
        loading={dataBusy}
        chartZoomOnClick
      />
      <FiscalRacCharts
        shareRows={racChartShareRows}
        propertyRows={racChartPropertyRows}
        contractRows={racChartContractRows}
        asOfContractRows={racChartAsOfContractRows}
        contractCatalogRows={racChartContractCatalogRows}
        contractMetaById={contractMetaById}
        propertyGroups={propertyGroups}
        racOptions={accessibleRacOptions}
        racIds={effectiveRacIds}
        tenure={tenure}
        loading={dataBusy}
        chartZoomOnClick
      />
    </>
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
          disabled={loadingRacOptions || racFilterLocked}
          MenuProps={KPI_COMPACT_MULTI_SELECT_MENU_PROPS.MenuProps}
          renderValue={(selected) =>
            selected.length > 1
              ? `${selected.length} selected`
              : selected.length
              ? selected
                  .map((id) => {
                    const match = accessibleRacOptions.find(
                      (o) => String(o.id ?? o.Id) === String(id)
                    );
                    return getKpiOptionName(match) || id;
                  })
                  .join(", ")
              : racFilterLocked
              ? getKpiOptionName(accessibleRacOptions[0]) || "—"
              : "All"
          }
        >
          {!racFilterLocked ? (
            <MenuItem value={KPI_FILTER_ALL_VALUE}>
              <Checkbox checked={racIds.length === 0} size="small" sx={KPI_COMPACT_CHECKBOX_SX} />
              <ListItemText primary="All" {...KPI_COMPACT_LIST_TEXT_PROPS} />
            </MenuItem>
          ) : null}
          {accessibleRacOptions.map((o) => (
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
      <FormControl
        size="small"
        sx={baseFilterControlSx}
        disabled={loadingBaseOptions || baseFilterLocked}
      >
        <InputLabel id="kpi-filter-base-label">Base</InputLabel>
        <SearchableSelect
          labelId="kpi-filter-base-label"
          label="Base"
          multiple
          value={baseIds}
          onChange={handleBaseChange}
          MenuProps={KPI_BASE_MULTI_SELECT_MENU_PROPS.MenuProps}
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
              : baseFilterLocked
              ? getBaseDropdownLabel(baseOptions[0]) || "—"
              : "All"
          }
        >
          {!baseFilterLocked ? (
            <MenuItem value={KPI_FILTER_ALL_VALUE}>
              <Checkbox checked={baseIds.length === 0} size="small" sx={KPI_BASE_CHECKBOX_SX} />
              <ListItemText primary="All" {...KPI_BASE_LIST_TEXT_PROPS} />
            </MenuItem>
          ) : null}
          {baseOptions.map((o) => (
            <MenuItem key={o.id ?? o.Id} value={String(o.id ?? o.Id)}>
              <Checkbox
                checked={baseIds.includes(String(o.id ?? o.Id))}
                size="small"
                sx={KPI_BASE_CHECKBOX_SX}
              />
              <ListItemText primary={getBaseDropdownLabel(o)} {...KPI_BASE_LIST_TEXT_PROPS} />
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
      <IconButton
        size="small"
        color="info"
        title="Refresh as-of values"
        disabled={dataBusy}
        onClick={() => {
          setAsOfRefreshing(true);
          setAsOfRefreshToken((t) => t + 1);
        }}
        sx={{ flexShrink: 0 }}
      >
        <Icon fontSize="small">send</Icon>
      </IconButton>
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
    asOfRefreshing,
    tenure,
    loadingRacOptions,
    loadingBaseOptions,
    accessibleRacOptions,
    baseOptions,
    racFilterLocked,
    baseFilterLocked,
  ]);

  const pageContent = (
    <>
      <Card sx={{ ...cardSx, mb: 1 }} className="erp-dashboard-tabs-card">
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
        <KpiHomeSection title="Financials">
          <MDBox mt={2}>{financialsSectionContent}</MDBox>
        </KpiHomeSection>
        <KpiHomeSection title="Contracts">{contractsSectionContent}</KpiHomeSection>
        <KpiHomeSection title="Fiscal Year Shares">{fiscalSectionContent}</KpiHomeSection>
      </TabPanel>

      <TabPanel value={tab} index={1} dense>
        {assetsTabContent}
      </TabPanel>

      <TabPanel value={tab} index={2} dense className="erp-kpi-tab-panel--contracts">
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
              value={dataBusy ? "—" : executive.activeProjects.toLocaleString()}
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
                ): {dataBusy ? "—" : executive.activeProjects.toLocaleString()} active projects
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
          <IconButton onClick={closeFinancialZoom} size="small" aria-label="Close enlarged chart">
            <Icon>close</Icon>
          </IconButton>
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
            <FinancialMetricDrillChart
              {...financialMetricDrillSharedProps}
              metricConfig={financialZoomConfig.metricConfig}
              title={financialZoomConfig.title}
              seriesColor={financialZoomConfig.seriesColor}
              drill={financialZoomConfig.drill}
              onDrillChange={financialZoomConfig.onDrillChange}
              isZoomed
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <MDBox className="erp-kpi-overview-root">{pageContent}</MDBox>;
  }

  return (
    <DashboardPageShell
      title="KPI Overview"
      subtitle="Property, contract, and financial analytics with RAC / Base filters"
      actions={kpiFilters}
      moduleBodyClassName="erp-kpi-overview-module-body"
    >
      <MDBox className="erp-kpi-overview-root">{pageContent}</MDBox>
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
