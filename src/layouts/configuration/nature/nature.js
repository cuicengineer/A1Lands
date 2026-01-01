import { useEffect, useState, useMemo } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import api from "services/api.service";
import StatusBadge from "components/StatusBadge";

function NatureConfig() {
  const statusOptions = [
    { value: 1, label: "Active" },
    { value: 0, label: "Not Active" },
  ];

  const [tableRows, setTableRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    fetchNatures();
  }, []);

  const fetchNatures = async () => {
    try {
      const response = await api.list("Nature");
      setTableRows(response);
    } catch (error) {
      console.error("Error fetching natures:", error);
    }
  };

  const handleAddNature = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: tableRows.length > 0 ? Math.max(...tableRows.map((r) => r.id)) + 1 : 1,
      name: "",
      description: "",
      status: statusOptions[0].value,
      rentalVal: 0,
      annualRent: 0,
      govtShare: 0,
      pafShare: 0,
      propNumber: "",
    });
  };

  const handleEditNature = (id) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
  };

  const handleSave = async () => {
    if (editingRowId === "__new__" && newRowDraft) {
      if (!newRowDraft.name) {
        alert("Name is mandatory.");
        return;
      }
      try {
        const payload = {
          ...newRowDraft,
          rentalVal: newRowDraft.rentalVal === "" ? null : newRowDraft.rentalVal,
          annualRent: newRowDraft.annualRent === "" ? null : newRowDraft.annualRent,
          govtShare: newRowDraft.govtShare === "" ? null : parseFloat(newRowDraft.govtShare),
          pafShare: newRowDraft.pafShare === "" ? null : parseFloat(newRowDraft.pafShare),
        };
        const { id, ...createPayload } = payload;
        await api.create("Nature", createPayload);
        fetchNatures();
        setEditingRowId(null);
        setNewRowDraft(null);
      } catch (error) {
        console.error("Error creating nature:", error);
      }
    } else if (editingRowId && editDraft) {
      if (!editDraft.name) {
        alert("Name is mandatory.");
        return;
      }
      try {
        const payload = {
          ...editDraft,
          rentalVal: editDraft.rentalVal === "" ? null : parseFloat(editDraft.rentalVal),
          annualRent: editDraft.annualRent === "" ? null : parseFloat(editDraft.annualRent),
          govtShare: editDraft.govtShare === "" ? null : parseFloat(editDraft.govtShare),
          pafShare: editDraft.pafShare === "" ? null : parseFloat(editDraft.pafShare),
        };
        await api.update("Nature", editingRowId, payload);
        fetchNatures();
        setEditingRowId(null);
        setEditDraft(null);
      } catch (error) {
        console.error("Error updating nature:", error);
      }
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteNature = async (id) => {
    try {
      await api.remove("Nature", id);
      fetchNatures();
    } catch (error) {
      console.error("Error deleting nature:", error);
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "8%" },
    { Header: "Id", accessor: "id", align: "left", width: "6%" },
    { Header: "Name", accessor: "name", align: "left", width: "18%" },
    { Header: "Description", accessor: "description", align: "left", width: "24%" },
    { Header: "Status", accessor: "status", align: "center", width: "8%" },
    { Header: "Rental Value (Mil)", accessor: "rentalVal", align: "right", width: "10%" },
    { Header: "Annual Rent (Mil)", accessor: "annualRent", align: "right", width: "10%" },
    { Header: "Govt Share", accessor: "govtShare", align: "right", width: "8%" },
    { Header: "PAF Share", accessor: "pafShare", align: "right", width: "8%" },
    { Header: "Property Number", accessor: "propNumber", align: "left", width: "10%" },
  ];

  const renderInput = (field, value, type = "text", mandatory = false) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      type={type}
      {...(type === "number" &&
        (field === "rentalVal" ||
          field === "annualRent" ||
          field === "govtShare" ||
          field === "pafShare") && { step: "any" })}
      required={mandatory}
    />
  );

  const renderStatusSelect = (value) => (
    <Select
      value={value}
      onChange={(e) => handleChange("status", e.target.value)}
      size="small"
      fullWidth
    >
      {statusOptions.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </Select>
  );

  const computedRows = useMemo(() => {
    const filteredRows = tableRows.filter((row) =>
      Object.values(row || {}).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        name: renderInput("name", newRowDraft.name, "text", true),
        description: renderInput("description", newRowDraft.description),
        status: renderStatusSelect(newRowDraft.status),
        rentalVal: renderInput("rentalVal", newRowDraft.rentalVal, "number"),
        annualRent: renderInput("annualRent", newRowDraft.annualRent, "number"),
        govtShare: renderInput("govtShare", newRowDraft.govtShare, "number"),
        pafShare: renderInput("pafShare", newRowDraft.pafShare, "number"),
        propNumber: renderInput("propNumber", newRowDraft.propNumber),
        actions: (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    }

    filteredRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: r.id,
        name: isEditing ? (
          renderInput("name", draft.name, "text", true)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.name}
          </MDBox>
        ),
        description: isEditing ? (
          renderInput("description", draft.description)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.description}
          </MDBox>
        ),
        status: isEditing ? (
          renderStatusSelect(draft.status)
        ) : (
          <StatusBadge value={r.status} inactiveLabel="Not Active" inactiveColor="error" />
        ),
        rentalVal: isEditing ? renderInput("rentalVal", draft.rentalVal, "number") : r.rentalVal,
        annualRent: isEditing
          ? renderInput("annualRent", draft.annualRent, "number")
          : r.annualRent,
        govtShare: isEditing ? renderInput("govtShare", draft.govtShare, "number") : r.govtShare,
        pafShare: isEditing ? renderInput("pafShare", draft.pafShare, "number") : r.pafShare,
        propNumber: isEditing ? renderInput("propNumber", draft.propNumber) : r.propNumber,
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ) : (
          <MDBox
            alignItems="left"
            justifyContent="left"
            sx={{
              backgroundColor: "#f8f9fa", // Light grey background
              gap: "2px", // Manually set small gap between icons
              padding: "2px 2px", // Adds some internal padding
              borderRadius: "2px", // Optional: softens the box edges
            }}
          >
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditNature(r.id)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteNature(r.id)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    });

    return rows;
  }, [tableRows, searchQuery, editingRowId, editDraft, newRowDraft]);

  // Memoize the table object to prevent DataTable from resetting pagination
  // This is lightweight - just stores a reference to columns and computedRows
  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  // Create a stable key based on the actual data (not editing state)
  // This prevents DataTable remounting when only editing state changes
  // Very lightweight - just a string concatenation
  const tableKey = useMemo(
    () => `nature-table-${tableRows.length}-${tableRows.map((r) => r.id).join("-")}`,
    [tableRows]
  );

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
              Nature
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={2}>
              <MDButton variant="gradient" color="info" onClick={handleAddNature}>
                Add Nature
              </MDButton>
            </MDBox>
          </MDBox>
          <MDBox pt={3}>
            <MDBox
              sx={{
                overflowX: "auto",
                "& .MuiTable-root": {
                  tableLayout: "fixed",
                  width: "100%",
                },
                "& .MuiTableCell-root": {
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                  maxWidth: "100%",
                  verticalAlign: "top",
                },
                "& .MuiTableCell-root *": {
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  maxWidth: "100%",
                },
                "& .MuiTable-root th": {
                  fontSize: "1.15rem !important",
                  fontWeight: "700 !important",
                  padding: "12px 10px !important",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  borderBottom: "1px solid #d0d0d0",
                },
                "& .MuiTable-root td": {
                  padding: "10px 10px !important",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  hyphens: "auto",
                  maxWidth: "100%",
                  borderBottom: "1px solid #e0e0e0",
                },
                "& .MuiTable-root td > div": {
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                },
                "& .MuiTable-root td *": {
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                },
                "& .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3)": {
                  maxWidth: "240px",
                  width: "20%",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                },
                "& .MuiTable-root td:nth-of-type(3) > *": {
                  display: "block",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  maxWidth: "100%",
                },
                "& .MuiTable-root th:nth-of-type(4), & .MuiTable-root td:nth-of-type(4)": {
                  maxWidth: "240px",
                  width: "20%",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                },
              }}
            >
              <DataTable
                table={tableData}
                isSorted={false}
                canSearch={true}
                page={pageIndex}
                entriesPerPage={{
                  defaultValue: pageSize,
                  entries: [5, 10, 15, 20, 25],
                }}
                onPageChange={(page) => setPageIndex(page)}
                onEntriesPerPageChange={(value) => {
                  setPageSize(value);
                  setPageIndex(0); // Reset to first page when page size changes
                }}
                showTotalEntries
                noEndBorder
              />
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default NatureConfig;
