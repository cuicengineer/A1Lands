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

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";

// Data
import authorsTableData from "layouts/tables/data/authorsTableData";
import projectsTableData from "layouts/tables/data/projectsTableData";

function Tables() {
  const { columns, rows } = authorsTableData();
  const { columns: pColumns, rows: pRows } = projectsTableData();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Tables"
        subtitle="Sample data tables"
        bodySx={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          overflow: "hidden",
        }}
      >
        <MDBox
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
            "& .MuiTableContainer-root": {
              flex: "1 1 0",
              minHeight: 0,
              overflow: "hidden",
            },
          }}
        >
          <DataTable
            table={{ columns, rows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={false}
            showTotalEntries={false}
            noEndBorder
          />
        </MDBox>
        <MDBox
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
            "& .MuiTableContainer-root": {
              flex: "1 1 0",
              minHeight: 0,
              overflow: "hidden",
            },
          }}
        >
          <DataTable
            table={{ columns: pColumns, rows: pRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={false}
            showTotalEntries={false}
            noEndBorder
          />
        </MDBox>
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default Tables;
