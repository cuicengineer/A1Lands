import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDButton from "components/MDButton";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import { Grid, Input, Select, MenuItem, FormControl, InputLabel } from "@mui/material";

import PropTypes from "prop-types";

function NewContractForm({ open, handleClose }) {
  const [contractData, setContractData] = useState({
    sno: "",
    class: "",
    cmd: "",
    unit: "",
    caNo: "",
    contractorName: "",
    contractorAddress: "",
    businessTitle: "",
    natureOfBusiness: "",
    location: "",
    gpId: "",
    areaCA: "",
    areaBOO: "",
    revenueRate: "",
    revenueRateDate: "",
    rentalValue: "",
    initialContractorName: "",
    initialContractDate: "",
    contractFrom: "",
    contractTo: "",
    firstYRentPM: "",
    firstYRentPA: "",
    termOfPayment: "",
    profitTerm: "",
    increaseRate: "",
    increaseInterval: "",
    securityDepositTerm: "",
    securityDepositRs: "",
    dpcPerDay: "",
    govtSharePA: "",
    pafSharePA: "",
    status: "",
    feasible: "",
    caStatus: "",
    approvingAuthority: "",
    remarks: "",
    createdBy: "",
    createdDate: "",
    isDeleted: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setContractData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleDateChange = (name, date) => {
    setContractData((prevData) => ({
      ...prevData,
      [name]: date ? date.format("YYYY-MM-DD") : "",
    }));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add New A1 Contract</DialogTitle>
      <DialogContent>
        <MDBox component="form" role="form">
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Sno"
                fullWidth
                name="sno"
                value={contractData.sno}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="class-label">Class</InputLabel>
                <Select
                  labelId="class-label"
                  id="class-select"
                  value={contractData.class}
                  label="Class"
                  onChange={handleChange}
                  name="class"
                >
                  <MenuItem value="Class A">Class A</MenuItem>
                  <MenuItem value="Class B">Class B</MenuItem>
                  <MenuItem value="Class C">Class C</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="cmd-label">Cmd</InputLabel>
                <Select
                  labelId="cmd-label"
                  id="cmd-select"
                  value={contractData.cmd}
                  label="Cmd"
                  onChange={handleChange}
                  name="cmd"
                >
                  <MenuItem value="CMD001">CMD001</MenuItem>
                  <MenuItem value="CMD002">CMD002</MenuItem>
                  <MenuItem value="CMD003">CMD003</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="unit-label">Unit</InputLabel>
                <Select
                  labelId="unit-label"
                  id="unit-select"
                  value={contractData.unit}
                  label="Unit"
                  onChange={handleChange}
                  name="unit"
                >
                  <MenuItem value="Unit 1">Unit 1</MenuItem>
                  <MenuItem value="Unit 2">Unit 2</MenuItem>
                  <MenuItem value="Unit 3">Unit 3</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="CA No"
                fullWidth
                name="caNo"
                value={contractData.caNo}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Contractor Name"
                fullWidth
                name="contractorName"
                value={contractData.contractorName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Contractor Address"
                fullWidth
                name="contractorAddress"
                value={contractData.contractorAddress}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Business Title"
                fullWidth
                name="businessTitle"
                value={contractData.businessTitle}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="nature-of-business-label">Nature of Business</InputLabel>
                <Select
                  labelId="nature-of-business-label"
                  id="nature-of-business-select"
                  value={contractData.natureOfBusiness}
                  label="Nature of Business"
                  onChange={handleChange}
                  name="natureOfBusiness"
                >
                  <MenuItem value="Nature A">Nature A</MenuItem>
                  <MenuItem value="Nature B">Nature B</MenuItem>
                  <MenuItem value="Nature C">Nature C</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Location"
                fullWidth
                name="location"
                value={contractData.location}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="gp-id-label">GP ID</InputLabel>
                <Select
                  labelId="gp-id-label"
                  id="gp-id-select"
                  value={contractData.gpId}
                  label="GP ID"
                  onChange={handleChange}
                  name="gpId"
                >
                  <MenuItem value="GPID001">GPID001</MenuItem>
                  <MenuItem value="GPID002">GPID002</MenuItem>
                  <MenuItem value="GPID003">GPID003</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Area-CA"
                fullWidth
                name="areaCA"
                value={contractData.areaCA}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Area-BOO"
                fullWidth
                name="areaBOO"
                value={contractData.areaBOO}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Revenue Rate"
                fullWidth
                name="revenueRate"
                value={contractData.revenueRate}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="date"
                label="Revenue Rate Date"
                fullWidth
                name="revenueRateDate"
                value={contractData.revenueRateDate}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Rental Value"
                fullWidth
                name="rentalValue"
                value={contractData.rentalValue}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Initial Contractor Name"
                fullWidth
                name="initialContractorName"
                value={contractData.initialContractorName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="date"
                label="Initial Contract Date"
                fullWidth
                name="initialContractDate"
                value={contractData.initialContractDate}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="date"
                label="Contract From"
                fullWidth
                name="contractFrom"
                value={contractData.contractFrom}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="date"
                label="Contract To"
                fullWidth
                name="contractTo"
                value={contractData.contractTo}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="1st Y Rent PM"
                fullWidth
                name="firstYRentPM"
                value={contractData.firstYRentPM}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="1st Y Rent PA"
                fullWidth
                name="firstYRentPA"
                value={contractData.firstYRentPA}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Term of Payment"
                fullWidth
                name="termOfPayment"
                value={contractData.termOfPayment}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Profit Term"
                fullWidth
                name="profitTerm"
                value={contractData.profitTerm}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Increase (Rate)"
                fullWidth
                name="increaseRate"
                value={contractData.increaseRate}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Increase Interval"
                fullWidth
                name="increaseInterval"
                value={contractData.increaseInterval}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Security Deposit Term"
                fullWidth
                name="securityDepositTerm"
                value={contractData.securityDepositTerm}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Security Deposit Rs"
                fullWidth
                name="securityDepositRs"
                value={contractData.securityDepositRs}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="DPC (Per Day)"
                fullWidth
                name="dpcPerDay"
                value={contractData.dpcPerDay}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Govt Share-PA"
                fullWidth
                name="govtSharePA"
                value={contractData.govtSharePA}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="PAF Share-PA"
                fullWidth
                name="pafSharePA"
                value={contractData.pafSharePA}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Status"
                fullWidth
                name="status"
                value={contractData.status}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Feasible"
                fullWidth
                name="feasible"
                value={contractData.feasible}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="CA Status"
                fullWidth
                name="caStatus"
                value={contractData.caStatus}
                onChange={handleChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="approving-authority-label">Approving Authority</InputLabel>
                <Select
                  labelId="approving-authority-label"
                  id="approving-authority-select"
                  value={contractData.approvingAuthority}
                  label="Approving Authority"
                  onChange={handleChange}
                  name="approvingAuthority"
                >
                  <MenuItem value="Authority A">Authority A</MenuItem>
                  <MenuItem value="Authority B">Authority B</MenuItem>
                  <MenuItem value="Authority C">Authority C</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Remarks"
                fullWidth
                name="remarks"
                value={contractData.remarks}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Input type="file" inputProps={{ accept: ".zip,.pdf" }} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="Created By"
                fullWidth
                name="createdBy"
                value={contractData.createdBy}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="date"
                label="Created Date"
                fullWidth
                name="createdDate"
                value={contractData.createdDate}
                onChange={handleChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                type="text"
                label="IsDeleted"
                fullWidth
                name="isDeleted"
                value={contractData.isDeleted}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={handleClose} color="secondary">
          Cancel
        </MDButton>
        <MDButton onClick={handleClose} color="info">
          Add Contract
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

NewContractForm.propTypes = {
  open: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default NewContractForm;
