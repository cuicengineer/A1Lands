import Card from "@mui/material/Card";
import { useEffect, useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import api from "../../../services/api.service";
import PropTypes from "prop-types";
import AddUserForm from "./AddUserForm";
import StatusBadge from "components/StatusBadge";

function UserMgmt() {
  const [tableRows, setTableRows] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [errors, setErrors] = useState({});
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [userData, commandData, baseData, roleData] = await Promise.all([
          api.list("User"),
          api.list("Command"),
          api.list("Base"),
          api.list("Role"),
        ]);
        if (!mounted) return;

        const userArr = Array.isArray(userData) ? userData : userData?.items || [];
        const commandArr = Array.isArray(commandData) ? commandData : commandData?.items || [];
        const baseArr = Array.isArray(baseData) ? baseData : baseData?.items || [];
        const roleArr = Array.isArray(roleData) ? roleData : roleData?.items || [];

        setTableRows(userArr);
        setCommandOptions(commandArr.map((cmd) => ({ id: Number(cmd.id), name: cmd.name })));
        setBaseOptions(
          baseArr.map((base) => ({ id: Number(base.id), name: base.name, cmdId: Number(base.cmd) }))
        );
        // Category lookup (bind to user-role): store roleName as value, roleName as key (per request)
        setRoleOptions(
          roleArr
            .map((r) => ({
              key: String(r.roleName ?? r.name ?? r.id ?? ""),
              value: String(r.roleName ?? r.name ?? r.id ?? ""),
              id: Number(r.id),
            }))
            .filter((r) => r.value)
        );
      } catch (e) {
        console.error("Failed to load data", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  const handleAddUser = () => {
    if (editingRowId) return;
    setNewRowDraft({
      id: 0,
      username: "",
      pakNo: "",
      name: "",
      password: "",
      rank: "",
      category: "",
      unitId: "",
      baseId: baseOptions[0]?.id || "",
      cmdId: commandOptions[0]?.id || "",
      status: 1,
    });
    setErrors({});
    setIsAddFormOpen(true);
  };

  const handleEditUser = (id) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    if (
      String(row.username || "")
        .trim()
        .toLowerCase() === "superuser"
    )
      return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const PASSWORD_POLICY_TEXT =
    "Password must be 6-12 characters long and contain at least 1 special character.";

  const validatePasswordPolicy = (value) => {
    const s = String(value || "");
    if (!s.trim()) return "Password is required";
    if (s.length < 6 || s.length > 12) return PASSWORD_POLICY_TEXT;
    // special char = anything that's not alphanumeric
    if (!/[^a-zA-Z0-9]/.test(s)) return PASSWORD_POLICY_TEXT;
    return "";
  };

  const validateForm = (draftToValidate, showAlert = false) => {
    const errs = {};
    const draft = draftToValidate;
    if (!draft?.username || !String(draft.username).trim()) errs.username = "Username is required";
    if (!draft?.pakNo || !String(draft.pakNo).trim()) errs.pakNo = "PakNo is required";
    if (!draft?.name || !String(draft.name).trim()) errs.name = "Name is required";
    const pwMsg = validatePasswordPolicy(draft?.password);
    if (pwMsg) errs.password = pwMsg;
    if (!draft?.rank || !String(draft.rank).trim()) errs.rank = "Rank is required";
    if (!draft?.category || !String(draft.category).trim()) errs.category = "Category is required";
    if (draft?.cmdId === "" || draft?.cmdId === null || draft?.cmdId === undefined)
      errs.cmdId = "Command is required";
    if (draft?.baseId === "" || draft?.baseId === null || draft?.baseId === undefined)
      errs.baseId = "Base is required";
    if (draft?.unitId === "" || draft?.unitId === null || draft?.unitId === undefined)
      errs.unitId = "Unit ID is required";
    if (draft?.status === "" || draft?.status === null || draft?.status === undefined)
      errs.status = "Status is required";
    setErrors(errs);

    if (showAlert && errs.password) {
      // Requirement: show policy as alert when password is not valid
      alert(PASSWORD_POLICY_TEXT);
    }
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field, value) => {
    const nextValue =
      field === "Status" || field === "CmdId" || field === "BaseId" ? Number(value) : value;
    if (editingRowId) {
      setEditDraft((draft) => {
        const updatedDraft = { ...draft, [field]: nextValue };
        if (field === "CmdId") {
          const filteredBases = baseOptions.filter((base) => base.cmdId === nextValue);
          updatedDraft.BaseId = filteredBases.length > 0 ? filteredBases[0].id : "";
        }
        return updatedDraft;
      });
    }
  };

  const handleAddSave = async () => {
    if (!validateForm(newRowDraft, true)) return;

    setErrors({});

    try {
      const payload = {
        username: newRowDraft.username,
        pakNo: newRowDraft.pakNo,
        name: newRowDraft.name,
        password: newRowDraft.password,
        rank: newRowDraft.rank,
        category: newRowDraft.category,
        unitId: newRowDraft.unitId ? Number(newRowDraft.unitId) : 0,
        status: Number(newRowDraft.status),
        cmdId: Number(newRowDraft.cmdId),
        baseId: Number(newRowDraft.baseId),
      };
      const created = await api.create("User", payload);
      setTableRows((prev) => [{ ...created, id: created.id }, ...prev]);
    } catch (e) {
      console.error("Save failed", e);
    }
    setIsAddFormOpen(false);
    setNewRowDraft(null);
    setErrors({});
  };

  const handleEditSave = async () => {
    if (!validateForm(editDraft, true)) return;

    setErrors({});

    try {
      if (editingRowId && editDraft) {
        const payload = {
          id: editDraft.id,
          ...editDraft,
          status: Number(editDraft.status),
          cmdId: Number(editDraft.cmdId),
          baseId: Number(editDraft.baseId),
          unitId: editDraft.unitId ? Number(editDraft.unitId) : 0,
        };
        const updated = await api.update("User", editingRowId, payload);
        setTableRows((prev) =>
          prev.map((r) =>
            r.id === editingRowId ? { ...(updated || editDraft), id: (updated || editDraft).id } : r
          )
        );
      }
    } catch (e) {
      console.error("Save failed", e);
    }
    setEditingRowId(null);
    setEditDraft(null);
    setErrors({});
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setErrors({});
    setIsAddFormOpen(false);
  };

  const handleDeleteUser = async (id) => {
    const row = tableRows.find((r) => r.id === id);
    if (
      row &&
      String(row.username || "")
        .trim()
        .toLowerCase() === "superuser"
    )
      return;
    if (window.confirm(`Are you sure you want to delete user with Id ${id}?`)) {
      try {
        await api.remove("User", id);
        setTableRows((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px" },
    { Header: "Id", accessor: "id", align: "center", width: "56px" },
    { Header: "Username", accessor: "username", align: "left" },
    { Header: "PakNo", accessor: "pakNo", align: "left" },
    { Header: "Name", accessor: "name", align: "left" },
    { Header: "Password", accessor: "password", align: "left" },
    { Header: "Rank", accessor: "rank", align: "left" },
    { Header: "Category", accessor: "category", align: "left" },
    {
      Header: "Command",
      accessor: "cmdId",
      align: "left",
      Cell: ({ cell: { value, row } }) => {
        const isEditing = editingRowId === row.original.id;
        const draft = isEditing ? editDraft : row.original;
        return isEditing
          ? renderCommandSelect("cmdId", Number(draft.cmdId), false)
          : commandOptions.find((cmd) => cmd.id === Number(value))?.name || value;
      },
    },
    {
      Header: "Base",
      accessor: "baseId",
      align: "left",
      Cell: ({ cell: { value, row } }) => {
        const isEditing = editingRowId === row.original.id;
        const draft = isEditing ? editDraft : row.original;
        return isEditing
          ? renderBaseSelect("baseId", Number(draft.baseId), Number(draft.cmdId), false)
          : baseOptions.find((base) => base.id === Number(value))?.name || value;
      },
    },
    { Header: "Unit", accessor: "unitId", align: "left" },
    { Header: "Status", accessor: "status", align: "center" },
  ];

  const renderStatusBadge = (status) => {
    return (
      <MDBox ml={-1}>
        <StatusBadge value={status} inactiveLabel="Inactive" inactiveColor="error" />
      </MDBox>
    );
  };

  const renderInput = (field, value, isRequired = false, isReadOnly = false) => {
    return (
      <MDInput
        value={value}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        required={isRequired}
        error={Boolean(errors[field])}
        helperText={errors[field]}
        type={field === "password" ? "password" : "text"}
        InputProps={{
          readOnly: isReadOnly,
        }}
      />
    );
  };

  const renderCategorySelect = (field, value, disabled = false) => (
    <MDInput
      select
      value={value || ""}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      disabled={disabled}
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      {roleOptions.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.value}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const renderCommandSelect = (field, value, disabled = false) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      disabled={disabled}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      {commandOptions.map((opt) => (
        <MenuItem key={opt.id} value={opt.id}>
          {opt.name}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderBaseSelect = (field, value, cmdId, disabled = false) => {
    const filteredBases = baseOptions.filter((base) => base.cmdId === cmdId);
    return (
      <MDInput
        select
        value={value}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        disabled={disabled}
        sx={{
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            minHeight: "45px",
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        {filteredBases.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  const computedRows = (() => {
    const rows = [];

    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      const isSuperuser =
        String(r.username || "")
          .trim()
          .toLowerCase() === "superuser";
      rows.push({
        __disabledRow: isSuperuser,
        id: r.id,
        username: isEditing ? renderInput("username", draft.username, true, false) : r.username,
        password: isEditing ? renderInput("password", draft.password, true) : "********",
        pakNo: isEditing ? renderInput("pakNo", draft.pakNo, false, false) : r.pakNo,
        name: isEditing ? renderInput("name", draft.name, false, false) : r.name,
        rank: isEditing ? renderInput("rank", draft.rank, false, false) : r.rank,
        category: isEditing ? renderCategorySelect("category", draft.category, false) : r.category,
        cmdId: isEditing
          ? renderCommandSelect("cmdId", Number(draft.cmdId), false)
          : commandOptions.find((cmd) => cmd.id === Number(r.cmdId))?.name || r.cmdId,
        baseId: isEditing
          ? renderBaseSelect("baseId", Number(draft.baseId), Number(draft.cmdId), false)
          : baseOptions.find((base) => base.id === Number(r.baseId))?.name || r.baseId,
        unitId: isEditing
          ? renderInput("unitId", Number(draft.unitId), false, false)
          : Number(r.unitId),
        status: isEditing
          ? renderStatusSelect("Status", draft.status)
          : renderStatusBadge(r.status),
        actions: isSuperuser ? (
          <MDBox />
        ) : isEditing ? (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleEditSave} title="Save">
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
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditUser(r.id)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteUser(r.id)}
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
            <MDBox
              sx={{
                overflowX: "auto",
                "& .MuiTable-root": {
                  tableLayout: "fixed",
                  width: "100%",
                },
                "& .MuiTable-root th": {
                  fontSize: "1.05rem !important",
                  fontWeight: "700 !important",
                  padding: "10px 10px !important",
                  borderBottom: "1px solid #d0d0d0",
                },
                "& .MuiTable-root td": {
                  padding: "8px 10px !important",
                  borderBottom: "1px solid #e0e0e0",
                },
                // Tighten spacing for numeric-ish columns after reordering:
                // 2 = Id, 11 = Unit
                "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2), & .MuiTable-root th:nth-of-type(11), & .MuiTable-root td:nth-of-type(11)":
                  {
                    paddingLeft: "6px !important",
                    paddingRight: "6px !important",
                  },
              }}
            >
              <DataTable
                table={{ columns, rows: computedRows }}
                isSorted={false}
                canSearch
                page={pageIndex}
                entriesPerPage={{ defaultValue: pageSize, entries: [5, 10, 15, 20, 25] }}
                onPageChange={(page) => setPageIndex(page)}
                onEntriesPerPageChange={(value) => {
                  setPageSize(value);
                  setPageIndex(0);
                }}
                showTotalEntries
                noEndBorder
              />
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />

      <AddUserForm
        open={isAddFormOpen}
        handleClose={handleCancel}
        newRowDraft={newRowDraft}
        setNewRowDraft={setNewRowDraft}
        commandOptions={commandOptions}
        baseOptions={baseOptions}
        roleOptions={roleOptions}
        handleAddSave={handleAddSave}
        errors={errors}
        setErrors={setErrors}
      />
    </DashboardLayout>
  );
}

UserMgmt.propTypes = {
  cell: PropTypes.shape({
    row: PropTypes.shape({
      original: PropTypes.shape({
        id: PropTypes.number,
        pakNo: PropTypes.string,
        cmdId: PropTypes.number,
        baseId: PropTypes.number,
      }),
    }),
  }),
};

export default UserMgmt;
