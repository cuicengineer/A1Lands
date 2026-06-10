import React, { useState, useEffect, useMemo, useRef, useCallback, startTransition } from "react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import CurrencyLoading from "components/CurrencyLoading";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ContractsModuleTabs from "layouts/contracts/components/ContractsModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  resolveBaseNameById,
  resolveCommandNameById,
} from "layouts/dashboard/kpi-overview/kpiOverviewNavigation";
import { gridValueChipCell } from "utils/gridValueChipCell";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import Popover from "@mui/material/Popover";
import RentalPropertyForm from "./RentalPropertyForm";
import rentalPropertiesApi from "services/api.rentalproperties.service";
import uploadApi from "services/api.upload.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  getLoggedInUserBaseId,
  isLoggedInUserBaseReadCategory,
} from "services/api.service";
import contractApi from "services/api.contract.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import {
  hasRentalPropertiesUrlFilters,
  readRentalPropertiesUrlFilters,
} from "layouts/dashboard/kpi-overview/kpiOverviewNavigation";
import api from "services/api.service";
import { perfEnd, perfLog, perfMark } from "utils/pagePerfTrace";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";

/** Stable action handlers for memoized grid cells (assigned each render). */
const rentalPropertiesGridHandlersRef = { current: {} };

const RentalPropertyActionsCell = React.memo(function RentalPropertyActionsCell({ row }) {
  const rowData = row?.original || {};
  const normalizedId = rowData.id;
  const handlers = rentalPropertiesGridHandlersRef.current;
  const showEdit = rowData._canEdit && handlers.onEdit;
  const showDelete = rowData._canDelete && handlers.onDelete;
  if (!showEdit && !showDelete) return null;
  return (
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
      {showEdit ? (
        <IconButton
          size="small"
          color="info"
          onClick={() => handlers.onEdit(normalizedId)}
          title="Edit"
          sx={{ padding: "1px" }}
        >
          <Icon>edit</Icon>
        </IconButton>
      ) : null}
      {showDelete ? (
        <IconButton
          size="small"
          color="error"
          onClick={() => handlers.onDelete(normalizedId)}
          title="Delete"
          sx={{ padding: "1px" }}
        >
          <Icon>delete</Icon>
        </IconButton>
      ) : null}
    </MDBox>
  );
});

RentalPropertyActionsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object,
  }),
};

const RentalPropertyAttachmentsCell = React.memo(function RentalPropertyAttachmentsCell({ row }) {
  const rowData = row?.original || {};
  const handlers = rentalPropertiesGridHandlersRef.current;
  const hasAttachments = rowData?.id;
  const rawIsAttachment = rowData?.IsAttachment ?? rowData?.isAttachment;
  const countValue =
    rowData?.attachmentCount ??
    rowData?.attachmentsCount ??
    rowData?.filesCount ??
    rowData?.AttachmentCount ??
    rowData?.AttachmentsCount ??
    rowData?.FilesCount;
  const hasAttachmentData =
    rawIsAttachment === true ||
    rawIsAttachment === 1 ||
    rawIsAttachment === "1" ||
    String(rawIsAttachment || "")
      .trim()
      .toLowerCase() === "true" ||
    Number(countValue || 0) > 0;
  if (!hasAttachments) return <span>-</span>;
  return (
    <IconButton
      size="small"
      color={hasAttachmentData ? "success" : "error"}
      onClick={() => handlers.onViewAttachments?.(rowData)}
      disabled={handlers.attachmentLoading && handlers.attachmentLoadingId === rowData.id}
      title="View attachments"
    >
      <Icon>visibility</Icon>
    </IconButton>
  );
});

RentalPropertyAttachmentsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object,
  }),
};

const RentalPropertyGroupsCell = React.memo(function RentalPropertyGroupsCell({ row }) {
  const rowData = row?.original || {};
  const propertyId = rowData?.id ?? rowData?.Id;
  const handlers = rentalPropertiesGridHandlersRef.current;
  if (!propertyId) return <span>-</span>;
  return (
    <IconButton
      size="small"
      color="warning"
      onClick={() => handlers.onViewActiveGroups?.(propertyId)}
      disabled={handlers.loadingActiveData}
      title="View active property groupings using this property"
    >
      <Icon>group</Icon>
    </IconButton>
  );
});

RentalPropertyGroupsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.object,
  }),
};

const RentalPropertyAreaCell = React.memo(function RentalPropertyAreaCell({ value, row }) {
  const rowData = row?.original || {};
  const areaValue = value ?? rowData?.area ?? rowData?.Area ?? "";
  const uoM = rowData?.uoM ?? rowData?.UoM ?? rowData?.uom ?? "";
  const formattedArea = areaValue || areaValue === 0 ? Number(areaValue).toLocaleString() : "";
  const combined = `${formattedArea}${uoM ? ` (${uoM})` : ""}`.trim();
  return combined || "-";
});

RentalPropertyAreaCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  row: PropTypes.shape({ original: PropTypes.object }),
};

const RentalPropertyPidCell = React.memo(function RentalPropertyPidCell({ value, row }) {
  const rowData = row?.original || {};
  return value ?? rowData?.pId ?? rowData?.PId ?? rowData?.pid ?? "-";
});

RentalPropertyPidCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  row: PropTypes.shape({ original: PropTypes.object }),
};

const RentalPropertyRemarksCell = React.memo(function RentalPropertyRemarksCell({ value, row }) {
  const rowData = row?.original || {};
  return value ?? rowData?.remarks ?? rowData?.Remarks ?? "-";
});

RentalPropertyRemarksCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  row: PropTypes.shape({ original: PropTypes.object }),
};

const StatusBadge = ({ value }) => (
  <MDBadge
    badgeContent={value === 1 || value === "1" || value === true ? "Active" : "Inactive"}
    color={value === 1 || value === "1" || value === true ? "success" : "error"}
    variant="gradient"
    size="sm"
  />
);

StatusBadge.propTypes = {
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]).isRequired,
};

/** Location column: show first 30 characters; click … to read full text in a popover. */
function LocationTableCell({ value }) {
  const [anchor, setAnchor] = useState(null);
  const text = value != null && String(value).trim() !== "" ? String(value) : "-";
  const hasContent = text !== "-";
  const showMore = hasContent && text.length > 30;
  const displayText = showMore ? text.slice(0, 30) : text;

  return (
    <MDBox display="flex" alignItems="flex-start" gap={0.25} sx={{ maxWidth: "100%", minWidth: 0 }}>
      <MDBox
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          wordBreak: "break-word",
          fontSize: "0.875rem",
          fontWeight: 400,
          lineHeight: "inherit",
          color: "#111111 !important",
        }}
      >
        {hasContent ? displayText : "-"}
      </MDBox>
      {showMore && (
        <>
          <MDBox
            component="button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAnchor(e.currentTarget);
            }}
            sx={{
              border: "none",
              background: "none",
              padding: "0 1px",
              cursor: "pointer",
              color: "info.main",
              fontSize: "0.8rem",
              lineHeight: 1.2,
              flexShrink: 0,
              alignSelf: "flex-end",
              textDecoration: "underline",
            }}
            aria-label="Show full address"
          >
            …
          </MDBox>
          <Popover
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            PaperProps={{
              sx: { maxWidth: "min(92vw, 420px)", p: 1.5, boxShadow: 3, bgcolor: "#ffffff" },
            }}
          >
            <MDTypography
              variant="body"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", bgcolor: "black" }}
            >
              {text}
            </MDTypography>
          </Popover>
        </>
      )}
    </MDBox>
  );
}

LocationTableCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.oneOf([null])]),
};

function RentalProperties() {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const isBaseReadUser = isLoggedInUserBaseReadCategory();
  const userBaseId = getLoggedInUserBaseId();

  const getPropertyRowBaseId = (property) => {
    const b = property?.baseId ?? property?.BaseId;
    if (b === null || b === undefined || b === "") return null;
    const n = Number(b);
    return Number.isFinite(n) ? n : null;
  };

  /** For Base-Read users, only rows whose base matches the logged-in user's base. */
  const rowIsEditableOrDeletableByBase = (row) => {
    if (!isBaseReadUser) return true;
    if (userBaseId === null) return false;
    return getPropertyRowBaseId(row) === userBaseId;
  };

  /** Base-Read users need a base on the session to add/edit/delete; others use menu rights only. */
  const baseReadCanMutate = !isBaseReadUser || userBaseId != null;
  const lockedBaseIdForForm = isBaseReadUser && userBaseId != null ? userBaseId : null;
  const [tableRows, setTableRows] = useState([]);
  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Search is handled by shared DataTable (canSearch)

  const urlFilters = useMemo(() => readRentalPropertiesUrlFilters(), []);
  const urlFilterActive = hasRentalPropertiesUrlFilters(urlFilters);

  const fetchRentalProperties = useCallback(async () => {
    perfMark("rental-properties.api");
    setLoading(true);
    try {
      const networkStart = performance.now();
      const response = await rentalPropertiesApi.getAllRecords();
      perfLog(
        "rental-properties.api.network",
        `${(performance.now() - networkStart).toFixed(1)}ms`
      );
      const stateStart = performance.now();
      startTransition(() => {
        const rows = response?.data ?? (Array.isArray(response) ? response : []);
        const arr = Array.isArray(rows) ? rows : [];
        setTableRows(arr);
        setTotalCount(Number(response?.pagination?.totalCount ?? arr.length));
      });
      perfLog("rental-properties.api.state", `${(performance.now() - stateStart).toFixed(1)}ms`);
    } catch (error) {
      console.error("Error fetching rental properties:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      perfEnd("rental-properties.api");
    }
  }, []);

  useEffect(() => {
    fetchRentalProperties();
  }, [fetchRentalProperties]);

  const [formOpen, setFormOpen] = useState(false);
  const [currentProperty, setCurrentProperty] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);

  // Active Contracts and Groups dialogs
  const [activeContractsDialogOpen, setActiveContractsDialogOpen] = useState(false);
  const [activeGroupsDialogOpen, setActiveGroupsDialogOpen] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [activeGroups, setActiveGroups] = useState([]);
  const [loadingActiveData, setLoadingActiveData] = useState(false);
  const [currentPropertyId, setCurrentPropertyId] = useState(null);

  /** Master lists — grid labels resolve IDs via catalogs when API rows omit names. */
  const [classesList, setClassesList] = useState([]);
  const [commandsList, setCommandsList] = useState([]);
  const [basesList, setBasesList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [classRes, cmdRes, baseRes] = await Promise.all([
          api.list("class"),
          api.list("command"),
          api.list("base"),
        ]);
        if (cancelled) return;
        setClassesList(Array.isArray(classRes) ? classRes : []);
        setCommandsList(Array.isArray(cmdRes) ? cmdRes : []);
        setBasesList(Array.isArray(baseRes) ? baseRes : []);
      } catch (e) {
        if (!cancelled) {
          setClassesList([]);
          setCommandsList([]);
          setBasesList([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddProperty = () => {
    if (!canCreate) return;
    if (isBaseReadUser && userBaseId == null) {
      alert("Your session has no base assigned; you cannot create rental properties.");
      return;
    }
    setCurrentProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (id) => {
    if (!canEdit) return;
    // Handle both camelCase and PascalCase for id lookup
    const property = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!property) {
      console.error("Property not found for id:", id);
      return;
    }
    if (isBaseReadUser && !rowIsEditableOrDeletableByBase(property)) {
      alert("You can only edit rental properties for your assigned base.");
      return;
    }
    console.log("Editing property:", property);
    // Handle both camelCase and PascalCase for all fields
    const propertyId = property.id ?? property.Id;
    const cmdId = property.cmdId ?? property.CmdId ?? null;
    const baseId = property.baseId ?? property.BaseId ?? null;
    const classId = property.classId ?? property.ClassId ?? null;
    const pId = property.pId ?? property.PId ?? property.pid ?? "";
    const uoM = property.uoM ?? property.UoM ?? property.uom ?? "";
    const area = property.area ?? property.Area ?? "";
    const location = property.location ?? property.Location ?? "";
    const remarks = property.remarks ?? property.Remarks ?? "";
    const status = property.status ?? property.Status ?? true;

    setCurrentProperty({
      id: propertyId,
      cmdId: cmdId,
      baseId: baseId,
      classId: classId,
      pId: pId,
      uoM: uoM,
      area: area,
      location: location,
      remarks: remarks,
      status: status === true || status === 1 || status === "1",
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (isBaseReadUser) {
        if (userBaseId == null) {
          alert("Your session has no base assigned; you cannot save rental properties.");
          return null;
        }
        const submittedBase =
          formData.baseId === "" || formData.baseId == null ? null : Number(formData.baseId);
        if (submittedBase !== userBaseId) {
          alert("You can only create or update rental properties for your assigned base.");
          return null;
        }
        if (currentProperty && getPropertyRowBaseId(currentProperty) !== userBaseId) {
          alert("You can only update rental properties for your assigned base.");
          return null;
        }
      }
      const formattedData = {
        cmdId: formData.cmdId,
        baseId: formData.baseId,
        classId: formData.classId,
        propertyType: null,
        pId: formData.pId,
        uoM: formData.uoM,
        area: formData.area,
        location: formData.location,
        remarks: formData.remarks,
        status: formData.status === true || formData.status === 1 || formData.status === "1",
      };

      console.log("Submitting rental property with data:", formattedData);

      let createdOrUpdatedId = null;
      if (currentProperty) {
        if (!canEdit) return null;
        // Edit existing property
        await rentalPropertiesApi.update(currentProperty.id, formattedData);
        createdOrUpdatedId = currentProperty.id;
      } else {
        if (!canCreate) return null;
        // Add new property
        const response = await rentalPropertiesApi.create(formattedData);
        // Extract ID from response (could be response.id or response.data.id)
        createdOrUpdatedId = response?.id || response?.data?.id || null;
      }
      await fetchRentalProperties();
      setFormOpen(false);

      // Return the ID so the form can upload files if needed
      return createdOrUpdatedId;
    } catch (error) {
      console.error("Error saving rental property:", error);
      // Optionally, show an error message to the user
      throw error;
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
  };

  const handleDeleteProperty = (id) => {
    if (!canDelete) return;
    const property = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (property && isBaseReadUser && !rowIsEditableOrDeletableByBase(property)) {
      alert("You can only delete rental properties for your assigned base.");
      return;
    }
    setPropertyToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete) return;
    const property = tableRows.find(
      (row) =>
        (row.id ?? row.Id) === propertyToDelete ||
        Number(row.id ?? row.Id) === Number(propertyToDelete)
    );
    if (property && isBaseReadUser && !rowIsEditableOrDeletableByBase(property)) {
      alert("You can only delete rental properties for your assigned base.");
      setShowDeleteDialog(false);
      setPropertyToDelete(null);
      return;
    }
    try {
      await rentalPropertiesApi.remove(propertyToDelete);
      await fetchRentalProperties();
      setShowDeleteDialog(false);
      setPropertyToDelete(null);
    } catch (error) {
      console.error("Error deleting rental property:", error);
      // Optionally, show an error message to the user
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setPropertyToDelete(null);
  };

  const handleViewAttachments = async (record) => {
    if (!record?.id) return;

    setAttachmentLoading(true);
    setAttachmentLoadingId(record.id);
    setCurrentViewingRecord(record);
    try {
      const response = await uploadApi.getUploadedFiles(record.id, "RentalProperties");
      const filesArray = response?.files || (Array.isArray(response) ? response : []);

      const normalized = filesArray.map((f) => {
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
        };
      });

      setAttachmentList(normalized);
      setAttachmentDialogOpen(true);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      alert("Unable to load attachments.");
    } finally {
      setAttachmentLoading(false);
      setAttachmentLoadingId(null);
    }
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialogOpen(false);
    setAttachmentList([]);
    setCurrentViewingRecord(null);
  };

  const handleDownloadAttachment = (file) => {
    uploadApi
      .downloadFile(file, file?.fileName || file?.name || "download")
      .catch((e) => alert(`Download failed: ${e.message}`));
  };

  const handleDeleteAttachment = async (file) => {
    if (!canDelete) return;
    if (isBaseReadUser && !rowIsEditableOrDeletableByBase(currentViewingRecord || {})) {
      alert("You can only remove attachments for rental properties for your assigned base.");
      return;
    }
    if (!file?.id) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await uploadApi.deleteUploadedFile(file.id);
      // Refresh the attachment list from the server
      const recordId = currentViewingRecord?.id;
      if (recordId) {
        const response = await uploadApi.getUploadedFiles(recordId, "RentalProperties");
        const filesArray = response?.files || (Array.isArray(response) ? response : []);
        const normalized = filesArray.map((f) => {
          if (typeof f === "string") {
            return {
              fileName: f.split(/[\\/]/).pop(),
              downloadUrl: f,
            };
          }
          const fileName =
            f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
          const downloadUrl =
            f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
          return {
            ...f,
            fileName,
            downloadUrl,
          };
        });
        setAttachmentList(normalized);
      } else {
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleUploadSuccess = () => {
    // Refresh the table after successful upload
    fetchRentalProperties();
  };

  // Helper function to normalize property IDs from a group (same logic as property-grouping)
  const normalizePropertyIdsFromGroup = (group) => {
    if (!group) return [];

    // API returns PropertyGroupLinkings (PascalCase)
    const fromLinkings = group.PropertyGroupLinkings;
    if (Array.isArray(fromLinkings) && fromLinkings.length) {
      const ids = fromLinkings
        .map((x) => {
          if (x === null || x === undefined) return null;
          if (typeof x === "number" || typeof x === "string") return Number(x);
          // API returns PropertyId, PropId, or Id (PascalCase)
          const candidate = x.PropertyId || x.PropId || x.Id;
          return candidate ? Number(candidate) : null;
        })
        .filter((n) => n !== null && Number.isFinite(n));
      return Array.from(new Set(ids));
    }

    // Check for property array/string (API may return Property)
    const raw = group.Property;
    if (Array.isArray(raw)) {
      const ids = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      return Array.from(new Set(ids));
    }

    if (typeof raw === "string") {
      const ids = raw
        .split(",")
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n));
      return Array.from(new Set(ids));
    }

    return [];
  };

  // Fetch active contracts for a property

  // Fetch active groups for a property
  const handleViewActiveGroups = async (propertyId) => {
    setCurrentPropertyId(propertyId);
    setLoadingActiveData(true);
    setActiveGroups([]);

    try {
      // Fetch all property groups (fetch all pages)
      let allGroups = [];
      let currentPage = 1;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const response = await propertyGroupingApi.list(currentPage, pageSize);
        const groups = response?.pagination
          ? response.data || []
          : Array.isArray(response)
          ? response
          : [];

        allGroups = allGroups.concat(groups);

        if (response?.pagination) {
          const totalPages = Math.ceil(response.pagination.totalCount / pageSize);
          hasMore = currentPage < totalPages;
          currentPage += 1;
        } else {
          hasMore = false;
        }
      }

      // Filter groups that contain this property and are active
      // First, try using PropertyGroupLinkings from the list response
      let groupsWithProperty = allGroups.filter((group) => {
        const isActive = group.Status === true || group.Status === 1;
        const isNotDeleted = group.IsDeleted === false || group.IsDeleted === 0;
        if (!isActive || !isNotDeleted) return false;

        // Use normalized property IDs to check if property is in the group
        const propertyIds = normalizePropertyIdsFromGroup(group);
        return (
          propertyIds.length > 0 && propertyIds.some((id) => Number(id) === Number(propertyId))
        );
      });

      // If no groups found and PropertyGroupLinkings might not be populated,
      // fetch linked properties for each active group
      if (groupsWithProperty.length === 0) {
        const activeGroups = allGroups.filter((group) => {
          const isActive = group.Status === true || group.Status === 1;
          const isNotDeleted = group.IsDeleted === false || group.IsDeleted === 0;
          return isActive && isNotDeleted;
        });

        // Check each active group by fetching its linked properties
        const groupsWithPropertyPromises = activeGroups.map(async (group) => {
          try {
            const groupId = group.Id || group.id;
            if (!groupId) return null;

            const linkedPropsResponse = await propertyGroupingApi.getByGroup(groupId, 1, 1000);
            const linkedProps = linkedPropsResponse?.pagination
              ? linkedPropsResponse.data || []
              : Array.isArray(linkedPropsResponse)
              ? linkedPropsResponse
              : [];

            // Check if property is in linked properties
            const hasProperty = linkedProps.some((linking) => {
              const linkingPropId =
                linking.PropertyId ||
                linking.PropId ||
                (typeof linking === "number" ? linking : null);
              return linkingPropId && Number(linkingPropId) === Number(propertyId);
            });

            return hasProperty ? group : null;
          } catch (error) {
            console.error(
              `Error fetching linked properties for group ${group.Id || group.id}:`,
              error
            );
            return null;
          }
        });

        const resolvedGroups = await Promise.all(groupsWithPropertyPromises);
        groupsWithProperty = resolvedGroups.filter((g) => g !== null);
      }

      setActiveGroups(groupsWithProperty);
      setActiveGroupsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching active groups:", error);
      alert("Failed to load active groups.");
      setActiveGroups([]);
    } finally {
      setLoadingActiveData(false);
    }
  };

  rentalPropertiesGridHandlersRef.current = {
    onEdit: handleEditProperty,
    onDelete: handleDeleteProperty,
    onViewAttachments: handleViewAttachments,
    onViewActiveGroups: handleViewActiveGroups,
    attachmentLoading,
    attachmentLoadingId,
    loadingActiveData,
  };

  const columns = useMemo(
    () => [
      { Header: "Actions", accessor: "actions", align: "center", Cell: RentalPropertyActionsCell },
      { Header: "Status", accessor: "status", align: "center", Cell: StatusBadge },
      { Header: "Id", accessor: "id", align: "left" },
      { Header: "RAC", accessor: "cmdName", align: "left", Cell: gridValueChipCell("rac") },
      { Header: "Base", accessor: "baseName", align: "left", Cell: gridValueChipCell("base") },
      { Header: "Class", accessor: "className", align: "left", Cell: gridValueChipCell("class") },
      {
        Header: "Property",
        accessor: "pId",
        align: "left",
        Cell: RentalPropertyPidCell,
      },
      {
        Header: "Area(UoM)",
        accessor: "area",
        align: "right",
        Cell: RentalPropertyAreaCell,
      },
      {
        Header: "Location",
        accessor: "location",
        align: "left",
        Cell: LocationTableCell,
      },
      {
        Header: "Remarks",
        accessor: "remarks",
        align: "left",
        Cell: RentalPropertyRemarksCell,
      },
      {
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        Cell: RentalPropertyAttachmentsCell,
      },
      {
        Header: "Groups",
        accessor: "activeGroups",
        align: "center",
        Cell: RentalPropertyGroupsCell,
      },
    ],
    []
  );

  const classById = useMemo(() => {
    const map = new Map();
    (classesList || []).forEach((c) => {
      const id = Number(c?.id ?? c?.Id);
      if (Number.isFinite(id)) map.set(id, c);
    });
    return map;
  }, [classesList]);

  const computedRows = useMemo(() => {
    perfMark("rental-properties.transform");
    const result = tableRows.map((row) => {
      const normalizedId = row?.id ?? row?.Id;
      const baseReadAllowsActions = rowIsEditableOrDeletableByBase(row);
      const rowClassId = row.classId ?? row.ClassId;
      const classMatch = classById.get(Number(rowClassId));
      const classNameFromId = classMatch
        ? String(
            classMatch.name ?? classMatch.Name ?? classMatch.className ?? classMatch.ClassName ?? ""
          ).trim()
        : "";

      return {
        ...row,
        id: normalizedId,
        status: row.status ?? row.Status ?? true,
        pId: row.pId ?? row.PId ?? row.pid ?? "",
        uoM: row.uoM ?? row.UoM ?? row.uom ?? "",
        area: row.area ?? row.Area ?? "",
        remarks: row.remarks ?? row.Remarks ?? "",
        cmdName:
          resolveCommandNameById(commandsList, row.cmdId ?? row.CmdId) ||
          (row.cmdName ?? row.CmdName ?? row.cmdname ?? row.commandName ?? ""),
        baseName:
          resolveBaseNameById(basesList, row.baseId ?? row.BaseId) ||
          (row.baseName ?? row.BaseName ?? row.basename ?? ""),
        className:
          classNameFromId ||
          row.className ||
          row.ClassName ||
          row.classname ||
          (rowClassId !== undefined && rowClassId !== null && rowClassId !== ""
            ? String(rowClassId)
            : ""),
        location: row.location ?? row.Location ?? "",
        _canEdit: canEdit && baseReadAllowsActions,
        _canDelete: canDelete && baseReadAllowsActions,
      };
    });
    perfEnd("rental-properties.transform");
    return result;
  }, [
    tableRows,
    isBaseReadUser,
    userBaseId,
    classById,
    canEdit,
    canDelete,
    commandsList,
    basesList,
  ]);

  const displayRows = useMemo(() => {
    if (!urlFilterActive) return computedRows;
    return computedRows.filter((row) => {
      const rowCmd = Number(row.cmdId ?? row.CmdId);
      const rowBase = Number(row.baseId ?? row.BaseId);
      const rowClass = Number(row.classId ?? row.ClassId);
      if (urlFilters.cmdId && rowCmd !== Number(urlFilters.cmdId)) return false;
      if (urlFilters.baseId && rowBase !== Number(urlFilters.baseId)) return false;
      if (urlFilters.classId && rowClass !== Number(urlFilters.classId)) return false;
      return true;
    });
  }, [computedRows, urlFilterActive, urlFilters]);

  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: totalCount,
        visible: urlFilterActive ? displayRows.length : null,
      }),
    [totalCount, urlFilterActive, displayRows.length]
  );

  const tableConfig = useMemo(() => ({ columns, rows: displayRows }), [columns, displayRows]);

  const handleGridPageSizeChange = useCallback((value) => {
    setGridPageSize(Number(value));
  }, []);

  useEffect(() => {
    perfLog("rental-properties.render", {
      pass: renderCountRef.current,
      rows: tableRows.length,
      displayRows: displayRows.length,
      loading,
    });
  });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Rental Properties"
        subtitle="Manage rental property records"
        tabs={<ContractsModuleTabs />}
        metadata={workspaceMetadata}
        actions={
          canCreate && baseReadCanMutate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddProperty}>
              Add Rental Property
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
            overflow: "auto",
          },
          flex: "1 1 0",
          minHeight: 0,
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.925rem !important",
            fontWeight: "700 !important",
            width: "auto !important",
            minWidth: "0 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            width: "auto !important",
            minWidth: "0 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
          },
          "& table td > div": {
            maxWidth: "100% !important",
          },
          "& .MuiTable-root td:nth-of-type(9)": {
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "break-word !important",
          },
        }}
      >
        <DataTable
          table={tableConfig}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={{
            defaultValue: GRID_DISPLAY_DEFAULT_PAGE_SIZE,
            entries: [10, 25, 50, 100],
          }}
          pageSize={gridPageSize}
          onEntriesPerPageChange={handleGridPageSizeChange}
          autoResetFilters={false}
          showTotalEntries={false}
          noEndBorder
          canSearch
          exportFileName="Rental-Properties"
          contentFitTable
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>

      <RentalPropertyForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={currentProperty}
        onUploadSuccess={handleUploadSuccess}
        lockedBaseId={lockedBaseIdForForm}
      />

      <Dialog
        open={attachmentDialogOpen}
        onClose={handleCloseAttachmentDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Attachments</DialogTitle>
        <DialogContent>
          {attachmentLoading ? (
            <MDBox display="flex" justifyContent="center" py={3}>
              <CurrencyLoading size={40} />
            </MDBox>
          ) : attachmentList.length === 0 ? (
            <MDTypography variant="body2" color="text">
              No attachments uploaded for this record.
            </MDTypography>
          ) : (
            <List disablePadding>
              {attachmentList.map((file, index) => (
                <MDBox key={file.id || file.fileName || index}>
                  <ListItem
                    disableGutters
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      px: 0,
                    }}
                  >
                    <ListItemText
                      primary={file.fileName || file.name || `Attachment ${index + 1}`}
                    />
                    <MDBox display="flex" gap={1} alignItems="center">
                      <MDButton
                        size="small"
                        variant="outlined"
                        color="info"
                        onClick={() => handleDownloadAttachment(file)}
                        disabled={!file.id && !file.fileId && !file.downloadUrl}
                      >
                        <Icon>download</Icon>&nbsp;Download
                      </MDButton>
                      {canDelete && rowIsEditableOrDeletableByBase(currentViewingRecord || {}) && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAttachment(file)}
                          sx={{ ml: 1 }}
                        >
                          <Icon>delete</Icon>
                        </IconButton>
                      )}
                    </MDBox>
                  </ListItem>
                  {index < attachmentList.length - 1 && <Divider />}
                </MDBox>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={showDeleteDialog} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1">
            Are you sure you want to delete this rental property?
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary">
            Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDelete}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* Active Groups Dialog */}
      <Dialog
        open={activeGroupsDialogOpen}
        onClose={() => {
          setActiveGroupsDialogOpen(false);
          setActiveGroups([]);
          setCurrentPropertyId(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            Active Property Groupings for Property ID: {currentPropertyId}
          </MDTypography>
          <MDTypography variant="body2" color="secondary" sx={{ mt: 1 }}>
            Total Active Groups: {activeGroups.length}
          </MDTypography>
        </DialogTitle>
        <DialogContent>
          {loadingActiveData ? (
            <MDBox display="flex" justifyContent="center" p={3}>
              <CurrencyLoading size={100} />
            </MDBox>
          ) : activeGroups.length === 0 ? (
            <MDTypography variant="body1" color="text" sx={{ p: 2 }}>
              No active property groupings found for this property.
            </MDTypography>
          ) : (
            <List>
              {activeGroups.map((group, index) => {
                const groupId = group.GId || group.gId || "N/A";
                const cmdName = group.CmdName || group.cmdName || "N/A";
                const baseName = group.BaseName || group.baseName || "N/A";
                const className = group.ClassName || group.className || "N/A";
                const location = group.Location || group.location || "N/A";

                return (
                  <MDBox key={group.Id || group.id || index}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <MDTypography variant="h6" fontWeight="medium">
                            Group ID: {groupId}
                          </MDTypography>
                        }
                        secondary={
                          <MDBox>
                            <MDTypography variant="body2" color="text">
                              Command: {cmdName} | Base: {baseName} | Class: {className}
                            </MDTypography>
                            <MDTypography variant="body2" color="text">
                              Location: {location}
                            </MDTypography>
                            <MDTypography
                              variant="caption"
                              color="warning"
                              sx={{ mt: 0.5, display: "block" }}
                            >
                              Note: Make this group inactive before modifying this property.
                            </MDTypography>
                          </MDBox>
                        }
                      />
                    </ListItem>
                    {index < activeGroups.length - 1 && <Divider />}
                  </MDBox>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => {
              setActiveGroupsDialogOpen(false);
              setActiveGroups([]);
              setCurrentPropertyId(null);
            }}
          >
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default RentalProperties;
