/**
 * KPI Overview — enterprise analytics dashboard (property-summary API).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Skeleton from "@mui/material/Skeleton";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import { useMaterialUIController } from "context";
import api from "services/api.service";
import "assets/css/all.min.css";

import KpiCharts, { getEnterpriseCardSx } from "./components/KpiCharts";
import FiscalKpiGrid from "./components/FiscalKpiGrid";
import {
  buildAssetCards,
  buildAhqApproval,
  buildContractHealth,
  buildContractStatus,
  buildExecutiveKpis,
  buildFinancialShares,
  buildFiscalKpiGridRows,
  extractContractsSummaryRows,
  extractGovtPafShareRows,
  extractPropertySummaryRows,
  formatKpiMoneyLabel,
  getFiscalYearPeriods,
} from "./kpiDataUtils";
import {
  buildContractsUrlFromKpi,
  buildRentalPropertiesUrlFromKpi,
  openKpiTargetInNewTab,
  resolveAssetCardClassId,
} from "./kpiOverviewNavigation";

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <MDBox pt={2}>{children}</MDBox>;
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
};

function KpiHomeSection({ title, children, darkMode }) {
  return (
    <MDBox mb={4}>
      <MDTypography variant="h5" fontWeight="bold" mb={2} color={darkMode ? "white" : "dark"}>
        {title}
      </MDTypography>
      {children}
    </MDBox>
  );
}

KpiHomeSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  darkMode: PropTypes.bool.isRequired,
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

const TENURE_OPTIONS = ["Annual", "Biannual", "Quarterly", "Monthly"];
const KPI_FILTER_ALL_VALUE = "__all__";

const KPI_FILTER_CONTROL_SX = { minWidth: { xs: "100%", sm: 140 } };
const KPI_COMPACT_FILTER_CONTROL_SX = {
  ...KPI_FILTER_CONTROL_SX,
  width: { xs: "100%", sm: 140 },
  "& .MuiSelect-select": {
    fontSize: "0.875rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

/** Above MUI AppBar (~1100); header strip and menus share this stack. */
const KPI_HEADER_Z_INDEX = 1200;

const KPI_FILTER_SELECT_MENU_PROPS = {
  MenuProps: {
    sx: { zIndex: KPI_HEADER_Z_INDEX + 1 },
  },
};

const KPI_COMPACT_MULTI_SELECT_MENU_PROPS = {
  MenuProps: {
    ...KPI_FILTER_SELECT_MENU_PROPS.MenuProps,
    PaperProps: {
      sx: {
        minWidth: 140,
        maxWidth: 220,
        "& .MuiMenuItem-root": {
          minHeight: 34,
          py: 0.35,
          px: 1,
          fontSize: "0.875rem",
        },
      },
    },
  },
};

const KPI_COMPACT_CHECKBOX_SX = { p: 0.35, mr: 0.5 };
const KPI_COMPACT_LIST_TEXT_PROPS = {
  primaryTypographyProps: {
    fontSize: "0.875rem",
    noWrap: true,
  },
};

function getTodayDateInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function readKpiRowNumber(row, keys) {
  for (const key of keys) {
    const n = Number(row?.[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readKpiRowId(row, keys) {
  for (const key of keys) {
    const raw = row?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    return String(raw);
  }
  return "";
}

function getKpiRowCmdId(row) {
  return readKpiRowId(row, ["CmdId", "cmdId", "RacId", "racId", "CommandId", "commandId"]);
}

function getKpiRowBaseId(row) {
  return readKpiRowId(row, ["BaseId", "baseId", "FormationId", "formationId"]);
}

function filterKpiRowsByRacBase(rows, racIds, baseIds) {
  const racSet = new Set((racIds || []).map(String));
  const baseSet = new Set((baseIds || []).map(String));
  const hasRacFilter = racSet.size > 0;
  const hasBaseFilter = baseSet.size > 0;
  if (!hasRacFilter && !hasBaseFilter) return rows;

  return (rows || []).filter((row) => {
    const rowCmdId = getKpiRowCmdId(row);
    const rowBaseId = getKpiRowBaseId(row);
    if (hasRacFilter && (!rowCmdId || !racSet.has(rowCmdId))) return false;
    if (hasBaseFilter && (!rowBaseId || !baseSet.has(rowBaseId))) return false;
    return true;
  });
}

function buildKpiFinancialBarChart({
  shareRows,
  racOptions,
  baseOptions,
  racIds,
  baseIds,
  fieldKeys,
}) {
  const groupByBase = (racIds || []).length > 0 || (baseIds || []).length > 0;
  const selectedBaseSet = new Set((baseIds || []).map(String));
  const sourceOptions = groupByBase
    ? (baseOptions || []).filter(
        (option) =>
          selectedBaseSet.size === 0 || selectedBaseSet.has(String(option.id ?? option.Id))
      )
    : racOptions || [];

  const labels = sourceOptions.map((option) => getKpiOptionName(option) || String(option.id ?? ""));
  const data = sourceOptions.map((option) => {
    const optionId = String(option.id ?? option.Id ?? "");
    return (shareRows || []).reduce((sum, row) => {
      const rowId = groupByBase ? getKpiRowBaseId(row) : getKpiRowCmdId(row);
      if (rowId !== optionId) return sum;
      return sum + (readKpiRowNumber(row, fieldKeys) || 0);
    }, 0);
  });

  if (labels.length > 0) return { labels, data };

  return {
    labels: ["All"],
    data: [
      (shareRows || []).reduce((sum, row) => sum + (readKpiRowNumber(row, fieldKeys) || 0), 0),
    ],
  };
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
    hb: "secondary",
  };
  return map[card.key] || "info";
}

function resolveAssetCardIcon(card) {
  if (card.key === "total") return "summarize";
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

function resolveAssetCardIconClass(card) {
  const map = {
    categoryA: "fa-solid fa-store",
    categoryB: "fa-solid fa-building",
    categoryC: "fa-solid fa-tractor",
    bts: "fa-solid fa-tower-cell",
    hb: "fa-solid fa-rectangle-ad",
  };
  return map[card.key] || "";
}

const ASSET_CARDS_VISIBLE_COUNT = 6;
const ASSET_CARD_GAP_PX = 12;
const ASSET_CARD_SLOT_WIDTH = `calc((100% - ${
  (ASSET_CARDS_VISIBLE_COUNT - 1) * ASSET_CARD_GAP_PX
}px) / ${ASSET_CARDS_VISIBLE_COUNT})`;

function AssetCardsScroller({ cards, loading, darkMode, cardSx, onCardClick }) {
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
    <MDBox display="flex" alignItems="stretch" gap={0.5} sx={{ overflow: "visible" }}>
      <MDBox
        ref={scrollRef}
        sx={{
          display: "flex",
          gap: `${ASSET_CARD_GAP_PX}px`,
          overflowX: "auto",
          overflowY: "visible",
          flex: 1,
          minWidth: 0,
          pt: 2,
          mt: -2,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": {
            display: "none",
            width: 0,
            height: 0,
          },
        }}
      >
        {cards.map((a) => (
          <MDBox
            key={a.key}
            data-asset-card
            sx={{
              flex: `0 0 ${ASSET_CARD_SLOT_WIDTH}`,
              width: ASSET_CARD_SLOT_WIDTH,
              maxWidth: ASSET_CARD_SLOT_WIDTH,
              minWidth: 0,
              boxSizing: "border-box",
              overflow: "visible",
            }}
          >
            <AssetCard
              label={a.label}
              count={a.count}
              areaLine={a.areaLine}
              mil={a.mil}
              darkMode={darkMode}
              cardSx={cardSx}
              color={resolveAssetCardColor(a)}
              icon={resolveAssetCardIcon(a)}
              iconClass={resolveAssetCardIconClass(a)}
              onClick={onCardClick ? () => onCardClick(a) : undefined}
            />
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
};

function AssetCard({
  label,
  count,
  areaLine,
  mil,
  darkMode,
  cardSx,
  color,
  icon,
  iconClass,
  onClick,
}) {
  const m = mil && typeof mil === "object" ? { ...DEFAULT_MIL, ...mil } : DEFAULT_MIL;
  const hasLoginStyleIcon = Boolean(iconClass);

  return (
    <Card
      sx={{
        ...cardSx,
        px: 1.5,
        pb: 1.5,
        pt: 2.5,
        overflow: "visible",
        ...(onClick
          ? {
              cursor: "pointer",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 28px rgba(0,0,0,0.1)",
              },
            }
          : {}),
      }}
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
      <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.75}>
        <MDBox
          variant="gradient"
          bgColor={color}
          color={color === "light" ? "dark" : "white"}
          coloredShadow={color}
          borderRadius="xl"
          display="flex"
          justifyContent="center"
          alignItems="center"
          width="3.25rem"
          height="3.25rem"
          mt={-1.5}
          sx={{
            flexShrink: 0,
            ...(hasLoginStyleIcon
              ? {
                  background: darkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.72)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: darkMode
                    ? "1px solid rgba(255,255,255,0.16)"
                    : "1px solid rgba(255,255,255,0.55)",
                  clipPath: "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)",
                  boxShadow: darkMode
                    ? "0 8px 24px rgba(0,0,0,0.35)"
                    : "0 8px 22px rgba(0,0,0,0.12)",
                  "& i": {
                    fontSize: "2.2rem",
                    background: "linear-gradient(135deg, #102a4d 0%, #3b82f6 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    display: "inline-block",
                    transition: "transform 0.3s ease",
                  },
                  "&:hover i": { transform: "scale(1.1)" },
                }
              : {}),
          }}
        >
          {hasLoginStyleIcon ? (
            <i className={iconClass} aria-hidden="true" />
          ) : (
            <Icon fontSize="medium" color="inherit">
              {icon}
            </Icon>
          )}
        </MDBox>
        <MDBox
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          flex={1}
          ml={1}
          minWidth={0}
        >
          <MDTypography
            variant="button"
            fontWeight="bold"
            color={darkMode ? "white" : "dark"}
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </MDTypography>
          <MDBox
            width={8}
            height={8}
            flexShrink={0}
            borderRadius="50%"
            sx={{ bgcolor: `${color}.main`, boxShadow: `0 0 0 3px rgba(0,0,0,0.04)` }}
          />
        </MDBox>
      </MDBox>
      <MDBox textAlign="center" py={0.5} mb={0.5}>
        <MDTypography
          variant="h4"
          fontWeight="bold"
          color={darkMode ? "white" : "dark"}
          sx={{ fontSize: { xs: "1.65rem", sm: "1.85rem" }, lineHeight: 1.15 }}
        >
          {count.toLocaleString()}
        </MDTypography>
      </MDBox>
      <MDBox display="flex" alignItems="baseline" justifyContent="space-between" gap={1} mt={0.75}>
        <MDTypography variant="caption" color="text" sx={{ opacity: 0.75, flexShrink: 0 }}>
          Area
        </MDTypography>
        <MDTypography
          variant="caption"
          fontWeight="bold"
          color="info"
          sx={{
            textAlign: "right",
            minWidth: 0,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {areaLine}
        </MDTypography>
      </MDBox>
      <MDBox
        mt={1}
        pt={1}
        sx={{
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <MDBox
          display="flex"
          justifyContent="space-between"
          alignItems="baseline"
          gap={0.5}
          mb={0.5}
        >
          <MDTypography
            variant="body2"
            component="span"
            color="text"
            sx={{ opacity: 0.9, fontSize: "0.875rem", lineHeight: 1.35, flexShrink: 0 }}
          >
            Income
          </MDTypography>
          <MDTypography
            variant="body2"
            component="span"
            fontWeight="bold"
            color={darkMode ? "white" : "dark"}
            sx={{
              fontSize: "0.875rem",
              lineHeight: 1.35,
              minWidth: 0,
              textAlign: "right",
              overflowWrap: "anywhere",
            }}
          >
            {formatKpiMoneyLabel(Number(m.incomePA) || 0)}
          </MDTypography>
        </MDBox>
        <MDTypography
          variant="body2"
          component="div"
          textAlign="center"
          fontWeight={600}
          color={darkMode ? "white" : "dark"}
          sx={{ fontSize: "0.8125rem", letterSpacing: 0.3, mt: 0.25, mb: 0.75 }}
        >
          Shares
        </MDTypography>
        {SHARE_MIL_ROWS.map((row) => (
          <MDBox
            key={row.key}
            display="flex"
            justifyContent="space-between"
            alignItems="baseline"
            gap={0.5}
            mb={0.5}
          >
            <MDTypography
              variant="body2"
              component="span"
              color="text"
              sx={{ opacity: 0.9, fontSize: "0.875rem", lineHeight: 1.35, flexShrink: 0 }}
            >
              {row.label}
            </MDTypography>
            <MDTypography
              variant="body2"
              component="span"
              fontWeight="bold"
              color={darkMode ? "white" : "dark"}
              sx={{
                fontSize: "0.875rem",
                lineHeight: 1.35,
                minWidth: 0,
                textAlign: "right",
                overflowWrap: "anywhere",
              }}
            >
              {formatKpiMoneyLabel(Number(m[row.key]) || 0)}
            </MDTypography>
          </MDBox>
        ))}
      </MDBox>
    </Card>
  );
}

AssetCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  areaLine: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  iconClass: PropTypes.string,
  mil: PropTypes.shape({
    incomePA: PropTypes.number,
    govt: PropTypes.number,
    paf: PropTypes.number,
    ahq: PropTypes.number,
    rac: PropTypes.number,
    base: PropTypes.number,
  }),
  darkMode: PropTypes.bool.isRequired,
  cardSx: PropTypes.object.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

AssetCard.defaultProps = {
  mil: DEFAULT_MIL,
  iconClass: "",
  onClick: undefined,
};

function ContractHealthCard({ label, count, pct, worth, color, darkMode, cardSx, icon, onClick }) {
  return (
    <Card
      sx={{
        ...cardSx,
        p: 1.5,
        borderLeft: 4,
        borderColor: `${color}.main`,
        overflow: "visible",
        ...(onClick
          ? {
              cursor: "pointer",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 28px rgba(0,0,0,0.1)",
              },
            }
          : {}),
      }}
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
      <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.75}>
        <MDBox
          variant="gradient"
          bgColor={color}
          color={color === "light" ? "dark" : "white"}
          coloredShadow={color}
          borderRadius="xl"
          display="flex"
          justifyContent="center"
          alignItems="center"
          width="3.25rem"
          height="3.25rem"
          mt={-2}
          sx={{ flexShrink: 0 }}
        >
          <Icon fontSize="medium" color="inherit">
            {icon}
          </Icon>
        </MDBox>
        <MDBox flex={1} ml={1} minWidth={0}>
          <MDTypography variant="caption" fontWeight="bold" textTransform="uppercase" color="text">
            {label}
          </MDTypography>
        </MDBox>
      </MDBox>
      <MDBox display="flex" alignItems="baseline" justifyContent="space-between" mt={0.5}>
        <MDTypography variant="h4" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          {count.toLocaleString()}
        </MDTypography>
        <MDTypography variant="h6" fontWeight="medium" color={`${color}.main`}>
          {pct}%
        </MDTypography>
      </MDBox>
      <MDBox mt={0.5}>
        <MDTypography variant="caption" color="info" fontWeight="bold" sx={{ lineHeight: 1.35 }}>
          Worth: {formatKpiMoneyLabel(Number(worth) || 0)}
        </MDTypography>
      </MDBox>
    </Card>
  );
}

ContractHealthCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  pct: PropTypes.number.isRequired,
  worth: PropTypes.number,
  color: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  darkMode: PropTypes.bool.isRequired,
  cardSx: PropTypes.object.isRequired,
  onClick: PropTypes.func,
};

function KpiOverview() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [propertyRows, setPropertyRows] = useState([]);
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

  const fiscalPeriods = useMemo(() => getFiscalYearPeriods(6), []);
  const cardSx = useMemo(() => getEnterpriseCardSx(darkMode), [darkMode]);
  const closeFinancialZoom = useCallback(() => setFinancialZoomChart(null), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.request("GET", "/api/Dashboards/property-summary");
        if (!cancelled) {
          setPropertyRows(extractPropertySummaryRows(data));
          setContractRows(extractContractsSummaryRows(data));
          setShareRows(extractGovtPafShareRows(data));
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
    () => buildAssetCards(filteredPropertyRows, filteredShareRows),
    [filteredPropertyRows, filteredShareRows]
  );
  const health = useMemo(() => buildContractHealth(filteredContractRows), [filteredContractRows]);
  const contractStatus = useMemo(
    () => buildContractStatus(filteredContractRows),
    [filteredContractRows]
  );
  const ahqApproval = useMemo(() => buildAhqApproval(filteredContractRows), [filteredContractRows]);
  const shares = useMemo(() => buildFinancialShares(filteredShareRows), [filteredShareRows]);
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

  const handleAssetCardClick = useCallback(
    (card) => {
      const classId = resolveAssetCardClassId(card);
      openKpiTargetInNewTab(
        buildRentalPropertiesUrlFromKpi({
          racId,
          baseId,
          classId,
        })
      );
    },
    [racId, baseId]
  );

  const handleContractHealthCardClick = useCallback(
    (healthKey) => {
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId,
          baseId,
          kpiContractHealth: healthKey,
        })
      );
    },
    [racId, baseId]
  );

  const handleContractStatusCardClick = useCallback(
    (statusKey) => {
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId,
          baseId,
          kpiContractStatus: statusKey,
        })
      );
    },
    [racId, baseId]
  );

  const handleAhqApprovalCardClick = useCallback(
    (approvalKey) => {
      openKpiTargetInNewTab(
        buildContractsUrlFromKpi({
          racId,
          baseId,
          kpiApproval: approvalKey,
        })
      );
    },
    [racId, baseId]
  );

  const overviewContent = (
    <>
      {loading ? (
        <Grid container spacing={1.5}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <AssetCardsScroller
          cards={assetCards}
          loading={loading}
          darkMode={darkMode}
          cardSx={cardSx}
          onCardClick={handleAssetCardClick}
        />
      )}

      <MDBox mt={3}>
        <KpiCharts
          shareRows={filteredShareRows}
          assetCards={assetCards}
          loading={loading}
          chartZoomOnClick={tab === 1}
        />
      </MDBox>
    </>
  );

  const contractsSectionContent = (
    <>
      <MDTypography variant="h6" fontWeight="bold" mb={1.5} color={darkMode ? "white" : "dark"}>
        Contract Health
      </MDTypography>
      <Grid container spacing={1.5}>
        {healthCards.map((h) => (
          <Grid item xs={12} sm={6} md={2.4} key={h.key}>
            <ContractHealthCard
              label={h.label}
              count={h.count}
              pct={h.pct}
              worth={h.worth}
              color={h.color}
              icon={contractHealthIcons[h.key] || "check_circle"}
              darkMode={darkMode}
              cardSx={cardSx}
              onClick={() => handleContractHealthCardClick(h.key)}
            />
          </Grid>
        ))}
      </Grid>

      <MDTypography
        variant="h6"
        fontWeight="bold"
        mt={3}
        mb={1.5}
        color={darkMode ? "white" : "dark"}
      >
        Contract Status
      </MDTypography>
      <Grid container spacing={1.5}>
        {contractStatusCards.map((s) => (
          <Grid item xs={12} sm={6} md={3} key={s.key}>
            <ContractHealthCard
              label={s.label}
              count={s.count}
              pct={s.pct}
              worth={s.worth}
              color={s.color}
              icon={contractStatusIcons[s.key] || "check_circle"}
              darkMode={darkMode}
              cardSx={cardSx}
              onClick={() => handleContractStatusCardClick(s.key)}
            />
          </Grid>
        ))}
      </Grid>

      <MDTypography
        variant="h6"
        fontWeight="bold"
        mt={3}
        mb={1.5}
        color={darkMode ? "white" : "dark"}
      >
        AHQ Approval
      </MDTypography>
      <Grid container spacing={1.5}>
        {ahqApprovalCards.map((a) => (
          <Grid item xs={12} sm={6} md={3} key={a.key}>
            <ContractHealthCard
              label={a.label}
              count={a.count}
              pct={a.pct}
              worth={a.worth}
              color={a.color}
              icon={ahqApprovalIcons[a.key] || "schedule"}
              darkMode={darkMode}
              cardSx={cardSx}
              onClick={() => handleAhqApprovalCardClick(a.key)}
            />
          </Grid>
        ))}
      </Grid>
    </>
  );

  const pafAnnualRentChart = useMemo(() => {
    const chart = buildKpiFinancialBarChart({
      shareRows: filteredShareRows,
      racOptions,
      baseOptions,
      racIds,
      baseIds,
      fieldKeys: ["IncomePA", "incomePA", "IncomePA_Million", "incomePA_Million"],
    });
    return {
      labels: chart.labels,
      datasets: { label: "Annual Rent", data: chart.data },
    };
  }, [filteredShareRows, racOptions, baseOptions, racIds, baseIds]);

  const govtShareChart = useMemo(() => {
    const chart = buildKpiFinancialBarChart({
      shareRows: filteredShareRows,
      racOptions,
      baseOptions,
      racIds,
      baseIds,
      fieldKeys: ["GovtShare", "govtShare"],
    });
    return {
      labels: chart.labels,
      datasets: { label: "Govt Share", data: chart.data },
    };
  }, [filteredShareRows, racOptions, baseOptions, racIds, baseIds]);

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
        color={color}
        title={title}
        description={description}
        date="Updated just now"
        chart={chart}
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
  );

  const financialsSectionContent = (
    <>
      <Grid container spacing={2} mb={2}>
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
        assetCards={assetCards}
        loading={loading}
        chartZoomOnClick
        chartLayout="financials"
      />
      <Grid container spacing={1.5} mt={1}>
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
    </>
  );

  const fiscalSectionContent = (
    <FiscalKpiGrid
      rows={fiscalRows}
      fiscalPeriods={fiscalPeriods}
      expanded={analyticsExpanded}
      onToggleExpanded={() => setAnalyticsExpanded((e) => !e)}
      loading={loading}
    />
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={0.5} pb={2} px={{ xs: 1, sm: 2 }}>
        <MDBox mb={1.5}>
          <MDBox
            display="flex"
            flexDirection={{ xs: "column", lg: "row" }}
            alignItems={{ xs: "stretch", lg: "center" }}
            justifyContent="space-between"
            gap={1.5}
            mb={1}
            sx={{
              position: "relative",
              zIndex: KPI_HEADER_Z_INDEX,
              pointerEvents: "auto",
            }}
          >
            <MDTypography
              variant="h4"
              fontWeight="bold"
              color={darkMode ? "white" : "dark"}
              sx={{ lineHeight: 1.2, flexShrink: 0 }}
            >
              KPI Overview
            </MDTypography>
            <MDBox
              display="flex"
              flexWrap="wrap"
              alignItems="center"
              gap={1.5}
              sx={{ width: { xs: "100%", lg: "auto" } }}
            >
              <FormControl size="small" sx={KPI_COMPACT_FILTER_CONTROL_SX}>
                <InputLabel id="kpi-filter-rac-label">RAC</InputLabel>
                <Select
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
                            const match = racOptions.find(
                              (o) => String(o.id ?? o.Id) === String(id)
                            );
                            return getKpiOptionName(match) || id;
                          })
                          .join(", ")
                      : "All"
                  }
                >
                  <MenuItem value={KPI_FILTER_ALL_VALUE}>
                    <Checkbox
                      checked={racIds.length === 0}
                      size="small"
                      sx={KPI_COMPACT_CHECKBOX_SX}
                    />
                    <ListItemText primary="All" {...KPI_COMPACT_LIST_TEXT_PROPS} />
                  </MenuItem>
                  {racOptions.map((o) => (
                    <MenuItem key={o.id ?? o.Id} value={String(o.id ?? o.Id)}>
                      <Checkbox
                        checked={racIds.includes(String(o.id ?? o.Id))}
                        size="small"
                        sx={KPI_COMPACT_CHECKBOX_SX}
                      />
                      <ListItemText
                        primary={getKpiOptionName(o)}
                        {...KPI_COMPACT_LIST_TEXT_PROPS}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={KPI_COMPACT_FILTER_CONTROL_SX}
                disabled={loadingBaseOptions}
              >
                <InputLabel id="kpi-filter-base-label">Base</InputLabel>
                <Select
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
                            const match = baseOptions.find(
                              (o) => String(o.id ?? o.Id) === String(id)
                            );
                            return getKpiOptionName(match) || id;
                          })
                          .join(", ")
                      : "All"
                  }
                >
                  <MenuItem value={KPI_FILTER_ALL_VALUE}>
                    <Checkbox
                      checked={baseIds.length === 0}
                      size="small"
                      sx={KPI_COMPACT_CHECKBOX_SX}
                    />
                    <ListItemText primary="All" {...KPI_COMPACT_LIST_TEXT_PROPS} />
                  </MenuItem>
                  {baseOptions.map((o) => (
                    <MenuItem key={o.id ?? o.Id} value={String(o.id ?? o.Id)}>
                      <Checkbox
                        checked={baseIds.includes(String(o.id ?? o.Id))}
                        size="small"
                        sx={KPI_COMPACT_CHECKBOX_SX}
                      />
                      <ListItemText
                        primary={getKpiOptionName(o)}
                        {...KPI_COMPACT_LIST_TEXT_PROPS}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <MDInput
                type="date"
                label="As of Date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ ...KPI_FILTER_CONTROL_SX, minWidth: { sm: 160 } }}
              />
              <FormControl size="small" sx={KPI_FILTER_CONTROL_SX}>
                <InputLabel id="kpi-filter-tenure-label">Tenure</InputLabel>
                <Select
                  labelId="kpi-filter-tenure-label"
                  label="Tenure"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  MenuProps={KPI_FILTER_SELECT_MENU_PROPS.MenuProps}
                >
                  {TENURE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </MDBox>
          </MDBox>
          <Card sx={{ ...cardSx, mb: 0 }}>
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 44,
                px: 1,
                "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontWeight: 600 },
              }}
            >
              <Tab label="Home" />
              <Tab label="Assets" />
              <Tab label="Contracts" />
              <Tab label="Financials" />
              <Tab label="Fiscal Year Shares" />
            </Tabs>
          </Card>
        </MDBox>

        <TabPanel value={tab} index={0}>
          <MDBox
            sx={{
              maxHeight: { xs: "calc(100vh - 200px)", md: "calc(100vh - 180px)" },
              overflowY: "auto",
              pr: 0.5,
            }}
          >
            <KpiHomeSection title="Assets" darkMode={darkMode}>
              {overviewContent}
            </KpiHomeSection>
            <KpiHomeSection title="Contracts" darkMode={darkMode}>
              {contractsSectionContent}
            </KpiHomeSection>
            <KpiHomeSection title="Financials" darkMode={darkMode}>
              <MDBox mt={4}>{financialsSectionContent}</MDBox>
            </KpiHomeSection>
            <KpiHomeSection title="Fiscal Year Shares" darkMode={darkMode}>
              {fiscalSectionContent}
            </KpiHomeSection>
          </MDBox>
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
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <Card sx={{ ...cardSx, p: 2 }}>
                <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
                  Active Projects
                </MDTypography>
                <MDTypography variant="h3" fontWeight="bold" color="info" mt={1}>
                  {loading ? "—" : executive.activeProjects.toLocaleString()}
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  From contracts & property summary datasets
                </MDTypography>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card sx={{ ...cardSx, p: 2 }}>
                <MDTypography
                  variant="button"
                  fontWeight="bold"
                  mb={1}
                  color={darkMode ? "white" : "dark"}
                >
                  Project KPIs (fiscal view)
                </MDTypography>
                <MDTypography variant="body2" color="text" mt={1}>
                  Latest fiscal period (
                  {fiscalPeriods[fiscalPeriods.length - 1]?.headerLabel ?? "—"}
                  ): {loading ? "—" : executive.activeProjects.toLocaleString()} active projects
                </MDTypography>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </MDBox>
      <Dialog
        open={Boolean(financialZoomConfig)}
        onClose={closeFinancialZoom}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: darkMode ? "background.default" : "background.paper",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pr: 1,
          }}
        >
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {financialZoomConfig?.title || ""}
          </MDTypography>
          <IconButton onClick={closeFinancialZoom} size="small" aria-label="Close enlarged chart">
            <Icon>close</Icon>
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 6 }}>
          {financialZoomConfig && (
            <ReportsBarChart
              color={financialZoomConfig.color}
              title={financialZoomConfig.title}
              description={financialZoomConfig.description}
              date="Updated just now"
              chart={financialZoomConfig.chart}
              chartHeight="28rem"
            />
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default KpiOverview;
