/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import PieChart from "examples/Charts/PieChart";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";

// Material Dashboard 2 React contexts
import { useMaterialUIController } from "context";

function SummaryOfA1Activities() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  // Summary table data
  const summaryData = {
    total: { value: 1500, amount: 762.0, label: "Total Worth" },
    categoryA: { value: 200, amount: 145.0 },
    categoryB: { value: 1500, amount: 44.0 },
    categoryC: { value: 200, amount: 540.0 },
    bts: { value: 100, amount: 402.0 },
    hb: { value: 50, amount: 36.0 },
  };

  // Status data
  const statusData = [
    { label: "Active Contracts", count: 1500 },
    { label: "Expired Contracts", count: 100 },
    { label: "Border Line Contracts", count: 200 },
    { label: "Closed Contracts", count: 50 },
  ];

  // Govt Share vs PAF Share pie chart data
  const shareChartData = {
    labels: ["Govt Share", "PAF Share"],
    datasets: {
      label: "Share Distribution",
      data: [2517887, 385552],
      backgroundColors: ["warning", "info"],
    },
  };

  // Category distribution bar chart data
  const categoryColors = {
    A: "rgba(247, 14, 14, 0.8)", // Blue
    B: "rgba(15, 1, 1, 0.93)", // Green
    C: "rgba(255, 152, 0, 0.8)", // Orange
    BTS: "rgba(244, 67, 54, 0.8)", // Red
    HB: "rgba(156, 39, 176, 0.8)", // Purple
  };

  const categoryChartData = {
    labels: ["A", "B", "C", "BTS", "HB"],
    datasets: {
      label: "Category Distribution",
      data: [2000000, 3000000, 4000000, 5000000, 6000000], // Round millions: 2M, 3M, 4M, 5M, 6M
      backgroundColor: [
        categoryColors.A,
        categoryColors.B,
        categoryColors.C,
        categoryColors.BTS,
        categoryColors.HB,
      ],
    },
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        {/* Main Container with Light Blue Border */}
        <Card
          sx={{
            border: darkMode ? "3px solid rgba(255, 255, 255, 0.2)" : "3px solid #87CEEB",
            borderRadius: "12px",
            padding: 3,
            backgroundColor: darkMode ? "#1a1a1a" : "#d9dde3",
          }}
        >
          <Grid container spacing={2}>
            {/* Top Section: Summary Cards - Using ComplexStatisticsCard format */}
            <Grid item xs={12}>
              <Grid container spacing={3}>
                {[
                  {
                    key: "total",
                    label: "Total Lands",
                    data: summaryData.total,
                    icon: "dashboard",
                    color: "info",
                  },
                  {
                    key: "categoryA",
                    label: "CAT A Lands",
                    data: summaryData.categoryA,
                    icon: "category",
                    color: "primary",
                  },
                  {
                    key: "categoryB",
                    label: "CAT B Lands",
                    data: summaryData.categoryB,
                    icon: "category",
                    color: "success",
                  },
                  {
                    key: "categoryC",
                    label: "CAT C Lands",
                    data: summaryData.categoryC,
                    icon: "category",
                    color: "warning",
                  },
                  {
                    key: "bts",
                    label: "BTS",
                    data: summaryData.bts,
                    icon: "signal_cellular_alt",
                    color: "error",
                  },
                  { key: "hb", label: "HB", data: summaryData.hb, icon: "home", color: "dark" },
                ].map((item) => (
                  <Grid item xs={12} sm={6} md={2} key={item.key}>
                    <MDBox mb={1.5}>
                      <ComplexStatisticsCard
                        color={item.color}
                        icon={item.icon}
                        title={item.label}
                        count={item.data.value}
                        percentage={{
                          color: "info",
                          amount: `Total Worth: ${item.data.amount.toFixed(2)} Mil`,
                        }}
                      />
                    </MDBox>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Status Stickers - Using ComplexStatisticsCard format with advanced styling */}
            <Grid item xs={12}>
              <Grid container spacing={3} mt={2}>
                {statusData.map((status, index) => {
                  // Determine color and icon based on status label
                  let color = "success"; // Default green
                  let icon = "check_circle";
                  let percentageColor = "success";
                  let percentageAmount = "";
                  let percentageLabel = "";

                  if (status.label === "Active") {
                    color = "success";
                    icon = "check_circle";
                    percentageColor = "success";
                    percentageAmount = "";
                    percentageLabel = "Active contracts";
                  } else if (status.label === "Expired") {
                    color = "error";
                    icon = "schedule";
                    percentageColor = "error";
                    percentageAmount = "";
                    percentageLabel = "Expired contracts";
                  } else if (status.label === "Border Line") {
                    color = "warning";
                    icon = "warning";
                    percentageColor = "warning";
                    percentageAmount = "";
                    percentageLabel = "Border line contracts";
                  } else if (status.label === "Closed") {
                    color = "warning";
                    icon = "close";
                    percentageColor = "warning";
                    percentageAmount = "";
                    percentageLabel = "Closed contracts";
                  }

                  return (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                      <MDBox mb={1.5}>
                        <ComplexStatisticsCard
                          color={color}
                          icon={icon}
                          title={status.label}
                          count={status.count}
                          percentage={{
                            color: percentageColor,
                            amount: percentageAmount,
                            label: percentageLabel,
                          }}
                        />
                      </MDBox>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            {/* Bottom Section: Charts in one row */}
            <Grid item xs={12}>
              <Grid container spacing={3} mt={2}>
                {/* Share Distribution Pie Chart - 4 columns with modern styling */}
                <Grid item xs={12} md={4}>
                  <MDBox
                    mb={3}
                    sx={{
                      "& .MuiCard-root": {
                        borderRadius: "16px",
                        boxShadow: darkMode
                          ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                          : "0 8px 24px rgba(0, 0, 0, 0.12)",
                        background: darkMode
                          ? "linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)"
                          : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                        border: darkMode
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid rgba(0, 0, 0, 0.05)",
                        transition: "all 0.3s ease-in-out",
                        color: darkMode ? "#ffffff" : "inherit",
                        "&:hover": {
                          boxShadow: darkMode
                            ? "0 12px 32px rgba(0, 0, 0, 0.7)"
                            : "0 12px 32px rgba(0, 0, 0, 0.15)",
                          transform: "translateY(-4px)",
                        },
                      },
                      "& .MuiTypography-root": {
                        color: darkMode ? "#ffffff !important" : "inherit",
                      },
                    }}
                  >
                    <PieChart
                      chart={shareChartData}
                      height="240px"
                      icon={{ color: "info", component: "pie_chart" }}
                      title="Share Distribution"
                      description="Govt Share vs PAF Share"
                    />
                  </MDBox>
                </Grid>

                {/* Category Distribution Bar Chart - 8 columns (remaining width) */}
                <Grid item xs={12} md={8}>
                  <MDBox
                    mb={3}
                    sx={{
                      height: "300px",
                      "& .MuiCard-root": {
                        borderRadius: "16px",
                        boxShadow: darkMode
                          ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                          : "0 8px 24px rgba(0, 0, 0, 0.12)",
                        background: darkMode
                          ? "linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)"
                          : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                        border: darkMode
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid rgba(0, 0, 0, 0.05)",
                        transition: "all 0.3s ease-in-out",
                        color: darkMode ? "#ffffff" : "inherit",
                        height: "100%",
                        "&:hover": {
                          boxShadow: darkMode
                            ? "0 12px 32px rgba(0, 0, 0, 0.7)"
                            : "0 12px 32px rgba(0, 0, 0, 0.15)",
                          transform: "translateY(-4px)",
                        },
                      },
                      "& .MuiTypography-root": {
                        color: darkMode ? "#ffffff !important" : "inherit",
                      },
                    }}
                  >
                    <MDBox>
                      <ReportsBarChart
                        color="info"
                        title="Category Distribution"
                        description=""
                        date=""
                        chart={categoryChartData}
                        height="300px"
                      />
                      {/* Color Map Legend */}
                      <MDBox
                        mt={2}
                        display="flex"
                        flexWrap="wrap"
                        gap={2}
                        justifyContent="center"
                        sx={{
                          "& .color-item": {
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          },
                          "& .color-box": {
                            width: "20px",
                            height: "20px",
                            borderRadius: "4px",
                            border: "1px solid rgba(0, 0, 0, 0.1)",
                          },
                          "& .color-label": {
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: darkMode ? "#ffffff !important" : "#000000",
                          },
                        }}
                      >
                        {Object.entries(categoryColors).map(([category, color]) => (
                          <MDBox key={category} className="color-item">
                            <MDBox
                              className="color-box"
                              sx={{
                                backgroundColor: color,
                              }}
                            />
                            <MDTypography className="color-label">{category}</MDTypography>
                          </MDBox>
                        ))}
                      </MDBox>
                    </MDBox>
                  </MDBox>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SummaryOfA1Activities;
