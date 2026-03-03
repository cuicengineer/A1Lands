import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import CurrencyLoading from "components/CurrencyLoading";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import Card from "@mui/material/Card";
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
import RentalPropertyForm from "./RentalPropertyForm";
import rentalPropertiesApi from "services/api.rentalproperties.service";
import uploadApi from "services/api.upload.service";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import propertyGroupingApi from "services/api.propertygrouping.service";

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

function RentalProperties() {
  const [tableRows, setTableRows] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState([]);
  // Search is handled by shared DataTable (canSearch)

  const fetchRentalProperties = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await rentalPropertiesApi.getAll(page, size);
      if (response && response.pagination) {
        setTableRows(response.data || []);
        setTotalCount(response.pagination.totalCount || 0);
        setPageNumber(response.pagination.pageNumber || page);
        setPageSize(response.pagination.pageSize || size);
      } else {
        const arr = Array.isArray(response) ? response : [];
        setTableRows(arr);
        setTotalCount(arr.length);
      }
    } catch (error) {
      console.error("Error fetching rental properties:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentalProperties(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  useEffect(() => {
    const fetchPropertyTypes = async () => {
      try {
        const response = await api.request("GET", "/api/PropertyTypes");
        const data = response?.data ?? (Array.isArray(response) ? response : []);
        // Normalize status: convert byte (0/1) to boolean for UI
        const normalizedData = Array.isArray(data)
          ? data.map((item) => ({
              ...item,
              status: item.status === 1 || item.status === true,
            }))
          : [];
        console.log("Fetched PropertyTypes for rental properties:", normalizedData);
        setPropertyTypes(normalizedData);
      } catch (error) {
        console.error("Error fetching property types:", error);
        setPropertyTypes([]);
      }
    };
    fetchPropertyTypes();
  }, []);

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

  const handleAddProperty = () => {
    setCurrentProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (id) => {
    // Handle both camelCase and PascalCase for id lookup
    const property = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!property) {
      console.error("Property not found for id:", id);
      return;
    }
    console.log("Editing property:", property);
    // Handle both camelCase and PascalCase for all fields
    const propertyId = property.id ?? property.Id;
    const cmdId = property.cmdId ?? property.CmdId ?? null;
    const baseId = property.baseId ?? property.BaseId ?? null;
    const classId = property.classId ?? property.ClassId ?? null;
    const propertyType = property.propertyType ?? property.PropertyType ?? null;
    const pId = property.pId ?? property.PId ?? property.pid ?? "";
    const uoM = property.uoM ?? property.UoM ?? property.uom ?? "";
    const area = property.area ?? property.Area ?? "";
    const location = property.location ?? property.Location ?? "";
    const remarks = property.remarks ?? property.Remarks ?? "";
    const status = property.status ?? property.Status ?? true;

    console.log("Property propertyType:", propertyType, "Type:", typeof propertyType);
    setCurrentProperty({
      id: propertyId,
      cmdId: cmdId,
      baseId: baseId,
      classId: classId,
      propertyType: propertyType ? Number(propertyType) : "",
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
      const formattedData = {
        cmdId: formData.cmdId,
        baseId: formData.baseId,
        classId: formData.classId,
        propertyType:
          formData.propertyType && formData.propertyType !== ""
            ? Number(formData.propertyType)
            : null,
        pId: formData.pId,
        uoM: formData.uoM,
        area: formData.area,
        location: formData.location,
        remarks: formData.remarks,
        status: formData.status === true || formData.status === 1 || formData.status === "1",
      };

      console.log("Submitting rental property with data:", formattedData);
      console.log("PropertyType in payload:", formattedData.propertyType);

      let createdOrUpdatedId = null;
      if (currentProperty) {
        // Edit existing property
        await rentalPropertiesApi.update(currentProperty.id, formattedData);
        createdOrUpdatedId = currentProperty.id;
      } else {
        // Add new property
        const response = await rentalPropertiesApi.create(formattedData);
        // Extract ID from response (could be response.id or response.data.id)
        createdOrUpdatedId = response?.id || response?.data?.id || null;
      }
      await fetchRentalProperties(pageNumber, pageSize);
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
    setPropertyToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await rentalPropertiesApi.remove(propertyToDelete);
      await fetchRentalProperties(pageNumber, pageSize);
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
    const downloadUrl =
      file?.downloadUrl || file?.fileUrl || file?.url || file?.filePath || file?.path;
    if (downloadUrl) {
      const fullUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `${process.env.REACT_APP_API_BASE_URL || ""}${
            downloadUrl.startsWith("/") ? "" : "/"
          }${downloadUrl}`;
      window.open(fullUrl, "_blank");
    } else {
      alert("Download URL is not available for this file.");
    }
  };

  const handleDeleteAttachment = async (file) => {
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
    fetchRentalProperties(pageNumber, pageSize);
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

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "10%" },
    { Header: "Is Active", accessor: "status", align: "center", width: "8%", Cell: StatusBadge },
    { Header: "Id", accessor: "id", align: "left", width: "5%" },
    { Header: "RAC", accessor: "cmdName", align: "left", width: "12%" },
    { Header: "Base", accessor: "baseName", align: "left", width: "12%" },
    { Header: "Class", accessor: "className", align: "left", width: "12%" },
    {
      Header: "Type",
      accessor: "propertyTypeName",
      align: "left",
      width: "12%",
      Cell: ({ value }) => value || "-",
    },
    {
      Header: "Property",
      accessor: "pId",
      align: "left",
      width: "8%",
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        return value ?? rowData?.pId ?? rowData?.PId ?? rowData?.pid ?? "-";
      },
    },
    {
      Header: "UoM",
      accessor: "uoM",
      align: "left",
      width: "7%",
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        return value ?? rowData?.uoM ?? rowData?.UoM ?? rowData?.uom ?? "-";
      },
    },
    {
      Header: "Area",
      accessor: "area",
      align: "right",
      width: "7%",
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        const areaValue = value ?? rowData?.area ?? rowData?.Area ?? "";
        return areaValue ? Number(areaValue).toLocaleString() : "-";
      },
    },
    { Header: "Location", accessor: "location", align: "left", width: "20%" },
    {
      Header: "Remarks",
      accessor: "remarks",
      align: "left",
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        return value ?? rowData?.remarks ?? rowData?.Remarks ?? "-";
      },
    },
    {
      Header: "Attach",
      accessor: "attachments",
      align: "center",
      width: "8%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
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
        return hasAttachments ? (
          <IconButton
            size="small"
            color={hasAttachmentData ? "success" : "error"}
            // eslint-disable-next-line react/prop-types
            onClick={() => handleViewAttachments(row.original)}
            // eslint-disable-next-line react/prop-types
            disabled={attachmentLoading && attachmentLoadingId === row?.original?.id}
            title="View attachments"
          >
            <Icon>visibility</Icon>
          </IconButton>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      Header: "Active Groups",
      accessor: "activeGroups",
      align: "center",
      width: "10%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const propertyId = rowData?.id ?? rowData?.Id;
        return propertyId ? (
          <IconButton
            size="small"
            color="warning"
            onClick={() => handleViewActiveGroups(propertyId)}
            disabled={loadingActiveData}
            title="View active property groupings using this property"
          >
            <Icon>group</Icon>
          </IconButton>
        ) : (
          <span>-</span>
        );
      },
    },
  ];

  const computedRows = useMemo(
    () =>
      tableRows.map((row) => {
        // Normalize id (handle both camelCase and PascalCase)
        const normalizedId = row?.id ?? row?.Id;
        // Find property type name by id (handle both camelCase and PascalCase)
        const propertyTypeId = row.propertyType ?? row.PropertyType ?? row.propertytype;
        const propertyTypeObj = propertyTypes.find(
          (pt) => Number(pt.id) === Number(propertyTypeId)
        );
        const propertyTypeName =
          propertyTypeObj?.name ||
          row.propertyTypeName ||
          row.PropertyTypeName ||
          row.propertytypename ||
          "";

        return {
          ...row,
          id: normalizedId,
          status: row.status ?? row.Status ?? true,
          // Normalize property fields (handle both camelCase and PascalCase)
          pId: row.pId ?? row.PId ?? row.pid ?? "",
          uoM: row.uoM ?? row.UoM ?? row.uom ?? "",
          area: row.area ?? row.Area ?? "",
          remarks: row.remarks ?? row.Remarks ?? "",
          // Show backend names; fallback to IDs if backend doesn't send names (handle both camelCase and PascalCase)
          cmdName:
            row.cmdName ??
            row.CmdName ??
            row.cmdname ??
            row.commandName ??
            row.cmdId ??
            row.CmdId ??
            "",
          baseName: row.baseName ?? row.BaseName ?? row.basename ?? row.baseId ?? row.BaseId ?? "",
          className:
            row.className ?? row.ClassName ?? row.classname ?? row.classId ?? row.ClassId ?? "",
          propertyTypeName: propertyTypeName,
          // Location with multiline display and proper wrapping (handle both camelCase and PascalCase)
          location: (
            <MDBox
              component="span"
              sx={{
                display: "block",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                maxWidth: "100%",
                lineHeight: 1.5,
              }}
            >
              {row.location ?? row.Location ?? ""}
            </MDBox>
          ),
          actions: (
            <MDBox
              alignItems="left"
              justifyContent="left"
              sx={{
                backgroundColor: "#f8f9fa", // Light grey background
                gap: "2px", // Small gap between icons
                padding: "2px 2px", // Compact padding
                borderRadius: "2px",
              }}
            >
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEditProperty(normalizedId)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteProperty(normalizedId)}
                title="Delete"
                sx={{ padding: "1px" }}
              >
                <Icon>delete</Icon>
              </IconButton>
            </MDBox>
          ),
        };
      }),
    [tableRows, propertyTypes]
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
              Rental Properties
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddProperty}>
              Add Rental Property
            </MDButton>
          </MDBox>
          <MDBox pt={3} position="relative">
            {/* Loading Overlay */}
            {loading && (
              <MDBox
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                zIndex={10}
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <CurrencyLoading size={50} />
              </MDBox>
            )}

            <MDBox
              sx={{
                overflowX: "auto",
                "& .MuiTable-root": {
                  tableLayout: "fixed",
                  width: "100%",
                },
                // DataTable uses custom <td> cells that default to nowrap + inner width:max-content.
                // Force wrapping + constrain inner wrapper so text never overlaps adjacent columns.
                "& table th, & table td": {
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "break-word !important",
                  verticalAlign: "top",
                },
                "& table td > div": {
                  display: "block !important",
                  width: "100% !important",
                  maxWidth: "100% !important",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "break-word !important",
                },
                "& table td > div > *": {
                  maxWidth: "100% !important",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "break-word !important",
                },
                // Location column specific styling - ensure no overflow
                "& table td[data-column='location'], & table th[data-column='location']": {
                  maxWidth: "200px !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "break-word !important",
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
                // 3 = Id, 7 = Property ID, 9 = Area
                "& .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3), & .MuiTable-root th:nth-of-type(7), & .MuiTable-root td:nth-of-type(7), & .MuiTable-root th:nth-of-type(9), & .MuiTable-root td:nth-of-type(9)":
                  {
                    paddingLeft: "6px !important",
                    paddingRight: "6px !important",
                  },
              }}
            >
              <DataTable
                table={{
                  columns,
                  rows: computedRows,
                }}
                isSorted={false}
                entriesPerPage={{
                  defaultValue: 20,
                  entries: [10, 25, 50, 100],
                }}
                pageSize={pageSize}
                onEntriesPerPageChange={(value) => {
                  setPageSize(value);
                  setPageNumber(1);
                  fetchRentalProperties(1, value);
                }}
                showTotalEntries={false}
                noEndBorder
                canSearch
                exportFileName="Rental-Properties"
              />
            </MDBox>

            {/* Server-side Pagination Footer */}
            {totalCount > 0 && (
              <MDBox
                display="flex"
                flexDirection={{ xs: "column", sm: "row" }}
                justifyContent="flex-start"
                alignItems={{ xs: "flex-start", sm: "center" }}
                p={3}
                gap={2}
              >
                <MDBox mb={{ xs: 3, sm: 0 }} display="flex" alignItems="center" gap={2}>
                  <MDTypography variant="button" color="secondary" fontWeight="regular">
                    {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} entries
                  </MDTypography>
                  {Math.ceil(totalCount / pageSize) > 1 && (
                    <MDPagination variant="gradient" color="info">
                      {pageNumber > 1 && (
                        <MDPagination item onClick={() => setPageNumber(pageNumber - 1)}>
                          <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
                        </MDPagination>
                      )}

                      {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
                        .filter((p) => {
                          const totalPages = Math.ceil(totalCount / pageSize);
                          return (
                            p === 1 ||
                            p === totalPages ||
                            (p >= pageNumber - 2 && p <= pageNumber + 2)
                          );
                        })
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && p - prev > 1;
                          return (
                            <>
                              {showEllipsis && (
                                <MDPagination item disabled>
                                  <Icon>more_horiz</Icon>
                                </MDPagination>
                              )}
                              <MDPagination
                                item
                                onClick={() => setPageNumber(p)}
                                active={p === pageNumber}
                              >
                                {p}
                              </MDPagination>
                            </>
                          );
                        })}

                      {pageNumber < Math.ceil(totalCount / pageSize) && (
                        <MDPagination item onClick={() => setPageNumber(pageNumber + 1)}>
                          <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
                        </MDPagination>
                      )}
                    </MDPagination>
                  )}
                </MDBox>
              </MDBox>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <Footer />

      <RentalPropertyForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={currentProperty}
        onUploadSuccess={handleUploadSuccess}
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
                        disabled={!file.downloadUrl}
                      >
                        <Icon>download</Icon>&nbsp;Download
                      </MDButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteAttachment(file)}
                        sx={{ ml: 1 }}
                      >
                        <Icon>delete</Icon>
                      </IconButton>
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
          <MDButton onClick={handleConfirmDelete} color="error">
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
              <CurrencyLoading size={50} />
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
