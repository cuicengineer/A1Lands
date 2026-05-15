import { useEffect, useState, useMemo } from "react";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import lockDateApi from "services/api.lockdate.service";
import { canCreateCurrentMenu, canEditCurrentMenu } from "services/api.service";
import { useMaterialUIController } from "context";
import { format, parseISO, isValid } from "date-fns";

function unwrapLockDateList(response) {
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

function pickLockDateValue(row) {
  const raw =
    row?.LockingDate ??
    row?.lockingDate ??
    row?.lockingdate ??
    row?.LockDate ??
    row?.lockDate ??
    "";
  if (raw === null || raw === undefined || String(raw).trim() === "") return "";
  const s = String(raw).trim();
  const datePart = s.includes("T") ? s.split("T")[0] : s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    const parsed = parseISO(s);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return s;
}

function pickLockDateId(row) {
  const id = row?.Id ?? row?.id;
  if (id === null || id === undefined || String(id).trim() === "") return null;
  return id;
}

function formatLockDateDisplay(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  try {
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    const parsed = parseISO(datePart);
    if (isValid(parsed)) return format(parsed, "dd-MMM-yyyy");
  } catch {
    // ignore invalid parseISO
  }
  return raw;
}

function LockDateConfig() {
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
  const [newErrors, setNewErrors] = useState({});

  const hasExistingRow = tableRows.length > 0;

  useEffect(() => {
    fetchLockDates();
  }, []);

  const fetchLockDates = async () => {
    try {
      const response = await lockDateApi.getAll();
      const rows = unwrapLockDateList(response)
        .map((row) => {
          const lockDate = pickLockDateValue(row);
          return {
            ...row,
            id: pickLockDateId(row) ?? 1,
            lockDate,
            lockingDate: lockDate,
          };
        })
        .slice(0, 1);
      setTableRows(rows);
    } catch (error) {
      console.error("Error fetching lock dates:", error);
      setTableRows([]);
    }
  };

  const handleAddLockDate = () => {
    if (!canCreate) return;
    if (hasExistingRow || editingRowId) return;
    setEditingRowId("__new__");
    setNewErrors({});
    setNewRowDraft({
      id: 1,
      lockDate: "",
    });
  };

  const handleEditLockDate = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row, lockDate: pickLockDateValue(row) });
  };

  const handleChange = (value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, lockDate: value }));
      if (newErrors.lockDate) setNewErrors((prev) => ({ ...prev, lockDate: undefined }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, lockDate: value }));
    }
  };

  const validateLockDate = (draft) => {
    const lockDate = draft?.lockDate;
    if (!lockDate || String(lockDate).trim() === "") {
      setNewErrors({ lockDate: "Lock Date is required" });
      return false;
    }
    setNewErrors({});
    return true;
  };

  const buildPutPayload = (lockDate) => ({
    LockingDate: lockDate,
    lockingDate: lockDate,
  });

  const handleSave = async () => {
    if (editingRowId === "__new__" && newRowDraft) {
      if (!canCreate) return;
      if (!validateLockDate(newRowDraft)) return;
      try {
        const id = newRowDraft.id ?? 1;
        await lockDateApi.update(id, buildPutPayload(newRowDraft.lockDate));
        await fetchLockDates();
        setEditingRowId(null);
        setNewRowDraft(null);
        setNewErrors({});
      } catch (error) {
        console.error("Error saving lock date:", error);
        alert("Failed to save lock date. Please try again.");
      }
    } else if (editingRowId && editDraft) {
      if (!canEdit) return;
      if (!validateLockDate(editDraft)) return;
      try {
        await lockDateApi.update(editingRowId, buildPutPayload(editDraft.lockDate));
        await fetchLockDates();
        setEditingRowId(null);
        setEditDraft(null);
        setNewErrors({});
      } catch (error) {
        console.error("Error updating lock date:", error);
        alert("Failed to update lock date. Please try again.");
      }
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setNewErrors({});
  };

  const renderDateInput = (value, mandatory = false) => (
    <MDInput
      value={value || ""}
      onChange={(e) => handleChange(e.target.value)}
      size="small"
      fullWidth
      type="date"
      required={mandatory}
      InputLabelProps={{ shrink: true }}
      error={Boolean(newErrors.lockDate)}
      helperText={newErrors.lockDate}
      sx={
        darkMode
          ? {
              "& .MuiInputBase-input": { color: "#000000 !important" },
              "& .MuiFormHelperText-root": { color: "#000000 !important" },
            }
          : {}
      }
    />
  );

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "60px" },
    {
      Header: "Lock Date",
      id: "lockingDate",
      accessor: "lockingDate",
      align: "left",
      minWidth: "160px",
    },
  ];

  const computedRows = useMemo(() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        lockingDate: renderDateInput(newRowDraft.lockDate, true),
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
        lockingDate: isEditing
          ? renderDateInput(draft.lockDate, true)
          : formatLockDateDisplay(r.lockingDate || r.lockDate || pickLockDateValue(r)),
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
                onClick={() => handleEditLockDate(r.id)}
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
  }, [tableRows, editingRowId, editDraft, newRowDraft, newErrors, darkMode, canEdit]);

  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  const tableKey = useMemo(
    () => `lock-date-table-${tableRows.length}-${tableRows.map((r) => r.id).join("-")}`,
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
              Lock Date
            </MDTypography>
          </MDBox>
          <MDBox pt={3}>
            <MDBox
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "70vh",
                minHeight: "400px",
                overflow: "hidden",
                "& .MuiTableContainer-root": {
                  flex: "1 1 0",
                  minHeight: 0,
                  overflow: "hidden",
                },
                "& .MuiTable-root": {
                  tableLayout: "auto",
                  width: "auto",
                  minWidth: "100%",
                },
                "& .MuiTableCell-root": {
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                  maxWidth: "100%",
                  verticalAlign: "top",
                },
                "& .MuiTable-root th": {
                  fontSize: "1.15rem !important",
                  fontWeight: "700 !important",
                  padding: "8px 6px !important",
                  borderBottom: "1px solid #d0d0d0",
                },
                "& .MuiTable-root td": {
                  padding: "8px 6px !important",
                  borderBottom: "1px solid #e0e0e0",
                },
              }}
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
                exportFileName="Lock-Date"
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

export default LockDateConfig;
