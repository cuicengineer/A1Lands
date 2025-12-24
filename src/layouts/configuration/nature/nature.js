import { useEffect, useState } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
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

function NatureConfig() {
  const statusOptions = [
    { value: 1, label: "Active" },
    { value: 0, label: "Not Active" },
  ];

  const [tableRows, setTableRows] = useState([]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

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
    { Header: "Id", accessor: "id", align: "left", minWidth: 1 },
    { Header: "Name", accessor: "name", align: "left", minWidth: 60 },
    { Header: "Description", accessor: "description", align: "left" },
    { Header: "Status", accessor: "status", align: "center" },
    { Header: "Rental Value (Mil)", accessor: "rentalVal", align: "right" },
    { Header: "Annual Rent (Mil)", accessor: "annualRent", align: "right" },
    { Header: "Govt Share", accessor: "govtShare", align: "right" },
    { Header: "PAF Share", accessor: "pafShare", align: "right" },
    { Header: "Property Number", accessor: "propNumber", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
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

  const computedRows = (() => {
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
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: r.id,
        name: isEditing ? renderInput("name", draft.name, "text", true) : r.name,
        description: isEditing ? renderInput("description", draft.description) : r.description,
        status: isEditing
          ? renderStatusSelect(draft.status)
          : statusOptions.find((opt) => opt.value === r.status)?.label,
        rentalVal: isEditing ? renderInput("rentalVal", draft.rentalVal, "number") : r.rentalVal,
        annualRent: isEditing
          ? renderInput("annualRent", draft.annualRent, "number")
          : r.annualRent,
        govtShare: isEditing ? renderInput("govtShare", draft.govtShare, "number") : r.govtShare,
        pafShare: isEditing ? renderInput("pafShare", draft.pafShare, "number") : r.pafShare,
        propNumber: isEditing ? renderInput("propNumber", draft.propNumber) : r.propNumber,
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
              onClick={() => handleEditNature(r.id)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteNature(r.id)}
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
              Nature
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddNature}>
              Add Nature
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

export default NatureConfig;
