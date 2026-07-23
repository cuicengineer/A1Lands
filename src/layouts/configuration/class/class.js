import { useCallback, useEffect, useState } from "react";

// @mui material components
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { compactActionSnoColumnsSx } from "utils/compactActionSnoColumnsSx";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "../../../services/api.service";
import { useMaterialUIController } from "context";
import { fetchReceiptProductOptions } from "layouts/accounts/receipts/receiptUtils";

const UOM_OPTIONS = ["Marla", "Sq Ft", "Acre"];

const getRowUoM = (row) => row?.uoM ?? row?.UoM ?? row?.uom ?? "";

const getRowItemWithCode = (row) => String(row?.itemWithCode ?? row?.ItemWithCode ?? "").trim();

/** Same active Item with Code options as contract invoice finalize dialog. */
async function fetchClassItemWithCodeOptions() {
  const products = await fetchReceiptProductOptions();
  return (products || [])
    .map((row) => {
      const label = String(row?.label || "").trim();
      if (!label) return null;
      const itemCode = label.includes(" - ") ? label.split(" - ")[0].trim() : label;
      if (!itemCode) return null;
      return {
        value: itemCode,
        label,
      };
    })
    .filter(Boolean);
}

function resolveItemWithCodeLabel(options, value) {
  const key = String(value || "")
    .trim()
    .toUpperCase();
  if (!key) return "";
  const match = (options || []).find(
    (option) =>
      String(option?.value || "")
        .trim()
        .toUpperCase() === key
  );
  return match?.label || String(value || "").trim();
}

function ClassConfig() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tableRows, setTableRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [itemWithCodeOptions, setItemWithCodeOptions] = useState([]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list("Class");
      const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
      setTableRows(arr);
    } catch (e) {
      console.error("Failed to load classes", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItemWithCodeOptions = useCallback(async () => {
    try {
      const options = await fetchClassItemWithCodeOptions();
      setItemWithCodeOptions(options);
    } catch (e) {
      console.error("Failed to load Item with Code options", e);
      setItemWithCodeOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    loadItemWithCodeOptions();
  }, [fetchClasses, loadItemWithCodeOptions]);

  const handleAddClass = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: 0,
      code: "",
      name: "",
      description: "",
      uoM: "",
      itemWithCode: "",
      status: 0,
    });
    setErrors({});
  };

  const handleEditClass = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({
      ...row,
      uoM: getRowUoM(row),
      itemWithCode: getRowItemWithCode(row),
    });
  };

  const handleChange = (field, value) => {
    let nextValue = field === "status" ? Number(value) : value;

    if (field === "code") {
      nextValue = String(value || "").toUpperCase();
    }

    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: nextValue }));
      if (field === "name") {
        const msg = nextValue && String(nextValue).trim() ? null : "Name is required";
        setErrors((prev) => ({ ...prev, name: msg }));
      }
      if (field === "uoM") {
        const msg = nextValue && String(nextValue).trim() ? null : "UoM is required";
        setErrors((prev) => ({ ...prev, uoM: msg }));
      }
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: nextValue }));
      if (field === "uoM") {
        const msg = nextValue && String(nextValue).trim() ? null : "UoM is required";
        setErrors((prev) => ({ ...prev, uoM: msg }));
      }
    }
  };

  const validateDraft = (draft) => {
    const errs = {};
    if (!draft?.name || !draft.name.trim()) {
      errs.name = "Name is required";
    }
    if (!draft?.uoM || !String(draft.uoM).trim()) {
      errs.uoM = "UoM is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = (draft) => ({
    id: draft.id,
    code: String(draft.code || "")
      .trim()
      .toUpperCase(),
    name: draft.name,
    description: draft.description,
    uoM: draft.uoM,
    itemWithCode: String(draft.itemWithCode || "").trim() || null,
    ItemWithCode: String(draft.itemWithCode || "").trim() || null,
    status: typeof draft.status === "string" ? Number(draft.status) : draft.status,
  });

  const handleSave = async () => {
    try {
      if (editingRowId === "__new__" && newRowDraft) {
        if (!canCreate) return;
        if (!validateDraft(newRowDraft)) return;
        await api.create("Class", buildPayload(newRowDraft));
        await fetchClasses();
        setEditingRowId(null);
        setNewRowDraft(null);
      } else if (editingRowId && editDraft) {
        if (!canEdit) return;
        if (!validateDraft(editDraft)) return;
        await api.update("Class", editDraft.id, buildPayload(editDraft));
        await fetchClasses();
        setEditingRowId(null);
        setEditDraft(null);
      }
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteClass = async (id) => {
    if (!canDelete) return;
    try {
      await api.remove("Class", id);
      await fetchClasses();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    if (!canDelete) return;
    const ok = window.confirm("Are you sure you want to delete this class?");
    if (!ok) return;
    await handleDeleteClass(id);
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "56px" },
    { Header: "Id", accessor: "id", align: "left", width: "5%" },
    { Header: "Code", accessor: "code", align: "left", width: "7%" },
    { Header: "Class Name", accessor: "name", align: "left", width: "14%" },
    { Header: "Description", accessor: "description", align: "left", width: "16%" },
    { Header: "UoM", accessor: "uoM", align: "left", width: "8%" },
    { Header: "Item with Code", accessor: "itemWithCode", align: "left", width: "18%" },
    { Header: "Status", accessor: "status", align: "center", width: "8%" },
  ];

  const renderStatusBadge = (status) => {
    const s = String(status ?? "")
      .trim()
      .toLowerCase();

    let label = "Inactive";
    if (status === 1 || status === "1" || s === "true" || s === "active") {
      label = "Active";
    }
    return (
      <MDBox ml={-1}>
        <MDBadge
          badgeContent={label}
          color={label === "Active" ? "success" : "dark"}
          variant="gradient"
          size="sm"
        />
      </MDBox>
    );
  };

  const darkInputSx = darkMode
    ? {
        "& .MuiInputBase-input": {
          color: "#000000 !important",
        },
        "& .MuiInputLabel-root": {
          color: "#000000 !important",
        },
        "& .MuiFormHelperText-root": {
          color: "#000000 !important",
        },
        "& .MuiSelect-select": {
          color: "#000000 !important",
        },
        "& .MuiSvgIcon-root": {
          color: "#000000 !important",
        },
      }
    : {};

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required={editingRowId === "__new__" && (field === "name" || field === "code")}
      error={editingRowId === "__new__" && Boolean(errors?.[field])}
      helperText={editingRowId === "__new__" ? errors?.[field] : undefined}
      {...(field === "code" && {
        inputProps: { maxLength: 10, style: { textTransform: "uppercase" } },
      })}
      sx={darkInputSx}
    />
  );

  const renderUoMSelect = (field, value) => (
    <MDInput
      select
      value={value ?? ""}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      error={Boolean(errors?.[field])}
      helperText={errors?.[field]}
      displayEmpty
      SelectProps={{ displayEmpty: true }}
      sx={darkInputSx}
    >
      <MenuItem value="">
        <em>Select UoM</em>
      </MenuItem>
      {UOM_OPTIONS.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderItemWithCodeSelect = (field, value) => {
    const selected = String(value ?? "").trim();
    const hasSelectedInOptions = itemWithCodeOptions.some(
      (option) =>
        String(option.value || "")
          .trim()
          .toUpperCase() === selected.toUpperCase()
    );
    return (
      <MDInput
        select
        value={selected}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        displayEmpty
        SelectProps={{ displayEmpty: true }}
        sx={darkInputSx}
      >
        <MenuItem value="">
          <em>Select Item with Code</em>
        </MenuItem>
        {selected && !hasSelectedInOptions ? (
          <MenuItem value={selected}>{selected}</MenuItem>
        ) : null}
        {itemWithCodeOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      sx={darkInputSx}
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        code: renderInput("code", newRowDraft.code),
        name: renderInput("name", newRowDraft.name),
        description: renderInput("description", newRowDraft.description),
        uoM: renderUoMSelect("uoM", newRowDraft.uoM),
        itemWithCode: renderItemWithCodeSelect("itemWithCode", newRowDraft.itemWithCode),
        status: renderStatusSelect("status", newRowDraft.status),
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

    tableRows.forEach((row) => {
      const isEditing = editingRowId === row.id;
      const currentRow = isEditing ? editDraft : row;
      const itemWithCodeValue = getRowItemWithCode(currentRow);

      rows.push({
        id: currentRow.id,
        code: isEditing ? (
          renderInput("code", currentRow.code)
        ) : (
          <MDBox component="span" sx={{ fontWeight: "medium" }}>
            {row.code || ""}
          </MDBox>
        ),
        name: isEditing ? (
          renderInput("name", currentRow.name)
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
            {row.name}
          </MDBox>
        ),
        description: isEditing ? (
          renderInput("description", currentRow.description)
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
            {row.description}
          </MDBox>
        ),
        uoM: isEditing ? (
          renderUoMSelect("uoM", currentRow.uoM ?? getRowUoM(currentRow))
        ) : (
          <MDBox component="span" sx={{ fontWeight: "medium" }}>
            {getRowUoM(row) || "—"}
          </MDBox>
        ),
        itemWithCode: isEditing ? (
          renderItemWithCodeSelect("itemWithCode", itemWithCodeValue)
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
            {resolveItemWithCodeLabel(itemWithCodeOptions, itemWithCodeValue) || "—"}
          </MDBox>
        ),
        status: isEditing
          ? renderStatusSelect("status", currentRow.status)
          : renderStatusBadge(currentRow.status),
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
                onClick={() => handleEditClass(row.id)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                size="small"
                color="error"
                onClick={() => confirmDelete(row.id)}
                title="Delete"
                sx={{ padding: "1px" }}
              >
                <Icon>delete</Icon>
              </IconButton>
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
      <EnterpriseWorkspace
        title="Class"
        subtitle="Manage class configuration"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddClass}>
              Add Class
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
          },
          flex: "1 1 0",
          minHeight: 0,
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
            fontSize: "1rem !important",
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
          "& .MuiTable-root th:nth-of-type(5), & .MuiTable-root td:nth-of-type(5)": {
            maxWidth: "240px",
            width: "20%",
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            lineHeight: 1.4,
          },
          "& .MuiTable-root td:nth-of-type(5) > *": {
            display: "block",
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            maxWidth: "100%",
          },
          "& .MuiTable-root th:nth-of-type(7), & .MuiTable-root td:nth-of-type(7)": {
            maxWidth: "240px",
            width: "20%",
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            lineHeight: 1.4,
          },
          ...compactActionSnoColumnsSx,
        }}
      >
        <DataTable
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={{ defaultValue: 20, entries: [5, 10, 15, 20, 25] }}
          showTotalEntries
          noEndBorder
          canSearch
          exportFileName="Class"
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default ClassConfig;
