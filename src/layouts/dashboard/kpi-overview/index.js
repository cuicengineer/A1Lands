/**
 * KPI Overview — enterprise analytics dashboard (property-summary API).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Skeleton from "@mui/material/Skeleton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useMaterialUIController } from "context";
import api from "services/api.service";

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
  getFiscalYearPeriods,
} from "./kpiDataUtils";

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <MDBox pt={2}>{children}</MDBox>;
}

TabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
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

const ACC_RAC_BASES_ENTITY = "AccRacBase";

const TENURE_OPTIONS = ["Annual", "Biannual", "Quarterly", "Monthly"];

const KPI_FILTER_CONTROL_SX = { minWidth: { xs: "100%", sm: 140 } };

/** Above MUI AppBar (~1100); header strip and menus share this stack. */
const KPI_HEADER_Z_INDEX = 1200;

const KPI_FILTER_SELECT_MENU_PROPS = {
  MenuProps: {
    sx: { zIndex: KPI_HEADER_Z_INDEX + 1 },
  },
};

function getTodayDateInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unwrapAccRacBasesList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.Items)) return res.Items;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.Data)) return res.Data;
  return [];
}

function mapAccRacBasesRow(row, fallbackId = "") {
  const id = String(row?.id ?? row?.Id ?? fallbackId ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  return { id, name };
}

function AssetCard({ label, count, areaLine, worth, mil, darkMode, cardSx, color }) {
  const m = mil && typeof mil === "object" ? { ...DEFAULT_MIL, ...mil } : DEFAULT_MIL;

  return (
    <Card sx={{ ...cardSx, p: 1.5 }}>
      <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={0.75}>
        <MDTypography variant="button" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          {label}
        </MDTypography>
        <MDBox
          width={8}
          height={8}
          borderRadius="50%"
          sx={{ bgcolor: `${color}.main`, boxShadow: `0 0 0 3px rgba(0,0,0,0.04)` }}
        />
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
          fontWeight="medium"
          color={darkMode ? "white" : "text"}
          sx={{ textAlign: "right", minWidth: 0, lineHeight: 1.25 }}
        >
          {areaLine}
        </MDTypography>
      </MDBox>
      <MDBox display="flex" alignItems="baseline" justifyContent="space-between" gap={1} mt={0.5}>
        <MDTypography variant="caption" color="text" sx={{ opacity: 0.75, flexShrink: 0 }}>
          Worth
        </MDTypography>
        <MDTypography variant="button" fontWeight="bold" color="info" sx={{ whiteSpace: "nowrap" }}>
          {worth.toFixed(2)} Mil
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
            sx={{ opacity: 0.9, fontSize: "0.875rem", lineHeight: 1.35 }}
          >
            Income PA
          </MDTypography>
          <MDTypography
            variant="body2"
            component="span"
            fontWeight="bold"
            color={darkMode ? "white" : "dark"}
            sx={{ fontSize: "0.875rem", whiteSpace: "nowrap", lineHeight: 1.35 }}
          >
            {(Number(m.incomePA) || 0).toFixed(2)} Mil
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
              sx={{ opacity: 0.9, fontSize: "0.875rem", lineHeight: 1.35 }}
            >
              {row.label}
            </MDTypography>
            <MDTypography
              variant="body2"
              component="span"
              fontWeight="bold"
              color={darkMode ? "white" : "dark"}
              sx={{ fontSize: "0.875rem", whiteSpace: "nowrap", lineHeight: 1.35 }}
            >
              {(Number(m[row.key]) || 0).toFixed(2)} Mil
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
  worth: PropTypes.number.isRequired,
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
};

AssetCard.defaultProps = {
  mil: DEFAULT_MIL,
};

function ContractHealthCard({ label, count, pct, trend, color, darkMode, cardSx }) {
  const TrendIcon = trend >= 0 ? TrendingUpIcon : TrendingDownIcon;
  const trendColor = trend >= 0 ? "success.main" : "error.main";

  return (
    <Card sx={{ ...cardSx, p: 1.5, borderLeft: 4, borderColor: `${color}.main` }}>
      <MDTypography variant="caption" fontWeight="bold" textTransform="uppercase" color="text">
        {label}
      </MDTypography>
      <MDBox display="flex" alignItems="baseline" justifyContent="space-between" mt={0.5}>
        <MDTypography variant="h4" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          {count.toLocaleString()}
        </MDTypography>
        <MDTypography variant="h6" fontWeight="medium" color={`${color}.main`}>
          {pct}%
        </MDTypography>
      </MDBox>
      <MDBox display="flex" alignItems="center" gap={0.5} mt={0.5}>
        <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
        <MDTypography variant="caption" sx={{ color: trendColor }}>
          {Math.abs(trend)}% vs portfolio
        </MDTypography>
      </MDBox>
    </Card>
  );
}

ContractHealthCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  pct: PropTypes.number.isRequired,
  trend: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  darkMode: PropTypes.bool.isRequired,
  cardSx: PropTypes.object.isRequired,
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
  const [racId, setRacId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [asOfDate, setAsOfDate] = useState(getTodayDateInputValue);
  const [tenure, setTenure] = useState("Annual");
  const [racOptions, setRacOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [loadingRacOptions, setLoadingRacOptions] = useState(false);
  const [loadingBaseOptions, setLoadingBaseOptions] = useState(false);

  const fiscalPeriods = useMemo(() => getFiscalYearPeriods(6), []);
  const cardSx = useMemo(() => getEnterpriseCardSx(darkMode), [darkMode]);

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
        const racRes = await api.list(ACC_RAC_BASES_ENTITY, { type: "RAC" }).catch(() => []);
        if (cancelled) return;
        const racArr = unwrapAccRacBasesList(racRes)
          .map(mapAccRacBasesRow)
          .filter((o) => o.id && o.name);
        setRacOptions(racArr);
      } catch (e) {
        if (!cancelled) console.error("KPI Overview RAC list:", e);
      } finally {
        if (!cancelled) setLoadingRacOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!racId) {
      setBaseOptions([]);
      setBaseId("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingBaseOptions(true);
      try {
        const raw = await api
          .list(ACC_RAC_BASES_ENTITY, { parentId: String(racId) })
          .catch(() => []);
        if (cancelled) return;
        const arr = unwrapAccRacBasesList(raw)
          .map(mapAccRacBasesRow)
          .filter((o) => o.id && o.name);
        setBaseOptions(arr);
        setBaseId((prev) => (prev && arr.some((o) => String(o.id) === String(prev)) ? prev : ""));
      } catch (e) {
        if (!cancelled) {
          console.error("KPI Overview Base list:", e);
          setBaseOptions([]);
        }
      } finally {
        if (!cancelled) setLoadingBaseOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [racId]);

  const handleRacChange = useCallback((event) => {
    setRacId(event.target.value);
    setBaseId("");
  }, []);

  const executive = useMemo(
    () => buildExecutiveKpis(propertyRows, contractRows, shareRows),
    [propertyRows, contractRows, shareRows]
  );
  const assetCards = useMemo(
    () => buildAssetCards(propertyRows, shareRows),
    [propertyRows, shareRows]
  );
  const health = useMemo(() => buildContractHealth(contractRows), [contractRows]);
  const contractStatus = useMemo(() => buildContractStatus(contractRows), [contractRows]);
  const ahqApproval = useMemo(() => buildAhqApproval(contractRows), [contractRows]);
  const shares = useMemo(() => buildFinancialShares(shareRows), [shareRows]);
  const fiscalRows = useMemo(
    () => buildFiscalKpiGridRows(propertyRows, contractRows, shareRows, fiscalPeriods),
    [propertyRows, contractRows, shareRows, fiscalPeriods]
  );

  const healthTotal = health.active + health.expiring + health.terminated + health.vacant || 1;

  const healthCards = useMemo(() => {
    const items = [
      { key: "active", label: "Active", count: health.active, color: "success" },
      { key: "expiring", label: "Expiring", count: health.expiring, color: "warning" },
      { key: "terminated", label: "Terminated", count: health.terminated, color: "error" },
      { key: "vacant", label: "Vacant", count: health.vacant, color: "info" },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / healthTotal) * 100);
      const trend = pct > 25 ? 4 : -2;
      return { ...item, pct, trend };
    });
  }, [health, healthTotal]);

  const contractStatusTotal =
    contractStatus.viable +
      contractStatus.unviable +
      contractStatus.active +
      contractStatus.inactive || 1;

  const contractStatusCards = useMemo(() => {
    const items = [
      { key: "viable", label: "Viable", count: contractStatus.viable, color: "success" },
      { key: "unviable", label: "Unviable", count: contractStatus.unviable, color: "error" },
      { key: "active", label: "Active", count: contractStatus.active, color: "info" },
      { key: "inactive", label: "Inactive", count: contractStatus.inactive, color: "dark" },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / contractStatusTotal) * 100);
      const trend = pct > 25 ? 4 : -2;
      return { ...item, pct, trend };
    });
  }, [contractStatus, contractStatusTotal]);

  const ahqApprovalTotal = ahqApproval.approved + ahqApproval.pending || 1;

  const ahqApprovalCards = useMemo(() => {
    const items = [
      { key: "approved", label: "Approved", count: ahqApproval.approved, color: "success" },
      { key: "pending", label: "Pending", count: ahqApproval.pending, color: "warning" },
    ];
    return items.map((item) => {
      const pct = Math.round((item.count / ahqApprovalTotal) * 100);
      const trend = pct > 25 ? 4 : -2;
      return { ...item, pct, trend };
    });
  }, [ahqApproval, ahqApprovalTotal]);

  const assetColors = {
    lands: "info",
    categoryA: "primary",
    categoryB: "success",
    categoryC: "warning",
    bts: "error",
    hb: "secondary",
  };

  const handleTabChange = useCallback((_, v) => setTab(v), []);

  const overviewContent = (
    <>
      {loading ? (
        <Grid container spacing={1.5}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <Skeleton variant="rounded" height={260} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={1.5}>
          {assetCards.map((a) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={a.key}>
              <AssetCard
                label={a.label}
                count={a.count}
                areaLine={a.areaLine}
                worth={a.worth}
                mil={a.mil}
                darkMode={darkMode}
                cardSx={cardSx}
                color={assetColors[a.key] || "info"}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <MDBox mt={3}>
        <KpiCharts shareRows={shareRows} assetCards={assetCards} loading={loading} />
      </MDBox>
    </>
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
              <FormControl size="small" sx={KPI_FILTER_CONTROL_SX}>
                <InputLabel id="kpi-filter-rac-label">RAC</InputLabel>
                <Select
                  labelId="kpi-filter-rac-label"
                  label="RAC"
                  value={racId}
                  onChange={handleRacChange}
                  disabled={loadingRacOptions}
                  MenuProps={KPI_FILTER_SELECT_MENU_PROPS.MenuProps}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {racOptions.map((o) => (
                    <MenuItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={KPI_FILTER_CONTROL_SX}
                disabled={!racId || loadingBaseOptions}
              >
                <InputLabel id="kpi-filter-base-label">Base</InputLabel>
                <Select
                  labelId="kpi-filter-base-label"
                  label="Base"
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  MenuProps={KPI_FILTER_SELECT_MENU_PROPS.MenuProps}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {baseOptions.map((o) => (
                    <MenuItem key={o.id} value={String(o.id)}>
                      {o.name}
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
              <Tab label="Assets" />
              <Tab label="Contracts" />
              <Tab label="Financials" />
              <Tab label="Fiscal Year Shares" />
            </Tabs>
          </Card>
        </MDBox>

        <TabPanel value={tab} index={0}>
          {overviewContent}
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <MDTypography variant="h6" fontWeight="bold" mb={1.5} color={darkMode ? "white" : "dark"}>
            Contract Health
          </MDTypography>
          <Grid container spacing={1.5}>
            {healthCards.map((h) => (
              <Grid item xs={12} sm={6} md={3} key={h.key}>
                <ContractHealthCard
                  label={h.label}
                  count={h.count}
                  pct={h.pct}
                  trend={h.trend}
                  color={h.color}
                  darkMode={darkMode}
                  cardSx={cardSx}
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
                  trend={s.trend}
                  color={s.color}
                  darkMode={darkMode}
                  cardSx={cardSx}
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
                  trend={a.trend}
                  color={a.color}
                  darkMode={darkMode}
                  cardSx={cardSx}
                />
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <KpiCharts shareRows={shareRows} assetCards={assetCards} loading={loading} />
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
        </TabPanel>

        <TabPanel value={tab} index={3}>
          <FiscalKpiGrid
            rows={fiscalRows}
            fiscalPeriods={fiscalPeriods}
            expanded={analyticsExpanded}
            onToggleExpanded={() => setAnalyticsExpanded((e) => !e)}
            loading={loading}
          />
        </TabPanel>

        <TabPanel value={tab} index={4}>
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
      <Footer />
    </DashboardLayout>
  );
}

export default KpiOverview;
