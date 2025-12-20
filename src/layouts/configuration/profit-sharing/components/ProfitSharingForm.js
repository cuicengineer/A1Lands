import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDButton from "components/MDButton";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import PropTypes from "prop-types";

function ProfitSharingForm({ open, handleClose }) {
  const [formData, setFormData] = useState({
    cmd: "",
    unit: "",
    category: "",
    govtShare: "",
    ahqShare: "",
    racShare: "",
    baseShare: "",
    effectiveDate: "",
    remarks: "",
    updatedBy: "",
    updatedDate: "",
    status: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    console.log(formData);
    handleClose();
  };

  // Placeholder data for dropdowns
  const cmdOptions = ["CMD-A", "CMD-B", "CMD-C"];
  const unitOptions = ["Unit-1", "Unit-2", "Unit-3"];
  const categoryOptions = ["Category-X", "Category-Y", "Category-Z"];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add New Profit Share</DialogTitle>
      <DialogContent>
        <MDBox component="form" role="form" display="flex" flexDirection="column">
          <FormControl variant="standard" sx={{ mb: 2 }}>
            <InputLabel id="cmd-label">Cmd</InputLabel>
            <Select
              labelId="cmd-label"
              id="cmd"
              name="cmd"
              value={formData.cmd}
              onChange={handleChange}
              label="Cmd"
            >
              {cmdOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="standard" sx={{ mb: 2 }}>
            <InputLabel id="unit-label">Unit</InputLabel>
            <Select
              labelId="unit-label"
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              label="Unit"
            >
              {unitOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="standard" sx={{ mb: 2 }}>
            <InputLabel id="category-label">Category</InputLabel>
            <Select
              labelId="category-label"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              label="Category"
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <MDInput
            label="Govt Share"
            name="govtShare"
            value={formData.govtShare}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="AHQ Share"
            name="ahqShare"
            value={formData.ahqShare}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="RAC Share"
            name="racShare"
            value={formData.racShare}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="Base Share"
            name="baseShare"
            value={formData.baseShare}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="Effective Date"
            name="effectiveDate"
            type="date"
            value={formData.effectiveDate}
            onChange={handleChange}
            sx={{ mb: 2 }}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <MDInput
            label="Remarks"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="Updated By"
            name="updatedBy"
            value={formData.updatedBy}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
          <MDInput
            label="Updated Date"
            name="updatedDate"
            type="date"
            value={formData.updatedDate}
            onChange={handleChange}
            sx={{ mb: 2 }}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <MDInput
            label="Status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={handleClose} color="secondary">
          Cancel
        </MDButton>
        <MDButton onClick={handleSubmit} color="info">
          Add
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ProfitSharingForm.propTypes = {
  open: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default ProfitSharingForm;
