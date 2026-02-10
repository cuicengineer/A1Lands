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

  const handleAddProperty = () => {
    setCurrentProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (id) => {
    const property = tableRows.find((row) => row.id === id);
    console.log("Editing property:", property);
    console.log(
      "Property propertyType:",
      property.propertyType,
      "Type:",
      typeof property.propertyType
    );
    setCurrentProperty({
      id: property.id,
      cmdId: property.cmdId,
      baseId: property.baseId,
      classId: property.classId,
      propertyType: property.propertyType ? Number(property.propertyType) : "",
      pId: property.pId,
      uoM: property.uoM,
      area: property.area,
      location: property.location,
      remarks: property.remarks,
      status: property.status,
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
        status: formData.status,
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

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "10%" },
    { Header: "Is Active", accessor: "status", align: "center", width: "8%", Cell: StatusBadge },
    { Header: "Id", accessor: "id", align: "left", width: "5%" },
    { Header: "Command", accessor: "cmdName", align: "left", width: "12%" },
    { Header: "Base", accessor: "baseName", align: "left", width: "12%" },
    { Header: "Class", accessor: "className", align: "left", width: "12%" },
    {
      Header: "Property Type",
      accessor: "propertyTypeName",
      align: "left",
      width: "12%",
      Cell: ({ value }) => value || "-",
    },
    { Header: "Property ID", accessor: "pId", align: "left", width: "8%" },
    { Header: "UoM", accessor: "uoM", align: "left", width: "7%" },
    { Header: "Area", accessor: "area", align: "right", width: "7%" },
    { Header: "Location", accessor: "location", align: "left", width: "20%" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "center",
      width: "8%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const hasAttachments = row?.original?.id;
        return hasAttachments ? (
          <IconButton
            size="small"
            color="primary"
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
  ];

  const computedRows = useMemo(
    () =>
      tableRows.map((row) => {
        // Find property type name by id
        const propertyTypeId = row.propertyType || row.propertytype;
        const propertyTypeObj = propertyTypes.find(
          (pt) => Number(pt.id) === Number(propertyTypeId)
        );
        const propertyTypeName =
          propertyTypeObj?.name || row.propertyTypeName || row.propertytypename || "";

        return {
          ...row,
          // Show backend names; fallback to IDs if backend doesn't send names
          cmdName: row.cmdName || row.cmdname || row.commandName || row.cmdId || "",
          baseName: row.baseName || row.basename || row.baseId || "",
          className: row.className || row.classname || row.classId || "",
          propertyTypeName: propertyTypeName,
          // Location with multiline display and proper wrapping
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
              {row.location || ""}
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
                onClick={() => handleEditProperty(row.id)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteProperty(row.id)}
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
                  defaultValue: pageSize,
                  entries: [10, 25, 50, 100],
                }}
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
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                p={3}
              >
                <MDBox mb={{ xs: 3, sm: 0 }}>
                  <MDTypography variant="button" color="secondary" fontWeight="regular">
                    Showing {(pageNumber - 1) * pageSize + 1} to{" "}
                    {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} entries
                  </MDTypography>
                </MDBox>

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
    </DashboardLayout>
  );
}

export default RentalProperties;
