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

// @mui material components
import Grid from "@mui/material/Grid";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import DefaultLineChart from "examples/Charts/LineCharts/DefaultLineChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";

// Data
import reportsBarChartData from "layouts/dashboard/data/reportsBarChartData";
import reportsLineChartData from "layouts/dashboard/data/reportsLineChartData";

// Dashboard components
import Projects from "layouts/dashboard/components/Projects";
import OrdersOverview from "layouts/dashboard/components/OrdersOverview";

function Dashboard() {
  const { sales, tasks } = reportsLineChartData;

  // Dummy "A1 Land Activities" widgets (top)
  const a1AnnualRent = {
    labels: ["ACD", "FAC", "NAC", "CAC", "SAC", "WAC"],
    datasets: { label: "Annual Rent", data: [7250, 24500, 32500, 73500, 82500, 20500] },
  };
  const a1GovtShare = {
    labels: ["ACD", "FAC", "NAC", "CAC", "SAC", "WAC"],
    datasets: { label: "Govt Share", data: [3500, 12500, 52500, 67500, 55000, 9500] },
  };
  const a1PafShare = {
    labels: ["ACD", "FAC", "NAC", "CAC", "SAC", "WAC"],
    datasets: { label: "PAF Share", data: [5500, 17500, 0, 75500, 0, 0] },
  };
  const a1ReceiptTrend = {
    labels: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      { label: "A", color: "info", data: [52, 48, 55, 49, 57, 54, 60, 58, 56, 59, 61, 62] },
      { label: "B", color: "success", data: [44, 42, 46, 45, 47, 46, 48, 49, 50, 51, 50, 52] },
      { label: "C", color: "warning", data: [30, 28, 31, 29, 32, 30, 33, 34, 35, 34, 36, 37] },
      { label: "BT", color: "error", data: [15, 14, 15, 14, 16, 15, 16, 16, 17, 16, 17, 18] },
      { label: "HB", color: "dark", data: [40, 39, 41, 40, 42, 41, 43, 44, 45, 46, 45, 47] },
    ],
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={3}>
          <MDTypography variant="h6" textAlign="center" fontWeight="bold">
            AHQ DASHBOARD : A1 LAND ACTIVITIES
          </MDTypography>
        </MDBox>
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={6}>
            <MDBox mb={3}>
              <ReportsBarChart
                color="info"
                title="Annual Rent"
                description="Dummy data"
                date="Updated just now"
                chart={a1AnnualRent}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6}>
            <MDBox mb={3}>
              <DefaultLineChart
                title="Receipt Trend"
                description="Dummy data"
                height="16rem"
                chart={a1ReceiptTrend}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6}>
            <MDBox mb={3}>
              <ReportsBarChart
                color="warning"
                title="Govt Share"
                description="Dummy data"
                date="Updated just now"
                chart={a1GovtShare}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6}>
            <MDBox mb={3}>
              <ReportsBarChart
                color="primary"
                title="PAF Share"
                description="Dummy data"
                date="Updated just now"
                chart={a1PafShare}
              />
            </MDBox>
          </Grid>
        </Grid>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="dark"
                icon="weekend"
                title="Bookings"
                count={281}
                percentage={{
                  color: "success",
                  amount: "+55%",
                  label: "than lask week",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                icon="leaderboard"
                title="Today's Users"
                count="2,300"
                percentage={{
                  color: "success",
                  amount: "+3%",
                  label: "than last month",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="success"
                icon="store"
                title="Revenue"
                count="34k"
                percentage={{
                  color: "success",
                  amount: "+1%",
                  label: "than yesterday",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <MDBox mb={1.5}>
              <ComplexStatisticsCard
                color="primary"
                icon="person_add"
                title="Followers"
                count="+91"
                percentage={{
                  color: "success",
                  amount: "",
                  label: "Just updated",
                }}
              />
            </MDBox>
          </Grid>
        </Grid>
        <MDBox mt={4.5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsBarChart
                  color="info"
                  title="website views"
                  description="Last Campaign Performance"
                  date="campaign sent 2 days ago"
                  chart={reportsBarChartData}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsLineChart
                  color="success"
                  title="daily sales"
                  description={
                    <>
                      (<strong>+15%</strong>) increase in today sales.
                    </>
                  }
                  date="updated 4 min ago"
                  chart={sales}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsLineChart
                  color="dark"
                  title="completed tasks"
                  description="Last Campaign Performance"
                  date="just updated"
                  chart={tasks}
                />
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>
        <MDBox>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={8}>
              <Projects />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <OrdersOverview />
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Dashboard;
