import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import OutlinedInput from "@mui/material/OutlinedInput";
import api from "services/api.service";
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

    fetchAllBases();
  }, []);

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
                    minHeight: "48px",
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
          {/* Area and UOM bound together */}
          <Grid item xs={10} sm={3}>
            <MDInput
              label="Total Area"
              type="number"
              value={form.area}
              onChange={(e) => handleChange("area", e.target.value)}
              size="small"
              InputProps={{ readOnly: true }}
              sx={{
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
              sx={{
                minWidth: "40",
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
                    minHeight: "40px",
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
          </Grid>

          {/* GroupID with reduced width */}
          <Grid item xs={10} sm={10}>
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

            <FormControl
              size="small"
              sx={{
                minWidth: "60px",
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
                    minHeight: "40px",
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
          {/* Address */}
          <Grid item xs={12} sm={14}>
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

  const fetchPropertyGroupings = async () => {
    try {
      const response = await api.list("propertygroup");
      setRows(response);
    } catch (error) {
      console.error("Error fetching property groupings:", error);
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
    fetchPropertyGroupings();
    fetchRentalProperties();
    fetchCommands();
    fetchBases();
    fetchClasses();
  }, []);

  const getCommandName = (commandId) => {
    const command = commands.find((cmd) => cmd.id === commandId);
    return command ? command.name : commandId;
  };

  const getBaseName = (baseId) => {
    const base = bases.find((b) => b.id === baseId);
    return base ? base.name : baseId;
  };

  const getClassName = (classId) => {
    const classItem = classes.find((c) => c.id === classId);
    return classItem ? classItem.name : classId;
  };

  const columns = [
    { Header: "ID", accessor: "id", align: "left" },
    {
      Header: "Command",
      accessor: "cmdId",
      align: "left",
      Cell: ({ value }) => getCommandName(value),
    },
    {
      Header: "Base",
      accessor: "baseId",
      align: "left",
      Cell: ({ value }) => getBaseName(value),
    },
    {
      Header: "Class",
      accessor: "classId",
      align: "left",
      Cell: ({ value }) => getClassName(value),
    },
    { Header: "Group ID", accessor: "gId", align: "left" },
    { Header: "UoM", accessor: "uoM", align: "left" },
    { Header: "Area", accessor: "area", align: "left" },
    { Header: "Location", accessor: "location", align: "left" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    {
      Header: "Status",
      accessor: "status",
      align: "left",
      Cell: ({ value }) => (value ? "Active" : "Inactive"),
    },
    { Header: "Actions", accessor: "actions", align: "center" },
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
      await api.remove("propertygroup", id);
      fetchPropertyGroupings();
    } catch (error) {
      console.error("Error deleting property grouping:", error);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const formattedData = {
        ...data,
        cmdid: Number(data.cmdid),
        baseid: Number(data.baseid),
        classid: Number(data.classid),
        property: data.property.join(", "),
        area: Number(data.area),
        status: Boolean(data.status),
        isDeleted: Boolean(data.isDeleted),
      };
      if (currentPropertyGrouping) {
        await api.update("propertygroup", currentPropertyGrouping.id, formattedData);
      } else {
        await api.create("propertygroup", formattedData);
      }
      fetchPropertyGroupings();
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
    gId: row.gId || "",
    uoM: row.uoM || "",
    area: row.area || 0,
    location: row.location || "",
    remarks: row.remarks || "",
    status: row.status,
    actions: (
      <MDBox display="flex" alignItems="center" mt={{ xs: 2, sm: 0 }} ml={{ xs: -1.5, sm: 0 }}>
        <MDButton variant="text" color="dark" onClick={() => handleEditPropertyGrouping(row.id)}>
          <Icon>edit</Icon>&nbsp;edit
        </MDButton>
        <MDButton variant="text" color="error" onClick={() => handleDeletePropertyGrouping(row.id)}>
          <Icon>delete</Icon>&nbsp;delete
        </MDButton>
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
                sx={{
                  "& .MuiTable-root": {
                    fontSize: "1rem",
                  },
                  "& .MuiTable-root th": {
                    fontSize: "1rem !important",
                    fontWeight: "600 !important",
                    padding: "12px 16px !important",
                  },
                  "& .MuiTable-root td": {
                    fontSize: "1rem !important",
                    padding: "12px 16px !important",
                  },
                  "& .MuiTableRow-root:nth-of-type(even)": {
                    backgroundColor: "#f5f5f5 !important",
                  },
                  "& .MuiTableRow-root:nth-of-type(odd)": {
                    backgroundColor: "#ffffff !important",
                  },
                  "& .MuiTableRow-root:hover": {
                    backgroundColor: "#e8f4f8 !important",
                  },
                }}
              >
                <DataTable
                  table={{ columns, rows: computedRows }}
                  isSorted={false}
                  entriesPerPage={true}
                  showTotalEntries={true}
                  noEndBorder
                  canSearch={true}
                />
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
    </DashboardLayout>
  );
}
