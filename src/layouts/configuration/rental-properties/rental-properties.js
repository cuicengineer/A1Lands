import { useState, useEffect } from "react";
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
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import RentalPropertyForm from "./RentalPropertyForm";
import rentalPropertiesApi from "services/api.rentalproperties.service";

const StatusBadge = ({ value }) => (
  <MDBadge
    badgeContent={value ? "Active" : "Disabled"}
    color={value ? "success" : "error"}
    variant="gradient"
    size="sm"
  />
);

StatusBadge.propTypes = {
  value: PropTypes.bool.isRequired,
};

function RentalProperties() {
  const [tableRows, setTableRows] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  const [formOpen, setFormOpen] = useState(false);
  const [currentProperty, setCurrentProperty] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);

  const handleAddProperty = () => {
    setCurrentProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (id) => {
    const property = tableRows.find((row) => row.id === id);
    setCurrentProperty({
      id: property.id,
      cmdId: property.cmdId,
      baseId: property.baseId,
      classId: property.classId,
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
        pId: formData.pId,
        uoM: formData.uoM,
        area: formData.area,
        location: formData.location,
        remarks: formData.remarks,
        status: formData.status,
      };

      if (currentProperty) {
        // Edit existing property
        await rentalPropertiesApi.update(currentProperty.id, formattedData);
        await fetchRentalProperties(pageNumber, pageSize);
      } else {
        // Add new property
        await rentalPropertiesApi.create(formattedData);
        await fetchRentalProperties(pageNumber, pageSize);
      }
      setFormOpen(false);
    } catch (error) {
      console.error("Error saving rental property:", error);
      // Optionally, show an error message to the user
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

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "10%" },
    { Header: "Is Active", accessor: "status", align: "center", width: "8%", Cell: StatusBadge },
    { Header: "Id", accessor: "id", align: "left", width: "5%" },
    { Header: "Command", accessor: "cmdName", align: "left", width: "12%" },
    { Header: "Base", accessor: "baseName", align: "left", width: "12%" },
    { Header: "Class", accessor: "className", align: "left", width: "12%" },
    { Header: "Property ID", accessor: "pId", align: "left", width: "8%" },
    { Header: "UoM", accessor: "uoM", align: "left", width: "7%" },
    { Header: "Area", accessor: "area", align: "right", width: "7%" },
    { Header: "Location", accessor: "location", align: "left", width: "13%" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
  ];

  const computedRows = tableRows.map((row) => ({
    ...row,
    // Show backend names; fallback to IDs if backend doesn't send names
    cmdName: row.cmdName || row.cmdname || row.commandName || row.cmdId || "",
    baseName: row.baseName || row.basename || row.baseId || "",
    className: row.className || row.classname || row.classId || "",
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
  }));

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

            {/* Server-side Pagination Controls + Search */}
            <MDBox display="flex" justifyContent="space-between" alignItems="center" p={3} pb={2}>
              <MDBox display="flex" alignItems="center">
                <Autocomplete
                  disableClearable
                  value={pageSize.toString()}
                  options={["10", "25", "50", "100"]}
                  onChange={(event, newValue) => {
                    setPageSize(parseInt(newValue, 10));
                    setPageNumber(1);
                  }}
                  size="small"
                  sx={{ width: "5rem" }}
                  renderInput={(params) => <MDInput {...params} />}
                />
                <MDTypography variant="caption" color="secondary">
                  &nbsp;&nbsp;entries per page
                </MDTypography>
              </MDBox>

              <MDBox width="14rem">
                <MDInput
                  placeholder="Search..."
                  size="small"
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </MDBox>
            </MDBox>

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
                  overflowWrap: "anywhere !important",
                  verticalAlign: "top",
                },
                "& table td > div": {
                  display: "block !important",
                  width: "100% !important",
                  maxWidth: "100% !important",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                },
                "& table td > div > *": {
                  maxWidth: "100% !important",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
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
                  rows: computedRows.filter((r) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      String(r.pId || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(r.cmdName || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(r.baseName || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(r.className || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(r.location || "")
                        .toLowerCase()
                        .includes(q) ||
                      String(r.remarks || "")
                        .toLowerCase()
                        .includes(q)
                    );
                  }),
                }}
                isSorted={false}
                entriesPerPage={false}
                showTotalEntries={false}
                noEndBorder
                canSearch={false}
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
      />

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
