import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import { useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import Icon from "@mui/material/Icon";
function DataConfig() {
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [tableRows, setTableRows] = useState([
    {
      id: "1",
      className: "A",
      cmd: "North",
      units: "Unit 1",
      natureOfBusiness: "Retail",
      propertyBoO: "Owned",
      propertyGrouping: "Group A",
      revenueRates: "10%",
      contracts: "2",
      profitSharing: "Yes",
      userAccounts: "5",
      updatedBy: "Admin",
      updatedDate: "2025-01-10",
    },
    {
      id: "2",
      className: "B",
      cmd: "South",
      units: "Unit 2",
      natureOfBusiness: "Services",
      propertyBoO: "Leased",
      propertyGrouping: "Group B",
      revenueRates: "12%",
      contracts: "3",
      profitSharing: "No",
      userAccounts: "3",
      updatedBy: "Admin",
      updatedDate: "2025-01-12",
    },
  ]);
  const columns = [
    { Header: "Class", accessor: "className", align: "left" },
    { Header: "Cmd", accessor: "cmd", align: "left" },
    { Header: "Units", accessor: "units", align: "left" },
    { Header: "Nature of Business", accessor: "natureOfBusiness", align: "left" },
    { Header: "Property - BoO", accessor: "propertyBoO", align: "left" },
    { Header: "Property Grouping", accessor: "propertyGrouping", align: "left" },
    { Header: "Reveneue Rates", accessor: "revenueRates", align: "left" },
    { Header: "Contracts", accessor: "contracts", align: "left" },
    { Header: "Profit Sharing", accessor: "profitSharing", align: "left" },
    { Header: "User Accounts", accessor: "userAccounts", align: "left" },
    { Header: "Updated By", accessor: "updatedBy", align: "left" },
    { Header: "Updated Date", accessor: "updatedDate", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];
  const handleAddNew = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      className: "",
      cmd: "",
      units: "",
      natureOfBusiness: "",
      propertyBoO: "",
      propertyGrouping: "",
      revenueRates: "",
      contracts: "",
      profitSharing: "",
      userAccounts: "",
      updatedBy: "",
      updatedDate: "",
    });
  };
  const handleEdit = (id) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };
  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((d) => ({ ...d, [field]: value }));
    } else if (editingRowId) {
      setEditDraft((d) => ({ ...d, [field]: value }));
    }
  };
  const handleSave = () => {
    if (editingRowId === "__new__" && newRowDraft) {
      const rowToAdd = { ...newRowDraft, id: String(Date.now()) };
      setTableRows((prev) => [rowToAdd, ...prev]);
      setEditingRowId(null);
      setNewRowDraft(null);
    } else if (editingRowId && editDraft) {
      setTableRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...editDraft } : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };
  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };
  const handleDelete = (id) => {
    setTableRows((prev) => prev.filter((r) => r.id !== id));
  };
  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
    />
  );
  const computedRows = (() => {
    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        className: renderInput("className", newRowDraft.className),
        cmd: renderInput("cmd", newRowDraft.cmd),
        units: renderInput("units", newRowDraft.units),
        natureOfBusiness: renderInput("natureOfBusiness", newRowDraft.natureOfBusiness),
        propertyBoO: renderInput("propertyBoO", newRowDraft.propertyBoO),
        propertyGrouping: renderInput("propertyGrouping", newRowDraft.propertyGrouping),
        revenueRates: renderInput("revenueRates", newRowDraft.revenueRates),
        contracts: renderInput("contracts", newRowDraft.contracts),
        profitSharing: renderInput("profitSharing", newRowDraft.profitSharing),
        userAccounts: renderInput("userAccounts", newRowDraft.userAccounts),
        updatedBy: renderInput("updatedBy", newRowDraft.updatedBy),
        updatedDate: renderInput("updatedDate", newRowDraft.updatedDate),
        actions: (
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              <Icon>save</Icon>&nbsp;Save
            </MDButton>
            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              <Icon>close</Icon>&nbsp;Cancel
            </MDButton>
          </MDBox>
        ),
      });
    }
    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        className: isEditing ? renderInput("className", draft.className) : r.className,
        cmd: isEditing ? renderInput("cmd", draft.cmd) : r.cmd,
        units: isEditing ? renderInput("units", draft.units) : r.units,
        natureOfBusiness: isEditing
          ? renderInput("natureOfBusiness", draft.natureOfBusiness)
          : r.natureOfBusiness,
        propertyBoO: isEditing ? renderInput("propertyBoO", draft.propertyBoO) : r.propertyBoO,
        propertyGrouping: isEditing
          ? renderInput("propertyGrouping", draft.propertyGrouping)
          : r.propertyGrouping,
        revenueRates: isEditing ? renderInput("revenueRates", draft.revenueRates) : r.revenueRates,
        contracts: isEditing ? renderInput("contracts", draft.contracts) : r.contracts,
        profitSharing: isEditing
          ? renderInput("profitSharing", draft.profitSharing)
          : r.profitSharing,
        userAccounts: isEditing ? renderInput("userAccounts", draft.userAccounts) : r.userAccounts,
        updatedBy: isEditing ? renderInput("updatedBy", draft.updatedBy) : r.updatedBy,
        updatedDate: isEditing ? renderInput("updatedDate", draft.updatedDate) : r.updatedDate,
        actions: isEditing ? (
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              <Icon>save</Icon>&nbsp;Save
            </MDButton>
            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              <Icon>close</Icon>&nbsp;Cancel
            </MDButton>
          </MDBox>
        ) : (
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDButton variant="text" color="dark" size="small" onClick={() => handleEdit(r.id)}>
              <Icon>edit</Icon>&nbsp;Edit
            </MDButton>
            <MDButton variant="text" color="error" size="small" onClick={() => handleDelete(r.id)}>
              <Icon>delete</Icon>&nbsp;Delete
            </MDButton>
          </MDBox>
        ),
      });
    });
    return rows;
  })();
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2}
                mt={-3}
                py={3}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <MDTypography variant="h6" color="white">
                  Data Config
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleAddNew}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={{ columns, rows: computedRows }}
                  isSorted={false}
                  canSearch={true}
                  entriesPerPage={{ defaultValue: 5, entries: [5, 10, 15, 20, 25] }}
                  showTotalEntries={true}
                  noEndBorder
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
export default DataConfig;
