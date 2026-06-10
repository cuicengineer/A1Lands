import { useEffect, useState, useMemo } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { configurationWorkspaceBodySx } from "utils/configurationWorkspaceBodySx";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import accountingSysApi from "services/api.accountingsys.service";
import { canCreateCurrentMenu, canEditCurrentMenu } from "services/api.service";
import { useMaterialUIController } from "context";

function unwrapAccountingSysList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.Items)) return response.Items;
  if (Array.isArray(response?.result)) return response.result;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return [response.data];
  }
  if (response && typeof response === "object") return [response];
  return [];
}

function normalizeAccountingSysRow(row) {
  const id = row?.Id ?? row?.id;
  return {
    ...row,
    id: id != null && String(id).trim() !== "" ? Number(id) : null,
    particularName: String(row?.ParticularName ?? row?.particularName ?? "").trim(),
    address: String(row?.Address ?? row?.address ?? "").trim(),
    telNo: String(row?.TelNo ?? row?.telNo ?? "").trim(),
  };
}

function buildApiPayload(draft) {
  const particularName = String(draft?.particularName ?? "").trim();
  const address = String(draft?.address ?? "").trim();
  const telNo = String(draft?.telNo ?? "").trim();
  return {
    ParticularName: particularName,
    particularName,
    Address: address,
    address,
    TelNo: telNo,
    telNo,
  };
}

function AccountingSysConfig() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();

  const [tableRows, setTableRows] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const hasExistingRow = tableRows.length > 0;

  useEffect(() => {
    fetchAccountingSys();
  }, []);

  const fetchAccountingSys = async () => {
    setLoading(true);
    try {
      const response = await accountingSysApi.getAll();
      const rows = unwrapAccountingSysList(response)
        .map(normalizeAccountingSysRow)
        .filter((row) => row.id != null)
        .slice(0, 1);
      setTableRows(rows);
    } catch (error) {
      console.error("Error fetching accounting system config:", error);
      setTableRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!canCreate) return;
    if (hasExistingRow || editingRowId) return;
    setEditingRowId("__new__");
    setErrors({});
    setNewRowDraft({
      particularName: "",
      address: "",
      telNo: "",
    });
  };

  const handleEdit = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({
      particularName: row.particularName,
      address: row.address,
      telNo: row.telNo,
    });
    setErrors({});
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateDraft = (draft) => {
    const next = {};
    if (!String(draft?.particularName ?? "").trim()) {
      next.particularName = "Particular Name is required";
    }
    if (!String(draft?.address ?? "").trim()) {
      next.address = "Address is required";
    }
    if (!String(draft?.telNo ?? "").trim()) {
      next.telNo = "Tel No. is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (editingRowId === "__new__" && newRowDraft) {
      if (!canCreate) return;
      if (!validateDraft(newRowDraft)) return;
      try {
        await accountingSysApi.create(buildApiPayload(newRowDraft));
        await fetchAccountingSys();
        setEditingRowId(null);
        setNewRowDraft(null);
        setErrors({});
      } catch (error) {
        console.error("Error saving accounting system config:", error);
        alert(error?.message || "Failed to save. Please try again.");
      }
    } else if (editingRowId && editDraft) {
      if (!canEdit) return;
      if (!validateDraft(editDraft)) return;
      try {
        await accountingSysApi.update(editingRowId, buildApiPayload(editDraft));
        await fetchAccountingSys();
        setEditingRowId(null);
        setEditDraft(null);
        setErrors({});
      } catch (error) {
        console.error("Error updating accounting system config:", error);
        alert(error?.message || "Failed to update. Please try again.");
      }
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setErrors({});
  };

  const inputSx = darkMode
    ? {
        "& .MuiInputBase-input": { color: "#000000 !important" },
        "& .MuiFormHelperText-root": { color: "#000000 !important" },
      }
    : {};

  const renderTextInput = (field, value, label) => (
    <MDInput
      value={value || ""}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      label={label}
      required
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={inputSx}
    />
  );

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "60px" },
    {
      Header: "Particular Name",
      id: "particularName",
      accessor: "particularName",
      align: "left",
      minWidth: "180px",
    },
    {
      Header: "Address",
      id: "address",
      accessor: "address",
      align: "left",
      minWidth: "220px",
    },
    {
      Header: "Tel No.",
      id: "telNo",
      accessor: "telNo",
      align: "left",
      minWidth: "140px",
    },
  ];

  const computedRows = useMemo(() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: "__new__",
        particularName: renderTextInput(
          "particularName",
          newRowDraft.particularName,
          "Particular Name"
        ),
        address: renderTextInput("address", newRowDraft.address, "Address"),
        telNo: renderTextInput("telNo", newRowDraft.telNo, "Tel No."),
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

    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: r.id,
        particularName: isEditing
          ? renderTextInput("particularName", draft.particularName, "Particular Name")
          : r.particularName || "-",
        address: isEditing
          ? renderTextInput("address", draft.address, "Address")
          : r.address || "-",
        telNo: isEditing ? renderTextInput("telNo", draft.telNo, "Tel No.") : r.telNo || "-",
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
              backgroundColor: "#f8f9fa",
              gap: "2px",
              padding: "2px 2px",
              borderRadius: "2px",
            }}
          >
            {canEdit && (
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEdit(r.id)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
            )}
          </MDBox>
        ),
      });
    });

    return rows;
  }, [tableRows, editingRowId, editDraft, newRowDraft, errors, darkMode, canEdit]);

  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  const tableKey = useMemo(
    () => `accounting-sys-table-${tableRows.length}-${tableRows.map((r) => r.id).join("-")}`,
    [tableRows]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Accounting Sys."
        subtitle="Manage accounting system particulars"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate && !hasExistingRow && !editingRowId ? (
            <MDButton variant="outlined" color="dark" onClick={handleAdd}>
              Add Accounting Sys.
            </MDButton>
          ) : null
        }
        bodySx={configurationWorkspaceBodySx}
      >
        <DataTable
          key={tableKey}
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch={true}
          page={pageIndex}
          entriesPerPage={{
            defaultValue: 20,
            entries: [5, 10, 15, 20, 25],
          }}
          pageSize={pageSize}
          onPageChange={(page) => setPageIndex(page)}
          onEntriesPerPageChange={(value) => {
            setPageSize(value);
            setPageIndex(0);
          }}
          showTotalEntries
          exportFileName="Accounting-Sys"
          noEndBorder
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default AccountingSysConfig;
