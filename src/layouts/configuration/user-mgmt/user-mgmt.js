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
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import api from "../../../services/api.service";
import PropTypes from "prop-types";
import AddUserForm from "./AddUserForm";

function UserMgmt() {
  const [tableRows, setTableRows] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [errors, setErrors] = useState({});
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [userData, commandData, baseData] = await Promise.all([
          api.list("User"),
          api.list("Command"),
          api.list("Base"),
        ]);
        if (!mounted) return;

        const userArr = Array.isArray(userData) ? userData : userData?.items || [];
        const commandArr = Array.isArray(commandData) ? commandData : commandData?.items || [];
        const baseArr = Array.isArray(baseData) ? baseData : baseData?.items || [];

        setTableRows(userArr);
        setCommandOptions(commandArr.map((cmd) => ({ id: Number(cmd.id), name: cmd.name })));
        setBaseOptions(
          baseArr.map((base) => ({ id: Number(base.id), name: base.name, cmdId: Number(base.cmd) }))
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
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const validateForm = (draftToValidate) => {
    const errs = {};
    const draft = draftToValidate;
    if (!draft?.username || !String(draft.username).trim()) errs.username = "Username is required";
    if (!draft?.name || !String(draft.name).trim()) errs.name = "Name is required";
    if (!draft?.password || !String(draft.password).trim()) errs.password = "Password is required";
    setErrors(errs);
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
    if (!validateForm(newRowDraft)) return;

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
    if (!validateForm(editDraft)) return;

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
    { Header: "Id", accessor: "id", align: "left" },
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
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderStatusBadge = (status) => {
    const label = status === 1 ? "Active" : "Inactive";
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

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
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
      rows.push({
        id: r.id,
        username: isEditing ? renderInput("username", draft.username, true, false) : r.username,
        password: isEditing ? renderInput("password", draft.password, true) : "********",
        pakNo: isEditing ? renderInput("pakNo", draft.pakNo, false, false) : r.pakNo,
        name: isEditing ? renderInput("name", draft.name, false, false) : r.name,
        rank: isEditing ? renderInput("rank", draft.rank, false, false) : r.rank,
        category: isEditing ? renderInput("category", draft.category, false, false) : r.category,
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
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleEditSave}>
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
              onClick={() => handleEditUser(r.id)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteUser(r.id)}
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

      <AddUserForm
        open={isAddFormOpen}
        handleClose={handleCancel}
        newRowDraft={newRowDraft}
        setNewRowDraft={setNewRowDraft}
        commandOptions={commandOptions}
        baseOptions={baseOptions}
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
