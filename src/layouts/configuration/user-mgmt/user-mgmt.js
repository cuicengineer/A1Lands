import Card from "@mui/material/Card";
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

function UserMgmt() {
  const [tableRows, setTableRows] = useState([
    {
      sno: "1",
      username: "jdoe",
      rank: "Lt",
      name: "John Dc",
      pakno: "12345",
      command: "North",
      base: "Alpha",
      designation: "Ops",
      createdDate: "15/01/2024",
      status: "Active",
      password: "password123",
    },
    {
      sno: "2",
      username: "asmith",
      rank: "Capt",
      name: "Alice Sr",
      pakno: "23456",
      command: "South",
      base: "Bravo",
      designation: "Intel",
      createdDate: "02/02/2024",
      status: "Active",
      password: "password123",
    },
    {
      sno: "3",
      username: "bali",
      rank: "Maj",
      name: "Bilal Kh",
      pakno: "34567",
      command: "East",
      base: "Charli",
      designation: "Admin",
      createdDate: "20/02/2024",
      status: "Active",
      password: "password123",
    },
    {
      sno: "4",
      username: "qzhang",
      rank: "Lt Col",
      name: "Qin Zhe",
      pakno: "45678",
      command: "West",
      base: "Delta",
      designation: "Tech",
      createdDate: "03/03/2024",
      status: "Active",
      password: "password123",
    },
    {
      sno: "5",
      username: "mrahman",
      rank: "Col",
      name: "Mahmud",
      pakno: "56789",
      command: "HQ",
      base: "Echo",
      designation: "Command",
      createdDate: "20/03/2024",
      status: "Inactive",
      password: "password123",
    },
    {
      sno: "6",
      username: "nqureshi",
      rank: "Lt",
      name: "Nadia Qu",
      pakno: "67890",
      command: "North",
      base: "Alpha",
      designation: "Ops",
      createdDate: "22/11/2025",
      status: "Active",
      password: "password123",
    },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddUser = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      sno: "",
      username: "",
      rank: "",
      name: "",
      pakno: "",
      command: "",
      base: "",
      designation: "",
      createdDate: "",
      status: "",
      password: "",
    });
  };

  const handleEditUser = (username) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.username === username);
    if (!row) return;
    setEditingRowId(username);
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
      setTableRows((prev) => [{ ...newRowDraft }, ...prev]);
      setEditingRowId(null);
      setNewRowDraft(null);
    } else if (editingRowId && editDraft) {
      setTableRows((prev) => prev.map((r) => (r.username === editingRowId ? { ...editDraft } : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "5%" },
    { Header: "Username", accessor: "username", align: "left" },
    { Header: "Rank", accessor: "rank", align: "left" },
    { Header: "Name", accessor: "name", align: "left" },
    { Header: "PakNo", accessor: "pakno", align: "left" },
    { Header: "Command", accessor: "command", align: "left" },
    { Header: "Base", accessor: "base", align: "left" },
    { Header: "Role", accessor: "role", align: "left" },
    { Header: "Password", accessor: "password", align: "left" },
    { Header: "Designation", accessor: "designation", align: "left" },
    { Header: "Created Date", accessor: "createdDate", align: "center" },
    { Header: "Status", accessor: "status", align: "center" },
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
        username: renderInput("username", newRowDraft.username),
        rank: renderInput("rank", newRowDraft.rank),
        name: renderInput("name", newRowDraft.name),
        pakno: renderInput("pakno", newRowDraft.pakno),
        command: renderInput("command", newRowDraft.command),
        base: renderInput("base", newRowDraft.base),
        designation: renderInput("designation", newRowDraft.designation),
        createdDate: renderInput("createdDate", newRowDraft.createdDate),
        status: renderInput("status", newRowDraft.status),
        password: renderInput("password", newRowDraft.password),
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

    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.username;
      const draft = isEditing ? editDraft : r;
      rows.push({
        sno: isEditing ? renderInput("sno", draft.sno) : r.sno,
        username: isEditing ? renderInput("username", draft.username) : r.username,
        rank: isEditing ? renderInput("rank", draft.rank) : r.rank,
        name: isEditing ? renderInput("name", draft.name) : r.name,
        pakno: isEditing ? renderInput("pakno", draft.pakno) : r.pakno,
        command: isEditing ? renderInput("command", draft.command) : r.command,
        base: isEditing ? renderInput("base", draft.base) : r.base,
        designation: isEditing ? renderInput("designation", draft.designation) : r.designation,
        createdDate: isEditing ? renderInput("createdDate", draft.createdDate) : r.createdDate,
        status: isEditing ? renderInput("status", draft.status) : renderStatusBadge(r.status),
        password: isEditing ? renderInput("password", draft.password) : "********",
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              Save
            </MDButton>
            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              Cancel
            </MDButton>
          </MDBox>
        ) : (
          <MDBox display="flex" gap={1}>
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() => handleEditUser(r.username)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteUser(r.username)}
            >
              Delete
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
              User Management
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddUser}>
              Add User
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
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default UserMgmt;
