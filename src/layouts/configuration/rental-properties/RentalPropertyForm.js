import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import MDButton from "components/MDButton";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import Icon from "@mui/material/Icon";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import api from "../../../../src/services/api.service";

function RentalPropertyForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState({
    cmdId: "",
    baseId: "",
    classId: "",
    pId: "",
    uoM: "",
    area: 0,
    location: "",
    remarks: "",
    status: false, // Default value
  });

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [allBases, setAllBases] = useState([]); // New state to store all bases
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await api.list("command");
        console.log("Fetched commands:", response); // Log commands
        setCommands(response);
      } catch (error) {
        console.error("Error fetching commands:", error);
      }
    };

    const fetchClasses = async () => {
      try {
        const response = await api.list("class");
        console.log("Fetched classes:", response); // Log classes
        setClasses(response);
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };

    const fetchAllBases = async () => {
      try {
        const response = await api.list("base");
        console.log("Fetched all bases:", response); // Log all bases
        setAllBases(response);
      } catch (error) {
        console.error("Error fetching all bases:", error);
      }
    };

    fetchCommands();
    fetchClasses();
    fetchAllBases(); // Fetch all bases on mount
  }, []);

  useEffect(() => {
    if (form.cmdId && allBases.length > 0) {
      const filteredBases = allBases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setBases(filteredBases);
    } else {
      setBases([]);
    }
  }, [form.cmdId, allBases]);

  useEffect(() => {
    if (initialData) {
      const newForm = {
        cmdId: initialData.cmdId || "",
        baseId: initialData.baseId || "",
        classId: initialData.classId || "",
        pId: initialData.pId || "",
        uoM: initialData.uoM || "",
        area: initialData.area || 0,
        location: initialData.location || "",
        remarks: initialData.remarks || "",
        status: initialData.status || false,
      };
      let currentFilteredBases = [];
      if (newForm.cmdId && allBases.length > 0) {
        currentFilteredBases = allBases.filter(
          (base) => Number(base.cmd) === Number(newForm.cmdId)
        );
        setBases(currentFilteredBases);
      } else {
        setBases([]);
      }

      // Validate baseId against filtered bases
      if (
        newForm.baseId &&
        !currentFilteredBases.some((base) => Number(base.id) === Number(newForm.baseId))
      ) {
        newForm.baseId = ""; // Reset if not found in filtered bases
      }
      setForm(newForm);
    } else {
      setForm({
        cmdId: "",
        baseId: "",
        classId: "",
        pId: "",
        uoM: "",
        area: 0,
        location: "",
        remarks: "",
        status: false,
      });
      setBases([]); // Clear bases when adding new property
    }
  }, [initialData, allBases]);

  const handleChange = (field, value) => {
    setForm((prevForm) => ({
      ...prevForm,
      [field]: field === "area" ? Number(value) : value,
      ...(field === "cmdId" && { baseId: "" }), // Reset baseId when cmdId changes
    }));
  };

  const handleSave = () => {
    onSubmit(form);
  };

  const fields = [
    { label: "Command ID", key: "cmdId", type: "select", options: commands, mandatory: true },
    { label: "Base ID", key: "baseId", type: "select", options: bases, mandatory: true },
    { label: "Class ID", key: "classId", type: "select", options: classes, mandatory: true },
    { label: "Property ID", key: "pId" },
    { label: "UoM", key: "uoM" },
    { label: "Area", key: "area", type: "number" },
    { label: "Location", key: "location" },
    { label: "Remarks", key: "remarks" },
    {
      label: "Is Active",
      key: "status",
      type: "select",
      options: [
        { id: true, name: "Yes" },
        { id: false, name: "No" },
      ],
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{initialData ? "Edit Rental Property" : "Add Rental Property"}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          {fields.map((f) => (
            <Grid item xs={12} sm={6} key={f.key}>
              {f.type === "select" ? (
                <FormControl fullWidth size="small" required={f.mandatory}>
                  <InputLabel>{f.label}</InputLabel>
                  <Select
                    value={form[f.key]}
                    label={f.label}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  >
                    {f.options.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <MDInput
                  label={f.label}
                  type={f.type || "text"}
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  fullWidth
                  size="small"
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose}>
          <Icon>close</Icon>
          <MDBox ml={1}>Cancel</MDBox>
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          <Icon>save</Icon>
          <MDBox ml={1}>Save</MDBox>
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

RentalPropertyForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

export default RentalPropertyForm;
