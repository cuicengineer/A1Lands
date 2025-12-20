import { useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import Card from "@mui/material/Card";

function ClassConfig() {
  const [tableRows, setTableRows] = useState([
    { sno: "1", name: "A", status: "Active", createdDate: "10/01/2024" },
    { sno: "2", name: "B", status: "Active", createdDate: "15/01/2024" },
    { sno: "3", name: "C", status: "Inactive", createdDate: "20/01/2024" },
    { sno: "4", name: "BTS", status: "Active", createdDate: "25/01/2024" },
    { sno: "5", name: "HB", status: "Inactive", createdDate: "30/01/2024" },
    { sno: "6", name: "A1", status: "Active", createdDate: "05/02/2024" },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddClass = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      sno: "",
      name: "",
      status: "",
      createdDate: "",
    });
  };

  const handleEditClass = (sno) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.sno === sno);
    if (!row) return;
    setEditingRowId(sno);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
  };

  const handleSave = () => {
    if (editingRowId === "__new__" && newRowDraft) {
      setTableRows((prev) => [newRowDraft, ...prev]);
      setEditingRowId(null);
      setNewRowDraft(null);
    } else if (editingRowId && editDraft) {
      setTableRows((prev) => prev.map((r) => (r.sno === editingRowId ? editDraft : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteClass = (sno) => {
    setTableRows((prev) => prev.filter((row) => row.sno !== sno));
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "5%" },
    { Header: "Class Name", accessor: "name", align: "left" },
    { Header: "Description", accessor: "description", align: "left" },
    { Header: "Status", accessor: "status", align: "center" },
    { Header: "Created Date", accessor: "createdDate", align: "center" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderStatusBadge = (status) => (
    <MDBox ml={-1}>
      <MDBadge
        badgeContent={status}
        color={status === "Active" ? "success" : "dark"}
        variant="gradient"
        size="sm"
      />
    </MDBox>
  );

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
        sno: renderInput("sno", newRowDraft.sno),
        name: renderInput("name", newRowDraft.name),
        status: renderInput("status", newRowDraft.status),
        createdDate: renderInput("createdDate", newRowDraft.createdDate),
        actions: (
          <MDBox display="flex" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              Save
            </MDButton>
            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              Cancel
            </MDButton>
          </MDBox>
        ),
      });
    }

    tableRows.forEach((row) => {
      const isEditing = editingRowId === row.sno;
      const currentRow = isEditing ? editDraft : row;

      rows.push({
        sno: isEditing ? renderInput("sno", currentRow.sno) : currentRow.sno,
        name: isEditing ? renderInput("name", currentRow.name) : currentRow.name,
        status: isEditing
          ? renderInput("status", currentRow.status)
          : renderStatusBadge(currentRow.status),
        createdDate: isEditing
          ? renderInput("createdDate", currentRow.createdDate)
          : currentRow.createdDate,
        actions: (
          <MDBox display="flex" gap={1}>
            {isEditing ? (
              <>
                <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
                  Save
                </MDButton>
                <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
                  Cancel
                </MDButton>
              </>
            ) : (
              <>
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => handleEditClass(row.sno)}
                >
                  Edit
                </MDButton>
                <MDButton
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleDeleteClass(row.sno)}
                >
                  Delete
                </MDButton>
              </>
            )}
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
              Class
            </MDTypography>
            <MDButton variant="gradient" bgColor="dark" onClick={handleAddClass}>
              Add Class
            </MDButton>
          </MDBox>
          <MDBox pt={3}>
            <DataTable
              table={{ columns, rows: computedRows }}
              isSorted={false}
              entriesPerPage={false}
              showTotalEntries={false}
              noEndBorder
            />
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ClassConfig;
