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
import FormHelperText from "@mui/material/FormHelperText";
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
import StatusBadge from "components/StatusBadge";

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
  const isEditMode = Boolean(initialData);
  const normalizePropertyIds = (data) => {
    if (!data) return [];

    const fromLinkings = data.PropertyGroupLinkings || data.propertyGroupLinkings;
    if (Array.isArray(fromLinkings) && fromLinkings.length) {
      const ids = fromLinkings
        .map((x) => {
          if (x === null || x === undefined) return null;
          if (typeof x === "number" || typeof x === "string") return Number(x);
          // best-effort for object shapes
          const candidate =
            x.propertyId?.id ??
            x.propertyId ??
            x.property?.id ??
            x.property ??
            x.rentalPropertyId?.id ??
            x.rentalPropertyId ??
            x.id;
          return Number(candidate);
        })
        .filter((n) => Number.isFinite(n));
      return Array.from(new Set(ids));
    }

    const raw = data.property;
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
  const [errors, setErrors] = useState({});

  const [allBases, setAllBases] = useState([]); // New state to store all bases
  const [linkedPropertyNameById, setLinkedPropertyNameById] = useState({});

  const getPropertyLabel = (propertyId) => {
    const idKey = String(propertyId);
    const fromLinked = linkedPropertyNameById[idKey];
    if (fromLinked) return String(fromLinked);
    const prop = rentalProperties.find((p) => Number(p.id) === Number(propertyId));
    return String(prop?.propertyName || prop?.name || prop?.pId || propertyId);
  };

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
    // reset validation errors when opening / switching edit mode
    setErrors({});
    if (initialData) {
      const normalizedPropertyIds = normalizePropertyIds(initialData);
      const newForm = {
        cmdid: initialData.cmdId || "",
        baseid: initialData.baseId || "",
        classid: initialData.classId || "",
        property: normalizedPropertyIds,
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
      setLinkedPropertyNameById(initialData.linkedPropertyNameById || {});
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
      setLinkedPropertyNameById({});
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

  const handleChange = (f, v) => {
    setForm((p) => ({
      ...p,
      [f]: f === "area" ? Number(v) : f === "status" || f === "isDeleted" ? Boolean(v) : v,
      ...(f === "cmdid" && { baseid: "" }),
    }));
    // clear field-level error on change
    if (errors?.[f]) setErrors((prev) => ({ ...prev, [f]: undefined }));
  };

  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.trim().length === 0;
    return false;
  };

  const validateAddNew = () => {
    const next = {};
    const required = [
      { key: "cmdid", label: "Command" },
      { key: "baseid", label: "Base" },
      { key: "classid", label: "Class" },
      { key: "property", label: "Property" },
      { key: "gId", label: "GroupID" },
      { key: "location", label: "Address" },
      { key: "uoM", label: "UoM" },
      { key: "remarks", label: "Remarks" },
    ];
    required.forEach(({ key, label }) => {
      if (isEmpty(form?.[key])) next[key] = `${label} is required`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    // Apply mandatory check only for "Add New"
    if (!isEditMode) {
      const ok = validateAddNew();
      if (!ok) return;
    }
    onSubmit(form);
  };

  const handlePropertyChange = (event) => {
    const {
      target: { value },
    } = event;
    const selectedPropertiesRaw = typeof value === "string" ? value.split(",") : value;
    const selectedProperties = (selectedPropertiesRaw || [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    setForm((prevForm) => {
      const prevIds = Array.isArray(prevForm.property) ? prevForm.property : [];

      // Allow removals freely; enforce unique labels only when adding new selection(s)
      const isRemoval = selectedProperties.length < prevIds.length;
      if (!isRemoval) {
        const prevLabelSet = new Set(prevIds.map(getPropertyLabel));

        // Detect newly-added ids and block duplicates by label
        const addedIds = selectedProperties.filter((id) => !prevIds.includes(id));
        for (let i = 0; i < addedIds.length; i += 1) {
          const id = addedIds[i];
          const label = getPropertyLabel(id);
          if (prevLabelSet.has(label)) {
            alert(`"${label}" is already selected. Each property name can be added only once.`);
            return prevForm;
          }
          prevLabelSet.add(label);
        }

        // Also prevent duplicates within the incoming selection itself (edge case)
        const seen = new Set();
        for (let i = 0; i < selectedProperties.length; i += 1) {
          const label = getPropertyLabel(selectedProperties[i]);
          if (seen.has(label)) {
            alert(`"${label}" is already selected. Each property name can be added only once.`);
            return prevForm;
          }
          seen.add(label);
        }
      }

      // Calculate total area from selected properties
      const totalArea = selectedProperties.reduce((sum, propertyId) => {
        const property = rentalProperties.find((p) => p.id === Number(propertyId));
        return sum + (property && property.area ? Number(property.area) : 0);
      }, 0);

      return {
        ...prevForm,
        property: selectedProperties,
        area: totalArea,
      };
    });
    if (errors?.property) setErrors((prev) => ({ ...prev, property: undefined }));
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
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.cmdid)}
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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
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
              {!isEditMode && errors.cmdid && <FormHelperText>{errors.cmdid}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl
              size="small"
              fullWidth
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.baseid)}
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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
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
              {!isEditMode && errors.baseid && <FormHelperText>{errors.baseid}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl
              size="small"
              fullWidth
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.classid)}
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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
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
              {!isEditMode && errors.classid && <FormHelperText>{errors.classid}</FormHelperText>}
            </FormControl>
          </Grid>

          {/* Property */}
          <Grid item xs={10} sm={6}>
            <FormControl
              size="small"
              fullWidth
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.property)}
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
                disabled={isEditMode}
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
                    padding: "0 32px 0 14px",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "8px",
                  },
                  // Keep it readable even when disabled (read-only requirement)
                  "&.Mui-disabled": {
                    opacity: 1,
                  },
                  "& .MuiSelect-select.Mui-disabled": {
                    WebkitTextFillColor: "inherit",
                  },
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => {
                      const property = rentalProperties.find((p) => Number(p.id) === Number(value));
                      const label =
                        linkedPropertyNameById[String(value)] ||
                        property?.propertyName ||
                        property?.name ||
                        property?.pId ||
                        value;
                      return (
                        <Chip
                          key={value}
                          label={label}
                          {...(!isEditMode && { onDelete: handleDeleteProperty(value) })}
                          sx={{ fontSize: "0.9rem" }}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {rentalProperties.map((option) => {
                  const optionLabel = getPropertyLabel(option.id);
                  const selectedIds = form.property || [];
                  const selectedLabelSet = new Set(selectedIds.map(getPropertyLabel));
                  const isSelected = selectedIds.some((id) => Number(id) === Number(option.id));
                  const isDuplicateName = selectedLabelSet.has(optionLabel) && !isSelected;

                  return (
                    <MenuItem
                      key={option.id}
                      value={option.id}
                      disabled={isDuplicateName}
                      sx={{ fontSize: "1rem", padding: "8px 14px" }}
                    >
                      {optionLabel}
                    </MenuItem>
                  );
                })}
              </Select>
              {!isEditMode && errors.property && <FormHelperText>{errors.property}</FormHelperText>}
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
              fullWidth
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.gId)}
              helperText={!isEditMode ? errors.gId : ""}
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

          {/* Address */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Address"
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              fullWidth
              size="small"
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.location)}
              helperText={!isEditMode ? errors.location : ""}
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
                fullWidth
                required={!isEditMode}
                error={!isEditMode && Boolean(errors.uoM)}
                sx={{
                  flex: 1,
                  minWidth: "140px",
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
                      padding: "0 32px 0 14px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minHeight: "45px",
                      display: "flex",
                      alignItems: "center",
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
                {!isEditMode && errors.uoM && <FormHelperText>{errors.uoM}</FormHelperText>}
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
              required={!isEditMode}
              error={!isEditMode && Boolean(errors.remarks)}
              helperText={!isEditMode ? errors.remarks : ""}
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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [linkedPropertiesDialogOpen, setLinkedPropertiesDialogOpen] = useState(false);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [loadingLinkedProperties, setLoadingLinkedProperties] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState("");
  const [currentGroupRecordId, setCurrentGroupRecordId] = useState(null);
  const [removingPropertyId, setRemovingPropertyId] = useState(null);
  const [linkingSelection, setLinkingSelection] = useState([]);
  const [savingLinkings, setSavingLinkings] = useState(false);

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
    setLinkingSelection([]);
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
    setLinkingSelection([]);
    setSavingLinkings(false);
    setLinkedPropertiesPageNumber(1);
    setLinkedPropertiesPageSize(100);
    setLinkedPropertiesTotalCount(0);
  };

  const getRentalPropertyLabel = (rp) => String(rp?.propertyName || rp?.name || rp?.pId || "");

  const getLinkedPropertyLabel = (item) =>
    String(
      item?.propertyName ||
        item?.name ||
        (typeof item?.property === "object"
          ? item.property.groupName || item.property.name || item.property.pId
          : "") ||
        ""
    );

  const getPropertyLabelById = (propertyId) => {
    const rp = rentalProperties.find((p) => Number(p.id) === Number(propertyId));
    return rp ? getRentalPropertyLabel(rp) : `Property ID: ${propertyId}`;
  };

  const getLinkedPropertyId = (item) =>
    Number(
      item?.propertyId?.id ??
        item?.propertyId ??
        item?.property?.id ??
        item?.property?.propertyId ??
        item?.property ??
        item?.rentalPropertyId?.id ??
        item?.rentalPropertyId
    );

  const getLinkedPropertyNameSet = () => {
    const set = new Set();
    linkedProperties.forEach((x) => {
      const name = getLinkedPropertyLabel(x);
      if (name) set.add(name);
    });
    return set;
  };

  const handleSaveLinkings = async () => {
    if (!currentGroupRecordId) return;
    const ids = Array.from(
      new Set((linkingSelection || []).map((n) => Number(n)).filter(Number.isFinite))
    );
    if (ids.length === 0) return;

    setSavingLinkings(true);
    try {
      await Promise.all(
        ids.map((propertyId) =>
          propertyGroupingApi.createPropertyGroupLinking({
            GrpId: Number(currentGroupRecordId),
            PropId: Number(propertyId),
          })
        )
      );
      setLinkingSelection([]);
      await handleViewLinkedProperties(
        currentGroupRecordId,
        currentGroupId,
        linkedPropertiesPageNumber,
        linkedPropertiesPageSize
      );
      fetchPropertyGroupings(pageNumber, pageSize);
    } catch (e) {
      console.error("Error creating property group linkings:", e);
      alert("Failed to add linked properties. Please try again.");
    } finally {
      setSavingLinkings(false);
    }
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
      Cell: ({ value }) => <StatusBadge value={value} />,
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
    const normalizePropertyIds = (data) => {
      if (!data) return [];
      const fromLinkings = data.PropertyGroupLinkings || data.propertyGroupLinkings;
      if (Array.isArray(fromLinkings) && fromLinkings.length) {
        const ids = fromLinkings
          .map((x) => {
            if (x === null || x === undefined) return null;
            if (typeof x === "number" || typeof x === "string") return Number(x);
            const candidate =
              x.propertyId?.id ??
              x.propertyId ??
              x.property?.id ??
              x.property ??
              x.rentalPropertyId?.id ??
              x.rentalPropertyId ??
              x.id;
            return Number(candidate);
          })
          .filter((n) => Number.isFinite(n));
        return Array.from(new Set(ids));
      }
      const raw = data.property;
      if (Array.isArray(raw))
        return Array.from(new Set(raw.map((v) => Number(v)).filter(Number.isFinite)));
      if (typeof raw === "string")
        return Array.from(
          new Set(
            raw
              .split(",")
              .map((s) => Number(String(s).trim()))
              .filter((n) => Number.isFinite(n))
          )
        );
      return [];
    };

    const extractLinkedPropertiesMeta = (resp) => {
      const list = resp && resp.pagination ? resp.data || [] : Array.isArray(resp) ? resp : [];
      const nameById = {};
      const ids = [];

      list.forEach((x) => {
        if (!x) return;
        const candidate =
          x.propertyId?.id ??
          x.propertyId ??
          x.property?.id ??
          x.property?.propertyId ??
          x.property ??
          x.rentalPropertyId?.id ??
          x.rentalPropertyId ??
          x.id;
        const idNum = Number(candidate);
        if (!Number.isFinite(idNum)) return;
        ids.push(idNum);

        const displayName =
          x.propertyName ||
          x.name ||
          (typeof x.property === "object"
            ? x.property.groupName || x.property.name || x.property.pId
            : null) ||
          null;
        if (displayName) nameById[String(idNum)] = String(displayName);
      });

      return { ids: Array.from(new Set(ids)), nameById };
    };

    const mapToFormInitialData = (pg) => ({
      ...pg,
      cmdId: pg.cmdId || pg.cmdid,
      baseId: pg.baseId || pg.baseid,
      classId: pg.classId || pg.classid,
      cmdid: Number(pg.cmdId || pg.cmdid),
      baseid: Number(pg.baseId || pg.baseid),
      classid: Number(pg.classId || pg.classid),
      property: normalizePropertyIds(pg),
      area: Number(pg.area),
      status: Boolean(pg.status),
      isDeleted: Boolean(pg.isDeleted),
    });

    // Open immediately using row data (fast), then hydrate using:
    // - GET /api/PropertyGroup/:id for full record
    // - GET /api/PropertyGroup/ByGroup/:id for linked properties (same as the eye-icon dialog)
    setCurrentPropertyGrouping(mapToFormInitialData(propertyGrouping));
    setOpenForm(true);

    (async () => {
      try {
        const [full, byGroup] = await Promise.all([
          propertyGroupingApi.get(id),
          propertyGroupingApi.getByGroup(id, 1, 1000),
        ]);
        const { ids: linkedIds, nameById } = extractLinkedPropertiesMeta(byGroup);
        const base = full || propertyGrouping || {};
        const hydrated = {
          ...base,
          ...(linkedIds.length ? { property: linkedIds } : {}),
          linkedPropertyNameById: nameById,
        };
        setCurrentPropertyGrouping(mapToFormInitialData(hydrated));
      } catch (e) {
        // keep the row-based data if GET fails
        console.error("Error fetching property grouping details:", e);
      }
    })();

    return;
  };

  const handleDeletePropertyGrouping = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await propertyGroupingApi.remove(recordToDelete);
      fetchPropertyGroupings();
    } catch (error) {
      console.error("Error deleting property grouping:", error);
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
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
                  // ID column: keep integers on a single line (avoid 1006 -> 100 + 6)
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
                    whiteSpace: "nowrap !important",
                    wordBreak: "normal !important",
                    overflowWrap: "normal !important",
                    width: "56px !important",
                    minWidth: "56px !important",
                    maxWidth: "56px !important",
                    textAlign: "center !important",
                  },
                  "& .MuiTable-root td:nth-of-type(2) > div": {
                    whiteSpace: "nowrap !important",
                    wordBreak: "normal !important",
                    overflowWrap: "normal !important",
                  },
                  "& .MuiTable-root td:nth-of-type(2) > div > *": {
                    whiteSpace: "nowrap !important",
                    wordBreak: "normal !important",
                    overflowWrap: "normal !important",
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
                      sx={{
                        width: "5rem",
                        "& .MuiInputBase-root": { minHeight: "45px" },
                        "& .MuiInputBase-input": { paddingTop: 0, paddingBottom: 0 },
                      }}
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
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this property grouping? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" variant="gradient">
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
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
          {/* Add Linked Properties */}
          <MDBox mb={2}>
            <MDTypography
              variant="button"
              color="secondary"
              fontWeight="regular"
              sx={{ display: "block", mb: 0.5 }}
            >
              Add Properties
            </MDTypography>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={rentalProperties || []}
              value={(rentalProperties || []).filter((rp) =>
                (linkingSelection || []).some((id) => Number(id) === Number(rp.id))
              )}
              getOptionLabel={(option) =>
                getRentalPropertyLabel(option) || String(option?.id || "")
              }
              isOptionEqualToValue={(option, value) => Number(option?.id) === Number(value?.id)}
              onChange={(event, newValue) => {
                const nextIds = (newValue || []).map((v) => Number(v.id)).filter(Number.isFinite);

                // Enforce unique propertyName across already-linked + newly-selected
                const usedNames = getLinkedPropertyNameSet();
                const seen = new Set();
                for (let i = 0; i < nextIds.length; i += 1) {
                  const label = getPropertyLabelById(nextIds[i]);
                  if (usedNames.has(label) || seen.has(label)) {
                    alert(
                      `"${label}" is already selected. Each property name can be added only once.`
                    );
                    return;
                  }
                  seen.add(label);
                }
                setLinkingSelection(nextIds);
              }}
              renderInput={(params) => (
                <MDInput {...params} placeholder="Select properties..." size="small" fullWidth />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option?.id ?? index}
                    label={getRentalPropertyLabel(option) || String(option?.id || "")}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderOption={(props, option) => {
                const optionLabel = getRentalPropertyLabel(option) || String(option?.id || "");
                const linkedNameSet = getLinkedPropertyNameSet();
                const selectedNameSet = new Set(
                  (linkingSelection || []).map((id) => getPropertyLabelById(id))
                );
                const isAlreadyLinked = linkedNameSet.has(optionLabel);
                const isDuplicateByName =
                  selectedNameSet.has(optionLabel) &&
                  !(linkingSelection || []).includes(Number(option.id));

                return (
                  <li {...props} aria-disabled={isAlreadyLinked || isDuplicateByName}>
                    <MDBox
                      display="flex"
                      justifyContent="space-between"
                      width="100%"
                      alignItems="center"
                    >
                      <span>{optionLabel}</span>
                      {isAlreadyLinked ? (
                        <MDTypography variant="caption" color="secondary">
                          linked
                        </MDTypography>
                      ) : null}
                    </MDBox>
                  </li>
                );
              }}
              sx={{
                "& .MuiInputBase-root": { minHeight: "45px" },
                "& .MuiAutocomplete-inputRoot": { paddingTop: 0, paddingBottom: 0 },
                "& .MuiInputBase-input": { paddingTop: 0, paddingBottom: 0 },
              }}
            />
            <MDBox display="flex" justifyContent="flex-end" mt={1} gap={1}>
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleSaveLinkings}
                disabled={savingLinkings || !linkingSelection.length}
              >
                {savingLinkings ? "Saving..." : "Save"}
              </MDButton>
            </MDBox>
          </MDBox>

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
                      sx={{
                        width: "5rem",
                        "& .MuiInputBase-root": { minHeight: "45px" },
                        "& .MuiInputBase-input": { paddingTop: 0, paddingBottom: 0 },
                      }}
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
                  if (property.propertyName) {
                    propertyName = property.propertyName;
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
