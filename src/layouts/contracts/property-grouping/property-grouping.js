import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import CurrencyLoading from "components/CurrencyLoading";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import OutlinedInput from "@mui/material/OutlinedInput";
import api from "services/api.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";

function PropertyGroupingForm({
  open,
  onClose,
  onSubmit,
  initialData,
  rentalProperties,
  commands,
  bases,
  classes,
}) {
  const [form, setForm] = useState({
    cmdid: "",
    baseid: "",
    classid: "",
    property: [],
    gId: "",
    uoM: "",
    location: "",
    area: "",
    remarks: "",

    status: true,
    isDeleted: false,
  });

  const [allBases, setAllBases] = useState([]); // New state to store all bases

  useEffect(() => {
    const fetchAllBases = async () => {
      try {
        const response = await api.list("base");
        setAllBases(response);
      } catch (error) {
        console.error("Error fetching all bases:", error);
      }
    };

    // Only fetch bases list when dialog is opened (Add/Edit)
    if (!open) return;
    if (allBases.length === 0) fetchAllBases();
  }, [open, allBases.length]);

  useEffect(() => {
    if (initialData) {
      const newForm = {
        cmdid: initialData.cmdId || "",
        baseid: initialData.baseId || "",
        classid: initialData.classId || "",
        property: initialData.property
          ? Array.isArray(initialData.property)
            ? initialData.property
            : initialData.property.split(", ")
          : [],
        gId: initialData.gId || "",
        uoM: initialData.uoM || "",
        location: initialData.location || "",
        area: initialData.area || "",
        remarks: initialData.remarks || "",

        status:
          initialData.status === true || initialData.status === false ? initialData.status : true,
        isDeleted:
          initialData.isDeleted === true || initialData.isDeleted === false
            ? initialData.isDeleted
            : false,
      };
      let currentFilteredBases = [];
      if (newForm.cmdid && allBases.length > 0) {
        currentFilteredBases = allBases.filter(
          (base) => Number(base.cmd) === Number(newForm.cmdid)
        );
      } else {
      }

      // Validate base against filtered bases
      if (
        newForm.baseid &&
        !currentFilteredBases.some((base) => Number(base.id) === Number(newForm.baseid))
      ) {
        newForm.baseid = ""; // Reset if not found in filtered bases
      }
      setForm(newForm);
    } else {
      setForm({
        cmdid: "",
        baseid: "",
        classid: "",
        property: [],
        gId: "",
        uoM: "",
        location: "",
        area: "",
        remarks: "",

        status: true,
        isDeleted: false,
      });
    }
  }, [initialData, allBases]);

  // Auto-calculate area when properties change
  useEffect(() => {
    if (form.property && form.property.length > 0 && rentalProperties.length > 0) {
      const totalArea = form.property.reduce((sum, propertyId) => {
        const property = rentalProperties.find((p) => p.id === Number(propertyId));
        return sum + (property && property.area ? Number(property.area) : 0);
      }, 0);

      // Only update if the calculated area is different from current area
      if (form.area !== totalArea) {
        setForm((prevForm) => ({
          ...prevForm,
          area: totalArea,
        }));
      }
    } else if (form.property && form.property.length === 0 && form.area !== "") {
      setForm((prevForm) => ({
        ...prevForm,
        area: "",
      }));
    }
  }, [form.property, rentalProperties]);

  const handleChange = (f, v) =>
    setForm((p) => ({
      ...p,
      [f]: f === "area" ? Number(v) : f === "status" || f === "isDeleted" ? Boolean(v) : v,
      ...(f === "cmdid" && { baseid: "" }),
    }));
  const handleSave = () => onSubmit(form);

  const handlePropertyChange = (event) => {
    const {
      target: { value },
    } = event;
    const selectedProperties = typeof value === "string" ? value.split(",") : value;

    // Calculate total area from selected properties
    const totalArea = selectedProperties.reduce((sum, propertyId) => {
      const property = rentalProperties.find((p) => p.id === Number(propertyId));
      return sum + (property && property.area ? Number(property.area) : 0);
    }, 0);

    setForm((prevForm) => ({
      ...prevForm,
      property: selectedProperties,
      area: totalArea,
    }));
  };

  const handleDeleteProperty = (propertyToDelete) => () => {
    const updatedProperties = form.property.filter((property) => property !== propertyToDelete);

    // Recalculate total area after removing a property
    const totalArea = updatedProperties.reduce((sum, propertyId) => {
      const property = rentalProperties.find((p) => p.id === Number(propertyId));
      return sum + (property && property.area ? Number(property.area) : 0);
    }, 0);

    setForm((prevForm) => ({
      ...prevForm,
      property: updatedProperties,
      area: totalArea,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New Property Grouping</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          {/* First Row: Command, Base, Class */}
          <Grid item xs={12} sm={4}>
            <FormControl
              size="small"
              fullWidth
              sx={{
                minWidth: "140px",
              }}
            >
              <InputLabel
                id="command-label"
                sx={{
                  fontSize: "1rem",
                }}
              >
                Command
              </InputLabel>
              <Select
                labelId="command-label"
                value={form.cmdid || ""}
                label="Command"
                onChange={(e) => handleChange("cmdid", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1rem",
                    padding: "8px 32px 8px 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "wrap",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                }}
              >
                {commands.map((option) => (
                  <MenuItem
                    key={option.id}
                    value={option.id}
                    sx={{ fontSize: "1rem", padding: "8px 14px" }}
                  >
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl
              size="small"
              fullWidth
              sx={{
                minWidth: "140px",
              }}
            >
              <InputLabel
                id="base-label"
                sx={{
                  fontSize: "1rem",
                }}
              >
                Base
              </InputLabel>
              <Select
                labelId="base-label"
                value={form.baseid || ""}
                label="Base"
                onChange={(e) => handleChange("baseid", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1rem",
                    padding: "8px 32px 8px 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                }}
              >
                {allBases
                  .filter((base) => Number(base.cmd) === Number(form.cmdid))
                  .map((option) => (
                    <MenuItem
                      key={option.id}
                      value={option.id}
                      sx={{ fontSize: "1rem", padding: "8px 14px" }}
                    >
                      {option.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl
              size="small"
              fullWidth
              sx={{
                minWidth: "140px",
              }}
            >
              <InputLabel
                id="class-label"
                sx={{
                  fontSize: "1rem",
                }}
              >
                Class
              </InputLabel>
              <Select
                labelId="class-label"
                value={form.classid || ""}
                label="Class"
                onChange={(e) => handleChange("classid", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1rem",
                    padding: "8px 32px 8px 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                }}
              >
                {classes.map((option) => (
                  <MenuItem
                    key={option.id}
                    value={option.id}
                    sx={{ fontSize: "1rem", padding: "8px 14px" }}
                  >
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Property */}
          <Grid item xs={10} sm={6}>
            <FormControl
              size="small"
              fullWidth
              sx={{
                minWidth: "150px",
              }}
            >
              <InputLabel
                id="property-label"
                sx={{
                  fontSize: "1rem",
                }}
              >
                Property
              </InputLabel>
              <Select
                labelId="property-label"
                multiple
                value={form.property || []}
                onChange={handlePropertyChange}
                input={<OutlinedInput id="select-multiple-chip" label="Property" />}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1rem",
                    padding: "8px 32px 8px 14px",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => {
                      const property = rentalProperties.find((p) => p.id === value);
                      return (
                        <Chip
                          key={value}
                          label={property ? property.pId : value}
                          onDelete={handleDeleteProperty(value)}
                          sx={{ fontSize: "0.9rem" }}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {rentalProperties.map((option) => (
                  <MenuItem
                    key={option.id}
                    value={option.id}
                    sx={{ fontSize: "1rem", padding: "8px 14px" }}
                  >
                    {option.pId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* GroupID with reduced width - swapped position */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="GroupID"
              type="text"
              value={form.gId}
              onChange={(e) => handleChange("gId", e.target.value)}
              size="small"
              sx={{
                width: "30%",
                "& .MuiInputBase-input": {
                  fontSize: "1rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1rem",
                },
              }}
            />
          </Grid>

          {/* Address */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Address"
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1rem",
                },
              }}
            />
          </Grid>

          {/* Total Area and UOM bound together - swapped position */}
          <Grid item xs={12} sm={6}>
            <MDBox display="flex" alignItems="center" gap={1}>
              <MDInput
                label="Total Area"
                type="number"
                value={form.area}
                onChange={(e) => handleChange("area", e.target.value)}
                size="small"
                InputProps={{ readOnly: true }}
                sx={{
                  flex: 1,
                  "& .MuiInputBase-input": {
                    fontSize: "1rem",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "1rem",
                  },
                }}
              />
              <FormControl
                size="small"
                sx={{
                  minWidth: "100px",
                  maxWidth: "120px",
                }}
              >
                <InputLabel
                  id="uom-label"
                  sx={{
                    fontSize: "1rem",
                  }}
                >
                  UoM
                </InputLabel>
                <Select
                  labelId="uom-label"
                  value={form.uoM || ""}
                  label="UoM"
                  onChange={(e) => handleChange("uoM", e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                  sx={{
                    fontSize: "1rem",
                    "& .MuiSelect-select": {
                      fontSize: "1rem",
                      padding: "8px 32px 8px 14px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minHeight: "45px",
                    },
                    "& .MuiSelect-icon": {
                      display: "block !important",
                      right: "8px",
                    },
                  }}
                >
                  <MenuItem value="Marla" sx={{ fontSize: "1rem", padding: "8px 14px" }}>
                    Marla
                  </MenuItem>
                  <MenuItem value="Sq Ft" sx={{ fontSize: "1rem", padding: "8px 14px" }}>
                    Sq Ft
                  </MenuItem>
                  <MenuItem value="Acre" sx={{ fontSize: "1rem", padding: "8px 14px" }}>
                    Acre
                  </MenuItem>
                </Select>
              </FormControl>
            </MDBox>
          </Grid>

          {/* Remarks */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Remarks"
              type="text"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1rem",
                },
              }}
            />
          </Grid>

          {/* Status */}
          <Grid item xs={12} sm={6}>
            <FormControl
              size="small"
              fullWidth
              sx={{
                minWidth: "120px",
              }}
            >
              <InputLabel
                id="status-label"
                sx={{
                  fontSize: "1rem",
                }}
              >
                Status
              </InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1rem",
                    padding: "8px 32px 8px 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                }}
              >
                <MenuItem value={true} sx={{ fontSize: "1rem", padding: "8px 14px" }}>
                  Active
                </MenuItem>
                <MenuItem value={false} sx={{ fontSize: "1rem", padding: "8px 14px" }}>
                  Inactive
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          <Icon>save</Icon>&nbsp;Save
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

PropertyGroupingForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  rentalProperties: PropTypes.array.isRequired,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  classes: PropTypes.array.isRequired,
};

export default function PropertyGrouping() {
  const [openForm, setOpenForm] = useState(false);
  const [currentPropertyGrouping, setCurrentPropertyGrouping] = useState(null);
  const [rows, setRows] = useState([]);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [linkedPropertiesDialogOpen, setLinkedPropertiesDialogOpen] = useState(false);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [loadingLinkedProperties, setLoadingLinkedProperties] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState("");
  const [currentGroupRecordId, setCurrentGroupRecordId] = useState(null);
  const [removingPropertyId, setRemovingPropertyId] = useState(null);

  // Pagination state for main table
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Pagination state for linked properties dialog
  const [linkedPropertiesPageNumber, setLinkedPropertiesPageNumber] = useState(1);
  const [linkedPropertiesPageSize, setLinkedPropertiesPageSize] = useState(100);
  const [linkedPropertiesTotalCount, setLinkedPropertiesTotalCount] = useState(0);

  const fetchPropertyGroupings = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await propertyGroupingApi.list(page, size);
      if (response && response.pagination) {
        setRows(response.data || []);
        setTotalCount(response.pagination.totalCount || 0);
        setPageNumber(response.pagination.pageNumber || page);
        setPageSize(response.pagination.pageSize || size);
      } else {
        // Fallback for non-paginated response
        setRows(Array.isArray(response) ? response : []);
        setTotalCount(Array.isArray(response) ? response.length : 0);
      }
    } catch (error) {
      console.error("Error fetching property groupings:", error);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchRentalProperties = async () => {
    try {
      const response = await api.list("rentalproperty");
      setRentalProperties(response);
    } catch (error) {
      console.error("Error fetching rental properties:", error);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      setCommands(response);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      setBases(response);
    } catch (error) {
      console.error("Error fetching bases:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.list("class");
      setClasses(response);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  useEffect(() => {
    // On page load / pagination changes, only load the paginated PropertyGroup list
    fetchPropertyGroupings(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  // Lazy-load dropdown/filter data only when form opens (Add/Edit)
  useEffect(() => {
    if (!openForm) return;

    if (commands.length === 0) fetchCommands();
    // Note: bases list for the form is fetched inside PropertyGroupingForm (allBases)
    if (classes.length === 0) fetchClasses();
    if (rentalProperties.length === 0) fetchRentalProperties();
  }, [openForm, commands.length, classes.length, rentalProperties.length]);

  // Linked Properties dialog may need rentalProperties for name fallback
  useEffect(() => {
    if (!linkedPropertiesDialogOpen) return;
    if (rentalProperties.length === 0) fetchRentalProperties();
  }, [linkedPropertiesDialogOpen, rentalProperties.length]);

  const handleViewLinkedProperties = async (recordId, grpId, page = 1, size = 100) => {
    setCurrentGroupRecordId(recordId);
    setCurrentGroupId(grpId);
    setLinkedPropertiesDialogOpen(true);
    setLoadingLinkedProperties(true);
    setLinkedProperties([]);
    setLinkedPropertiesPageNumber(page);
    setLinkedPropertiesPageSize(size);
    try {
      const response = await propertyGroupingApi.getByGroup(recordId, page, size);
      if (response && response.pagination) {
        setLinkedProperties(response.data || []);
        setLinkedPropertiesTotalCount(response.pagination.totalCount || 0);
        setLinkedPropertiesPageNumber(response.pagination.pageNumber || page);
        setLinkedPropertiesPageSize(response.pagination.pageSize || size);
      } else {
        // Fallback for non-paginated response
        setLinkedProperties(Array.isArray(response) ? response : []);
        setLinkedPropertiesTotalCount(Array.isArray(response) ? response.length : 0);
      }
    } catch (error) {
      console.error("Error fetching linked properties:", error);
      alert("Failed to load linked properties.");
      setLinkedProperties([]);
      setLinkedPropertiesTotalCount(0);
    } finally {
      setLoadingLinkedProperties(false);
    }
  };

  const handleLinkedPropertiesPageChange = (newPage) => {
    if (currentGroupRecordId) {
      handleViewLinkedProperties(
        currentGroupRecordId,
        currentGroupId,
        newPage,
        linkedPropertiesPageSize
      );
    }
  };

  const handleLinkedPropertiesPageSizeChange = (newSize) => {
    if (currentGroupRecordId) {
      handleViewLinkedProperties(currentGroupRecordId, currentGroupId, 1, newSize);
    }
  };

  const handleCloseLinkedPropertiesDialog = () => {
    setLinkedPropertiesDialogOpen(false);
    setLinkedProperties([]);
    setCurrentGroupId("");
    setCurrentGroupRecordId(null);
    setLinkedPropertiesPageNumber(1);
    setLinkedPropertiesPageSize(100);
    setLinkedPropertiesTotalCount(0);
  };

  const handleRemoveProperty = async (linkingId) => {
    if (!window.confirm("Are you sure you want to remove this property from the group?")) {
      return;
    }

    setRemovingPropertyId(linkingId);
    try {
      await propertyGroupingApi.removePropertyFromGroup(linkingId);
      // Refresh the linked properties list
      const response = await propertyGroupingApi.getByGroup(
        currentGroupRecordId,
        linkedPropertiesPageNumber,
        linkedPropertiesPageSize
      );
      if (response && response.pagination) {
        setLinkedProperties(response.data || []);
        setLinkedPropertiesTotalCount(response.pagination.totalCount || 0);
      } else {
        setLinkedProperties(Array.isArray(response) ? response : []);
        setLinkedPropertiesTotalCount(Array.isArray(response) ? response.length : 0);
      }
      // Refresh the main table
      fetchPropertyGroupings(pageNumber, pageSize);
      alert("Property removed successfully!");
    } catch (error) {
      console.error("Error removing property:", error);
      alert("Failed to remove property. Please try again.");
    } finally {
      setRemovingPropertyId(null);
    }
  };

  const getPropertyName = (propertyId) => {
    if (!propertyId) return "Unknown Property";
    // Handle if propertyId is already an object with name/groupName
    if (typeof propertyId === "object") {
      return propertyId.groupName || propertyId.name || propertyId.pId || "Unknown Property";
    }
    const property = rentalProperties.find((p) => p.id === Number(propertyId));
    return property ? property.pId : `Property ID: ${propertyId}`;
  };

  const columns = [
    {
      Header: "Actions",
      accessor: "actions",
      align: "center",
      width: "10%",
    },
    { Header: "ID", accessor: "id", align: "left", width: "5%" },
    { Header: "Command", accessor: "cmdName", align: "left", width: "12%" },
    { Header: "Base", accessor: "baseName", align: "left", width: "12%" },
    { Header: "Class", accessor: "className", align: "left", width: "12%" },
    { Header: "Group ID", accessor: "gId", align: "left", width: "8%" },
    { Header: "UoM", accessor: "uoM", align: "left", width: "7%" },
    { Header: "Area", accessor: "area", align: "right", width: "7%" },
    { Header: "Location", accessor: "location", align: "left", width: "13%" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      width: "8%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? "Active" : "Inactive"),
    },
    {
      Header: "Linked Properties",
      accessor: "linkedProperties",
      align: "center",
      width: "10%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const recordId = row?.original?.id;
        // eslint-disable-next-line react/prop-types
        const grpId = row?.original?.gId || "";
        return recordId ? (
          <IconButton
            size="small"
            color="primary"
            // eslint-disable-next-line react/prop-types
            onClick={() => handleViewLinkedProperties(recordId, grpId)}
            title="View linked properties"
          >
            <Icon>visibility</Icon>
          </IconButton>
        ) : (
          <span>-</span>
        );
      },
    },
  ];

  const handleOpenForm = () => {
    setCurrentPropertyGrouping(null);
    setOpenForm(true);
  };
  const handleCloseForm = () => setOpenForm(false);

  const handleEditPropertyGrouping = (id) => {
    const propertyGrouping = rows.find((row) => row.id === id);
    setCurrentPropertyGrouping({
      ...propertyGrouping,
      cmdId: propertyGrouping.cmdId || propertyGrouping.cmdid,
      baseId: propertyGrouping.baseId || propertyGrouping.baseid,
      classId: propertyGrouping.classId || propertyGrouping.classid,
      cmdid: Number(propertyGrouping.cmdId || propertyGrouping.cmdid),
      baseid: Number(propertyGrouping.baseId || propertyGrouping.baseid),
      classid: Number(propertyGrouping.classId || propertyGrouping.classid),
      property: propertyGrouping.property
        ? Array.isArray(propertyGrouping.property)
          ? propertyGrouping.property
          : String(propertyGrouping.property).split(", ")
        : [],
      area: Number(propertyGrouping.area),
      status: Boolean(propertyGrouping.status),
      isDeleted: Boolean(propertyGrouping.isDeleted),
    });
    setOpenForm(true);
  };

  const handleDeletePropertyGrouping = async (id) => {
    try {
      await propertyGroupingApi.remove(id);
      fetchPropertyGroupings();
    } catch (error) {
      console.error("Error deleting property grouping:", error);
    }
  };

  const handleSubmit = async (data) => {
    try {
      // Convert property array to list of IDs for PropertyGroupLinkings
      const propertyGroupLinkings = Array.isArray(data.property)
        ? data.property.map((propId) => Number(propId))
        : [];

      const formattedData = {
        cmdId: Number(data.cmdid),
        baseId: Number(data.baseid),
        classId: Number(data.classid),
        gId: data.gId || "",
        uoM: data.uoM || "",
        location: data.location || "",
        area: Number(data.area) || 0,
        remarks: data.remarks || "",
        property: data.property.join(", "), // Keep existing property field as joined string
        PropertyGroupLinkings: propertyGroupLinkings, // New field: list of property IDs
        status: Boolean(data.status),
        isDeleted: Boolean(data.isDeleted),
      };
      if (currentPropertyGrouping) {
        await propertyGroupingApi.update(currentPropertyGrouping.id, formattedData);
      } else {
        await propertyGroupingApi.create(formattedData);
      }
      fetchPropertyGroupings(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving property grouping:", error);
    }
  };

  const computedRows = rows.map((row) => ({
    id: row.id,
    cmdId: row.cmdId || row.cmdid,
    baseId: row.baseId || row.baseid,
    classId: row.classId || row.classid,
    cmdName: row.cmdName || "",
    baseName: row.baseName || "",
    className: row.className || "",
    gId: row.gId || "",
    uoM: row.uoM || "",
    area: row.area || 0,
    location: row.location || "",
    remarks: row.remarks || "",
    status: row.status,
    actions: (
      <MDBox
        alignItems="left"
        justifyContent="left"
        sx={{
          backgroundColor: "#f8f9fa", // Light grey background (same as rental-properties)
          gap: "2px", // Small gap between icons
          padding: "2px 2px", // Compact padding
          borderRadius: "2px",
        }}
      >
        <IconButton
          size="small"
          color="info"
          onClick={() => handleEditPropertyGrouping(row.id)}
          title="Edit"
          sx={{ padding: "1px" }}
        >
          <Icon>edit</Icon>
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeletePropertyGrouping(row.id)}
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
        <Grid container spacing={6}>
          <Grid item xs={12}>
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
                  Property Grouping
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
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
                    whiteSpace: "normal !important",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  },
                  "& .MuiTable-root td": {
                    padding: "8px 10px !important",
                    borderBottom: "1px solid #e0e0e0",
                    whiteSpace: "normal !important",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  },
                  // Tighten spacing for numeric-ish columns (ID, Group ID, Area)
                  // 2 = ID, 6 = Group ID, 8 = Area
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2), & .MuiTable-root th:nth-of-type(6), & .MuiTable-root td:nth-of-type(6), & .MuiTable-root th:nth-of-type(8), & .MuiTable-root td:nth-of-type(8)":
                    {
                      paddingLeft: "6px !important",
                      paddingRight: "6px !important",
                    },
                }}
              >
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
                {/* Custom Pagination Controls and Search */}
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  p={3}
                  pb={2}
                >
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
                  <MDBox width="12rem">
                    <MDInput
                      placeholder="Search..."
                      size="small"
                      fullWidth
                      onChange={(e) => {
                        // Client-side search on current page data
                        const searchTerm = e.target.value.toLowerCase();
                        // Note: For server-side search, you'd need to add search parameter to API
                      }}
                    />
                  </MDBox>
                </MDBox>

                {/* Table */}
                <DataTable
                  table={{ columns, rows: computedRows }}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch={false}
                  pagination={{ variant: "gradient", color: "info" }}
                />

                {/* Custom Pagination Footer */}
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
                          .filter((page) => {
                            const totalPages = Math.ceil(totalCount / pageSize);
                            return (
                              page === 1 ||
                              page === totalPages ||
                              (page >= pageNumber - 2 && page <= pageNumber + 2)
                            );
                          })
                          .map((page, index, array) => {
                            const prevPage = array[index - 1];
                            const showEllipsis = prevPage && page - prevPage > 1;
                            return (
                              <React.Fragment key={page}>
                                {showEllipsis && (
                                  <MDPagination item disabled>
                                    <Icon>more_horiz</Icon>
                                  </MDPagination>
                                )}
                                <MDPagination
                                  item
                                  onClick={() => setPageNumber(page)}
                                  active={page === pageNumber}
                                >
                                  {page}
                                </MDPagination>
                              </React.Fragment>
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
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <PropertyGroupingForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentPropertyGrouping}
        rentalProperties={rentalProperties}
        commands={commands}
        bases={bases}
        classes={classes}
      />
      {/* Linked Properties Dialog */}
      <Dialog
        open={linkedPropertiesDialogOpen}
        onClose={handleCloseLinkedPropertiesDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Group ID: {currentGroupId}</DialogTitle>
        <DialogContent>
          {loadingLinkedProperties ? (
            <MDBox display="flex" justifyContent="center" py={3}>
              <CurrencyLoading size={40} />
            </MDBox>
          ) : linkedProperties.length === 0 ? (
            <MDTypography variant="body2" color="text">
              No linked properties found for this group.
            </MDTypography>
          ) : (
            <>
              {/* Pagination Controls for Linked Properties */}
              {linkedPropertiesTotalCount > linkedPropertiesPageSize && (
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <MDBox display="flex" alignItems="center">
                    <Autocomplete
                      disableClearable
                      value={linkedPropertiesPageSize.toString()}
                      options={["25", "50", "100", "200"]}
                      onChange={(event, newValue) => {
                        handleLinkedPropertiesPageSizeChange(parseInt(newValue, 10));
                      }}
                      size="small"
                      sx={{ width: "5rem" }}
                      renderInput={(params) => <MDInput {...params} />}
                    />
                    <MDTypography variant="caption" color="secondary">
                      &nbsp;&nbsp;entries per page
                    </MDTypography>
                  </MDBox>
                  <MDTypography variant="caption" color="secondary">
                    Showing {(linkedPropertiesPageNumber - 1) * linkedPropertiesPageSize + 1} to{" "}
                    {Math.min(
                      linkedPropertiesPageNumber * linkedPropertiesPageSize,
                      linkedPropertiesTotalCount
                    )}{" "}
                    of {linkedPropertiesTotalCount} entries
                  </MDTypography>
                </MDBox>
              )}
              <List disablePadding>
                {linkedProperties.map((property, index) => {
                  const linkingId = property.id; // PropertyGroupLinking ID

                  // Extract property name - handle different response formats
                  let propertyName = "Unknown Property";

                  // Check if property has a groupName or name field directly
                  if (property.groupName) {
                    propertyName = property.groupName;
                  } else if (property.name) {
                    propertyName = property.name;
                  } else if (property.property) {
                    // If property is an object, check for groupName, name, or pId
                    if (typeof property.property === "object") {
                      propertyName =
                        property.property.groupName ||
                        property.property.name ||
                        property.property.pId ||
                        "Unknown Property";
                    } else {
                      // If property is just an ID, look it up
                      propertyName = getPropertyName(property.property);
                    }
                  } else if (property.propertyId) {
                    // If propertyId exists, extract it and look up the property
                    const propertyId =
                      typeof property.propertyId === "object"
                        ? property.propertyId.id || property.propertyId.propertyId
                        : property.propertyId;
                    propertyName = getPropertyName(propertyId);
                  }

                  return (
                    <MDBox key={linkingId || index}>
                      <ListItem
                        disableGutters
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          px: 0,
                        }}
                      >
                        <ListItemText primary={propertyName} />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveProperty(linkingId)}
                          disabled={removingPropertyId === linkingId}
                          title="Remove property from group"
                        >
                          {removingPropertyId === linkingId ? (
                            <CurrencyLoading size={20} />
                          ) : (
                            <Icon>delete</Icon>
                          )}
                        </IconButton>
                      </ListItem>
                      {index < linkedProperties.length - 1 && <Divider />}
                    </MDBox>
                  );
                })}
              </List>
              {/* Pagination Controls for Linked Properties */}
              {linkedPropertiesTotalCount > linkedPropertiesPageSize && (
                <MDBox display="flex" justifyContent="center" mt={2}>
                  <MDPagination variant="gradient" color="info">
                    {linkedPropertiesPageNumber > 1 && (
                      <MDPagination
                        item
                        onClick={() =>
                          handleLinkedPropertiesPageChange(linkedPropertiesPageNumber - 1)
                        }
                      >
                        <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
                      </MDPagination>
                    )}
                    {Array.from(
                      { length: Math.ceil(linkedPropertiesTotalCount / linkedPropertiesPageSize) },
                      (_, i) => i + 1
                    )
                      .filter((page) => {
                        const totalPages = Math.ceil(
                          linkedPropertiesTotalCount / linkedPropertiesPageSize
                        );
                        return (
                          page === 1 ||
                          page === totalPages ||
                          (page >= linkedPropertiesPageNumber - 1 &&
                            page <= linkedPropertiesPageNumber + 1)
                        );
                      })
                      .map((page, index, array) => {
                        const prevPage = array[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <MDPagination item disabled>
                                <Icon>more_horiz</Icon>
                              </MDPagination>
                            )}
                            <MDPagination
                              item
                              onClick={() => handleLinkedPropertiesPageChange(page)}
                              active={page === linkedPropertiesPageNumber}
                            >
                              {page}
                            </MDPagination>
                          </React.Fragment>
                        );
                      })}
                    {linkedPropertiesPageNumber <
                      Math.ceil(linkedPropertiesTotalCount / linkedPropertiesPageSize) && (
                      <MDPagination
                        item
                        onClick={() =>
                          handleLinkedPropertiesPageChange(linkedPropertiesPageNumber + 1)
                        }
                      >
                        <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
                      </MDPagination>
                    )}
                  </MDPagination>
                </MDBox>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={handleCloseLinkedPropertiesDialog}
          >
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
