import { useEffect, useMemo, useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { withGridValueChip } from "utils/gridValueChipCell";

import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "../../../services/api.service";
import PropTypes from "prop-types";
import AddUserForm from "./AddUserForm";
import { useMaterialUIController } from "context";
import {
  USER_APPOINT_ENTITY,
  buildAppointNameOptions,
  mapUserAppointRows,
} from "./userAppointUtils";
import { isSuperuserUsername } from "./userMgmtUtils";

/** Dashboard menu row: View is always granted and cannot be unchecked in Assign Rights. */
function isDashboardRightsMenu(menuName) {
  return (
    String(menuName || "")
      .trim()
      .toLowerCase() === "dashboard"
  );
}

function UserMgmt() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const LEVEL_OPTIONS = [
    { id: 1, label: "AHQ" },
    { id: 2, label: "Command" },
    { id: 3, label: "Base" },
  ];

  const [tableRows, setTableRows] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [appointOptions, setAppointOptions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [errors, setErrors] = useState({});
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [isRightsModalOpen, setIsRightsModalOpen] = useState(false);
  const [rightsUserId, setRightsUserId] = useState(null);
  const [rightsUserName, setRightsUserName] = useState("");
  const [mainMenuNames, setMainMenuNames] = useState([]);
  const [rightsDraftRows, setRightsDraftRows] = useState([]);
  const [rightsRowMetaByMenu, setRightsRowMetaByMenu] = useState({});
  const [isRightsSaving, setIsRightsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();

  const isAhqCommand = (cmdId) => {
    const command = commandOptions.find((c) => Number(c.id) === Number(cmdId));
    const name = String(command?.name || "")
      .trim()
      .toLowerCase();
    return name === "ahq";
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [userData, commandData, baseData, roleData, appointData] = await Promise.all([
          api.list("User"),
          api.list("Command"),
          api.list("Base"),
          api.list("Role"),
          api.list(USER_APPOINT_ENTITY).catch(() => []),
        ]);
        if (!mounted) return;

        const userArr = Array.isArray(userData) ? userData : userData?.items || [];
        const commandArr = Array.isArray(commandData) ? commandData : commandData?.items || [];
        const baseArr = Array.isArray(baseData) ? baseData : baseData?.items || [];
        const roleArr = Array.isArray(roleData) ? roleData : roleData?.items || [];

        // Normalize status once when loading - convert to 0 or 1
        setTableRows(
          userArr.map((u) => ({
            ...u,
            status: u.status === 1 || u.status === "1" || u.status === true ? 1 : 0,
            appoint: u.appoint ?? u.Appoint ?? "",
          }))
        );
        setCommandOptions(commandArr.map((cmd) => ({ id: Number(cmd.id), name: cmd.name })));
        setBaseOptions(
          baseArr.map((base) => ({ id: Number(base.id), name: base.name, cmdId: Number(base.cmd) }))
        );
        // Category lookup (bind to user-role): store roleName as value, roleName as key (per request)
        const isActiveUserRole = (r) => {
          const s = r.status ?? r.Status;
          return s === 1 || s === true || s === "1" || String(s ?? "").toLowerCase() === "true";
        };
        const isUserRoleNotDeleted = (r) => {
          const d = r.isDeleted ?? r.IsDeleted;
          if (d === undefined || d === null) return true;
          if (d === false || d === 0 || d === "0" || String(d).toLowerCase() === "false")
            return true;
          return false;
        };
        setRoleOptions(
          roleArr
            .filter((r) => isActiveUserRole(r) && isUserRoleNotDeleted(r))
            .map((r) => ({
              key: String(r.roleName ?? r.name ?? r.id ?? ""),
              value: String(r.roleName ?? r.name ?? r.id ?? ""),
              id: Number(r.id),
            }))
            .filter((r) => r.value)
        );
        setAppointOptions(mapUserAppointRows(appointData));
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  const handleAddUser = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    const defaultCmdId = commandOptions[0]?.id || "";
    const isAhq = defaultCmdId ? isAhqCommand(defaultCmdId) : false;
    const firstBaseForCmd = baseOptions.find((b) => b.cmdId === Number(defaultCmdId));
    setNewRowDraft({
      id: 0,
      username: "",
      pakNo: "",
      name: "",
      password: "",
      rank: "",
      appoint: "",
      category: [],
      unitId: "",
      baseId: isAhq && firstBaseForCmd ? firstBaseForCmd.id : "",
      cmdId: defaultCmdId,
      levelId: isAhq ? 1 : 2,
      status: 1,
    });
    setErrors({});
    setIsAddFormOpen(true);
  };

  const handleEditUser = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => Number(r.id) === Number(id));
    if (!row) return;
    if (isSuperuserUsername(row.username)) return;
    setEditingRowId(Number(id));
    // Store original row data - preserve all existing values including password placeholder
    setEditDraft({
      ...row,
      password: "********", // Show placeholder to indicate password exists, user can change it
      username: row.username || "",
      pakNo: row.pakNo || "",
      name: row.name || "",
      rank: row.rank || "",
      appoint: row.appoint ?? row.Appoint ?? "",
      category: Array.isArray(row.category)
        ? row.category
        : String(row.category || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
      cmdId: row.cmdId !== undefined && row.cmdId !== null ? Number(row.cmdId) : "",
      baseId: row.baseId !== undefined && row.baseId !== null ? Number(row.baseId) : "",
      unitId: row.unitId !== undefined && row.unitId !== null ? Number(row.unitId) : "",
      levelId: row.levelId !== undefined && row.levelId !== null ? Number(row.levelId) : "",
      status: row.status !== undefined && row.status !== null ? Number(row.status) : 1, // Ensure status is number
    });
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

  const validateForm = (draftToValidate, showAlert = false, mode = "add") => {
    const errs = {};
    const draft = draftToValidate;

    // Validate all required fields
    if (!draft?.username || !String(draft.username).trim()) {
      errs.username = "Username is required";
    } else if (mode === "add" && isSuperuserUsername(draft.username)) {
      errs.username = 'Username "superuser" is reserved and cannot be used';
    } else {
      // Duplicate username not allowed (case-insensitive)
      const usernameLower = String(draft.username).trim().toLowerCase();
      const existing = tableRows.find(
        (row) =>
          String(row.username || "")
            .trim()
            .toLowerCase() === usernameLower &&
          (mode !== "edit" || Number(row.id) !== Number(editingRowId))
      );
      if (existing) {
        errs.username = "Username already exists";
      }
    }
    if (!draft?.pakNo || !String(draft.pakNo).trim()) {
      errs.pakNo = "PakNo is required";
    }
    if (!draft?.name || !String(draft.name).trim()) {
      errs.name = "Name is required";
    }
    // Only validate password for "add" mode, not for "edit" mode (password is optional during edit)
    if (mode === "add") {
      const pwMsg = validatePasswordPolicy(draft?.password);
      if (pwMsg) errs.password = pwMsg;
    } else if (mode === "edit") {
      // For edit mode, validate password only if user changed it (not placeholder)
      const passwordValue = String(draft?.password || "").trim();
      if (passwordValue && passwordValue !== "********" && passwordValue.length > 0) {
        const pwMsg = validatePasswordPolicy(passwordValue);
        if (pwMsg) errs.password = pwMsg;
      }
    }
    if (!draft?.rank || !String(draft.rank).trim()) {
      errs.rank = "Rank is required";
    }
    const categoryArr = Array.isArray(draft?.category)
      ? draft.category
      : String(draft?.category || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    if (categoryArr.length === 0) {
      errs.category = "Category is required";
    }
    if (draft?.cmdId === "" || draft?.cmdId === null || draft?.cmdId === undefined) {
      errs.cmdId = "Command is required";
    }
    // Base is optional for non-AHQ (same as Add User form).
    if (draft?.levelId === "" || draft?.levelId === null || draft?.levelId === undefined) {
      errs.levelId = "Level ID is required";
    }
    if (draft?.status === "" || draft?.status === null || draft?.status === undefined) {
      errs.status = "Status is required";
    }
    // Only update errors state when something changed to avoid unnecessary re-renders / update loops
    setErrors((prev) => {
      const prevKeys = Object.keys(prev).sort().join();
      const nextKeys = Object.keys(errs).sort().join();
      if (prevKeys !== nextKeys) return errs;
      const same = Object.keys(errs).every((k) => prev[k] === errs[k]);
      return same ? prev : errs;
    });

    if (showAlert && Object.keys(errs).length > 0) {
      const messages = Object.values(errs).filter(Boolean);
      if (messages.length > 0) {
        alert(messages.join("\n"));
      }
    }
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field, value) => {
    const nextValue =
      field === "Status" ||
      field === "CmdId" ||
      field === "BaseId" ||
      field === "status" ||
      field === "cmdId" ||
      field === "baseId" ||
      field === "levelId"
        ? Number(value)
        : field === "category"
        ? Array.isArray(value)
          ? value
          : String(value || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
        : value;
    if (editingRowId) {
      setEditDraft((draft) => {
        const updatedDraft = { ...draft, [field]: nextValue };
        if (field === "CmdId" || field === "cmdId") {
          // Handle "None" selection (empty string)
          if (nextValue === "" || nextValue === null || nextValue === undefined) {
            updatedDraft.baseId = null;
            updatedDraft.BaseId = null;
            updatedDraft.unitId = null;
            updatedDraft.levelId = null;
          } else if (isAhqCommand(nextValue)) {
            const filteredBases = baseOptions.filter((base) => base.cmdId === Number(nextValue));
            const pick = filteredBases.length > 0 ? filteredBases[0].id : "";
            updatedDraft.baseId = pick;
            updatedDraft.BaseId = pick;
            updatedDraft.levelId = 1;
          } else {
            const filteredBases = baseOptions.filter((base) => base.cmdId === Number(nextValue));
            const pick = filteredBases.length > 0 ? filteredBases[0].id : "";
            updatedDraft.baseId = pick;
            updatedDraft.BaseId = pick;
            if (!updatedDraft.levelId || Number(updatedDraft.levelId) === 1) {
              updatedDraft.levelId = 2;
            }
          }
        }
        return updatedDraft;
      });
    }
  };

  const handleAddSave = async () => {
    if (!canCreate) return;
    if (!validateForm(newRowDraft, true, "add")) return;

    setErrors({});

    try {
      const ahqSelected = isAhqCommand(newRowDraft.cmdId);
      const hasBase =
        newRowDraft.baseId !== "" &&
        newRowDraft.baseId !== null &&
        newRowDraft.baseId !== undefined;
      const computedLevelId = ahqSelected ? 1 : hasBase ? 3 : 2;
      const payload = {
        username: newRowDraft.username,
        pakNo: newRowDraft.pakNo,
        name: newRowDraft.name,
        password: newRowDraft.password,
        rank: newRowDraft.rank,
        appoint: String(newRowDraft.appoint ?? "").trim(),
        category: (Array.isArray(newRowDraft.category)
          ? newRowDraft.category
          : String(newRowDraft.category || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
        ).join(","),
        unitId: null,
        status: Number(newRowDraft.status),
        cmdId: Number(newRowDraft.cmdId),
        baseId: newRowDraft.baseId ? Number(newRowDraft.baseId) : null,
        levelId: computedLevelId,
      };
      const created = await api.create("User", payload);
      // Normalize status when adding new row
      const normalizedCreated = {
        ...created,
        id: created.id,
        status: created.status === 1 || created.status === "1" || created.status === true ? 1 : 0,
      };
      setTableRows((prev) => [normalizedCreated, ...prev]);
    } catch (e) {
      console.error("Save failed", e);
    }
    setIsAddFormOpen(false);
    setNewRowDraft(null);
    setErrors({});
  };

  const handleEditSave = async (e) => {
    e?.stopPropagation?.();
    if (!canEdit) return;
    if (!editDraft) {
      alert("Unable to save: edit data is missing.");
      return;
    }
    if (!validateForm(editDraft, true, "edit")) return;

    setErrors({});

    try {
      const ahqSelected = isAhqCommand(editDraft.cmdId);

      // Build payload - include all required fields
      const payload = {
        id: editDraft.id,
        username: String(editDraft.username || "").trim(),
        pakNo: String(editDraft.pakNo || "").trim(),
        name: String(editDraft.name || "").trim(),
        rank: String(editDraft.rank || "").trim(),
        appoint: String(editDraft.appoint ?? editDraft.Appoint ?? "").trim(),
        category: (Array.isArray(editDraft.category)
          ? editDraft.category
          : String(editDraft.category || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
        ).join(","),
        status: Number(editDraft.status) === 1 ? 1 : 0, // Ensure status is 1 or 0
        cmdId: Number(editDraft.cmdId),
        baseId: editDraft.baseId ? Number(editDraft.baseId) : null,
        unitId:
          editDraft.unitId !== "" && editDraft.unitId !== null && editDraft.unitId !== undefined
            ? Number(editDraft.unitId)
            : null,
        levelId: ahqSelected ? 1 : editDraft.levelId ? Number(editDraft.levelId) : null,
      };

      // Only include password if user actually entered a new one (not the placeholder)
      const passwordValue = String(editDraft.password || "").trim();
      if (passwordValue && passwordValue !== "********" && passwordValue.length > 0) {
        payload.password = passwordValue;
      }

      const updated = await api.update("User", editingRowId, payload);
      setTableRows((prev) =>
        prev.map((r) => {
          if (Number(r.id) === Number(editingRowId)) {
            const updatedRow = updated || editDraft;
            // Use the payload status value (which we know is correct: 0 or 1)
            // Normalize API response status if it's in a different format
            const normalizedStatus =
              payload.status !== undefined
                ? payload.status
                : updatedRow.status === 1 || updatedRow.status === "1" || updatedRow.status === true
                ? 1
                : 0;
            return {
              ...updatedRow,
              id: updatedRow.id,
              status: normalizedStatus,
            };
          }
          return r;
        })
      );
      setEditingRowId(null);
      setEditDraft(null);
      setErrors({});
    } catch (err) {
      console.error("Save failed", err);
      alert(err?.message || "Failed to save user. Please try again.");
    }
  };

  const handleCancel = (e) => {
    e?.stopPropagation?.();
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setErrors({});
    setIsAddFormOpen(false);
  };

  const handleDeleteUser = async (id) => {
    if (!canDelete) return;
    const row = tableRows.find((r) => Number(r.id) === Number(id));
    if (row && isSuperuserUsername(row.username)) return;
    if (window.confirm(`Are you sure you want to delete user with Id ${id}?`)) {
      try {
        await api.remove("User", id);
        setTableRows((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
  };

  const loadMainMenuNames = async () => {
    try {
      const routesModule = await import("routes");
      const appRoutes = routesModule?.default || [];
      const names = appRoutes
        .filter((route) => route?.type === "collapse" && route?.name)
        .map((route) => route.name);
      setMainMenuNames(names);
      return names;
    } catch (e) {
      console.error("Failed to load main menu names", e);
      setMainMenuNames([]);
      return [];
    }
  };

  const handleOpenRightsModal = async (id) => {
    const row = tableRows.find((r) => r.id === id);

    const toBoolean = (value) =>
      value === true ||
      value === 1 ||
      value === "1" ||
      String(value || "")
        .trim()
        .toLowerCase() === "true";

    const getMenuName = (item) =>
      String(
        item?.menuName ??
          item?.MenuName ??
          item?.moduleName ??
          item?.ModuleName ??
          item?.menu ??
          item?.name ??
          ""
      ).trim();
    const normalizeMenuKey = (name) =>
      String(name || "")
        .trim()
        .toLowerCase();

    const menus = mainMenuNames.length > 0 ? mainMenuNames : await loadMainMenuNames();
    let permissionRows = [];
    try {
      const permissionsData = await api.request("GET", `/api/UserPermissions/ByUser/${id}`);
      permissionRows = Array.isArray(permissionsData)
        ? permissionsData
        : Array.isArray(permissionsData?.items)
        ? permissionsData.items
        : Array.isArray(permissionsData?.data)
        ? permissionsData.data
        : permissionsData && typeof permissionsData === "object"
        ? [permissionsData]
        : [];
    } catch (e) {
      console.error("Failed to load user permissions", e);
    }

    const rightsLookup = permissionRows.reduce((acc, item) => {
      const menuName = getMenuName(item);
      if (!menuName) return acc;
      acc[normalizeMenuKey(menuName)] = item;
      return acc;
    }, {});

    setRightsRowMetaByMenu(rightsLookup);
    setRightsDraftRows(
      menus.map((menuName) => {
        const existing = rightsLookup[normalizeMenuKey(menuName)] || {};
        const isDashboardRow = isDashboardRightsMenu(menuName);
        return {
          menuName,
          view: isDashboardRow
            ? true
            : toBoolean(existing?.canView ?? existing?.CanView ?? existing?.view ?? existing?.View),
          create: toBoolean(
            existing?.canCreate ?? existing?.CanCreate ?? existing?.create ?? existing?.Create
          ),
          edit: toBoolean(
            existing?.canEdit ?? existing?.CanEdit ?? existing?.edit ?? existing?.Edit
          ),
          delete: toBoolean(
            existing?.canDelete ?? existing?.CanDelete ?? existing?.delete ?? existing?.Delete
          ),
        };
      })
    );
    setRightsUserId(id);
    setRightsUserName(row?.username || "");
    setIsRightsModalOpen(true);
  };

  const handleCloseRightsModal = () => {
    setIsRightsModalOpen(false);
    setRightsUserId(null);
    setRightsUserName("");
    setRightsDraftRows([]);
    setRightsRowMetaByMenu({});
  };

  const handleRightsToggle = (menuName, field) => {
    if (isSuperuserUsername(rightsUserName)) return;
    if (field === "view" && isDashboardRightsMenu(menuName)) return;
    setRightsDraftRows((prev) =>
      prev.map((row) =>
        row.menuName === menuName
          ? {
              ...row,
              [field]: !row[field],
            }
          : row
      )
    );
  };

  const handleRightsSave = async () => {
    if (!rightsUserId) return;
    if (isSuperuserUsername(rightsUserName)) return;
    setIsRightsSaving(true);
    try {
      await Promise.all(
        rightsDraftRows.map((row) => {
          const existingRow =
            rightsRowMetaByMenu[row.menuName] ||
            rightsRowMetaByMenu[
              String(row.menuName || "")
                .trim()
                .toLowerCase()
            ] ||
            {};
          const {
            id,
            Id,
            view,
            View,
            create,
            Create,
            edit,
            Edit,
            delete: deleteFlag,
            Delete,
            canView,
            CanView,
            canCreate,
            CanCreate,
            canEdit,
            CanEdit,
            canDelete,
            CanDelete,
            ...existingRowWithoutPermissionFlags
          } = existingRow;
          const payload = {
            ...existingRowWithoutPermissionFlags,
            userId: rightsUserId,
            menuName: row.menuName,
            canView: row.view,
            canCreate: row.create,
            canEdit: row.edit,
            canDelete: row.delete,
          };
          return api.post("/api/UserPermissions", payload);
        })
      );
      handleCloseRightsModal();
    } catch (e) {
      console.error("Failed to save user permissions", e);
    } finally {
      setIsRightsSaving(false);
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "100px" },
    { Header: "Id", accessor: "id", align: "center", width: "56px" },
    { Header: "Username", accessor: "username", align: "left" },
    { Header: "PakNo", accessor: "pakNo", align: "left" },
    { Header: "Name", accessor: "name", align: "left" },
    { Header: "Password", accessor: "password", align: "left" },
    { Header: "Rank", accessor: "rank", align: "left" },
    { Header: "Appointment", accessor: "appoint", align: "left" },
    { Header: "Category", accessor: "category", align: "left" },
    {
      Header: "RAC",
      accessor: "cmdId",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ cell: { value, row } }) => {
        const isEditing = Number(editingRowId) === Number(row.original.id);
        const draft = isEditing ? editDraft : row.original;
        if (isEditing) {
          return renderCommandSelect("cmdId", draft.cmdId ? Number(draft.cmdId) : "", false);
        }
        const display = commandOptions.find((cmd) => cmd.id === Number(value))?.name || value;
        return withGridValueChip(display, "rac", { row });
      },
    },
    {
      Header: "Base",
      accessor: "baseId",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ cell: { value, row } }) => {
        const isEditing = Number(editingRowId) === Number(row.original.id);
        const draft = isEditing ? editDraft : row.original;
        if (isEditing) {
          return renderBaseSelect(
            "baseId",
            draft.baseId ? Number(draft.baseId) : "",
            Number(draft.cmdId),
            false
          );
        }
        const display = baseOptions.find((base) => base.id === Number(value))?.name || value;
        return withGridValueChip(display, "base", { row });
      },
    },
    {
      Header: "Level ID",
      accessor: "levelId",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ cell: { value, row } }) => {
        const isEditing = Number(editingRowId) === Number(row.original.id);
        const draft = isEditing ? editDraft : row.original;
        const ahqSelected = isAhqCommand(draft?.cmdId);
        return isEditing
          ? renderLevelSelect(
              "levelId",
              Number(draft.levelId || (ahqSelected ? 1 : 2)),
              ahqSelected
            )
          : LEVEL_OPTIONS.find((opt) => Number(opt.id) === Number(value))?.label || value || "-";
      },
    },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ cell: { value, row } }) => {
        const isEditing = Number(editingRowId) === Number(row.original.id);
        const draft = isEditing ? editDraft : row.original;
        if (isEditing) {
          return renderStatusSelect("status", draft.status);
        }
        // Get status value - prefer row.original.status, fallback to value
        // The status in row.original should be the raw number (0 or 1) from computedRows
        const statusValue = row.original?.status !== undefined ? row.original.status : value;
        // Ensure status is properly converted to number for comparison
        const numStatus = typeof statusValue === "number" ? statusValue : Number(statusValue);
        return renderStatusBadge(numStatus);
      },
    },
  ];

  const renderStatusBadge = (status) => {
    // Convert to number for consistent comparison
    let numStatus = typeof status === "number" ? status : Number(status);

    // Handle NaN, null, undefined - treat as 0 (Inactive)
    if (isNaN(numStatus) || status === null || status === undefined) {
      numStatus = 0;
    }

    // Explicitly check: if status is 0 (after conversion), show Inactive
    // Otherwise (1 or any other value), show Active
    const label = numStatus === 0 ? "Inactive" : "Active";

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
        sx={
          darkMode
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
              }
            : {}
        }
      />
    );
  };

  const renderCategorySelect = (field, value, disabled = false) => (
    <MDInput
      select
      value={
        Array.isArray(value)
          ? value
          : String(value || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
      }
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      disabled={disabled}
      error={Boolean(errors[field])}
      helperText={errors[field]}
      SelectProps={{
        multiple: true,
        renderValue: (selected) => (Array.isArray(selected) ? selected.join(", ") : ""),
      }}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          ...(darkMode ? { color: "#000000 !important" } : {}),
        },
        ...(darkMode
          ? {
              "& .MuiInputLabel-root": {
                color: "#000000 !important",
              },
              "& .MuiFormHelperText-root": {
                color: "#000000 !important",
              },
              "& .MuiSvgIcon-root": {
                color: "#000000 !important",
              },
            }
          : {}),
      }}
    >
      {roleOptions.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.value}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderStatusSelect = (field, value) => {
    // Normalize value to 1 or 0 (number) to match MenuItem values
    let normalizedValue;
    if (value === null || value === undefined || value === "") {
      normalizedValue = 1; // Default to Active
    } else if (typeof value === "boolean") {
      normalizedValue = value ? 1 : 0;
    } else {
      const numValue = Number(value);
      // Explicitly check for 0 and 1 - if numValue is 0, keep it as 0, if it's 1, keep it as 1, otherwise default to 1
      if (numValue === 0) {
        normalizedValue = 0;
      } else if (numValue === 1) {
        normalizedValue = 1;
      } else {
        normalizedValue = 1; // Default to Active for any other value
      }
    }

    return (
      <MDInput
        select
        value={normalizedValue}
        onChange={(e) => {
          const selectedValue = Number(e.target.value);
          handleChange(field, selectedValue);
        }}
        size="small"
        fullWidth
        sx={{
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
            ...(darkMode ? { color: "#000000 !important" } : {}),
          },
          ...(darkMode
            ? {
                "& .MuiInputLabel-root": {
                  color: "#000000 !important",
                },
                "& .MuiSvgIcon-root": {
                  color: "#000000 !important",
                },
              }
            : {}),
        }}
      >
        <MenuItem value={1}>Active</MenuItem>
        <MenuItem value={0}>Inactive</MenuItem>
      </MDInput>
    );
  };

  const renderCommandSelect = (field, value, disabled = false) => (
    <MDInput
      select
      value={value || ""}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      disabled={disabled}
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          ...(darkMode ? { color: "#000000 !important" } : {}),
        },
        ...(darkMode
          ? {
              "& .MuiInputLabel-root": {
                color: "#000000 !important",
              },
              "& .MuiSvgIcon-root": {
                color: "#000000 !important",
              },
            }
          : {}),
      }}
    >
      <MenuItem value="">None</MenuItem>
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
        value={value || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        disabled={disabled}
        error={Boolean(errors[field])}
        helperText={errors[field]}
        SelectProps={{
          displayEmpty: true,
        }}
        sx={{
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
            ...(darkMode ? { color: "#000000 !important" } : {}),
          },
          ...(darkMode
            ? {
                "& .MuiInputLabel-root": {
                  color: "#000000 !important",
                },
                "& .MuiSvgIcon-root": {
                  color: "#000000 !important",
                },
              }
            : {}),
        }}
      >
        <MenuItem value="">None</MenuItem>
        {filteredBases.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  const renderAppointSelect = (field, value) => {
    const options = buildAppointNameOptions(appointOptions, value);
    return (
      <MDInput
        select
        value={value || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        error={Boolean(errors[field])}
        helperText={errors[field]}
        sx={{
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
            ...(darkMode ? { color: "#000000 !important" } : {}),
          },
          ...(darkMode
            ? {
                "& .MuiInputLabel-root": {
                  color: "#000000 !important",
                },
                "& .MuiSvgIcon-root": {
                  color: "#000000 !important",
                },
              }
            : {}),
        }}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {options.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  const renderLevelSelect = (field, value, disabled = false) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      disabled={disabled}
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          ...(darkMode ? { color: "#000000 !important" } : {}),
        },
        ...(darkMode
          ? {
              "& .MuiInputLabel-root": {
                color: "#000000 !important",
              },
              "& .MuiFormHelperText-root": {
                color: "#000000 !important",
              },
              "& .MuiSvgIcon-root": {
                color: "#000000 !important",
              },
            }
          : {}),
      }}
    >
      {LEVEL_OPTIONS.map((opt) => (
        <MenuItem key={opt.id} value={opt.id}>
          {opt.id} - {opt.label}
        </MenuItem>
      ))}
    </MDInput>
  );

  const computedRows = useMemo(() => {
    const rows = [];

    tableRows.forEach((r) => {
      const isEditing = Number(editingRowId) === Number(r.id);
      const draft = isEditing ? editDraft : r;
      const isProtectedSuperuser = isSuperuserUsername(r.username);
      rows.push({
        __disabledRow: isProtectedSuperuser,
        id: r.id,
        username: isEditing ? renderInput("username", draft.username, true, false) : r.username,
        password: isEditing
          ? renderInput("password", draft.password || "********", false)
          : "********",
        pakNo: isEditing ? renderInput("pakNo", draft.pakNo, false, false) : r.pakNo,
        name: isEditing ? renderInput("name", draft.name, false, false) : r.name,
        rank: isEditing ? renderInput("rank", draft.rank, false, false) : r.rank,
        appoint: isEditing
          ? renderAppointSelect("appoint", draft.appoint ?? draft.Appoint ?? "")
          : r.appoint ?? r.Appoint ?? "" ?? "",
        category: isEditing ? renderCategorySelect("category", draft.category, false) : r.category,
        cmdId: isEditing
          ? renderCommandSelect("cmdId", draft.cmdId ? Number(draft.cmdId) : "", false)
          : commandOptions.find((cmd) => cmd.id === Number(r.cmdId))?.name || r.cmdId,
        baseId: isEditing
          ? renderBaseSelect(
              "baseId",
              draft.baseId ? Number(draft.baseId) : "",
              Number(draft.cmdId),
              false
            )
          : baseOptions.find((base) => base.id === Number(r.baseId))?.name || r.baseId,
        levelId: isEditing
          ? renderLevelSelect(
              "levelId",
              Number(draft.levelId || (isAhqCommand(draft?.cmdId) ? 1 : 2)),
              isAhqCommand(draft?.cmdId)
            )
          : LEVEL_OPTIONS.find((opt) => Number(opt.id) === Number(r.levelId))?.label ||
            r.levelId ||
            "-",
        status: isEditing ? renderStatusSelect("status", draft.status) : r.status, // Keep raw status value, let Cell function render it
        actions: isEditing ? (
          <MDBox
            display="flex"
            flexDirection="row"
            flexWrap="nowrap"
            alignItems="center"
            justifyContent="center"
            gap="2px"
            sx={{ whiteSpace: "nowrap" }}
          >
            <IconButton
              size="small"
              color="success"
              onClick={handleEditSave}
              onMouseDown={(e) => e.stopPropagation()}
              title="Save"
            >
              <Icon>check</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={handleCancel}
              onMouseDown={(e) => e.stopPropagation()}
              title="Cancel"
            >
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ) : (
          <MDBox
            display="flex"
            flexDirection="row"
            flexWrap="nowrap"
            alignItems="center"
            justifyContent="center"
            sx={{
              backgroundColor: "#f8f9fa",
              gap: "2px",
              padding: "2px 2px",
              borderRadius: "2px",
              whiteSpace: "nowrap",
            }}
          >
            {canEdit && !isProtectedSuperuser && (
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEditUser(r.id)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
            )}
            {canDelete && !isProtectedSuperuser && (
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteUser(r.id)}
                title="Delete"
                sx={{ padding: "1px" }}
              >
                <Icon>delete</Icon>
              </IconButton>
            )}
            <IconButton
              size="small"
              color="secondary"
              onClick={() => handleOpenRightsModal(r.id)}
              title="Assign Rights"
              sx={{ padding: "1px" }}
            >
              <Icon>security</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    });

    return rows;
  }, [
    tableRows,
    editingRowId,
    editDraft,
    commandOptions,
    baseOptions,
    roleOptions,
    appointOptions,
    errors,
    darkMode,
  ]);

  const isRightsReadOnly = isSuperuserUsername(rightsUserName);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="User Management"
        subtitle="Manage system users and access rights"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddUser}>
              Add User
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
          "& .MuiTable-root th": {
            fontSize: "0.925rem !important",
            fontWeight: "700 !important",
            padding: "10px 10px !important",
            borderBottom: "1px solid #d0d0d0",
          },
          "& .MuiTable-root td": {
            padding: "8px 10px !important",
            borderBottom: "1px solid #e0e0e0",
          },
          "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2), & .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3)":
            {
              paddingLeft: "6px !important",
              paddingRight: "6px !important",
            },
          "& .MuiTable-root th:nth-of-type(2)": {
            whiteSpace: "nowrap !important",
          },
        }}
      >
        <DataTable
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch
          page={pageIndex}
          pageSize={pageSize}
          entriesPerPage={{ defaultValue: 20, entries: [5, 10, 15, 20, 25] }}
          onPageChange={(page) => setPageIndex(page)}
          onEntriesPerPageChange={(value) => {
            setPageSize(value);
            setPageIndex(0);
          }}
          showTotalEntries
          exportFileName="User-Management"
          noEndBorder
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>

      <Dialog open={isRightsModalOpen} onClose={handleCloseRightsModal} fullWidth maxWidth="md">
        <DialogTitle sx={{ color: "#344767" }}>
          {`Assign Rights${rightsUserName ? ` - ${rightsUserName}` : ""}`}
        </DialogTitle>
        <DialogContent>
          <TableContainer
            component={Paper}
            sx={{
              "& thead th": {
                color: darkMode ? "#ffffff !important" : "#344767 !important",
              },
              "& tbody td:first-of-type": {
                color: darkMode ? "#ffffff" : "inherit",
                maxWidth: "60px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }}
          >
            <Table size="small">
              <TableHead sx={{ display: "contents !important " }}>
                <TableRow>
                  <TableCell>Menu Name</TableCell>
                  <TableCell align="center">View</TableCell>
                  <TableCell align="center">Create</TableCell>
                  <TableCell align="center">Edit</TableCell>
                  <TableCell align="center">Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rightsDraftRows.map((row) => (
                  <TableRow key={row.menuName}>
                    <TableCell>{row.menuName}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={row.view}
                        onChange={() => handleRightsToggle(row.menuName, "view")}
                        size="small"
                        disabled={isRightsReadOnly || isDashboardRightsMenu(row.menuName)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={row.create}
                        onChange={() => handleRightsToggle(row.menuName, "create")}
                        size="small"
                        disabled={isRightsReadOnly}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={row.edit}
                        onChange={() => handleRightsToggle(row.menuName, "edit")}
                        size="small"
                        disabled={isRightsReadOnly}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={row.delete}
                        onChange={() => handleRightsToggle(row.menuName, "delete")}
                        size="small"
                        disabled={isRightsReadOnly}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" onClick={handleCloseRightsModal} disabled={isRightsSaving}>
            {isRightsReadOnly ? "Close" : "Cancel"}
          </MDButton>
          {!isRightsReadOnly && (
            <MDButton color="info" onClick={handleRightsSave} disabled={isRightsSaving}>
              {isRightsSaving ? "Saving..." : "Save"}
            </MDButton>
          )}
        </DialogActions>
      </Dialog>

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
        appointOptions={appointOptions}
        onAppointOptionsChange={setAppointOptions}
      />
    </DashboardLayout>
  );
}

UserMgmt.propTypes = {
  cell: PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
    row: PropTypes.shape({
      original: PropTypes.shape({
        id: PropTypes.number,
        pakNo: PropTypes.string,
        cmdId: PropTypes.number,
        baseId: PropTypes.number,
        status: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.bool]),
      }),
    }),
  }),
};

export default UserMgmt;
