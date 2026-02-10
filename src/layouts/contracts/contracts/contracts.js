import React, { useState, useEffect, useMemo } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import CurrencyLoading from "components/CurrencyLoading";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import uploadApi from "services/api.upload.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import StatusBadge from "components/StatusBadge";
import { PropertyGroupingForm } from "layouts/contracts/property-grouping/property-grouping";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";

function ContractsForm({
  open,
  onClose,
  onSubmit,
  initialData,
  commands,
  bases,
  classes,
  propertyGroups,
  tenants,
  onPropertyGroupsRefresh,
}) {
  const [form, setForm] = useState({
    contractNo: "",
    cmdId: "",
    baseId: "",
    classId: "",
    grpId: "",
    tenantNo: "",
    businessName: "",
    natureOfBusiness: "",
    contractStartDate: "",
    contractEndDate: "",
    commercialOperationDate: "",
    initialRentPM: "",
    initialRentPA: "",
    paymentTermMonths: "",
    term: "",
    increaseRatePercent: "",
    increaseIntervalMonths: "",
    sdRateMonths: "",
    securityDepositAmount: "",
    rentalValue: "",
    govtShareCondition: "",
    pafShare: "",
    status: true,
    remarks: "",
    riseTermType: "",
    riseyear: "",
    risedate: "",
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [filteredPropertyGroups, setFilteredPropertyGroups] = useState([]);

  // Rise Terms state
  const [riseTermsDialogOpen, setRiseTermsDialogOpen] = useState(false);
  const [riseTerms, setRiseTerms] = useState([]);
  const [editingRiseTermIndex, setEditingRiseTermIndex] = useState(null);
  const [riseTermForm, setRiseTermForm] = useState({
    monthsInterval: "",
    risePercent: "",
    sequenceNo: "",
  });
  const [riseTermErrors, setRiseTermErrors] = useState({});

  // Contracts dialog state
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Property Grouping form state
  const [propertyGroupingFormOpen, setPropertyGroupingFormOpen] = useState(false);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);

  const normalizeRiseTermType = (value) => {
    if (!value) return "";
    const token = String(value).trim().toLowerCase();
    if (!token) return "";
    if (token.includes("standard")) return "Standard";
    if (token.includes("fixed")) return "Fixed Date";
    if (token.includes("variable")) return "Variable Increase";
    // Fallback: return original trimmed value so it at least shows in the UI if it matches exactly
    return String(value).trim();
  };

  useEffect(() => {
    if (initialData) {
      const rawRiseType =
        initialData.riseTermType ??
        initialData.RiseTermType ??
        initialData.riseTerm ??
        initialData.RiseTerm ??
        "";
      const rawRiseYear =
        initialData.riseyear ?? initialData.RiseYear ?? initialData.riseYear ?? null;
      const rawRiseDate =
        initialData.risedate ?? initialData.RiseDate ?? initialData.riseDate ?? null;

      const normalizedRiseYear = rawRiseYear !== null ? String(rawRiseYear) : "";
      const normalizedRiseDate =
        rawRiseDate !== null && String(rawRiseDate).trim() !== ""
          ? String(rawRiseDate).split("T")[0].slice(0, 10)
          : "";

      // Normalize govtShareCondition - handle case variations and ensure it matches dropdown options
      const rawGovtShareCondition =
        initialData.govtShareCondition ??
        initialData.GovtShareCondition ??
        initialData.govtShare ??
        initialData.GovtShare ??
        "";
      const govtShareOptions = ["A", "C", "NA"];

      let validGovtShareCondition = "";
      if (rawGovtShareCondition) {
        // Convert to string and trim whitespace
        const stringValue = String(rawGovtShareCondition).trim();

        // Check if it's already a valid option (exact match - case sensitive)
        if (govtShareOptions.includes(stringValue)) {
          validGovtShareCondition = stringValue;
        } else {
          // Try case-insensitive normalization
          const upperValue = stringValue.toUpperCase();

          // Map common variations
          if (upperValue === "N/A" || upperValue === "N-A" || upperValue === "NA") {
            validGovtShareCondition = "NA";
          } else if (upperValue === "A") {
            validGovtShareCondition = "A";
          } else if (upperValue === "C") {
            validGovtShareCondition = "C";
          } else {
            // If no match found, set to empty (user will need to select)
            validGovtShareCondition = "";
          }
        }
      }

      setForm({
        contractNo: initialData.contractNo || "",
        cmdId: initialData.cmdId || "",
        baseId: initialData.baseId || "",
        classId: initialData.classId || "",
        grpId: initialData.grpId || "",
        tenantNo: initialData.tenantNo || "",
        businessName: initialData.businessName || "",
        natureOfBusiness: initialData.natureOfBusiness || "",
        contractStartDate: initialData.contractStartDate
          ? initialData.contractStartDate.split("T")[0]
          : "",
        contractEndDate: initialData.contractEndDate
          ? initialData.contractEndDate.split("T")[0]
          : "",
        commercialOperationDate: initialData.commercialOperationDate
          ? initialData.commercialOperationDate.split("T")[0]
          : "",
        initialRentPM: initialData.initialRentPM || "",
        initialRentPA: initialData.initialRentPA || "",
        paymentTermMonths: initialData.paymentTermMonths || "",
        term: initialData.term || "",
        increaseRatePercent: initialData.increaseRatePercent || "",
        increaseIntervalMonths: initialData.increaseIntervalMonths || "",
        sdRateMonths: initialData.sdRateMonths || "",
        securityDepositAmount: initialData.securityDepositAmount || "",
        rentalValue: initialData.rentalValue || "",
        govtShareCondition: validGovtShareCondition,
        pafShare: initialData.pafShare || "",
        status: initialData.status !== undefined ? initialData.status : true,
        remarks: initialData.remarks || "",
        riseTermType: normalizeRiseTermType(rawRiseType),
        riseyear: normalizedRiseYear,
        risedate: normalizedRiseDate,
      });

      // Initialize riseTerms list from existing contract rise terms, if any
      const rawRiseTerms =
        initialData.contractRiseTerms ||
        initialData.ContractRiseTerms ||
        initialData.riseTerms ||
        [];
      if (Array.isArray(rawRiseTerms) && rawRiseTerms.length > 0) {
        const normalizedRiseTerms = rawRiseTerms
          .map((t) => {
            const monthsInterval =
              t.monthsInterval ?? t.MonthsInterval ?? t.months_interval ?? null;
            const risePercent = t.risePercent ?? t.RisePercent ?? t.rise_percent ?? null;
            const sequenceNo = t.sequenceNo ?? t.SequenceNo ?? t.sequence_no ?? null;
            const contractID = t.contractID ?? t.ContractID ?? t.contractId ?? t.ContractId ?? null;
            const isDeleted = t.isDeleted ?? t.IsDeleted ?? null;
            const id = t.id ?? t.Id ?? t.contractRiseTermId ?? t.ContractRiseTermId ?? null;

            if (monthsInterval === null || risePercent === null || sequenceNo === null) {
              return null;
            }

            return {
              id: id ? Number(id) : null,
              monthsInterval: String(monthsInterval),
              risePercent: String(risePercent),
              sequenceNo: String(sequenceNo),
              contractID: contractID ? Number(contractID) : null,
              isDeleted: isDeleted !== null && isDeleted !== undefined ? Boolean(isDeleted) : null,
            };
          })
          .filter(Boolean);

        setRiseTerms(normalizedRiseTerms);
      } else {
        setRiseTerms([]);
      }
    } else {
      setForm({
        contractNo: "",
        cmdId: "",
        baseId: "",
        classId: "",
        grpId: "",
        tenantNo: "",
        businessName: "",
        natureOfBusiness: "",
        contractStartDate: "",
        contractEndDate: "",
        commercialOperationDate: "",
        initialRentPM: "",
        initialRentPA: "",
        paymentTermMonths: "",
        term: "",
        increaseRatePercent: "",
        increaseIntervalMonths: "",
        sdRateMonths: "",
        securityDepositAmount: "",
        rentalValue: "",
        govtShareCondition: "",
        status: true,
        remarks: "",
        riseTermType: "",
        riseyear: "",
        risedate: "",
      });
      // Reset rise terms when opening new form
      setRiseTerms([]);
    }
    setErrors({});
  }, [initialData, open]);

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      if (form.baseId && !filtered.find((b) => b.id === form.baseId)) {
        setForm((prev) => ({ ...prev, baseId: "" }));
      }
    } else {
      setFilteredBases([]);
    }
  }, [form.cmdId, bases]);

  // Show all classes (not filtered by base)
  useEffect(() => {
    if (classes.length > 0) {
      setFilteredClasses(classes);
    } else {
      setFilteredClasses([]);
    }
  }, [classes]);

  // Filter property groups based on selected command, base, and class
  useEffect(() => {
    if (form.cmdId && form.baseId && form.classId && propertyGroups.length > 0) {
      const filtered = propertyGroups.filter(
        (pg) =>
          Number(pg.cmdId) === Number(form.cmdId) &&
          Number(pg.baseId) === Number(form.baseId) &&
          Number(pg.classId) === Number(form.classId)
      );
      setFilteredPropertyGroups(filtered);
      if (form.grpId && !filtered.find((pg) => pg.id === form.grpId)) {
        setForm((prev) => ({ ...prev, grpId: "" }));
      }
    } else {
      setFilteredPropertyGroups([]);
    }
  }, [form.cmdId, form.baseId, form.classId, propertyGroups]);

  // Auto-calculate initialRentPA when initialRentPM changes
  useEffect(() => {
    const initialRent = Number(form.initialRentPM);

    if (initialRent && !isNaN(initialRent)) {
      const calculated = initialRent * 12;
      setForm((prev) => ({
        ...prev,
        initialRentPA: String(calculated),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        initialRentPA: "",
      }));
    }
  }, [form.initialRentPM]);

  // Auto-calculate securityDepositAmount when sdRateMonths or initialRentPM changes
  useEffect(() => {
    const sdRate = Number(form.sdRateMonths);
    const initialRent = Number(form.initialRentPM);

    if (sdRate && initialRent && !isNaN(sdRate) && !isNaN(initialRent)) {
      const calculated = sdRate * initialRent;
      setForm((prev) => ({
        ...prev,
        securityDepositAmount: String(calculated),
      }));
    } else if ((!sdRate || isNaN(sdRate)) && (!initialRent || isNaN(initialRent))) {
      setForm((prev) => ({
        ...prev,
        securityDepositAmount: "",
      }));
    }
  }, [form.sdRateMonths, form.initialRentPM]);

  const handleChange = (field, value) => {
    // Prevent manual editing of auto-calculated fields
    if (field === "securityDepositAmount" || field === "initialRentPA") {
      return;
    }

    setForm((prev) => {
      const updated = {
        ...prev,
        [field]: value,
        // Clear related fields when riseTermType changes
        ...(field === "riseTermType" && {
          riseyear: "",
          risedate: "",
        }),
      };

      // If start date changes and end date is now invalid, clear end date
      if (field === "contractStartDate" && updated.contractEndDate) {
        if (updated.contractEndDate <= value) {
          updated.contractEndDate = "";
        }
      }

      // If start date or end date changes, validate commercial operation date
      if (
        (field === "contractStartDate" || field === "contractEndDate") &&
        updated.commercialOperationDate
      ) {
        if (
          updated.contractStartDate &&
          updated.contractEndDate &&
          (updated.commercialOperationDate < updated.contractStartDate ||
            updated.commercialOperationDate > updated.contractEndDate)
        ) {
          updated.commercialOperationDate = "";
        }
      }

      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    // Clear rise terms when switching away from Variable Increase
    if (field === "riseTermType" && value !== "Variable Increase") {
      setRiseTerms([]);
    }

    // When Group ID is selected, fetch active contracts for that group
    if (field === "grpId" && value) {
      const selectedGroup = filteredPropertyGroups.find((pg) => pg.id === Number(value));
      if (selectedGroup && selectedGroup.gId) {
        fetchActiveContractsByGroupId(selectedGroup.gId);
      }
    }
  };

  // Fetch active contracts by Group ID
  const fetchActiveContractsByGroupId = async (groupId) => {
    if (!groupId || !groupId.trim()) {
      setActiveContracts([]);
      return;
    }

    setLoadingContracts(true);
    try {
      // Call API endpoint to search contracts by group name
      const response = await contractApi.searchByGrpName(groupId.trim());

      // Handle response - could be array or object with data property
      const contracts = response?.data || (Array.isArray(response) ? response : []);

      setActiveContracts(contracts);
      setContractsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching contracts by Group ID:", error);
      setActiveContracts([]);
      alert("Error fetching contracts. Please try again.");
    } finally {
      setLoadingContracts(false);
    }
  };

  // Fetch rental properties and all property groupings for PropertyGroupingForm
  useEffect(() => {
    if (propertyGroupingFormOpen) {
      const fetchRentalProperties = async () => {
        try {
          const response = await api.list("rentalproperty");
          setRentalProperties(response);
        } catch (error) {
          console.error("Error fetching rental properties:", error);
        }
      };
      const fetchAllPropertyGroupings = async () => {
        try {
          // Fetch a large number to get all records for validation
          const response = await propertyGroupingApi.list(1, 10000);
          if (response && response.pagination) {
            setAllPropertyGroupings(response.data || []);
          } else {
            setAllPropertyGroupings(Array.isArray(response) ? response : []);
          }
        } catch (error) {
          console.error("Error fetching all property groupings:", error);
          setAllPropertyGroupings([]);
        }
      };
      if (rentalProperties.length === 0) {
        fetchRentalProperties();
      }
      fetchAllPropertyGroupings();
    }
  }, [propertyGroupingFormOpen, rentalProperties.length]);

  // Handle Property Grouping form save
  const handlePropertyGroupingSave = async (formData) => {
    try {
      const formattedData = {
        cmdId: Number(formData.cmdid),
        baseId: Number(formData.baseid),
        classId: Number(formData.classid),
        gId: formData.gId || "",
        location: formData.location || "",
        area: Number(formData.area) || 0,
        remarks: formData.remarks || "",
        property: formData.property.join(", "),
        PropertyGroupLinkings: formData.property.map((propId) => Number(propId)),
        status: Boolean(formData.status),
        isDeleted: Boolean(formData.isDeleted),
      };

      await propertyGroupingApi.create(formattedData);
      setPropertyGroupingFormOpen(false);

      // Refresh property groups list
      if (onPropertyGroupsRefresh) {
        onPropertyGroupsRefresh();
      }
    } catch (error) {
      console.error("Error saving property grouping:", error);
      alert("Failed to save property grouping. Please try again.");
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.contractNo?.trim()) newErrors.contractNo = "Contract No is required";
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseId) newErrors.baseId = "Base is required";
    if (!form.classId) newErrors.classId = "Class is required";
    if (!form.grpId) newErrors.grpId = "Group is required";
    if (!form.tenantNo?.trim()) newErrors.tenantNo = "Tenant No is required";
    if (!form.businessName?.trim()) newErrors.businessName = "Business Name is required";
    if (!form.natureOfBusiness?.trim())
      newErrors.natureOfBusiness = "Nature of Business is required";
    if (!form.contractStartDate) newErrors.contractStartDate = "Contract Start Date is required";
    if (!form.contractEndDate) newErrors.contractEndDate = "Contract End Date is required";
    if (
      form.contractStartDate &&
      form.contractEndDate &&
      form.contractEndDate <= form.contractStartDate
    ) {
      newErrors.contractEndDate = "Contract End Date must be greater than Contract Start Date";
    }
    if (form.commercialOperationDate && form.contractStartDate && form.contractEndDate) {
      if (form.commercialOperationDate < form.contractStartDate) {
        newErrors.commercialOperationDate =
          "Commercial Operation Date must be on or after Contract Start Date";
      } else if (form.commercialOperationDate > form.contractEndDate) {
        newErrors.commercialOperationDate =
          "Commercial Operation Date must be on or before Contract End Date";
      }
    }
    if (!form.initialRentPM) newErrors.initialRentPM = "Initial Rent PM is required";
    // initialRentPA is auto-calculated, no validation needed
    if (!form.paymentTermMonths) newErrors.paymentTermMonths = "Payment Term Months is required";
    if (!form.govtShareCondition) newErrors.govtShareCondition = "Govt Share Condition is required";
    if (form.remarks && form.remarks.length > 500) {
      newErrors.remarks = "Remarks cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      contractNo: form.contractNo.trim(),
      cmdId: Number(form.cmdId),
      baseId: Number(form.baseId),
      classId: Number(form.classId),
      grpId: Number(form.grpId),
      tenantNo: form.tenantNo.trim(),
      businessName: form.businessName.trim(),
      natureOfBusiness: form.natureOfBusiness.trim(),
      contractStartDate: form.contractStartDate,
      contractEndDate: form.contractEndDate,
      commercialOperationDate: form.commercialOperationDate || null,
      initialRentPM: form.initialRentPM ? Number(form.initialRentPM) : null,
      initialRentPA: form.initialRentPA ? Number(form.initialRentPA) : null,
      paymentTermMonths: form.paymentTermMonths ? Number(form.paymentTermMonths) : null,
      term: form.term || null,
      increaseRatePercent: form.increaseRatePercent ? Number(form.increaseRatePercent) : null,
      increaseIntervalMonths: form.increaseIntervalMonths
        ? Number(form.increaseIntervalMonths)
        : null,
      sdRateMonths: form.sdRateMonths ? Number(form.sdRateMonths) : null,
      securityDepositAmount: form.securityDepositAmount ? Number(form.securityDepositAmount) : null,
      rentalValue: form.rentalValue ? Number(form.rentalValue) : null,
      govtShareCondition: form.govtShareCondition,
      pafShare: form.pafShare ? Number(form.pafShare) : null,
      status: form.status,
      remarks: form.remarks?.trim() || null,
      riseTermType: form.riseTermType || null,
      // If Standard is selected, include riseyear
      ...(form.riseTermType === "Standard" && {
        riseyear: form.riseyear ? Number(form.riseyear) : null,
      }),
      // If Fixed Date is selected, include risedate
      ...(form.riseTermType === "Fixed Date" && {
        risedate: form.risedate || null,
      }),
      // If Variable Increase is selected, include contractRiseTerms
      ...(form.riseTermType === "Variable Increase" && {
        contractRiseTerms:
          riseTerms.length > 0
            ? riseTerms.map((term) => {
                // Get contract ID from initialData if editing, otherwise use term's existing contractID
                const contractID =
                  initialData?.id ??
                  initialData?.Id ??
                  initialData?.contractID ??
                  initialData?.ContractID ??
                  term.contractID ??
                  null;

                // Preserve existing isDeleted value, or set to false for new terms
                const isDeletedValue =
                  term.isDeleted !== null && term.isDeleted !== undefined
                    ? Boolean(term.isDeleted)
                    : false;

                return {
                  contractID: contractID ? Number(contractID) : 0,
                  monthsInterval: Number(term.monthsInterval),
                  risePercent: Number(term.risePercent),
                  sequenceNo: Number(term.sequenceNo),
                  status: 1, // true
                  action: contractID ? "update" : "create",
                  actionBy: null,
                  actionDate: null,
                  isDeleted: isDeletedValue,
                };
              })
            : [],
      }),
    };

    await onSubmit(payload);
  };

  // Rise Terms handlers
  const getNextRiseSequenceNo = () => {
    const maxSeq = riseTerms.reduce((max, t) => {
      const n = Number(t?.sequenceNo);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return String(maxSeq + 1);
  };

  const handleRiseTermChange = (field, value) => {
    // Sequence No is auto-generated; prevent manual edits
    if (field === "sequenceNo") return;
    setRiseTermForm((prev) => ({ ...prev, [field]: value }));
    if (riseTermErrors[field]) {
      setRiseTermErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateRiseTerm = () => {
    const newErrors = {};
    if (!riseTermForm.monthsInterval || Number(riseTermForm.monthsInterval) <= 0) {
      newErrors.monthsInterval = "Months Interval is required and must be greater than 0";
    }
    if (!riseTermForm.risePercent || Number(riseTermForm.risePercent) <= 0) {
      newErrors.risePercent = "Rise Percent is required and must be greater than 0";
    }

    setRiseTermErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRiseTerm = () => {
    if (!validateRiseTerm()) return;

    if (editingRiseTermIndex !== null) {
      // Update existing term
      const updated = [...riseTerms];
      updated[editingRiseTermIndex] = { ...riseTermForm };
      setRiseTerms(updated);
    } else {
      // Add new term
      const nextSeq = getNextRiseSequenceNo();
      setRiseTerms([...riseTerms, { ...riseTermForm, sequenceNo: nextSeq }]);
    }

    setRiseTermForm({
      monthsInterval: "",
      risePercent: "",
      sequenceNo: getNextRiseSequenceNo(),
    });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);
  };

  const handleEditRiseTerm = (index) => {
    setRiseTermForm({ ...riseTerms[index] });
    setEditingRiseTermIndex(index);
    setRiseTermErrors({});
  };

  const handleDeleteRiseTerm = async (index) => {
    const termToDelete = riseTerms[index];

    // If the term has an ID, call the API to delete it
    if (termToDelete && termToDelete.id) {
      try {
        await contractApi.deleteContractRiseTerm(termToDelete.id);
        alert("Rise term deleted successfully.");

        // Remove from local state
        const updated = riseTerms.filter((_, i) => i !== index);
        setRiseTerms(updated);
        if (editingRiseTermIndex === index) {
          setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
          setEditingRiseTermIndex(null);
        }
      } catch (error) {
        console.error("Error deleting rise term:", error);
        alert("Failed to delete rise term. Please try again.");
      }
    } else {
      // If no ID, just remove from local state (new term not yet saved)
      const updated = riseTerms.filter((_, i) => i !== index);
      setRiseTerms(updated);
      if (editingRiseTermIndex === index) {
        setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
        setEditingRiseTermIndex(null);
      }
    }
  };

  const handleCloseRiseTermsDialog = () => {
    setRiseTermsDialogOpen(false);
    setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);
  };

  const paymentTermOptions = [1, 2, 3, 4, 6, 12];
  const increaseIntervalOptions = [1, 2, 3, 4, 6, 12, 15, 24];
  const govtShareOptions = ["A", "C", "NA"];

  // Shared compact styling to keep all inputs/lookups consistent and simple
  const labelSx = { fontSize: "1rem" };
  const inputSx = {
    "& .MuiInputBase-input": { fontSize: "1rem", padding: "10px 12px" },
    "& .MuiInputLabel-root": { fontSize: "1rem" },
  };
  const selectSx = {
    fontSize: "1rem",
    // Keep a fixed control height whether empty or filled
    "& .MuiOutlinedInput-root": {
      minHeight: "45px",
    },
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "12px 32px 12px 12px",
      minHeight: "45px",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
  };
  const menuItemSx = { fontSize: "1rem" };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
          {initialData ? "Edit Contract" : "New Contract"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={1}>
            {/* ContractNo */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Contract No"
                type="text"
                value={form.contractNo}
                onChange={(e) => handleChange("contractNo", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.contractNo}
                helperText={errors.contractNo}
                sx={inputSx}
              />
            </Grid>

            {/* Command, Base, Class - First Row */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.cmdId}>
                <InputLabel id="cmd-label" sx={labelSx}>
                  Command
                </InputLabel>
                <Select
                  labelId="cmd-label"
                  value={form.cmdId || ""}
                  label="Command"
                  onChange={(e) => handleChange("cmdId", e.target.value)}
                  sx={selectSx}
                >
                  {commands.map((cmd) => (
                    <MenuItem key={cmd.id} value={cmd.id} sx={menuItemSx}>
                      {cmd.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.baseId}>
                <InputLabel id="base-label" sx={labelSx}>
                  Base
                </InputLabel>
                <Select
                  labelId="base-label"
                  value={form.baseId || ""}
                  label="Base"
                  onChange={(e) => handleChange("baseId", e.target.value)}
                  disabled={!form.cmdId}
                  sx={selectSx}
                >
                  {filteredBases.map((base) => (
                    <MenuItem key={base.id} value={base.id} sx={menuItemSx}>
                      {base.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.classId}>
                <InputLabel id="class-label" sx={labelSx}>
                  Class
                </InputLabel>
                <Select
                  labelId="class-label"
                  value={form.classId || ""}
                  label="Class"
                  onChange={(e) => handleChange("classId", e.target.value)}
                  disabled={!form.cmdId || !form.baseId}
                  sx={selectSx}
                >
                  {filteredClasses.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id} sx={menuItemSx}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Group ID */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox display="flex" alignItems="center" gap={1}>
                <FormControl size="small" fullWidth error={!!errors.grpId} sx={{ flex: 1 }}>
                  <InputLabel id="grp-label" sx={labelSx}>
                    Group ID
                  </InputLabel>
                  <Select
                    labelId="grp-label"
                    value={form.grpId || ""}
                    label="Group ID"
                    onChange={(e) => handleChange("grpId", e.target.value)}
                    disabled={!form.cmdId || !form.baseId || !form.classId}
                    sx={selectSx}
                  >
                    {filteredPropertyGroups.map((pg) => (
                      <MenuItem key={pg.id} value={pg.id} sx={menuItemSx}>
                        {pg.gId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  color="primary"
                  onClick={() => setPropertyGroupingFormOpen(true)}
                  disabled={!form.cmdId || !form.baseId || !form.classId}
                  title="Create New Property Group"
                  sx={{
                    minWidth: "40px",
                    width: "40px",
                    height: "40px",
                  }}
                >
                  <Icon>add</Icon>
                </IconButton>
              </MDBox>
            </Grid>

            {/* TenantNo */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.tenantNo}>
                <InputLabel id="tenant-label" sx={labelSx}>
                  Tenant No
                </InputLabel>
                <Select
                  labelId="tenant-label"
                  value={form.tenantNo || ""}
                  label="Tenant No"
                  onChange={(e) => handleChange("tenantNo", e.target.value)}
                  sx={selectSx}
                >
                  {tenants.map((tenant) => (
                    <MenuItem key={tenant.id} value={tenant.tenantNo} sx={menuItemSx}>
                      {tenant.tenantNo} - {tenant.ownerName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Tenant Name (Read-only) */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Tenant Name"
                type="text"
                value={
                  form.tenantNo
                    ? tenants.find((t) => t.tenantNo === form.tenantNo)?.ownerName || ""
                    : ""
                }
                fullWidth
                size="small"
                disabled
                sx={inputSx}
              />
            </Grid>

            {/* Tenant Address (Read-only) */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Tenant Address"
                type="text"
                value={
                  form.tenantNo
                    ? tenants.find((t) => t.tenantNo === form.tenantNo)?.address || ""
                    : ""
                }
                fullWidth
                size="small"
                disabled
                sx={inputSx}
              />
            </Grid>

            {/* BusinessName */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Business Name"
                type="text"
                value={form.businessName}
                onChange={(e) => handleChange("businessName", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.businessName}
                helperText={errors.businessName}
                sx={inputSx}
              />
            </Grid>

            {/* NatureOfBusiness */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Nature of Business"
                type="text"
                value={form.natureOfBusiness}
                onChange={(e) => handleChange("natureOfBusiness", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.natureOfBusiness}
                helperText={errors.natureOfBusiness}
                sx={inputSx}
              />
            </Grid>

            {/* ContractStartDate */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Contract Start Date (CSD)"
                type="date"
                value={form.contractStartDate}
                onChange={(e) => handleChange("contractStartDate", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.contractStartDate}
                helperText={errors.contractStartDate}
                InputLabelProps={{ shrink: true }}
                sx={inputSx}
              />
            </Grid>

            {/* ContractEndDate */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Contract End Date (CED)"
                type="date"
                value={form.contractEndDate}
                onChange={(e) => handleChange("contractEndDate", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.contractEndDate}
                helperText={errors.contractEndDate}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: form.contractStartDate
                    ? (() => {
                        // Set min date to one day after start date
                        const startDate = new Date(form.contractStartDate);
                        startDate.setDate(startDate.getDate() + 1);
                        return startDate.toISOString().split("T")[0];
                      })()
                    : undefined,
                }}
                sx={inputSx}
              />
            </Grid>

            {/* CommercialOperationDate */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Commercial Operation Date (COD)"
                type="date"
                value={form.commercialOperationDate}
                onChange={(e) => handleChange("commercialOperationDate", e.target.value)}
                fullWidth
                size="small"
                error={!!errors.commercialOperationDate}
                helperText={errors.commercialOperationDate}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: form.contractStartDate || undefined,
                  max: form.contractEndDate || undefined,
                }}
                sx={inputSx}
              />
            </Grid>

            {/* InitialRentPM */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Initial Rent PM (Rs)"
                type="number"
                value={form.initialRentPM}
                onChange={(e) => handleChange("initialRentPM", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.initialRentPM}
                helperText={errors.initialRentPM}
                sx={inputSx}
              />
            </Grid>

            {/* InitialRentPA */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Initial Rent PA (Rs)"
                type="number"
                value={form.initialRentPA}
                onChange={(e) => handleChange("initialRentPA", e.target.value)}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                sx={inputSx}
              />
            </Grid>

            {/* PaymentTermMonths */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.paymentTermMonths}>
                <InputLabel id="payment-term-label" sx={labelSx}>
                  Payment Term Months
                </InputLabel>
                <Select
                  labelId="payment-term-label"
                  value={form.paymentTermMonths || ""}
                  label="Payment Term Months"
                  onChange={(e) => handleChange("paymentTermMonths", e.target.value)}
                  sx={selectSx}
                >
                  {paymentTermOptions.map((option) => (
                    <MenuItem key={option} value={option} sx={menuItemSx}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Term */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.term}>
                <InputLabel id="term-label" sx={labelSx}>
                  Term
                </InputLabel>
                <Select
                  labelId="term-label"
                  value={form.term || ""}
                  label="Term"
                  onChange={(e) => handleChange("term", e.target.value)}
                  sx={selectSx}
                >
                  <MenuItem value="Rent" sx={menuItemSx}>
                    Rent
                  </MenuItem>
                  <MenuItem value="Profit" sx={menuItemSx}>
                    Profit
                  </MenuItem>
                  <MenuItem value="Rent + Profit" sx={menuItemSx}>
                    Rent + Profit
                  </MenuItem>
                  <MenuItem value="Rent/Profit" sx={menuItemSx}>
                    Rent/Profit
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* IncreaseRatePercent */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Increase Rate Percent %"
                type="number"
                value={form.increaseRatePercent}
                onChange={(e) => handleChange("increaseRatePercent", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>

            {/* IncreaseIntervalMonths */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth>
                <InputLabel id="increase-interval-label" sx={labelSx}>
                  Increase Interval Months
                </InputLabel>
                <Select
                  labelId="increase-interval-label"
                  value={form.increaseIntervalMonths || ""}
                  label="Increase Interval Months"
                  onChange={(e) => handleChange("increaseIntervalMonths", e.target.value)}
                  sx={selectSx}
                >
                  {increaseIntervalOptions.map((option) => (
                    <MenuItem key={option} value={option} sx={menuItemSx}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Rise Terms */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.riseTermType}>
                <InputLabel id="rise-term-type-label" sx={labelSx}>
                  Rise Terms
                </InputLabel>
                <Select
                  labelId="rise-term-type-label"
                  value={form.riseTermType || ""}
                  label="Rise Terms"
                  onChange={(e) => handleChange("riseTermType", e.target.value)}
                  sx={selectSx}
                >
                  <MenuItem value="Standard" sx={menuItemSx}>
                    Standard
                  </MenuItem>
                  <MenuItem value="Fixed Date" sx={menuItemSx}>
                    Fixed Date
                  </MenuItem>
                  <MenuItem value="Variable Increase" sx={menuItemSx}>
                    Variable Increase
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Rise Year (shown when Standard is selected) */}
            {form.riseTermType === "Standard" && (
              <Grid item xs={12} sm={6} md={4}>
                <FormControl size="small" fullWidth error={!!errors.riseyear}>
                  <InputLabel id="rise-year-label" sx={labelSx}>
                    Rise Year
                  </InputLabel>
                  <Select
                    labelId="rise-year-label"
                    value={form.riseyear || ""}
                    label="Rise Year"
                    onChange={(e) => handleChange("riseyear", e.target.value)}
                    sx={selectSx}
                  >
                    {Array.from({ length: 50 }, (_, i) => {
                      const year = new Date().getFullYear() - 10 + i;
                      return (
                        <MenuItem key={year} value={year.toString()} sx={menuItemSx}>
                          {year}
                        </MenuItem>
                      );
                    })}
                  </Select>
                  {errors.riseyear && <FormHelperText>{errors.riseyear}</FormHelperText>}
                </FormControl>
              </Grid>
            )}

            {/* Rise Date (shown when Fixed Date is selected) */}
            {form.riseTermType === "Fixed Date" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDInput
                  label="Rise Date"
                  type="date"
                  value={form.risedate}
                  onChange={(e) => handleChange("risedate", e.target.value)}
                  fullWidth
                  size="small"
                  error={!!errors.risedate}
                  helperText={errors.risedate}
                  InputLabelProps={{ shrink: true }}
                  sx={inputSx}
                />
              </Grid>
            )}

            {/* Variable Increase Add Icon (shown when Variable Increase is selected) */}
            {form.riseTermType === "Variable Increase" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDBox display="flex" alignItems="center" gap={1}>
                  <MDInput
                    label="Variable Increase"
                    value={
                      riseTerms.length > 0 ? `${riseTerms.length} term(s) configured` : "No terms"
                    }
                    fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                    sx={{ flex: 1, ...inputSx }}
                  />
                  <IconButton
                    color="primary"
                    onClick={() => {
                      setRiseTermForm({
                        monthsInterval: "",
                        risePercent: "",
                        sequenceNo: getNextRiseSequenceNo(),
                      });
                      setRiseTermForm({
                        monthsInterval: "",
                        risePercent: "",
                        sequenceNo: getNextRiseSequenceNo(),
                      });
                      setRiseTermErrors({});
                      setEditingRiseTermIndex(null);
                      setRiseTermsDialogOpen(true);
                    }}
                    title="Add Rise Terms"
                    sx={{
                      minWidth: "40px",
                      width: "40px",
                      height: "40px",
                    }}
                  >
                    <Icon>add</Icon>
                  </IconButton>
                </MDBox>
              </Grid>
            )}

            {/* SDRateMonths */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="SD Rate Months"
                type="number"
                value={form.sdRateMonths}
                onChange={(e) => handleChange("sdRateMonths", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>

            {/* SecurityDepositAmount */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Security Deposit Amount (Rs)"
                type="number"
                value={form.securityDepositAmount}
                onChange={(e) => handleChange("securityDepositAmount", e.target.value)}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                sx={inputSx}
              />
            </Grid>

            {/* RentalValue */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Rental Value"
                type="number"
                value={form.rentalValue}
                onChange={(e) => handleChange("rentalValue", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>

            {/* GovtShareCondition */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.govtShareCondition}>
                <InputLabel id="govt-share-label" sx={labelSx}>
                  Govt Share Condition
                </InputLabel>
                <Select
                  labelId="govt-share-label"
                  value={form.govtShareCondition || ""}
                  label="Govt Share Condition"
                  onChange={(e) => handleChange("govtShareCondition", e.target.value)}
                  sx={selectSx}
                >
                  {govtShareOptions.map((option) => (
                    <MenuItem key={option} value={option} sx={menuItemSx}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* PAFShare */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="PAF Share (%)"
                type="number"
                value={form.pafShare || ""}
                onChange={(e) => handleChange("pafShare", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth>
                <InputLabel id="status-label" sx={labelSx}>
                  Status
                </InputLabel>
                <Select
                  labelId="status-label"
                  value={form.status !== undefined ? form.status : true}
                  label="Status"
                  onChange={(e) => handleChange("status", e.target.value)}
                  sx={selectSx}
                >
                  <MenuItem value={true} sx={menuItemSx}>
                    Active
                  </MenuItem>
                  <MenuItem value={false} sx={menuItemSx}>
                    Inactive
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Remarks */}
            <Grid item xs={12}>
              <MDInput
                label="Remarks"
                type="text"
                value={form.remarks}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 500) {
                    handleChange("remarks", value);
                  }
                }}
                fullWidth
                multiline
                rows={3}
                size="small"
                sx={inputSx}
                error={!!errors.remarks}
                helperText={errors.remarks || `${form.remarks?.length || 0}/500 characters`}
              />
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

      {/* Active Contracts Dialog */}
      <Dialog
        open={contractsDialogOpen}
        onClose={() => setContractsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            Active Contracts for Group ID:{" "}
            {form.grpId
              ? filteredPropertyGroups.find((pg) => pg.id === Number(form.grpId))?.gId || form.grpId
              : ""}
          </MDTypography>
        </DialogTitle>
        <DialogContent>
          {loadingContracts ? (
            <MDBox display="flex" justifyContent="center" py={4}>
              <CurrencyLoading />
            </MDBox>
          ) : activeContracts.length === 0 ? (
            <MDBox py={4} textAlign="center">
              <MDTypography variant="body2" color="text">
                No active contracts found for this Group ID.
              </MDTypography>
            </MDBox>
          ) : (
            <MDBox
              sx={{
                maxHeight: "500px",
                overflowY: "auto",
                // Firefox
                scrollbarWidth: "thin",
                scrollbarColor: "#333333 transparent",
                // Chrome/Safari/Edge
                "&::-webkit-scrollbar": {
                  width: "8px",
                  height: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                  borderRadius: "2px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#333333",
                  borderRadius: "10px",
                  border: "2px solid transparent",
                  backgroundClip: "padding-box",
                  "&:hover": {
                    backgroundColor: "#1a1a1a",
                  },
                },
                "&::-webkit-scrollbar-button": {
                  display: "none",
                },
              }}
            >
              <Card>
                <MDBox p={2}>
                  <MDTypography variant="caption" color="text" mb={2}>
                    Total Active Contracts: {activeContracts.length}
                  </MDTypography>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Sno
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Class
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Cmd
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA No
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Address
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Business Title
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Nature of Business
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Location
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          GP ID
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-CA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-BOO
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Rental Value
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contract Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract From
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract To
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PM
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Term of Payment
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Profit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase (Rate)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase Interval
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit (Rs)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          DPC (Per Day)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Govt Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          PAF Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Feasible
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Approving Authority
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeContracts.map((contract, index) => {
                        // Helper function to get field value with fallbacks
                        const getField = (camelCase, pascalCase, altNames = []) => {
                          if (contract[camelCase] !== undefined && contract[camelCase] !== null) {
                            return contract[camelCase];
                          }
                          if (contract[pascalCase] !== undefined && contract[pascalCase] !== null) {
                            return contract[pascalCase];
                          }
                          for (const alt of altNames) {
                            if (contract[alt] !== undefined && contract[alt] !== null) {
                              return contract[alt];
                            }
                          }
                          return "-";
                        };

                        // Helper function to format date as dd-mm-yyyy
                        const formatDate = (dateValue) => {
                          if (!dateValue) return "-";
                          try {
                            // Handle ISO date string (with or without time)
                            const dateStr = dateValue.split("T")[0]; // Get YYYY-MM-DD part
                            const [year, month, day] = dateStr.split("-");
                            if (year && month && day) {
                              return `${day}-${month}-${year}`;
                            }
                            // Try parsing as Date object
                            const date = new Date(dateValue);
                            if (!isNaN(date.getTime())) {
                              const dd = String(date.getDate()).padStart(2, "0");
                              const mm = String(date.getMonth() + 1).padStart(2, "0");
                              const yyyy = date.getFullYear();
                              return `${dd}-${mm}-${yyyy}`;
                            }
                            return "-";
                          } catch {
                            return "-";
                          }
                        };

                        return (
                          <tr
                            key={contract.id || index}
                            style={{
                              borderBottom: "1px solid #e0e0e0",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f9f9f9";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {index + 1}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("class", "Class", ["className", "ClassName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("cmd", "Cmd", ["cmdName", "CmdName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("unit", "Unit", ["unitName", "UnitName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caNo", "CANo", ["contractNo", "ContractNo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorName", "ContractorName", [
                                "businessName",
                                "BusinessName",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorAddress", "ContractorAddress", [
                                "address",
                                "Address",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("businessTitle", "BusinessTitle", ["title", "Title"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("natureOfBusiness", "NatureOfBusiness", [
                                "nature",
                                "Nature",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("location", "Location")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("gpId", "GPId", [
                                "groupId",
                                "GroupId",
                                "gId",
                                "GId",
                                "grpId",
                                "GrpId",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaCA", "AreaCA", ["areaCa", "AreaCa"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaBOO", "AreaBOO", ["areaBoo", "AreaBoo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("revenueRate", "RevenueRate")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("revenueRateDate", "RevenueRateDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("rentalValue", "RentalValue")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("initialContractorName", "InitialContractorName")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("initialContractDate", "InitialContractDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractFrom", "ContractFrom", [
                                  "contractStartDate",
                                  "ContractStartDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractTo", "ContractTo", [
                                  "contractEndDate",
                                  "ContractEndDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPM", "FirstYRentPM", [
                                "initialRentPM",
                                "InitialRentPM",
                                "firstYearRentPM",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPA", "FirstYRentPA", [
                                "initialRentPA",
                                "InitialRentPA",
                                "firstYearRentPA",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("termOfPayment", "TermOfPayment", [
                                "paymentTermMonths",
                                "PaymentTermMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("profitTerm", "ProfitTerm")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseRate", "IncreaseRate", [
                                "increaseRatePercent",
                                "IncreaseRatePercent",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseInterval", "IncreaseInterval", [
                                "increaseIntervalMonths",
                                "IncreaseIntervalMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("securityDepositTerm", "SecurityDepositTerm", [
                                "sdRateMonths",
                                "SdRateMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("securityDepositRs", "SecurityDepositRs", [
                                "securityDepositAmount",
                                "SecurityDepositAmount",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("dpcPerDay", "DPCPerDay", ["dpc", "DPC"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("govtSharePA", "GovtSharePA", [
                                "govtShareCondition",
                                "GovtShareCondition",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("pafSharePA", "PAFSharePA", ["pafShare", "PAFShare"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              <StatusBadge value={getField("status", "Status")} />
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("feasible", "Feasible")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caStatus", "CAStatus")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("approvingAuthority", "ApprovingAuthority")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("remarks", "Remarks")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => setContractsDialogOpen(false)}
          >
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
        </DialogActions>
      </Dialog>
      {/* Property Grouping Form Dialog */}
      <PropertyGroupingForm
        open={propertyGroupingFormOpen}
        onClose={() => setPropertyGroupingFormOpen(false)}
        onSubmit={handlePropertyGroupingSave}
        initialData={null}
        rentalProperties={rentalProperties}
        commands={commands}
        bases={bases}
        classes={classes}
        allPropertyGroupings={allPropertyGroupings}
      />

      {/* Rise Terms Dialog */}
      <Dialog
        open={riseTermsDialogOpen}
        onClose={handleCloseRiseTermsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            {editingRiseTermIndex !== null ? "Edit Rise Term" : "Add Rise Term"}
          </MDTypography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth error={!!riseTermErrors.monthsInterval}>
                <InputLabel id="months-interval-label" sx={labelSx}>
                  Months Interval
                </InputLabel>
                <Select
                  labelId="months-interval-label"
                  value={riseTermForm.monthsInterval || ""}
                  label="Months Interval"
                  onChange={(e) => handleRiseTermChange("monthsInterval", e.target.value)}
                  sx={selectSx}
                >
                  {[12, 24, 36, 48, 60, 72, 84, 96].map((value) => (
                    <MenuItem key={value} value={value.toString()} sx={menuItemSx}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
                {riseTermErrors.monthsInterval && (
                  <FormHelperText>{riseTermErrors.monthsInterval}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <MDInput
                label="Rise Percent"
                type="number"
                step="0.01"
                value={riseTermForm.risePercent}
                onChange={(e) => handleRiseTermChange("risePercent", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!riseTermErrors.risePercent}
                helperText={riseTermErrors.risePercent}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <MDInput
                label="Sequence No"
                type="number"
                value={riseTermForm.sequenceNo}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                sx={inputSx}
              />
            </Grid>
          </Grid>

          {riseTerms.length > 0 && (
            <MDBox mt={3}>
              <MDTypography variant="h6" fontWeight="medium" mb={2}>
                Existing Rise Terms
              </MDTypography>
              <Card>
                <MDBox p={2}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Sequence No
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Months Interval
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Rise Percent
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...riseTerms]
                        .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo))
                        .map((term, index) => {
                          const originalIndex = riseTerms.findIndex(
                            (t) =>
                              t.sequenceNo === term.sequenceNo &&
                              t.monthsInterval === term.monthsInterval
                          );
                          return (
                            <tr key={index} style={{ borderBottom: "1px solid #e0e0e0" }}>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.sequenceNo}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.monthsInterval}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.risePercent}%
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={() => handleEditRiseTerm(originalIndex)}
                                  sx={{ mr: 1 }}
                                >
                                  <Icon>edit</Icon>
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteRiseTerm(originalIndex)}
                                >
                                  <Icon>delete</Icon>
                                </IconButton>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseRiseTermsDialog}>
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={handleAddRiseTerm}>
            <Icon>{editingRiseTermIndex !== null ? "save" : "add"}</Icon>&nbsp;
            {editingRiseTermIndex !== null ? "Update" : "Add"} Term
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

ContractsForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  classes: PropTypes.array.isRequired,
  propertyGroups: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  onPropertyGroupsRefresh: PropTypes.func,
};

export default function Contracts() {
  const [openForm, setOpenForm] = useState(false);
  const [currentContract, setCurrentContract] = useState(null);
  const [rows, setRows] = useState([]);

  // Server-side pagination state (backend now paginates)
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search is handled by shared DataTable (canSearch)

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [propertyGroups, setPropertyGroups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [userIPAddress, setUserIPAddress] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);

  const fetchContracts = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await contractApi.getAll(page, size);
      if (response && response.pagination) {
        setRows(response.data || []);
        setTotalCount(response.pagination.totalCount || 0);
        setPageNumber(response.pagination.pageNumber || page);
        setPageSize(response.pagination.pageSize || size);
      } else {
        // Fallback (non-paginated)
        const arr = Array.isArray(response) ? response : [];
        setRows(arr);
        setTotalCount(arr.length);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
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

  const fetchPropertyGroups = async () => {
    try {
      const response = await api.list("propertygroup");
      setPropertyGroups(response);
    } catch (error) {
      console.error("Error fetching property groups:", error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.list("tenant");
      setTenants(response);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  // Fetch user's IP address
  const fetchUserIPAddress = async () => {
    try {
      // Try multiple IP services for reliability
      const ipServices = [
        { url: "https://api.ipify.org?format=json", extract: (data) => data.ip },
        {
          url: "https://api.ip.sb/ip",
          extract: (data) => (typeof data === "string" ? data : data.ip),
        },
        { url: "https://api.myip.com", extract: (data) => data.ip || data.query },
        {
          url: "https://ipapi.co/ip/",
          extract: (data) => (typeof data === "string" ? data.trim() : data.ip),
        },
      ];

      for (const service of ipServices) {
        try {
          const response = await fetch(service.url, { method: "GET" });
          if (response.ok) {
            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
              data = await response.json();
            } else {
              data = await response.text();
            }
            const ip = service.extract(data);
            if (ip && typeof ip === "string" && ip.trim().length > 0) {
              setUserIPAddress(ip.trim());
              return;
            }
          }
        } catch (e) {
          // Try next service
          continue;
        }
      }
      // Fallback: set to unknown if all services fail
      setUserIPAddress("unknown");
    } catch (error) {
      console.error("Error fetching IP address:", error);
      setUserIPAddress("unknown");
    }
  };

  // Fetch all property groupings for grouping display
  useEffect(() => {
    const fetchAllPropertyGroupings = async () => {
      try {
        const response = await propertyGroupingApi.list(1, 10000);
        if (response && response.pagination) {
          setAllPropertyGroupings(response.data || []);
        } else {
          setAllPropertyGroupings(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        console.error("Error fetching all property groupings:", error);
        setAllPropertyGroupings([]);
      }
    };
    fetchAllPropertyGroupings();
  }, []);

  // Lazy-load dropdown lists only when form opens (Add New / Edit)
  useEffect(() => {
    if (!openForm) return;

    if (commands.length === 0) fetchCommands();
    if (bases.length === 0) fetchBases();
    if (classes.length === 0) fetchClasses();
    if (propertyGroups.length === 0) fetchPropertyGroups();
    if (tenants.length === 0) fetchTenants();
  }, [
    openForm,
    commands.length,
    bases.length,
    classes.length,
    propertyGroups.length,
    tenants.length,
  ]);

  // Fetch user IP address on component mount
  useEffect(() => {
    fetchUserIPAddress();
  }, []);

  // Load current page from backend
  useEffect(() => {
    fetchContracts(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentContract(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditContract = (id) => {
    const contract = rows.find((row) => row.id === id);
    setCurrentContract(contract);
    setOpenForm(true);
  };

  const handleDeleteContract = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete) {
      try {
        // Include IP address in delete request body
        const deleteData = {
          ActionBy: "admin",
          ActionDate: new Date().toISOString(),
          userIPAddress: userIPAddress || "unknown",
        };
        await contractApi.remove(recordToDelete, deleteData);
        await fetchContracts(pageNumber, pageSize);
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
      } catch (error) {
        console.error("Error deleting contract:", error);
        alert("Failed to delete contract. Please try again.");
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (data) => {
    try {
      // Add IP address to the payload
      const dataWithIP = {
        ...data,
        userIPAddress: userIPAddress || "unknown",
      };

      if (currentContract && currentContract.id) {
        await contractApi.update(currentContract.id, dataWithIP);
      } else {
        await contractApi.create(dataWithIP);
      }
      await fetchContracts(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Failed to save contract. Please try again.");
    }
  };

  const normalizeFiles = (filesArray) =>
    filesArray.map((f) => {
      if (typeof f === "string") {
        return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
      }
      const fileName =
        f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
      const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
      return { ...f, fileName, downloadUrl };
    });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const handleViewAttachments = async (record) => {
    if (!record?.id) return;
    setAttachmentLoading(true);
    setAttachmentLoadingId(record.id);
    setCurrentViewingRecord(record);
    setSelectedFiles([]);
    try {
      const response = await uploadApi.getUploadedFiles(record.id, "Contracts");
      const filesArray = response?.files || (Array.isArray(response) ? response : []);
      setAttachmentList(normalizeFiles(filesArray));
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
    setSelectedFiles([]);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExisting = attachmentList.length;
    const totalSelected = selectedFiles.length;
    const totalFiles = totalExisting + totalSelected;
    const remainingSlots = 5 - totalFiles;

    if (totalFiles >= 5) {
      alert(
        "Maximum 5 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more file(s). Maximum 5 files allowed.`);
      event.target.value = "";
      return;
    }

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalFiles + validFiles.length > 5) {
      alert(`You can only upload ${5 - totalFiles} more file(s). Maximum 5 files allowed.`);
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, "Contracts");
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    setAttachmentList(normalizeFiles(filesArray));
  };

  const handleUploadSelected = async () => {
    if (!currentViewingRecord?.id) {
      alert("Record ID not found. Please reopen attachments and try again.");
      return;
    }
    if (selectedFiles.length === 0) {
      alert("Select at least one file to upload.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadApi.uploadFiles(currentViewingRecord.id, "Contracts", selectedFiles);
      await refreshAttachments(currentViewingRecord.id);
      setSelectedFiles([]);
      alert("Files uploaded successfully.");
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Failed to upload files: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
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
    if (!confirmDelete) return;

    try {
      await uploadApi.deleteUploadedFile(file.id);
      if (currentViewingRecord?.id) {
        await refreshAttachments(currentViewingRecord.id);
      } else {
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  // Helper function to format date as dd-mm-yyyy
  const formatDateDDMMYYYY = (dateValue) => {
    if (!dateValue) return "";
    try {
      // Handle ISO date string (with or without time)
      const dateStr = dateValue.split("T")[0]; // Get YYYY-MM-DD part
      const [year, month, day] = dateStr.split("-");
      if (year && month && day) {
        return `${day}-${month}-${year}`;
      }
      // If already in dd-mm-yyyy format, return as is
      return dateValue;
    } catch {
      return dateValue || "";
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px" },
    { Header: "ID", accessor: "id", align: "center", width: "56px" },
    { Header: "Contract No", accessor: "contractNo", align: "left" },
    // Backend now sends names directly (no mapping)
    { Header: "Command", accessor: "cmdName", align: "left" },
    { Header: "Base", accessor: "baseName", align: "left" },
    { Header: "Class", accessor: "className", align: "left" },
    {
      Header: "Group",
      accessor: "grpName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          // eslint-disable-next-line react/prop-types
          const groupKey = row.original.groupKey;
          const isExpanded = expandedGroups.has(groupKey);
          return (
            <MDBox display="flex" alignItems="center" gap={1}>
              <IconButton
                size="small"
                onClick={() => {
                  const newExpanded = new Set(expandedGroups);
                  if (isExpanded) {
                    newExpanded.delete(groupKey);
                  } else {
                    newExpanded.add(groupKey);
                  }
                  setExpandedGroups(newExpanded);
                }}
                sx={{ padding: "4px" }}
              >
                <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
              </IconButton>
              <MDTypography variant="body2" fontWeight="medium">
                {/* eslint-disable-next-line react/prop-types */}
                {row.original.grpName || row.original.gId || ""}
              </MDTypography>
            </MDBox>
          );
        }
        // eslint-disable-next-line react/prop-types
        return row.original.grpName || row.original.gId || "-";
      },
    },
    {
      Header: "Total Area",
      accessor: "totalArea",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          // eslint-disable-next-line react/prop-types
          const totalArea = row.original.totalArea || 0;
          return (
            <MDTypography variant="body2" fontWeight="medium">
              {totalArea ? Number(totalArea).toLocaleString() : "-"}
            </MDTypography>
          );
        }
        return "-";
      },
    },
    {
      Header: "Location",
      accessor: "location",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          // eslint-disable-next-line react/prop-types
          const location = row.original.location || "";
          return (
            <MDTypography variant="body2" fontWeight="medium">
              {location || "-"}
            </MDTypography>
          );
        }
        return "-";
      },
    },
    { Header: "Unit", accessor: "unitName", align: "left" },
    {
      Header: "Tenant No",
      accessor: "tenantNo",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const tenantNo = value || row.original?.tenantNo || "";
        // Find tenant from tenants list
        const tenant = tenants.find((t) => t.tenantNo === tenantNo);
        if (tenant) {
          return (
            <MDBox>
              <MDTypography variant="caption" fontWeight="medium">
                {tenantNo}
              </MDTypography>
              <MDTypography variant="caption" display="block" color="text">
                {tenant.ownerName || "-"}
              </MDTypography>
              <MDTypography
                variant="caption"
                display="block"
                color="text"
                sx={{ fontSize: "0.75rem" }}
              >
                {tenant.address || "-"}
              </MDTypography>
            </MDBox>
          );
        }
        return tenantNo || "-";
      },
    },
    { Header: "Business Name", accessor: "businessName", align: "left" },
    { Header: "Nature of Business", accessor: "natureOfBusiness", align: "left" },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMYYYY(value),
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMYYYY(value),
    },
    {
      Header: "Commercial Operation Date",
      accessor: "commercialOperationDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? formatDateDDMMYYYY(value) : "-"),
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    { Header: "Payment Term Months", accessor: "paymentTermMonths", align: "right" },
    { Header: "Term", accessor: "term", align: "left" },
    {
      Header: "Increase Rate %",
      accessor: "increaseRatePercent",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Increase Interval Months",
      accessor: "increaseIntervalMonths",
      align: "right",
    },
    { Header: "SD Rate Months", accessor: "sdRateMonths", align: "right" },
    {
      Header: "Security Deposit Amount (Rs)",
      accessor: "securityDepositAmount",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Rental Value",
      accessor: "rentalValue",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    { Header: "Govt Share Condition", accessor: "govtShareCondition", align: "left" },
    {
      Header: "PAF Share %",
      accessor: "pafShare",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const hasId = row?.original?.id;
        return hasId ? (
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
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <StatusBadge value={value} />,
    },
    { Header: "Remarks", accessor: "remarks", align: "left" },
  ];

  // Group contracts by grpId
  const groupedData = useMemo(() => {
    // Normalize rows
    const normalizedRows = rows.map((row) => ({
      ...row,
      cmdName: row.cmdName || row.cmdname || row.commandName || "",
      baseName: row.baseName || row.basename || row.baseNameText || "",
      className: row.className || row.classname || row.classNameText || "",
      grpName: row.grpName || row.grpname || row.groupName || row.gId || "",
      grpId: row.grpId || row.gId || "",
      unitName: row.unitName || row.unitname || row.uomName || row.uoM || row.uoMName || "",
    }));

    // Group by grpId
    const groups = new Map();
    normalizedRows.forEach((row) => {
      const grpId = row.grpId || row.gId || "";
      if (!grpId) {
        // If no group, add as individual row
        if (!groups.has("_no_group")) {
          groups.set("_no_group", { grpId: "", grpName: "", rows: [] });
        }
        groups.get("_no_group").rows.push(row);
        return;
      }

      const groupKey = grpId;
      if (!groups.has(groupKey)) {
        // Find property grouping to get area and location
        const propertyGrouping = allPropertyGroupings.find(
          (pg) => pg.gId === grpId || pg.id === Number(grpId)
        );
        groups.set(groupKey, {
          grpId: grpId,
          grpName: propertyGrouping?.gId || row.grpName || grpId,
          totalArea: propertyGrouping?.area || 0,
          location: propertyGrouping?.location || "",
          rows: [],
        });
      }
      groups.get(groupKey).rows.push(row);
    });

    // Build result array
    const result = [];
    groups.forEach((group, groupKey) => {
      if (groupKey === "_no_group") {
        // Add ungrouped rows directly
        group.rows.forEach((row) => {
          result.push({
            ...row,
            actions: (
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
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditContract(row.id)}
                  title="Edit"
                  sx={{ padding: "1px" }}
                >
                  <Icon>edit</Icon>
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteContract(row.id)}
                  title="Delete"
                  sx={{ padding: "1px" }}
                >
                  <Icon>delete</Icon>
                </IconButton>
              </MDBox>
            ),
          });
        });
        return;
      }

      const isExpanded = expandedGroups.has(groupKey);

      // Add group row
      result.push({
        ...group.rows[0],
        grpName: group.grpName,
        totalArea: group.totalArea,
        location: group.location,
        isGroupRow: true,
        groupKey: groupKey,
        groupRows: group.rows,
        actions: (
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
            <IconButton
              size="small"
              color="info"
              onClick={() => {
                const newExpanded = new Set(expandedGroups);
                if (isExpanded) {
                  newExpanded.delete(groupKey);
                } else {
                  newExpanded.add(groupKey);
                }
                setExpandedGroups(newExpanded);
              }}
              title={isExpanded ? "Collapse" : "Expand"}
              sx={{ padding: "1px" }}
            >
              <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
            </IconButton>
          </MDBox>
        ),
      });

      // Add expanded rows if group is expanded
      if (isExpanded) {
        group.rows.forEach((row) => {
          result.push({
            ...row,
            isExpandedRow: true,
            actions: (
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
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditContract(row.id)}
                  title="Edit"
                  sx={{ padding: "1px" }}
                >
                  <Icon>edit</Icon>
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteContract(row.id)}
                  title="Delete"
                  sx={{ padding: "1px" }}
                >
                  <Icon>delete</Icon>
                </IconButton>
              </MDBox>
            ),
          });
        });
      }
    });

    return result;
  }, [rows, allPropertyGroupings, expandedGroups]);

  const computedRows = groupedData;

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
                  Contracts
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
                sx={{
                  // Match property-grouping style: tight grid + multi-line headers/cells (no overflow)
                  overflowX: "auto",
                  "& .MuiTable-root": {
                    tableLayout: "fixed",
                    width: "100%",
                  },
                  // DataTable uses custom <td> cells (MDBox), not MUI TableCell.
                  // Force wrapping + constrain inner "max-content" wrapper so text never overlaps.
                  "& table th, & table td": {
                    whiteSpace: "normal !important",
                    wordBreak: "break-word !important",
                    overflowWrap: "anywhere !important",
                    lineHeight: 1.3,
                    verticalAlign: "top",
                  },
                  // DataTableBodyCell renders: <td><div style="display:inline-block;width:max-content">...</div></td>
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
                    fontSize: "1.0rem !important",
                    fontWeight: "700 !important",
                    padding: "8px 8px !important",
                    borderBottom: "1px solid #d0d0d0",
                  },
                  "& .MuiTable-root td": {
                    padding: "6px 8px !important",
                    borderBottom: "1px solid #e0e0e0",
                  },
                  // Keep Actions + ID columns compact and stable (avoid wrap/overlap)
                  "& .MuiTable-root th:nth-of-type(1), & .MuiTable-root td:nth-of-type(1)": {
                    width: "72px",
                    minWidth: "72px",
                    maxWidth: "72px",
                    whiteSpace: "nowrap !important",
                    paddingLeft: "4px !important",
                    paddingRight: "4px !important",
                  },
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
                    width: "56px",
                    minWidth: "56px",
                    maxWidth: "56px",
                    whiteSpace: "nowrap !important",
                    paddingLeft: "4px !important",
                    paddingRight: "4px !important",
                  },
                  // ID is an integer field; keep it tight against the next column (Contract No)
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
                    paddingRight: "1px !important",
                  },
                  "& .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3)": {
                    paddingLeft: "1px !important",
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
                    fetchContracts(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Contracts"
                />

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
                              <React.Fragment key={p}>
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
      <ContractsForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentContract}
        commands={commands}
        bases={bases}
        classes={classes}
        propertyGroups={propertyGroups}
        tenants={tenants}
        onPropertyGroupsRefresh={fetchPropertyGroups}
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
          ) : (
            <>
              {attachmentList.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No attachments uploaded for this contract.
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

              {currentViewingRecord?.id && (
                <MDBox
                  mt={3}
                  p={2}
                  sx={{
                    border: "1px dashed",
                    borderColor: "#b0b0b0",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                    Upload Attachments (Max 5 total)
                  </MDTypography>

                  <input
                    accept="*/*"
                    style={{ display: "none" }}
                    id="contract-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={attachmentList.length + selectedFiles.length >= 5 || isUploading}
                  />
                  <label htmlFor="contract-file-upload">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={attachmentList.length + selectedFiles.length >= 5 || isUploading}
                      sx={{
                        mb: 2,
                        minHeight: "48px",
                        fontSize: "1rem",
                        fontWeight: 600,
                        px: 3,
                        "& .MuiSvgIcon-root": { fontSize: "1.4rem", mr: 1 },
                      }}
                    >
                      <Icon>cloud_upload</Icon>
                      Select Files ({attachmentList.length + selectedFiles.length}/5)
                    </MDButton>
                  </label>

                  {attachmentList.length + selectedFiles.length < 5 && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      You can upload {5 - (attachmentList.length + selectedFiles.length)} more
                      file(s).
                    </MDTypography>
                  )}

                  {selectedFiles.length > 0 && (
                    <MDBox mt={1} display="flex" flexWrap="wrap" gap={1}>
                      {selectedFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => handleRemoveFile(index)}
                          deleteIcon={<Icon>cancel</Icon>}
                          sx={{ fontSize: "0.95rem" }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </MDBox>
                  )}

                  <MDBox mt={2} display="flex" justifyContent="flex-end">
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={handleUploadSelected}
                      disabled={selectedFiles.length === 0 || isUploading}
                    >
                      <Icon>upload</Icon>&nbsp;{isUploading ? "Uploading..." : "Upload Selected"}
                    </MDButton>
                  </MDBox>
                </MDBox>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1">
            Are you sure you want to delete this contract? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary">
            Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error">
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
