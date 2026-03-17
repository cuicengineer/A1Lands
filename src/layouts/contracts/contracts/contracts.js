import React, { useState, useEffect, useMemo, useRef } from "react";
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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import CurrencyLoading from "components/CurrencyLoading";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import FormHelperText from "@mui/material/FormHelperText";
import api, { getActionBy, getUserIPAddress, isOperatorUser } from "services/api.service";
import contractApi from "services/api.contract.service";
import uploadApi from "services/api.upload.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import rentalValueRateApi from "services/api.rentalvaluerate.service";
import govtShareRateApi from "services/api.govtsharerate.service";
import StatusBadge from "components/StatusBadge";
import { PropertyGroupingForm } from "layouts/contracts/property-grouping/property-grouping";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import { useMaterialUIController } from "context";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { format, parseISO, isValid } from "date-fns";

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
  natures,
  onPropertyGroupsRefresh,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
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
    govtShare: "",
    pafShare: "",
    status: true,
    remarks: "",
    riseTermType: "",
    riseyear: "",
    risedate: "",
    vaArea: "",
    profitRate: "",
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

  // Form loading state
  const [formLoading, setFormLoading] = useState(false);

  // Property Grouping form state
  const [propertyGroupingFormOpen, setPropertyGroupingFormOpen] = useState(false);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);
  const [rentalValueRates, setRentalValueRates] = useState([]);
  const [govtShareRates, setGovtShareRates] = useState([]);

  const contractStartDateInputRef = useRef(null);
  const contractEndDateInputRef = useRef(null);
  const commercialOperationDateInputRef = useRef(null);
  const riseDateInputRef = useRef(null);

  const toDisplayDate = (isoStr) => {
    if (!isoStr || typeof isoStr !== "string") return "";
    const trimmed = isoStr.trim();
    if (!trimmed) return "";
    try {
      const d = parseISO(trimmed);
      return isValid(d) ? format(d, "dd-MMM-yyyy") : trimmed;
    } catch {
      return trimmed;
    }
  };

  const openDatePicker = (ref) => {
    if (ref?.current) {
      if (ref.current.showPicker) ref.current.showPicker();
      else ref.current.click();
    }
  };

  const normalizeRiseTermType = (value) => {
    if (!value) return "";
    const token = String(value).trim().toLowerCase();
    if (!token) return "";
    if (token.includes("uniform")) return "Uniform";
    if (token.includes("fixed")) return "Fixed Date";
    if (token.includes("increase") || token.includes("variable")) return "Variable";
    // Fallback: return original trimmed value so it at least shows in the UI if it matches exactly
    return String(value).trim();
  };

  useEffect(() => {
    // Set loading when form opens with initialData (edit mode)
    if (open && initialData) {
      setFormLoading(true);
    } else if (open && !initialData) {
      // New form - no loading needed
      setFormLoading(false);
    }

    if (initialData) {
      // Use only PascalCase (strict API response format)
      const rawRiseType = initialData.RiseTermType || "";
      const rawRiseYear = initialData.RiseYear ?? null;
      const rawRiseDate = initialData.RiseDate ?? null;

      const normalizedRiseYear = rawRiseYear !== null ? String(rawRiseYear) : "";
      const normalizedRiseDate =
        rawRiseDate !== null && String(rawRiseDate).trim() !== ""
          ? String(rawRiseDate).split("T")[0].slice(0, 10)
          : "";

      const rawGovtShare = initialData.GovtShare ?? 0;

      setForm({
        contractNo: initialData.ContractNo || "",
        cmdId: initialData.CmdId || "",
        baseId: initialData.BaseId || "",
        classId: initialData.ClassId || "",
        grpId: initialData.GrpId || "",
        tenantNo: initialData.TenantNo || "",
        businessName: initialData.BusinessName || "",
        natureOfBusiness: initialData.NatureOfBusiness || "",
        contractStartDate: initialData.ContractStartDate
          ? initialData.ContractStartDate.split("T")[0]
          : "",
        contractEndDate: initialData.ContractEndDate
          ? initialData.ContractEndDate.split("T")[0]
          : "",
        commercialOperationDate: initialData.CommercialOperationDate
          ? initialData.CommercialOperationDate.split("T")[0]
          : "",
        initialRentPM: initialData.InitialRentPM || "",
        initialRentPA:
          initialData.InitialRentPA !== "" &&
          initialData.InitialRentPA != null &&
          !Number.isNaN(Number(initialData.InitialRentPA))
            ? String(Math.round(Number(initialData.InitialRentPA)))
            : initialData.InitialRentPA || "",
        paymentTermMonths: initialData.PaymentTermMonths || "",
        term: initialData.Term || "",
        increaseRatePercent: initialData.IncreaseRatePercent || "",
        increaseIntervalMonths: initialData.IncreaseIntervalMonths || "",
        sdRateMonths: initialData.SDRateMonths || "",
        securityDepositAmount:
          initialData.SecurityDepositAmount !== "" &&
          initialData.SecurityDepositAmount != null &&
          !Number.isNaN(Number(initialData.SecurityDepositAmount))
            ? String(Math.round(Number(initialData.SecurityDepositAmount)))
            : initialData.SecurityDepositAmount || "",
        rentalValue:
          initialData.RentalValue !== "" &&
          initialData.RentalValue != null &&
          !Number.isNaN(Number(initialData.RentalValue))
            ? String(Math.round(Number(initialData.RentalValue)))
            : initialData.RentalValue || "",
        govtShare: Math.round(Number(rawGovtShare || 0)),
        pafShare:
          initialData.PAFShare !== "" &&
          initialData.PAFShare != null &&
          !Number.isNaN(Number(initialData.PAFShare))
            ? String(Math.round(Number(initialData.PAFShare)))
            : initialData.PAFShare || "",
        status: initialData.Status !== undefined ? initialData.Status : true,
        remarks: initialData.Remarks || "",
        riseTermType: normalizeRiseTermType(rawRiseType),
        riseyear: normalizedRiseYear,
        risedate: normalizedRiseDate,
        vaArea: initialData.VaArea || "",
        profitRate: initialData.ProfitRate ?? initialData.profitRate ?? "",
      });

      // Initialize riseTerms list from existing contract rise terms, if any
      const rawRiseTerms = initialData.ContractRiseTerms || [];
      if (Array.isArray(rawRiseTerms) && rawRiseTerms.length > 0) {
        const normalizedRiseTerms = rawRiseTerms
          .map((t) => {
            const monthsInterval = t.MonthsInterval ?? null;
            const risePercent = t.RisePercent ?? null;
            const sequenceNo = t.SequenceNo ?? null;
            const contractID = t.ContractID ?? null;
            const isDeleted = t.IsDeleted ?? null;
            const id = t.Id ?? null;

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

      // Data loaded, turn off loading after a small delay to ensure all state updates complete
      setTimeout(() => {
        setFormLoading(false);
      }, 100);
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
        govtShare: "",
        pafShare: "",
        status: true,
        remarks: "",
        riseTermType: "",
        riseyear: "",
        risedate: "",
        vaArea: "",
        profitRate: "",
      });
      // Reset rise terms when opening new form
      setRiseTerms([]);
      setFormLoading(false);
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
          Number(pg.CmdId || pg.cmdId) === Number(form.cmdId) &&
          Number(pg.BaseId || pg.baseId) === Number(form.baseId) &&
          Number(pg.ClassId || pg.classId) === Number(form.classId)
      );
      setFilteredPropertyGroups(filtered);
      if (form.grpId && !filtered.find((pg) => (pg.Id || pg.id) === form.grpId)) {
        setForm((prev) => ({ ...prev, grpId: "" }));
      }
    } else {
      setFilteredPropertyGroups([]);
    }
  }, [form.cmdId, form.baseId, form.classId, propertyGroups]);

  // Auto-calculate initialRentPA when initialRentPM changes (rounded to integer)
  useEffect(() => {
    const initialRent = Number(form.initialRentPM);

    if (initialRent && !isNaN(initialRent)) {
      const calculated = Math.round(initialRent * 12);
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

  // Auto-calculate securityDepositAmount when sdRateMonths or initialRentPM changes (rounded to integer)
  useEffect(() => {
    const sdRate = Number(form.sdRateMonths);
    const initialRent = Number(form.initialRentPM);

    if (sdRate && initialRent && !isNaN(sdRate) && !isNaN(initialRent)) {
      const calculated = Math.round(sdRate * initialRent);
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

  // Load Rental Value Rate (%) records when form opens.
  useEffect(() => {
    if (!open) return;
    const fetchRentalValueRates = async () => {
      try {
        const response = await rentalValueRateApi.getAll(1, 10000);
        const list =
          response && response.pagination
            ? response.data || []
            : Array.isArray(response)
            ? response
            : [];
        setRentalValueRates(list);
      } catch (error) {
        console.error("Error fetching rental value rates:", error);
        setRentalValueRates([]);
      }
    };
    fetchRentalValueRates();
  }, [open]);

  // Load Govt Share Rate (%) records when form opens.
  useEffect(() => {
    if (!open) return;
    const fetchGovtShareRates = async () => {
      try {
        const response = await govtShareRateApi.getAll(1, 10000);
        const list =
          response && response.pagination
            ? response.data || []
            : Array.isArray(response)
            ? response
            : [];
        setGovtShareRates(list);
      } catch (error) {
        console.error("Error fetching govt share rates:", error);
        setGovtShareRates([]);
      }
    };
    fetchGovtShareRates();
  }, [open]);

  const handleChange = (field, value) => {
    // Prevent manual editing of auto-calculated fields
    if (
      field === "securityDepositAmount" ||
      field === "initialRentPA" ||
      field === "rentalValue" ||
      field === "govtShare" ||
      field === "pafShare"
    ) {
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
          increaseIntervalMonths: "",
        }),
        // If selected Term does not contain "Rent", keep rent-increase fields empty
        ...(field === "term" &&
          !String(value || "")
            .toLowerCase()
            .includes("rent") && {
            increaseRatePercent: "",
            increaseIntervalMonths: "",
          }),
      };

      // If start date changes and end date is now invalid, clear end date
      if (field === "contractStartDate" && updated.contractEndDate) {
        if (updated.contractEndDate <= value) {
          updated.contractEndDate = "";
        }
      }
      // Auto-fill COD with selected CSD. User can still manually change COD afterwards.
      if (field === "contractStartDate") {
        updated.commercialOperationDate = value || "";
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

    // Clear rise terms when switching away from Variable
    if (field === "riseTermType" && value !== "Variable") {
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
    if (form.riseTermType === "Fixed Date") {
      if (!form.risedate?.trim()) {
        newErrors.risedate = "Rise Date is required";
      } else if (form.contractStartDate && form.contractEndDate) {
        if (form.risedate < form.contractStartDate) {
          newErrors.risedate = "Rise Date must be on or after Contract Start Date";
        } else if (form.risedate > form.contractEndDate) {
          newErrors.risedate = "Rise Date must be on or before Contract End Date";
        }
      }
    }
    if (!form.initialRentPM) newErrors.initialRentPM = "Initial Rent PM is required";
    // initialRentPA is auto-calculated, no validation needed
    if (!form.paymentTermMonths) newErrors.paymentTermMonths = "Payment Term Months is required";
    if (form.remarks && form.remarks.length > 500) {
      newErrors.remarks = "Remarks cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const hasRentInTerm = String(form.term || "")
      .toLowerCase()
      .includes("rent");

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
      profitRate:
        form.term &&
        String(form.term).toLowerCase() !== "rent" &&
        form.profitRate != null &&
        String(form.profitRate).trim() !== ""
          ? String(form.profitRate).trim()
          : null,
      increaseRatePercent:
        hasRentInTerm && form.increaseRatePercent ? Number(form.increaseRatePercent) : null,
      increaseIntervalMonths:
        !hasRentInTerm || form.riseTermType === "Variable"
          ? null
          : form.increaseIntervalMonths
          ? Number(form.increaseIntervalMonths)
          : null,
      sdRateMonths: form.sdRateMonths ? Number(form.sdRateMonths) : null,
      securityDepositAmount: form.securityDepositAmount ? Number(form.securityDepositAmount) : null,
      rentalValue: form.rentalValue ? Number(form.rentalValue) : null,
      govtShare: form.govtShare ? Number(form.govtShare) : null,
      pafShare: form.pafShare ? Number(form.pafShare) : null,
      feasible:
        Number(form.initialRentPA || 0) > Number(form.govtShare || 0) ? "Unviable" : "Viable",
      status: form.status,
      remarks: form.remarks?.trim() || null,
      riseTermType: form.riseTermType || null,
      riseyear:
        form.riseTermType === "Variable" || form.riseTermType === "Uniform"
          ? null
          : form.riseyear
          ? Number(form.riseyear)
          : null,
      // If Fixed Date is selected, include risedate
      ...(form.riseTermType === "Fixed Date" && {
        risedate: form.risedate || null,
      }),
      // Group Area, Group Rate, Rental Value Rate, and VA Area
      GroupArea: Number(selectedGroupArea) || null,
      GroupRate: Number(selectedGroupRate) || null,
      RentalValueRate: Number(selectedRentalValuePercentRate) || null,
      VaArea: form.vaArea ? Number(form.vaArea) : null,
      // If Variable is selected, include contractRiseTerms
      ...(form.riseTermType === "Variable" && {
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

    try {
      await onSubmit(payload);
    } catch (err) {
      console.error("Contract save failed:", err);
      alert("Failure: Contract could not be saved. Please try again.");
    }
  };

  const selectedPropertyGroup = filteredPropertyGroups.find(
    (pg) => Number(pg.Id || pg.id) === Number(form.grpId)
  );
  const isContractNoMissing = !form.contractNo?.trim();
  const hasTenantSelection = Boolean(String(form.tenantNo || "").trim());
  const selectedTenant = useMemo(() => {
    if (!hasTenantSelection) return null;
    const selectedTenantNo = String(form.tenantNo).trim();
    return tenants.find((t) => String(t?.tenantNo ?? "").trim() === selectedTenantNo) || null;
  }, [tenants, form.tenantNo, hasTenantSelection]);
  // Use only PascalCase (strict API response format)
  const selectedGroupArea = selectedPropertyGroup?.Area ?? "";
  const selectedGroupRate = selectedPropertyGroup?.Rate ?? "";
  const selectedGroupLocation =
    selectedPropertyGroup?.Location ?? selectedPropertyGroup?.location ?? "";
  const selectedGroupUoM = selectedPropertyGroup?.UoM ?? "";

  const selectedRentalValueRateMeta = useMemo(() => {
    if (!form.cmdId || !form.baseId || !form.classId || !form.contractStartDate) {
      return { percent: 0, applicationDate: "" };
    }
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const contractStartTs = new Date(`${form.contractStartDate}T23:59:59`).getTime();
    if (!Number.isFinite(contractStartTs) || contractStartTs <= 0) {
      return { percent: 0, applicationDate: "" };
    }

    // Use only PascalCase (strict API response format)
    const matched = (rentalValueRates || []).filter((r) => {
      const cmdId = r.CmdId ?? null;
      const baseId = r.BaseId ?? null;
      const classId = r.ClassId ?? null;
      const appDateRaw = r.ApplicableDate ?? null;

      // Check if IDs match
      if (
        !cmdId ||
        !baseId ||
        !classId ||
        Number(cmdId) !== Number(form.cmdId) ||
        Number(baseId) !== Number(form.baseId) ||
        Number(classId) !== Number(form.classId)
      ) {
        return false;
      }

      // Check status and deleted
      if (!isActive(r.Status) || isDeleted(r.IsDeleted)) {
        return false;
      }

      // Check application date
      if (!appDateRaw) {
        return false;
      }

      const appDateTs = new Date(appDateRaw).getTime();
      if (!Number.isFinite(appDateTs) || appDateTs <= 0 || appDateTs > contractStartTs) {
        return false;
      }

      // Rate must still be active at contract start: no DeactiveDate or DeactiveDate >= contractStartDate
      const deactiveRaw = r.DeactiveDate ?? r.deactiveDate ?? null;
      if (deactiveRaw) {
        const deactiveTs = new Date(String(deactiveRaw).split("T")[0]).getTime();
        if (Number.isFinite(deactiveTs) && deactiveTs < contractStartTs) {
          return false;
        }
      }

      return true;
    });
    if (matched.length === 0) return { percent: 0, applicationDate: "" };

    const sorted = [...matched].sort((a, b) => {
      const da = new Date(a.ApplicableDate || 0).getTime() || 0;
      const db = new Date(b.ApplicableDate || 0).getTime() || 0;
      return db - da;
    });
    const selected = sorted[0] || {};
    const rate = Number(selected?.Rate ?? 0);
    const appDate = selected?.ApplicableDate || "";
    return { percent: Number.isFinite(rate) ? rate : 0, applicationDate: String(appDate || "") };
  }, [rentalValueRates, form.cmdId, form.baseId, form.classId, form.contractStartDate]);
  const selectedRentalValuePercentRate = selectedRentalValueRateMeta.percent;

  // Auto-calculate Rental Value = Area * Rate * (%Rate / 100) (rounded to integer)
  useEffect(() => {
    const area = Number(selectedGroupArea);
    const rate = Number(selectedGroupRate);
    const percent = Number(selectedRentalValuePercentRate);
    const hasInputs = Number.isFinite(area) && Number.isFinite(rate) && Number.isFinite(percent);
    const calculated = hasInputs ? Math.round((area * rate * percent) / 100) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.rentalValue || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, rentalValue: calculated };
    });
  }, [selectedGroupArea, selectedGroupRate, selectedRentalValuePercentRate]);

  const rentalValueFormulaText = useMemo(() => {
    const area = Number(selectedGroupArea) || 0;
    const rate = Number(selectedGroupRate) || 0;
    const percent = Number(selectedRentalValuePercentRate) || 0;
    const calculated = Math.round((area * rate * percent) / 100);
    if (!form.contractStartDate) {
      return "Formula: Rental Value = Area x Revenue Rate x (Rental Value Rate %). Select Contract Start Date to apply the correct % Rate.";
    }
    const appDateInfo = selectedRentalValueRateMeta.applicationDate
      ? ` | % Rate App Date: ${String(selectedRentalValueRateMeta.applicationDate).split("T")[0]}`
      : " | % Rate App Date: N/A";
    return `Formula: ${area} x ${rate} x (${percent} / 100) = ${calculated}${appDateInfo}`;
  }, [
    selectedGroupArea,
    selectedGroupRate,
    selectedRentalValuePercentRate,
    selectedRentalValueRateMeta.applicationDate,
    form.contractStartDate,
  ]);

  const selectedGovtShareRateMeta = useMemo(() => {
    if (!form.cmdId || !form.baseId || !form.classId || !form.contractStartDate) {
      return { percent: 0, applicationDate: "" };
    }
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const contractStartTs = new Date(`${form.contractStartDate}T23:59:59`).getTime();
    if (!Number.isFinite(contractStartTs) || contractStartTs <= 0) {
      return { percent: 0, applicationDate: "" };
    }

    // Use only PascalCase (strict API response format)
    const matched = (govtShareRates || []).filter((r) => {
      const cmdId = r.CmdId ?? null;
      const baseId = r.BaseId ?? null;
      const classId = r.ClassId ?? null;
      const appDateRaw = r.ApplicableDate ?? null;

      // Check if IDs match
      if (
        !cmdId ||
        !baseId ||
        !classId ||
        Number(cmdId) !== Number(form.cmdId) ||
        Number(baseId) !== Number(form.baseId) ||
        Number(classId) !== Number(form.classId)
      ) {
        return false;
      }

      // Check status and deleted
      if (!isActive(r.Status) || isDeleted(r.IsDeleted)) {
        return false;
      }

      // Check application date
      if (!appDateRaw) {
        return false;
      }

      const appDateTs = new Date(appDateRaw).getTime();
      if (!Number.isFinite(appDateTs) || appDateTs <= 0 || appDateTs > contractStartTs) {
        return false;
      }

      // Rate must still be active at contract start: no DeactiveDate or DeactiveDate >= contractStartDate
      const deactiveRaw = r.DeactiveDate ?? r.deactiveDate ?? null;
      if (deactiveRaw) {
        const deactiveTs = new Date(String(deactiveRaw).split("T")[0]).getTime();
        if (Number.isFinite(deactiveTs) && deactiveTs < contractStartTs) {
          return false;
        }
      }

      return true;
    });
    if (matched.length === 0) return { percent: 0, applicationDate: "" };

    const sorted = [...matched].sort((a, b) => {
      const da = new Date(a.ApplicableDate || 0).getTime() || 0;
      const db = new Date(b.ApplicableDate || 0).getTime() || 0;
      return db - da;
    });
    const selected = sorted[0] || {};
    const rate = Number(selected?.Rate ?? 0);
    const appDate = selected?.ApplicableDate || "";
    return { percent: Number.isFinite(rate) ? rate : 0, applicationDate: String(appDate || "") };
  }, [govtShareRates, form.cmdId, form.baseId, form.classId, form.contractStartDate]);
  const selectedGovtSharePercentRate = selectedGovtShareRateMeta.percent;

  // Auto-calculate Govt Share = Rental Value * (%Govt Share / 100) (rounded to integer)
  useEffect(() => {
    const rentalValue = Number(form.rentalValue);
    const percent = Number(selectedGovtSharePercentRate);
    const hasInputs = Number.isFinite(rentalValue) && Number.isFinite(percent);
    const calculated = hasInputs ? Math.round((rentalValue * percent) / 100) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.govtShare || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, govtShare: calculated };
    });
  }, [form.rentalValue, selectedGovtSharePercentRate]);

  const govtShareFormulaText = useMemo(() => {
    const rentalValue = Number(form.rentalValue) || 0;
    const percent = Number(selectedGovtSharePercentRate) || 0;
    const calculated = Math.round((rentalValue * percent) / 100);
    if (!form.contractStartDate) {
      return "Formula: GovtShare = Rental Value x (% Govt Share / 100). Select Contract Start Date to apply the correct % rate.";
    }
    const appDateInfo = selectedGovtShareRateMeta.applicationDate
      ? ` | % Rate App Date: ${String(selectedGovtShareRateMeta.applicationDate).split("T")[0]}`
      : " | % Rate App Date: N/A";
    return `Formula: ${rentalValue} x (${percent} / 100) = ${calculated}${appDateInfo}`;
  }, [
    form.rentalValue,
    selectedGovtSharePercentRate,
    selectedGovtShareRateMeta.applicationDate,
    form.contractStartDate,
  ]);

  // Auto-calculate PAF Share = Rental Value - Govt Share (rounded to integer)
  useEffect(() => {
    const rentalValue = Number(form.rentalValue);
    const govtShare = Number(form.govtShare);
    const hasInputs = Number.isFinite(rentalValue) && Number.isFinite(govtShare);
    const calculated = hasInputs ? Math.round(rentalValue - govtShare) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.pafShare || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, pafShare: calculated };
    });
  }, [form.rentalValue, form.govtShare]);

  const pafShareFormulaText = useMemo(() => {
    const rentalValue = Number(form.rentalValue) || 0;
    const govtShare = Number(form.govtShare) || 0;
    const calculated = Math.round(rentalValue - govtShare);
    return `Formula: ${rentalValue} - ${govtShare} = ${calculated}`;
  }, [form.rentalValue, form.govtShare]);

  const viabilityLabel = useMemo(() => {
    const initialRentPA = Number(form.initialRentPA) || 0;
    const govtShare = Number(form.govtShare) || 0;
    return initialRentPA > govtShare ? "Unviable" : "Viable";
  }, [form.initialRentPA, form.govtShare]);

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

  // Fetch ContractRiseTerms by ContractID
  const fetchContractRiseTerms = async (contractId) => {
    if (!contractId) {
      setRiseTerms([]);
      return;
    }

    try {
      const response = await contractApi.getContractRiseTermsByContractId(contractId);
      const data = Array.isArray(response) ? response : response?.data || [];

      // Filter out deleted records and normalize data
      const normalizedRiseTerms = data
        .filter((t) => !t.IsDeleted && t.IsDeleted !== true)
        .map((t) => {
          const monthsInterval = t.MonthsInterval ?? null;
          const risePercent = t.RisePercent ?? null;
          const sequenceNo = t.SequenceNo ?? null;
          const contractID = t.ContractID ?? null;
          const isDeleted = t.IsDeleted ?? null;
          const id = t.Id ?? null;

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
    } catch (error) {
      console.error("Error fetching ContractRiseTerms:", error);
      // If API call fails, keep existing riseTerms from initialData
    }
  };

  const handleOpenRiseTermsDialog = () => {
    // Reset form
    setRiseTermForm({
      monthsInterval: "",
      risePercent: "",
      sequenceNo: getNextRiseSequenceNo(),
    });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);

    // Fetch ContractRiseTerms if we have a contract ID (edit mode)
    const contractId = initialData?.Id || initialData?.id;
    if (contractId) {
      fetchContractRiseTerms(contractId);
    } else {
      // New contract - use existing riseTerms from state
      // (which should be empty for new contracts)
    }

    setRiseTermsDialogOpen(true);
  };

  const handleCloseRiseTermsDialog = () => {
    setRiseTermsDialogOpen(false);
    setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);
  };

  const paymentTermOptions = [1, 2, 3, 4, 6, 12];
  const increaseIntervalOptions = [1, 2, 3, 4, 6, 12, 15, 24];
  const hasRentInTerm = String(form.term || "")
    .toLowerCase()
    .includes("rent");
  const activeNatureOptions = useMemo(() => {
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";

    return (natures || []).filter((item) => {
      const name = item?.name ?? item?.Name ?? item?.natureName ?? item?.NatureName ?? "";
      return Boolean(String(name).trim()) && isActive(item?.status) && !isDeleted(item?.isDeleted);
    });
  }, [natures]);

  // Shared compact styling to keep all inputs/lookups consistent and simple
  const labelSx = { fontSize: "1rem" };
  const inputSx = {
    "& .MuiInputBase-input": { fontSize: "1rem", padding: "10px 12px" },
    "& .MuiInputLabel-root": { fontSize: "1rem" },
  };
  const selectSx = {
    fontSize: "1rem",
    minHeight: "45px",
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
    // Keep a fixed control height whether empty or filled
    "&.MuiInputBase-root": {
      minHeight: "45px",
    },
    "&.MuiOutlinedInput-root": {
      minHeight: "45px",
    },
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "12px 32px 12px 12px",
      minHeight: "45px !important",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
  };
  const menuItemSx = { fontSize: "1rem" };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle
          sx={{
            py: 2,
            ...(darkMode ? { color: "#ffffff !important" } : {}),
          }}
        >
          <MDBox
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: { xs: "wrap", md: "nowrap" },
            }}
          >
            <MDTypography
              variant="h5"
              fontWeight="bold"
              sx={darkMode ? { color: "#ffffff !important" } : {}}
            >
              {initialData ? "Edit Contract" : "New Contract"}
            </MDTypography>
            <MDBox sx={{ width: { xs: "100%", md: "340px" } }}>
              <MDInput
                label="Contract No"
                type="text"
                value={form.contractNo}
                onChange={(e) => handleChange("contractNo", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.contractNo || isContractNoMissing}
                helperText={
                  errors.contractNo || (isContractNoMissing ? "Contract No is required" : "")
                }
                sx={inputSx}
              />
            </MDBox>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={{ position: "relative" }}>
          {formLoading && (
            <MDBox
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                zIndex: 1000,
              }}
            >
              <CurrencyLoading size={50} />
            </MDBox>
          )}
          <Grid container spacing={2} mt={1}>
            {/* Command, Base, Class - First Row */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.cmdId}>
                <InputLabel id="cmd-label" sx={labelSx}>
                  RAC
                </InputLabel>
                <Select
                  labelId="cmd-label"
                  value={form.cmdId || ""}
                  label="RAC"
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

            {/* Group ID - same row as Area, CA Area */}
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
                      <MenuItem key={pg.Id || pg.id} value={pg.Id || pg.id} sx={menuItemSx}>
                        {pg.GId || pg.gId}
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
              {form.grpId && (
                <MDTypography variant="caption" color="text" sx={{ mt: 0.5, display: "block" }}>
                  Location: {selectedGroupLocation || "-"}
                </MDTypography>
              )}
            </Grid>

            {/* Area (Read-only) with UoM as read-only text beside - same row as Group ID, CA Area */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox display="flex" alignItems="flex-end" gap={1}>
                <MDInput
                  label="Area"
                  type="number"
                  value={selectedGroupArea}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={inputSx}
                />
                <MDTypography variant="caption" color="text" sx={{ pb: 1, flexShrink: 0 }}>
                  UoM: {selectedGroupUoM || "-"}
                </MDTypography>
              </MDBox>
            </Grid>

            {/* CA Area - same row as Group ID, Area */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="CA Area"
                type="number"
                value={form.vaArea}
                onChange={(e) => handleChange("vaArea", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
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
                {errors.tenantNo && <FormHelperText>{errors.tenantNo}</FormHelperText>}
              </FormControl>
              <MDBox mt={0.75} px={0.25}>
                <MDTypography variant="caption" color="text" sx={{ display: "block" }}>
                  Tenant Name: {hasTenantSelection ? selectedTenant?.ownerName || "-" : "-"}
                </MDTypography>
                <MDTypography variant="caption" color="text" sx={{ display: "block" }}>
                  Tenant Address: {hasTenantSelection ? selectedTenant?.address || "-" : "-"}
                </MDTypography>
              </MDBox>
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
              <FormControl size="small" fullWidth required error={!!errors.natureOfBusiness}>
                <InputLabel id="nature-of-business-label" sx={labelSx}>
                  Nature of Business
                </InputLabel>
                <Select
                  labelId="nature-of-business-label"
                  value={form.natureOfBusiness || ""}
                  label="Nature of Business"
                  onChange={(e) => handleChange("natureOfBusiness", e.target.value)}
                  sx={selectSx}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 280,
                      },
                    },
                  }}
                >
                  {activeNatureOptions.map((nature) => {
                    const natureName =
                      nature?.name ??
                      nature?.Name ??
                      nature?.natureName ??
                      nature?.NatureName ??
                      "";
                    return (
                      <MenuItem key={natureName} value={natureName} sx={menuItemSx}>
                        {natureName}
                      </MenuItem>
                    );
                  })}
                </Select>
                {errors.natureOfBusiness && (
                  <FormHelperText>{errors.natureOfBusiness}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* ContractStartDate - display dd-MMM-yyyy, state remains yyyy-mm-dd */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={contractStartDateInputRef}
                  value={form.contractStartDate || ""}
                  onChange={(e) => handleChange("contractStartDate", e.target.value)}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Contract Start Date (CSD)"
                  type="text"
                  value={toDisplayDate(form.contractStartDate)}
                  readOnly
                  fullWidth
                  size="small"
                  required
                  error={!!errors.contractStartDate}
                  helperText={errors.contractStartDate}
                  onClick={() => openDatePicker(contractStartDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* CommercialOperationDate (COD) - display dd-MMM-yyyy */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={commercialOperationDateInputRef}
                  value={form.commercialOperationDate || ""}
                  onChange={(e) => handleChange("commercialOperationDate", e.target.value)}
                  min={form.contractStartDate || undefined}
                  max={form.contractEndDate || undefined}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Commercial Operation Date (COD)"
                  type="text"
                  value={toDisplayDate(form.commercialOperationDate)}
                  readOnly
                  fullWidth
                  size="small"
                  error={!!errors.commercialOperationDate}
                  helperText={errors.commercialOperationDate}
                  onClick={() => openDatePicker(commercialOperationDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* ContractEndDate (CED) - display dd-MMM-yyyy */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={contractEndDateInputRef}
                  value={form.contractEndDate || ""}
                  onChange={(e) => handleChange("contractEndDate", e.target.value)}
                  min={
                    form.contractStartDate
                      ? (() => {
                          const startDate = new Date(form.contractStartDate);
                          startDate.setDate(startDate.getDate() + 1);
                          return startDate.toISOString().split("T")[0];
                        })()
                      : undefined
                  }
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Contract End Date (CED)"
                  type="text"
                  value={toDisplayDate(form.contractEndDate)}
                  readOnly
                  fullWidth
                  size="small"
                  required
                  error={!!errors.contractEndDate}
                  helperText={errors.contractEndDate}
                  onClick={() => openDatePicker(contractEndDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* Initial Rent PM, Payment Term Months - same row */}
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

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.paymentTermMonths}>
                <InputLabel id="payment-term-label" sx={labelSx}>
                  Payment Term (Months)
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

            {/* Initial Rent PA (calculated) - same row as Payment Term */}
            <Grid item xs={12} sm={6} md={4}>
              <MDTypography
                variant="caption"
                color="black"
                fontWeight="bold"
                sx={{ display: "block" }}
              >
                Initial Rent PA
              </MDTypography>
              <MDTypography variant="h6" fontWeight="bold">
                {form.initialRentPA || 0}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Initial Rent PM × 12
              </MDTypography>
            </Grid>

            {/* SD Rate (Months) and Security Deposit (Rs) - same row */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth>
                <InputLabel id="sd-rate-months-label" sx={labelSx}>
                  SD Rate (Months)
                </InputLabel>
                <Select
                  labelId="sd-rate-months-label"
                  value={
                    [1, 2, 3, 9, 12].includes(Number(form.sdRateMonths))
                      ? Number(form.sdRateMonths)
                      : ""
                  }
                  label="SD Rate Months"
                  onChange={(e) => handleChange("sdRateMonths", e.target.value)}
                  sx={selectSx}
                >
                  {[1, 2, 3, 9, 12].map((n) => (
                    <MenuItem key={n} value={n} sx={menuItemSx}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={6}>
              <MDTypography
                variant="caption"
                color="black"
                fontWeight="bold"
                sx={{ display: "block" }}
              >
                Security Deposit (Rs)
              </MDTypography>
              <MDTypography variant="h6" fontWeight="bold">
                {form.securityDepositAmount || 0}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Formula: SD Rate Months x Initial Rent PM
              </MDTypography>
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
                  <MenuItem value="Rent or Profit" sx={menuItemSx}>
                    Rent or Profit
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* ProfitRate - shown when Term is not Rent (optional) */}
            {form.term && String(form.term).toLowerCase() !== "rent" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDInput
                  label="Profit Rate"
                  type="number"
                  value={form.profitRate}
                  onChange={(e) => handleChange("profitRate", e.target.value)}
                  fullWidth
                  size="small"
                  sx={inputSx}
                />
              </Grid>
            )}

            {/* Rise Terms, Increase Rate Percent %, Increase Interval Months - same row when Term is Rent */}
            {hasRentInTerm && (
              <>
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
                      <MenuItem value="Uniform" sx={menuItemSx}>
                        Uniform
                      </MenuItem>
                      <MenuItem value="Fixed Date" sx={menuItemSx}>
                        Fixed Date
                      </MenuItem>
                      <MenuItem value="Variable" sx={menuItemSx}>
                        Variable
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {form.riseTermType === "Variable" && (
                  <Grid item xs={12} sm={6} md={4}>
                    <MDBox
                      sx={{
                        flex: 1,
                        cursor: "pointer",
                        position: "relative",
                      }}
                      onClick={handleOpenRiseTermsDialog}
                    >
                      <MDInput
                        label="Variable"
                        value={
                          riseTerms.length > 0
                            ? `${riseTerms.length} term(s) configured`
                            : "Click for terms"
                        }
                        fullWidth
                        size="small"
                        InputProps={{ readOnly: true }}
                        sx={{
                          ...inputSx,
                          pointerEvents: "none",
                          "& .MuiInputBase-input": {
                            cursor: "pointer",
                          },
                        }}
                      />
                    </MDBox>
                  </Grid>
                )}
                {form.riseTermType !== "Variable" && form.riseTermType !== "Fixed Date" && (
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
                )}
                {form.riseTermType !== "Variable" && form.riseTermType !== "Fixed Date" && (
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
                )}
              </>
            )}

            {/* Rise Date - display dd-MMM-yyyy (when Fixed Date is selected) */}
            {form.riseTermType === "Fixed Date" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDBox sx={{ position: "relative" }}>
                  <input
                    type="date"
                    ref={riseDateInputRef}
                    value={form.risedate || ""}
                    onChange={(e) => handleChange("risedate", e.target.value)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      top: 0,
                      left: 0,
                      cursor: "pointer",
                    }}
                    aria-hidden
                  />
                  <MDInput
                    label="Rise Date"
                    type="text"
                    value={toDisplayDate(form.risedate)}
                    readOnly
                    fullWidth
                    size="small"
                    error={!!errors.risedate}
                    helperText={errors.risedate}
                    onClick={() => openDatePicker(riseDateInputRef)}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                  />
                </MDBox>
              </Grid>
            )}

            {/* Auto-calculated summary (display-only, separated from editable fields) */}
            <Grid item xs={12}>
              <MDBox
                sx={{
                  mt: 0.5,
                  mb: 0.5,
                  px: 2,
                  py: 1.5,
                  border: "1px solid #d0d0d0",
                  borderLeft: "4px solid #2E7D32",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <MDBox
                  sx={{
                    mb: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <MDTypography variant="button" fontWeight="bold">
                    Auto Calculated Values
                  </MDTypography>
                  <MDBox display="flex" flexDirection="column" alignItems="flex-end">
                    <Chip
                      label={viabilityLabel}
                      size="small"
                      color={viabilityLabel === "Viable" ? "success" : "error"}
                      sx={{ fontWeight: 700 }}
                    />
                    <MDTypography variant="caption" color="text" sx={{ mt: 0.5 }}>
                      Govt Share ≥ Initial Rent PA = Viable
                    </MDTypography>
                  </MDBox>
                </MDBox>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Rental Value
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.rentalValue || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {rentalValueFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Govt Share (Rs)
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.govtShare || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {govtShareFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      PAF Share (Rs)
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.pafShare || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {pafShareFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Rate
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {selectedGroupRate || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      From selected property group
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      % Rate
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {selectedRentalValuePercentRate || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      From Rental Value Rate
                    </MDTypography>
                  </Grid>
                </Grid>
              </MDBox>
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

                        // Helper function to format date as dd-MMM-yyyy
                        const formatDate = (dateValue) => {
                          if (!dateValue) return "-";
                          try {
                            const dateStr = String(dateValue).trim();
                            if (!dateStr) return "-";
                            const datePart = dateStr.includes("T")
                              ? dateStr.split("T")[0]
                              : dateStr;
                            const d = parseISO(datePart);
                            if (!isValid(d)) return "-";
                            return format(d, "dd-MMM-yyyy");
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
                                "govtShare",
                                "GovtShare",
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
                  {[
                    6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114,
                    120, 126, 132, 138, 144, 150, 156, 162, 168, 174, 180, 186, 192, 198, 204, 210,
                    216, 222, 228, 234, 240, 246, 252, 258, 264, 270, 276, 282, 288, 294, 300,
                  ].map((value) => (
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
                        <th>Sequence No</th>
                        <th>Months Interval</th>
                        <th>Rise Percent</th>
                        <th>Actions</th>
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
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleAddRiseTerm}
            disabled={isOperatorUser()}
          >
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
  natures: PropTypes.array,
  onPropertyGroupsRefresh: PropTypes.func,
};

export default function Contracts() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [openForm, setOpenForm] = useState(false);
  const [currentContract, setCurrentContract] = useState(null);
  const [rows, setRows] = useState([]);

  // Server-side pagination state (backend now paginates)
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search is handled by shared DataTable (canSearch)

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [propertyGroups, setPropertyGroups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [natures, setNatures] = useState([]);
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
  const CONTRACTS_GROUP_BY_CACHE_KEY = "contracts_groupByColumns";
  const [groupByColumns, setGroupByColumns] = useState(() => {
    try {
      const cached = localStorage.getItem(CONTRACTS_GROUP_BY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(CONTRACTS_GROUP_BY_CACHE_KEY, JSON.stringify(groupByColumns));
    } catch (_) {}
  }, [groupByColumns]);
  const [commandFilterIds, setCommandFilterIds] = useState([]);
  const [baseFilterIds, setBaseFilterIds] = useState([]);
  const [classFilterIds, setClassFilterIds] = useState([]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  // Trigger "as-of" refresh only on button click (not on date change).
  const [asOfRefreshToken, setAsOfRefreshToken] = useState(0);
  // Holds only the columns that should be overridden "as of" a selected date.
  // Keyed by Contract Id (primary) and ContractNo (fallback).
  const [asOfOverrideMap, setAsOfOverrideMap] = useState(() => ({
    byId: new Map(),
    byContractNo: new Map(),
    asOfDate: "",
  }));
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedContractDetails, setSelectedContractDetails] = useState(null);
  const [contractDetailsRiseTerms, setContractDetailsRiseTerms] = useState([]);
  const [loadingContractDetailsRiseTerms, setLoadingContractDetailsRiseTerms] = useState(false);
  const asOfDateInputRef = useRef(null);

  const openDatePicker = (ref) => {
    if (ref?.current) {
      if (ref.current.showPicker) ref.current.showPicker();
      else ref.current.click();
    }
  };

  const toDisplayDate = (isoDateStr) => {
    if (!isoDateStr || typeof isoDateStr !== "string") return "";
    try {
      const d = parseISO(isoDateStr.trim());
      return isValid(d) ? format(d, "dd-MMM-yyyy") : isoDateStr;
    } catch {
      return isoDateStr;
    }
  };

  const selectSx = {
    fontSize: "1rem",
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
      ...(darkMode ? { color: "#ffffff !important" } : {}),
    },
    ...(darkMode
      ? {
          "& .MuiInputLabel-root": {
            color: "#ffffff !important",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.3) !important",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.5) !important",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.7) !important",
          },
          "& .MuiSvgIcon-root": {
            color: "#ffffff !important",
          },
        }
      : {}),
  };
  const groupByInputSx = darkMode
    ? {
        "& .MuiInputLabel-root": {
          color: "#ffffff !important",
        },
        "& .MuiInputBase-input": {
          color: "#ffffff !important",
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.3) !important",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.5) !important",
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.7) !important",
        },
        "& .MuiSvgIcon-root": {
          color: "#ffffff !important",
        },
      }
    : {};
  const ALL_FILTER_VALUE = "__ALL__";

  const mergeAsOfOverrides = (baseRows, overrideState) => {
    const rowsArr = Array.isArray(baseRows) ? baseRows : [];
    if (!overrideState?.asOfDate) return rowsArr;

    const byId = overrideState?.byId instanceof Map ? overrideState.byId : new Map();
    const byContractNo =
      overrideState?.byContractNo instanceof Map ? overrideState.byContractNo : new Map();
    if (byId.size === 0 && byContractNo.size === 0) return rowsArr;

    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
    const readFirstOwn = (obj, keys) => {
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (own(obj, k)) return obj[k];
      }
      return undefined;
    };

    return rowsArr.map((r) => {
      const idKey = r?.Id ?? r?.id ?? null;
      const contractNoKey = r?.ContractNo ?? r?.contractNo ?? null;

      const fromId = idKey !== null && idKey !== undefined ? byId.get(Number(idKey)) : null;
      const fromNo = !fromId && contractNoKey ? byContractNo.get(String(contractNoKey)) : null;
      const o = fromId || fromNo;
      if (!o) return r;

      const next = { ...r };

      const contractState = readFirstOwn(o, [
        "ContractState",
        "contractState",
        "ContractStatus",
        "contractStatus",
      ]);
      const rentalValue = readFirstOwn(o, ["RentalValue", "rentalValue"]);
      const govtShare = readFirstOwn(o, ["GovtShare", "govtShare"]);
      const pafShare = readFirstOwn(o, ["PAFShare", "pafShare"]);
      const viability = readFirstOwn(o, ["Viability", "viability", "Feasible", "feasible"]);
      // Rate column in grid represents GroupRate (property group rate), not any generic "Rate" field.
      const groupRate = readFirstOwn(o, ["GroupRate", "groupRate"]);
      const percentRate = readFirstOwn(o, [
        "RentalValueRatePercent",
        "rentalValueRatePercent",
        "RentalValueRate",
        "rentalValueRate",
      ]);

      // Bind these calculated columns from as-of payload when key exists (including null).
      if (contractState !== undefined) {
        next.ContractState = contractState;
        next.contractState = contractState;
      }
      if (rentalValue !== undefined) {
        next.RentalValue = rentalValue;
        next.rentalValue = rentalValue;
      }
      if (govtShare !== undefined) {
        next.GovtShare = govtShare;
        next.govtShare = govtShare;
      }
      if (pafShare !== undefined) {
        next.PAFShare = pafShare;
        next.pafShare = pafShare;
      }
      if (viability !== undefined) {
        next.Viability = viability;
        next.viability = viability;
        next.Feasible = viability;
        next.feasible = viability;
      }
      if (groupRate !== undefined) {
        next.GroupRate = groupRate;
        next.groupRate = groupRate;
      }
      if (percentRate !== undefined) {
        next.RentalValueRatePercent = percentRate;
        next.rentalValueRatePercent = percentRate;
        // Some parts of the grid also read RentalValueRate
        next.RentalValueRate = percentRate;
        next.rentalValueRate = percentRate;
      }

      return next;
    });
  };

  const fetchContracts = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await contractApi.getAll(page, size);
      if (response && response.pagination) {
        const base = response.data || [];
        setRows(mergeAsOfOverrides(base, asOfOverrideMap));
        setTotalCount(response.pagination.totalCount || 0);
        setPageNumber(response.pagination.pageNumber || page);
        setPageSize(response.pagination.pageSize || size);
      } else {
        // Fallback (non-paginated)
        const arr = Array.isArray(response) ? response : [];
        setRows(mergeAsOfOverrides(arr, asOfOverrideMap));
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

  const fetchNatures = async () => {
    try {
      const response = await api.list("nature");
      setNatures(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching natures:", error);
      setNatures([]);
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
    if (natures.length === 0) fetchNatures();
  }, [
    openForm,
    commands.length,
    bases.length,
    classes.length,
    propertyGroups.length,
    tenants.length,
    natures.length,
  ]);

  // Load current page from backend (also when As of Date changes)
  useEffect(() => {
    fetchContracts(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  // When As of Date changes, fetch "as of" values and merge into existing rows.
  // Only these columns are overridden:
  // Rental Value, Govt Share, PAF Share, Rate, % Rate
  useEffect(() => {
    let isMounted = true;

    const fetchAsOfOverrides = async () => {
      try {
        if (!asOfRefreshToken) return; // no refresh requested yet
        if (!asOfDate) {
          if (!isMounted) return;
          setAsOfOverrideMap({ byId: new Map(), byContractNo: new Map(), asOfDate: "" });
          return;
        }

        const res = await contractApi.getActiveByAsOfDate(asOfDate);
        const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

        const byId = new Map();
        const byContractNo = new Map();
        arr.forEach((r) => {
          const id = r?.Id ?? r?.id ?? null;
          const cn = r?.ContractNo ?? r?.contractNo ?? null;
          if (id !== null && id !== undefined && Number.isFinite(Number(id))) {
            byId.set(Number(id), r);
          }
          if (cn) byContractNo.set(String(cn), r);
        });

        if (!isMounted) return;
        const nextOverrideState = { byId, byContractNo, asOfDate };
        setAsOfOverrideMap(nextOverrideState);

        // Merge into currently visible rows without replacing other fields.
        setRows((prev) => mergeAsOfOverrides(prev, nextOverrideState));
      } catch (e) {
        console.error("Error fetching ActiveByAsOfDate:", e);
        if (!isMounted) return;
        // Keep existing grid, just clear overrides (no destructive reload).
        setAsOfOverrideMap({ byId: new Map(), byContractNo: new Map(), asOfDate: "" });
      }
    };

    fetchAsOfOverrides();
    return () => {
      isMounted = false;
    };
  }, [asOfRefreshToken]);

  // Reset expanded state when grouping keys change.
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupByColumns]);

  const handleOpenForm = () => {
    setCurrentContract(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditContract = async (id) => {
    try {
      // Fetch contract data from API by ID instead of using local storage/table data
      setLoading(true);
      const contract = await api.get("Contracts", id);
      setCurrentContract(contract);
      setOpenForm(true);
    } catch (error) {
      console.error("Error fetching contract:", error);
      alert("Failed to load contract data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContract = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = async (rowData) => {
    setSelectedContractDetails(rowData);
    setDetailsDialogOpen(true);
    setContractDetailsRiseTerms([]);
    setLoadingContractDetailsRiseTerms(true);

    // Fetch ContractRiseTerms if contract has an ID
    const contractId = rowData?.Id || rowData?.id;
    if (contractId) {
      try {
        const response = await contractApi.getContractRiseTermsByContractId(contractId);
        const data = Array.isArray(response) ? response : response?.data || [];

        // Filter out deleted records and normalize data
        const normalizedRiseTerms = data
          .filter((t) => !t.IsDeleted && t.IsDeleted !== true)
          .map((t) => {
            const monthsInterval = t.MonthsInterval ?? null;
            const risePercent = t.RisePercent ?? null;
            const sequenceNo = t.SequenceNo ?? null;
            const id = t.Id ?? null;

            if (monthsInterval === null || risePercent === null || sequenceNo === null) {
              return null;
            }

            return {
              id: id ? Number(id) : null,
              monthsInterval: String(monthsInterval),
              risePercent: String(risePercent),
              sequenceNo: String(sequenceNo),
            };
          })
          .filter(Boolean)
          .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo));

        setContractDetailsRiseTerms(normalizedRiseTerms);
      } catch (error) {
        console.error("Error fetching ContractRiseTerms for details:", error);
        setContractDetailsRiseTerms([]);
      } finally {
        setLoadingContractDetailsRiseTerms(false);
      }
    } else {
      setLoadingContractDetailsRiseTerms(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isOperatorUser()) return;
    if (recordToDelete) {
      try {
        // Include IP address in delete request body
        const deleteData = {
          ActionBy: await getActionBy(),
          ActionDate: new Date().toISOString(),
          userIPAddress: getUserIPAddress() || "session",
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
      // Add IP address to the payload (from user session)
      const dataWithIP = {
        ...data,
        userIPAddress: getUserIPAddress() || "session",
      };

      // Check for contract ID in both PascalCase and camelCase
      const contractId = currentContract?.Id || currentContract?.id;
      if (currentContract && contractId) {
        await contractApi.update(contractId, dataWithIP);
      } else {
        await contractApi.create(dataWithIP);
      }
      await fetchContracts(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Failure: Contract could not be saved. Please try again.");
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
    if (isOperatorUser()) return;
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

  // Import centralized date formatter
  const formatDateDDMMMYYYY = (dateValue) => {
    if (!dateValue) return "";
    const raw = String(dateValue).trim();
    if (!raw) return "";

    const monthShort = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    try {
      const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
      let day = "";
      let month = "";
      let year = "";

      // yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      }
      // dd-mm-yyyy
      else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
        [day, month, year] = datePart.split("-");
      } else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return raw;
        day = String(parsed.getDate()).padStart(2, "0");
        month = String(parsed.getMonth() + 1).padStart(2, "0");
        year = String(parsed.getFullYear());
      }

      const monthIndex = Number(month) - 1;
      const monthText = monthShort[monthIndex] || month;
      return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
    } catch {
      return raw;
    }
  };

  const contractsExportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || "").toLowerCase();
    if (
      colId === "contractstartdate" ||
      colId === "contractenddate" ||
      colId === "commercialoperationdate" ||
      colId === "risedate"
    ) {
      return formatDateDDMMMYYYY(value);
    }
    return value;
  };

  const CALCULATED_CELL_BG = "#e9ecef";

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px", showInTable: true },
    { Header: "S.No", accessor: "id", align: "center", width: "56px", showInTable: true },
    { Header: "Contract No", accessor: "contractNo", align: "left", showInTable: true },
    // Backend now sends names directly (no mapping)
    { Header: "RAC", accessor: "cmdName", align: "left", width: "72px", showInTable: true },
    { Header: "Base", accessor: "baseName", align: "left", width: "72px", showInTable: true },
    { Header: "Class", accessor: "className", align: "left", width: "72px", showInTable: true },
    {
      Header: "Grouping ID",
      accessor: "grpId",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => value || row?.original?.GId || "-",
    },
    {
      id: "currentRentPA",
      Header: "Current Rent PA",
      accessor: "initialRentPA",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const currentRentPA =
          // eslint-disable-next-line react/prop-types
          value ?? row?.original?.CurrentRentPA ?? row?.original?.currentRentPA ?? null;
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {currentRentPA != null && currentRentPA !== ""
              ? Number(currentRentPA).toLocaleString()
              : "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Viability",
      accessor: "feasible",
      align: "center",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const fromPayload = String(
          value ??
            rowData.Viability ??
            rowData.viability ??
            rowData.Feasible ??
            rowData.feasible ??
            ""
        )
          .trim()
          .toLowerCase();
        const hasPayloadValue = fromPayload === "viable" || fromPayload === "unviable";
        const govt = Number(rowData.GovtShare ?? 0);
        const paf = Number(rowData.PAFShare ?? 0);
        const label = hasPayloadValue
          ? fromPayload === "viable"
            ? "Viable"
            : "Unviable"
          : govt > paf
          ? "Viable"
          : "Unviable";
        return <Chip label={label} size="small" color={label === "Viable" ? "success" : "error"} />;
      },
    },
    {
      Header: "Total Area (UoM)",
      accessor: "totalArea",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const totalArea = rowData?.TotalArea ?? 0;
        const uoM = rowData?.UoM || rowData?.uoM || rowData?.unitName || rowData?.UnitName || "";
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {totalArea ? `${Number(totalArea).toLocaleString()}${uoM ? ` (${uoM})` : ""}` : "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Location",
      accessor: "location",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const location = row.original?.Location || "";
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {location || "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "UoM",
      accessor: "uoM",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const uoM = value || rowData.UoM || rowData.unitName || rowData.UnitName || "";
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {uoM || "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Unit",
      accessor: "unitName",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const unitName = value || row.original?.UnitName || row.original?.UoM || "";
        return unitName || "-";
      },
    },
    {
      Header: "Tenant No",
      accessor: "tenantNo",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const tenantNo = value || row.original?.TenantNo || "";
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
    { Header: "Business Name", accessor: "businessName", align: "left", showInTable: false },
    {
      Header: "Nature of Business",
      accessor: "natureOfBusiness",
      align: "left",
      showInTable: false,
    },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMMYYYY(value),
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMMYYYY(value),
    },
    {
      Header: "Commercial Operation Date",
      accessor: "commercialOperationDate",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? formatDateDDMMMYYYY(value) : "-"),
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Payment Term Months",
      accessor: "paymentTermMonths",
      align: "right",
      showInTable: false,
    },
    { Header: "Term", accessor: "term", align: "left", showInTable: false },
    {
      Header: "Increase Rate %",
      accessor: "increaseRatePercent",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Increase Interval (Months)",
      accessor: "increaseIntervalMonths",
      align: "right",
      showInTable: false,
    },
    { Header: "SD Rate Months", accessor: "sdRateMonths", align: "right", showInTable: false },
    {
      Header: "Security Deposit (Rs)",
      accessor: "securityDepositAmount",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Contract State
        </MDBox>
      ),
      accessor: "contractState",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // Prefer backend-provided value if available, otherwise compute from dates.
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const renderContractStateBadge = (state) => {
          const normalizedState = String(state || "")
            .trim()
            .toLowerCase();
          const displayState =
            normalizedState === "upcoming" || normalizedState === "not started"
              ? "Not Started"
              : normalizedState === "active"
              ? "Active"
              : normalizedState === "expired"
              ? "Expired"
              : state;
          const badgeStyles =
            normalizedState === "active"
              ? {
                  backgroundColor: "#d4edda",
                  color: "#155724",
                }
              : normalizedState === "expired"
              ? {
                  backgroundColor: "#f8d7da",
                  color: "#721c24",
                }
              : normalizedState === "upcoming" || normalizedState === "not started"
              ? {
                  backgroundColor: "#dbeafe",
                  color: "#1d4ed8",
                }
              : {
                  backgroundColor: CALCULATED_CELL_BG,
                  color: "#344767",
                };

          return (
            <MDBox
              sx={{
                ...badgeStyles,
                px: 1,
                py: 0.35,
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "96px",
                fontWeight: 600,
              }}
            >
              {displayState}
            </MDBox>
          );
        };
        if (
          rowData.ContractState === null ||
          rowData.contractState === null ||
          rowData.ContractStatus === null ||
          rowData.contractStatus === null
        ) {
          return "null";
        }
        const fromPayload =
          rowData.ContractState ??
          rowData.contractState ??
          rowData.ContractStatus ??
          rowData.contractStatus ??
          "";
        const normalized = String(fromPayload || "")
          .trim()
          .toLowerCase();
        if (normalized) {
          return renderContractStateBadge(normalized);
        }

        const startRaw = rowData.ContractStartDate ?? rowData.contractStartDate ?? "";
        const endRaw = rowData.ContractEndDate ?? rowData.contractEndDate ?? "";
        const start = String(startRaw || "")
          .split("T")[0]
          .slice(0, 10);
        const end = String(endRaw || "")
          .split("T")[0]
          .slice(0, 10);
        const today = new Date().toISOString().split("T")[0];
        const computed =
          start && today < start
            ? "Upcoming"
            : end && today > end
            ? "Expired"
            : start && end && today >= start && today <= end
            ? "Active"
            : "-";

        return (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              display: "inline-block",
              width: "100%",
            }}
          >
            {computed === "-" ? computed : renderContractStateBadge(computed)}
          </MDBox>
        );
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Rental Value
        </MDBox>
      ),
      accessor: "rentalValue",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? Number(value).toLocaleString() : "-"}
        </MDBox>
      ),
    },
    {
      Header: "CA Area",
      accessor: "vaArea",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const vaArea = value || row?.original?.VaArea || 0;
        return vaArea || vaArea === 0 ? Number(vaArea).toLocaleString() : "-";
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Govt Share (Rs)
        </MDBox>
      ),
      accessor: "govtShare",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const finalValue = value;
        const display = finalValue || finalValue === 0 ? Number(finalValue).toLocaleString() : "-";
        return (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              display: "inline-block",
              width: "100%",
              textAlign: "right",
            }}
          >
            {finalValue === null ? "null" : display}
          </MDBox>
        );
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          PAF Share (Rs)
        </MDBox>
      ),
      accessor: "pafShare",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? Number(value).toLocaleString() : "-"}
        </MDBox>
      ),
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Rate
        </MDBox>
      ),
      accessor: "groupRate",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        /* eslint-disable react/prop-types */
        if (
          value === null ||
          row?.original?.GroupRate === null ||
          row?.original?.groupRate === null
        ) {
          return (
            <MDBox
              sx={{
                backgroundColor: CALCULATED_CELL_BG,
                px: 0.75,
                py: 0.25,
                borderRadius: "6px",
                display: "inline-block",
                width: "100%",
                textAlign: "right",
              }}
            >
              null
            </MDBox>
          );
        }
        const groupRate =
          value ||
          row?.original?.GroupRate ||
          row?.original?.groupRate ||
          row?.original?.TotalRate ||
          row?.original?.totalRate ||
          0;
        /* eslint-enable react/prop-types */
        const display = groupRate || groupRate === 0 ? Number(groupRate).toLocaleString() : "-";
        return (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              display: "inline-block",
              width: "100%",
              textAlign: "right",
            }}
          >
            {display}
          </MDBox>
        );
      },
    },
    {
      id: "percentRate",
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          % Rate
        </MDBox>
      ),
      accessor: (row) =>
        row?.RentalValueRate ??
        row?.rentalValueRate ??
        row?.RentalValueRatePercent ??
        row?.rentalValueRatePercent ??
        null,
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? `${Number(value)}%` : "-"}
        </MDBox>
      ),
    },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const hasId = rowData?.Id;
        const rawIsAttachment = rowData?.IsAttachment;
        const countValue =
          rowData?.AttachmentCount ?? rowData?.AttachmentsCount ?? rowData?.FilesCount;
        const hasAttachments =
          rawIsAttachment === true ||
          rawIsAttachment === 1 ||
          rawIsAttachment === "1" ||
          String(rawIsAttachment || "")
            .trim()
            .toLowerCase() === "true" ||
          Number(countValue || 0) > 0;
        return hasId ? (
          <IconButton
            size="small"
            color={hasAttachments ? "success" : "error"}
            // eslint-disable-next-line react/prop-types
            onClick={() => handleViewAttachments(row.original)}
            // eslint-disable-next-line react/prop-types
            disabled={attachmentLoading && attachmentLoadingId === row?.original?.Id}
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

  const groupingColumnOptions = [
    { label: "Group ID", value: "grpId" },
    { label: "Command", value: "cmdName" },
    { label: "Base", value: "baseName" },
    { label: "Class", value: "className" },
    { label: "Tenant No", value: "tenantNo" },
    { label: "Business Name", value: "businessName" },
    { label: "Nature of Business", value: "natureOfBusiness" },
    { label: "Status", value: "status" },
    { label: "Term", value: "term" },
  ];

  const gridFilterOptions = useMemo(() => {
    const commandMap = new Map();
    const baseMap = new Map();
    const classMap = new Map();

    (rows || []).forEach((row) => {
      const cmdName = String(row?.CmdName || "").trim();
      const baseName = String(row?.BaseName || "").trim();
      const className = String(row?.ClassName || "").trim();

      if (cmdName) commandMap.set(cmdName.toLowerCase(), cmdName);
      if (baseName) baseMap.set(baseName.toLowerCase(), baseName);
      if (className) classMap.set(className.toLowerCase(), className);
    });

    return {
      commands: Array.from(commandMap.values()).sort((a, b) => a.localeCompare(b)),
      bases: Array.from(baseMap.values()).sort((a, b) => a.localeCompare(b)),
      classes: Array.from(classMap.values()).sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  // Group contracts by selected grouping columns.
  const groupedData = useMemo(() => {
    // Use only PascalCase (strict API response format) - create camelCase aliases for accessors
    const normalizedRows = rows.map((row) => {
      // Look up property grouping to get Area, Rate, Location, and UoM
      const grpId = row.GrpId || row.GId || "";
      const propertyGrouping = allPropertyGroupings.find(
        (pg) => String(pg.GId || "") === String(grpId) || Number(pg.Id) === Number(grpId)
      );

      // Calculate Viability (same logic as Cell function)
      const fromPayload = String(
        row.Viability ?? row.viability ?? row.Feasible ?? row.feasible ?? ""
      )
        .trim()
        .toLowerCase();
      const hasPayloadValue = fromPayload === "viable" || fromPayload === "unviable";
      const govt = Number(row.GovtShare ?? 0);
      const paf = Number(row.PAFShare ?? 0);
      const feasibleValue = hasPayloadValue
        ? fromPayload === "viable"
          ? "Viable"
          : "Unviable"
        : govt > paf
        ? "Viable"
        : "Unviable";

      return {
        ...row,
        id: row.Id,
        contractNo: row.ContractNo || "",
        feasible: feasibleValue,
        asOfToday: "Active", // Text value for Excel export
        cmdName: row.CmdName || "",
        baseName: row.BaseName || "",
        className: row.ClassName || "",
        grpName: row.GrpName || row.GId || "",
        grpId: propertyGrouping?.GId ?? row.GId ?? row.GrpName ?? String(row.GrpId || ""),
        // Get from property grouping if available, otherwise from row
        totalArea: propertyGrouping?.Area ?? row.TotalArea ?? row.Area ?? 0,
        totalRate: propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        location: propertyGrouping?.Location ?? row.Location ?? "",
        unitName: propertyGrouping?.UoM ?? row.UnitName ?? row.UoM ?? "",
        uoM: propertyGrouping?.UoM ?? row.UoM ?? row.UnitName ?? "",
        tenantNo: row.TenantNo || "",
        businessName: row.BusinessName || "",
        natureOfBusiness: row.NatureOfBusiness || "",
        contractStartDate: row.ContractStartDate || "",
        contractEndDate: row.ContractEndDate || "",
        commercialOperationDate: row.CommercialOperationDate || "",
        initialRentPM: row.InitialRentPM || "",
        currentRentPA: row.CurrentRentPA ?? row.currentRentPA ?? "",
        initialRentPA: row.InitialRentPA || "",
        paymentTermMonths: row.PaymentTermMonths || "",
        term: row.Term || "",
        increaseRatePercent: row.IncreaseRatePercent || "",
        increaseIntervalMonths: row.IncreaseIntervalMonths || "",
        sdRateMonths: row.SDRateMonths || "",
        securityDepositAmount: row.SecurityDepositAmount || "",
        contractState:
          row.ContractState ?? row.contractState ?? row.ContractStatus ?? row.contractStatus ?? "",
        rentalValue: row.RentalValue ?? row.rentalValue,
        govtShare: row.GovtShare ?? row.govtShare,
        pafShare: row.PAFShare ?? row.pafShare,
        status: row.Status,
        remarks: row.Remarks || "",
        vaArea: row.VaArea || 0,
        groupRate:
          row.GroupRate !== undefined || row.groupRate !== undefined
            ? row.GroupRate ?? row.groupRate
            : propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        // Also set PascalCase versions for direct access
        CurrentRentPA: row.CurrentRentPA ?? row.currentRentPA ?? "",
        TotalArea: propertyGrouping?.Area ?? row.TotalArea ?? row.Area ?? 0,
        TotalRate: propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        GroupRate:
          row.GroupRate !== undefined || row.groupRate !== undefined
            ? row.GroupRate ?? row.groupRate
            : propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        Location: propertyGrouping?.Location ?? row.Location ?? "",
        UnitName: propertyGrouping?.UoM ?? row.UnitName ?? row.UoM ?? "",
        UoM: propertyGrouping?.UoM ?? row.UoM ?? "",
        VaArea: row.VaArea || 0,
      };
    });

    // Apply Command/Base/Class filters before grouping.
    const selectedCommandNames = new Set(
      (Array.isArray(commandFilterIds) ? commandFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );
    const selectedBaseNames = new Set(
      (Array.isArray(baseFilterIds) ? baseFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );
    const selectedClassNames = new Set(
      (Array.isArray(classFilterIds) ? classFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );

    const filteredRows = normalizedRows.filter((row) => {
      const cmdName = String(row.cmdName || "").toLowerCase();
      const baseName = String(row.baseName || "").toLowerCase();
      const className = String(row.className || "").toLowerCase();

      const matchesCommand = selectedCommandNames.size === 0 || selectedCommandNames.has(cmdName);
      const matchesBase = selectedBaseNames.size === 0 || selectedBaseNames.has(baseName);
      const matchesClass = selectedClassNames.size === 0 || selectedClassNames.has(className);

      // IMPORTANT:
      // "As of Date" is used only to refresh specific numeric columns via ActiveByAsOfDate,
      // not to filter/hide the master contracts list in the grid.
      const matchesAsOfDate = true;

      return matchesCommand && matchesBase && matchesClass && matchesAsOfDate;
    });

    // If no grouping selected, return plain rows.
    if (!Array.isArray(groupByColumns) || groupByColumns.length === 0) {
      return filteredRows.map((row) => ({
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
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleViewDetails(row)}
              title="View Details"
              sx={{ padding: "1px" }}
            >
              <Icon>visibility</Icon>
            </IconButton>
          </MDBox>
        ),
      }));
    }

    const groups = new Map();
    filteredRows.forEach((row) => {
      const groupValues = groupByColumns.map((col) => {
        const raw = row?.[col];
        if (raw === null || raw === undefined || raw === "") return "-";
        if (typeof raw === "boolean") return raw ? "Active" : "Inactive";
        return String(raw);
      });
      const groupKey = groupValues.join(" || ");
      const groupLabel = groupByColumns
        .map((col, idx) => {
          const colLabel = groupingColumnOptions.find((o) => o.value === col)?.label || col;
          return `${colLabel}: ${groupValues[idx]}`;
        })
        .join(" | ");

      if (!groups.has(groupKey)) {
        // Use property-group metadata when grouping includes grpId.
        const grpId = row.GrpId || row.GId || "";
        const propertyGrouping = allPropertyGroupings.find(
          (pg) => pg.GId === grpId || pg.Id === Number(grpId)
        );
        groups.set(groupKey, {
          grpId: grpId || "",
          grpName: propertyGrouping?.GId || row.GrpName || grpId || "",
          groupLabel,
          totalArea: propertyGrouping?.Area || 0,
          totalRate: propertyGrouping?.Rate ?? 0,
          location: propertyGrouping?.Location || "",
          rows: [],
        });
      }
      groups.get(groupKey).rows.push(row);
    });

    // Build result array
    const result = [];
    groups.forEach((group, groupKey) => {
      const isExpanded = expandedGroups.has(groupKey);
      const groupRows = group.rows;

      // Calculate sums for numeric fields
      const numericSums = {
        totalArea: 0,
        totalRate: 0,
        groupRate: 0,
        initialRentPM: 0,
        initialRentPA: 0,
        paymentTermMonths: 0,
        sdRateMonths: 0,
        increaseRatePercent: 0,
        increaseIntervalMonths: 0,
        securityDepositAmount: 0,
        rentalValue: 0,
        govtShare: 0,
        pafShare: 0,
        vaArea: 0,
        // PascalCase versions
        TotalArea: 0,
        TotalRate: 0,
        GroupRate: 0,
        InitialRentPM: 0,
        InitialRentPA: 0,
        PaymentTermMonths: 0,
        SDRateMonths: 0,
        IncreaseRatePercent: 0,
        IncreaseIntervalMonths: 0,
        SecurityDepositAmount: 0,
        RentalValue: 0,
        GovtShare: 0,
        PAFShare: 0,
        VaArea: 0,
      };

      groupRows.forEach((row) => {
        // Sum numeric fields
        numericSums.totalArea += Number(row.totalArea || row.TotalArea || 0);
        numericSums.totalRate += Number(row.totalRate || row.TotalRate || 0);
        numericSums.groupRate += Number(row.groupRate || row.GroupRate || 0);
        numericSums.initialRentPM += Number(row.initialRentPM || row.InitialRentPM || 0);
        numericSums.initialRentPA += Number(row.initialRentPA || row.InitialRentPA || 0);
        numericSums.paymentTermMonths += Number(
          row.paymentTermMonths || row.PaymentTermMonths || 0
        );
        numericSums.sdRateMonths += Number(row.sdRateMonths || row.SDRateMonths || 0);
        numericSums.increaseRatePercent += Number(
          row.increaseRatePercent || row.IncreaseRatePercent || 0
        );
        numericSums.increaseIntervalMonths += Number(
          row.increaseIntervalMonths || row.IncreaseIntervalMonths || 0
        );
        numericSums.securityDepositAmount += Number(
          row.securityDepositAmount || row.SecurityDepositAmount || 0
        );
        numericSums.rentalValue += Number(row.rentalValue || row.RentalValue || 0);
        numericSums.govtShare += Number(row.govtShare || row.GovtShare || 0);
        numericSums.pafShare += Number(row.pafShare || row.PAFShare || 0);
        numericSums.vaArea += Number(row.vaArea || row.VaArea || 0);

        // PascalCase versions
        numericSums.TotalArea += Number(row.TotalArea || row.totalArea || 0);
        numericSums.TotalRate += Number(row.TotalRate || row.totalRate || 0);
        numericSums.GroupRate += Number(row.GroupRate || row.groupRate || 0);
        numericSums.InitialRentPM += Number(row.InitialRentPM || row.initialRentPM || 0);
        numericSums.InitialRentPA += Number(row.InitialRentPA || row.initialRentPA || 0);
        numericSums.PaymentTermMonths += Number(
          row.PaymentTermMonths || row.paymentTermMonths || 0
        );
        numericSums.SDRateMonths += Number(row.SDRateMonths || row.sdRateMonths || 0);
        numericSums.IncreaseRatePercent += Number(
          row.IncreaseRatePercent || row.increaseRatePercent || 0
        );
        numericSums.IncreaseIntervalMonths += Number(
          row.IncreaseIntervalMonths || row.increaseIntervalMonths || 0
        );
        numericSums.SecurityDepositAmount += Number(
          row.SecurityDepositAmount || row.securityDepositAmount || 0
        );
        numericSums.RentalValue += Number(row.RentalValue || row.rentalValue || 0);
        numericSums.GovtShare += Number(row.GovtShare || row.govtShare || 0);
        numericSums.PAFShare += Number(row.PAFShare || row.pafShare || 0);
        numericSums.VaArea += Number(row.VaArea || row.vaArea || 0);
      });

      // Preserve values for grouped columns only
      const groupedColumnValues = {};
      groupByColumns.forEach((col) => {
        const firstRowValue = group.rows[0]?.[col];
        const firstRowValuePascal = group.rows[0]?.[col.charAt(0).toUpperCase() + col.slice(1)];
        groupedColumnValues[col] = firstRowValue !== undefined ? firstRowValue : "";
        // Also set PascalCase version if it exists
        if (firstRowValuePascal !== undefined) {
          groupedColumnValues[col.charAt(0).toUpperCase() + col.slice(1)] = firstRowValuePascal;
        }
      });

      // Create group row with sums for numeric fields and blank for date/text fields
      const groupRow = {
        // Start with first row to get structure
        ...group.rows[0],
        // Group label in Contract No (both PascalCase and camelCase)
        ContractNo: group.groupLabel || "-",
        contractNo: group.groupLabel || "-",
        GrpName: group.grpName,
        grpName: group.grpName,
        // Numeric fields - use sums
        ...numericSums,
        // Preserve grouped column values
        ...groupedColumnValues,
        // Date fields - set to blank
        contractStartDate: "",
        contractEndDate: "",
        commercialOperationDate: "",
        ContractStartDate: "",
        ContractEndDate: "",
        CommercialOperationDate: "",
        // Text fields - set to blank (except grouped columns which are already set above)
        tenantNo: "",
        businessName: "",
        natureOfBusiness: "",
        term: "",
        remarks: "",
        location: "",
        unitName: "",
        TenantNo: "",
        BusinessName: "",
        NatureOfBusiness: "",
        Term: "",
        Remarks: "",
        Location: "",
        UnitName: "",
        UoM: "",
        // Status and other non-numeric, non-date fields
        status: "",
        Status: "",
        feasible: "",
        Feasible: "",
        // Group metadata
        IsGroupRow: true,
        GroupKey: groupKey,
        GroupRows: group.rows,
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
      };

      result.push(groupRow);

      // Add expanded rows if group is expanded
      // Detail rows should show all original data (no aggregation)
      if (isExpanded) {
        group.rows.forEach((row) => {
          result.push({
            ...row,
            // Keep all original row data - no overrides needed
            IsExpandedRow: true,
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
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleViewDetails(row)}
                  title="View Details"
                  sx={{ padding: "1px" }}
                >
                  <Icon>visibility</Icon>
                </IconButton>
              </MDBox>
            ),
          });
        });
      }
    });

    return result;
  }, [
    rows,
    commandFilterIds,
    baseFilterIds,
    classFilterIds,
    allPropertyGroupings,
    expandedGroups,
    groupByColumns,
  ]);

  const computedRows = groupedData;

  // Filter columns to only show those with showInTable: true
  const visibleColumnsBase = columns.filter((col) => col.showInTable !== false);

  // Group calculated columns under a top header
  const calculatedColumnKeys = new Set([
    "contractState",
    "rentalValue",
    "govtShare",
    "pafShare",
    "groupRate",
    "percentRate",
  ]);
  const getColumnKey = (col) => col?.id || (typeof col?.accessor === "string" ? col.accessor : "");
  const calcIndexes = visibleColumnsBase
    .map((c, i) => ({ i, key: getColumnKey(c) }))
    .filter(({ key }) => calculatedColumnKeys.has(key))
    .map(({ i }) => i);

  const visibleColumns = (() => {
    if (calcIndexes.length === 0) return visibleColumnsBase;
    const first = Math.min(...calcIndexes);
    const last = Math.max(...calcIndexes);
    const before = visibleColumnsBase.slice(0, first);
    const calcChildren = visibleColumnsBase.slice(first, last + 1);
    const after = visibleColumnsBase.slice(last + 1);
    return [
      ...before,
      {
        Header: (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 1,
              py: 0.4,
              borderRadius: "8px",
              display: "inline-block",
              width: "100%",
              textAlign: "center",
            }}
          >
            Calculated Values
          </MDBox>
        ),
        align: "center",
        columns: calcChildren,
      },
      ...after,
    ];
  })();
  const allColumns = columns; // Keep all columns for details dialog and export

  const getUserId = () => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return "Unknown";
      const obj = JSON.parse(raw);
      return (
        obj?.username ||
        obj?.Username ||
        obj?.userName ||
        obj?.userId ||
        obj?.UserId ||
        obj?.unique_name ||
        obj?.UniqueName ||
        "Unknown"
      );
    } catch {
      return "Unknown";
    }
  };

  const generateContractDetailsPDF = (viewOnly = false) => {
    if (!selectedContractDetails) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 5;
    const boxGap = 4;
    const colWidth = (pageWidth - 2 * margin - 2 * boxGap) / 3;
    const boxPadding = 3;
    const boxMinHeight = 10;

    const addWatermarks = () => {
      const totalPages = doc.internal.getNumberOfPages();
      const userId = getUserId();
      const ip = getUserIPAddress() || "session";
      doc.setTextColor(180, 180, 180, 0.4);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      for (let p = 1; p <= totalPages; p += 1) {
        doc.setPage(p);
        doc.text(`IP: ${ip}`, pageWidth - margin - 30, pageHeight - 8);
        doc.text(`User: ${userId}`, margin, pageHeight - 8);
      }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
    };

    const getDisplayValue = (col, rowData) => {
      const accessor = col.accessor;
      const accessorKey = typeof accessor === "string" ? accessor : null;
      let value = accessorKey ? rowData[accessorKey] : undefined;
      if ((value === undefined || value === null) && accessorKey) {
        const pascal = accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1);
        value = rowData[pascal];
      }
      if ((value === undefined || value === null) && rowData.original && accessorKey) {
        value = rowData.original[accessorKey];
        if (value === undefined || value === null) {
          value = rowData.original[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
        }
      }
      if (accessor === "groupRate" || accessor === "totalRate") {
        value =
          rowData.GroupRate || rowData.groupRate || rowData.TotalRate || rowData.totalRate || value;
      }
      if (accessor === "grpId") return value || rowData?.GId || "-";
      if (accessor === "asOfToday") return "Active";
      if (accessor === "feasible") {
        const fromPayload = String(
          value ??
            rowData?.Viability ??
            rowData?.viability ??
            rowData?.Feasible ??
            rowData?.feasible ??
            ""
        )
          .trim()
          .toLowerCase();
        if (fromPayload === "viable" || fromPayload === "unviable")
          return fromPayload === "viable" ? "Viable" : "Unviable";
        const govt = Number(rowData?.GovtShare ?? 0);
        const paf = Number(rowData?.PAFShare ?? 0);
        return govt > paf ? "Viable" : "Unviable";
      }
      if (accessor === "totalArea") {
        const v = rowData?.TotalArea ?? value ?? 0;
        return v ? Number(v).toLocaleString() : "-";
      }
      if (accessor === "location") return rowData?.Location || value || "-";
      if (accessor === "uoM") return value || rowData?.UoM || rowData?.unitName || "-";
      if (accessor === "unitName") return value || rowData?.UnitName || rowData?.UoM || "-";
      if (accessor === "tenantNo") {
        const tn = value || rowData?.TenantNo || "";
        const tenant = tenants.find((t) => (t.tenantNo || t.TenantNo) === tn);
        if (tenant) {
          const parts = [tn];
          if (tenant.ownerName || tenant.OwnerName)
            parts.push(tenant.ownerName || tenant.OwnerName);
          if (tenant.address || tenant.Address) parts.push(tenant.address || tenant.Address);
          return parts.join(" - ");
        }
        return tn || "-";
      }
      const dateCols = [
        "contractStartDate",
        "contractEndDate",
        "commercialOperationDate",
        "risedate",
      ];
      if (dateCols.includes(accessor)) return formatDateDDMMMYYYY(value) || "-";
      const numCols = [
        "initialRentPM",
        "initialRentPA",
        "groupRate",
        "rentalValue",
        "vaArea",
        "govtShare",
        "pafShare",
        "securityDepositAmount",
      ];
      if (accessorKey && numCols.includes(accessorKey)) {
        const v = value ?? rowData?.[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
        return v !== undefined && v !== null && v !== "" ? Number(v).toLocaleString() : "-";
      }
      if (accessor === "increaseRatePercent") return value ? `${value}%` : "-";
      if (accessor === "status")
        return value === true || value === 1 || value === "Active" ? "Active" : "Inactive";
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    };

    const detailsColumns = allColumns.filter(
      (col) =>
        col.accessor !== "actions" &&
        col.accessor !== "attachments" &&
        typeof col.Header === "string"
    );

    const contractNo =
      selectedContractDetails.ContractNo || selectedContractDetails.contractNo || "-";

    if (viewOnly) {
      // Plain text only - no UI formatting (no boxes, no grid)
      let yPos = margin;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Contract Details", margin, yPos);
      yPos += lineHeight + 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract No: ${contractNo}`, margin, yPos);
      yPos += lineHeight + 4;

      detailsColumns.forEach((col) => {
        const displayVal = getDisplayValue(col, selectedContractDetails);
        const line = `${col.Header}: ${displayVal}`;
        const textLines = doc.splitTextToSize(line, pageWidth - 2 * margin);
        textLines.forEach((l) => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(l, margin, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      });

      if (contractDetailsRiseTerms.length > 0) {
        yPos += 4;
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Existing Rise Terms", margin, yPos);
        yPos += lineHeight + 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Sequence No    Months Interval    Rise Percent (%)", margin, yPos);
        yPos += lineHeight + 2;
        contractDetailsRiseTerms.forEach((term) => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(
            `${term.sequenceNo ?? ""}    ${term.monthsInterval ?? ""}    ${
              term.risePercent ?? ""
            }%`,
            margin,
            yPos
          );
          yPos += lineHeight;
        });
      }
    } else {
      // Formatted layout with boxes and grid (for download)
      let yPos = margin;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Contract Details", margin, yPos);
      yPos += lineHeight + 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract No: ${contractNo}`, margin, yPos);
      yPos += lineHeight + 6;

      const drawFieldBox = (x, y, label, value, align = "left") => {
        const innerWidth = colWidth - 2 * boxPadding;
        const valueLines = doc.splitTextToSize(String(value || "-"), innerWidth);
        const contentHeight = lineHeight + 2 + valueLines.length * lineHeight;
        const boxHeight = Math.max(boxMinHeight, contentHeight + 2 * boxPadding);

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.rect(x, y, colWidth, boxHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(label, x + boxPadding, y + boxPadding + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        let valY = y + boxPadding + 4 + lineHeight + 2;
        const tx =
          align === "right"
            ? x + colWidth - boxPadding
            : align === "center"
            ? x + colWidth / 2
            : x + boxPadding;
        valueLines.forEach((line) => {
          doc.text(line, tx, valY, { align });
          valY += lineHeight;
        });

        return boxHeight + boxGap;
      };

      let currentRowY = yPos;
      let maxRowHeight = 0;
      let colIndex = 0;

      detailsColumns.forEach((col) => {
        const x = margin + colIndex * (colWidth + boxGap);
        const displayVal = getDisplayValue(col, selectedContractDetails);
        const align = col.align === "right" ? "right" : col.align === "center" ? "center" : "left";
        const boxH = drawFieldBox(x, currentRowY, `${col.Header}:`, displayVal, align);

        maxRowHeight = Math.max(maxRowHeight, boxH);
        colIndex += 1;

        if (colIndex >= 3) {
          colIndex = 0;
          currentRowY += maxRowHeight;
          maxRowHeight = 0;

          if (currentRowY > pageHeight - 35) {
            doc.addPage();
            currentRowY = margin;
          }
        }
      });

      if (colIndex > 0) currentRowY += maxRowHeight;
      yPos = currentRowY + 4;

      if (contractDetailsRiseTerms.length > 0) {
        if (yPos + 40 > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Existing Rise Terms", margin, yPos);
        yPos += lineHeight + 6;

        const thHeight = 9;
        const tdHeight = 8;
        const seqWidth = 45;
        const monthsWidth = 50;
        const riseWidth = pageWidth - 2 * margin - seqWidth - monthsWidth;

        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, seqWidth, thHeight, "F");
        doc.rect(margin + seqWidth, yPos, monthsWidth, thHeight, "F");
        doc.rect(margin + seqWidth + monthsWidth, yPos, riseWidth, thHeight, "F");

        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPos, seqWidth + monthsWidth + riseWidth, thHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Sequence No", margin + 4, yPos + 6);
        doc.text("Months Interval", margin + seqWidth + 4, yPos + 6);
        doc.text("Rise Percent (%)", margin + seqWidth + monthsWidth + riseWidth - 4, yPos + 6, {
          align: "right",
        });
        yPos += thHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        contractDetailsRiseTerms.forEach((term) => {
          if (yPos + tdHeight > pageHeight - 25) {
            doc.addPage();
            yPos = margin;
          }
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.1);
          doc.rect(margin, yPos, seqWidth, tdHeight);
          doc.rect(margin + seqWidth, yPos, monthsWidth, tdHeight);
          doc.rect(margin + seqWidth + monthsWidth, yPos, riseWidth, tdHeight);

          doc.text(String(term.sequenceNo || ""), margin + 4, yPos + 5.5);
          doc.text(String(term.monthsInterval || ""), margin + seqWidth + 4, yPos + 5.5);
          doc.text(
            `${term.risePercent || ""}%`,
            margin + seqWidth + monthsWidth + riseWidth - 4,
            yPos + 5.5,
            { align: "right" }
          );
          yPos += tdHeight;
        });
      }
    }

    addWatermarks();
    const fileName = `Contract-Details-${contractNo.replace(/\s/g, "-")}.pdf`;
    if (viewOnly) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      doc.save(fileName);
    }
  };

  // Get column IDs that should be hidden initially (columns with showInTable: false)
  // React-table uses accessor as id if id is not provided
  const initialHiddenColumnIds = useMemo(() => {
    return columns
      .filter((col) => col.showInTable === false)
      .map((col) => {
        // React-table generates id from accessor if id is not provided
        // For columns with Cell functions, we need to ensure they have an id or accessor
        if (col.id) return col.id;
        if (col.accessor) return col.accessor;
        // Fallback: try to generate from Header (not ideal but works)
        if (typeof col.Header === "string") {
          return col.Header.toLowerCase().replace(/\s+/g, "");
        }
        return null;
      })
      .filter(Boolean);
  }, [columns]);

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
                  display: "flex",
                  flexDirection: "column",
                  height: "82vh",
                  minHeight: "680px",
                  overflow: "hidden",
                  "& .MuiTableContainer-root": {
                    flex: "1 1 0",
                    minHeight: 0,
                    overflow: "hidden",
                  },
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

                {/* Grouping + Command/Base/Class filter widgets */}
                <MDBox
                  px={2}
                  pb={2}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1.5}
                >
                  <MDBox
                    display="flex"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={1}
                    width={{ xs: "100%", md: "auto" }}
                  >
                    <MDBox width={{ xs: "80%", md: "150px" }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={[ALL_FILTER_VALUE, ...gridFilterOptions.commands]}
                        disableCloseOnSelect
                        value={commandFilterIds}
                        isOptionEqualToValue={(option, value) => option === value}
                        getOptionLabel={(option) =>
                          option === ALL_FILTER_VALUE ? "All" : String(option || "")
                        }
                        onChange={(event, newValue, reason, details) => {
                          if (details?.option === ALL_FILTER_VALUE) {
                            const allSelected =
                              gridFilterOptions.commands.length > 0 &&
                              commandFilterIds.length === gridFilterOptions.commands.length;
                            setCommandFilterIds(allSelected ? [] : [...gridFilterOptions.commands]);
                            return;
                          }
                          setCommandFilterIds(
                            (Array.isArray(newValue) ? newValue : []).filter(
                              (value) => value !== ALL_FILTER_VALUE
                            )
                          );
                        }}
                        renderOption={(props, option, { selected }) => {
                          const allSelected =
                            gridFilterOptions.commands.length > 0 &&
                            commandFilterIds.length === gridFilterOptions.commands.length;
                          const checked = option === ALL_FILTER_VALUE ? allSelected : selected;
                          return (
                            <li {...props}>
                              <Checkbox size="small" checked={checked} />
                              {option === ALL_FILTER_VALUE ? "All" : option}
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <MDInput
                            {...params}
                            label="RAC"
                            placeholder="Select RAC"
                            sx={groupByInputSx}
                          />
                        )}
                      />
                    </MDBox>
                    <MDBox width={{ xs: "80%", md: "150px" }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={[ALL_FILTER_VALUE, ...gridFilterOptions.bases]}
                        disableCloseOnSelect
                        value={baseFilterIds}
                        isOptionEqualToValue={(option, value) => option === value}
                        getOptionLabel={(option) =>
                          option === ALL_FILTER_VALUE ? "All" : String(option || "")
                        }
                        onChange={(event, newValue, reason, details) => {
                          if (details?.option === ALL_FILTER_VALUE) {
                            const allSelected =
                              gridFilterOptions.bases.length > 0 &&
                              baseFilterIds.length === gridFilterOptions.bases.length;
                            setBaseFilterIds(allSelected ? [] : [...gridFilterOptions.bases]);
                            return;
                          }
                          setBaseFilterIds(
                            (Array.isArray(newValue) ? newValue : []).filter(
                              (value) => value !== ALL_FILTER_VALUE
                            )
                          );
                        }}
                        renderOption={(props, option, { selected }) => {
                          const allSelected =
                            gridFilterOptions.bases.length > 0 &&
                            baseFilterIds.length === gridFilterOptions.bases.length;
                          const checked = option === ALL_FILTER_VALUE ? allSelected : selected;
                          return (
                            <li {...props}>
                              <Checkbox size="small" checked={checked} />
                              {option === ALL_FILTER_VALUE ? "All" : option}
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <MDInput
                            {...params}
                            label="Base"
                            placeholder="Select Base"
                            sx={groupByInputSx}
                          />
                        )}
                      />
                    </MDBox>
                    <MDBox width={{ xs: "80%", md: "150px" }}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={[ALL_FILTER_VALUE, ...gridFilterOptions.classes]}
                        disableCloseOnSelect
                        value={classFilterIds}
                        isOptionEqualToValue={(option, value) => option === value}
                        getOptionLabel={(option) =>
                          option === ALL_FILTER_VALUE ? "All" : String(option || "")
                        }
                        onChange={(event, newValue, reason, details) => {
                          if (details?.option === ALL_FILTER_VALUE) {
                            const allSelected =
                              gridFilterOptions.classes.length > 0 &&
                              classFilterIds.length === gridFilterOptions.classes.length;
                            setClassFilterIds(allSelected ? [] : [...gridFilterOptions.classes]);
                            return;
                          }
                          setClassFilterIds(
                            (Array.isArray(newValue) ? newValue : []).filter(
                              (value) => value !== ALL_FILTER_VALUE
                            )
                          );
                        }}
                        renderOption={(props, option, { selected }) => {
                          const allSelected =
                            gridFilterOptions.classes.length > 0 &&
                            classFilterIds.length === gridFilterOptions.classes.length;
                          const checked = option === ALL_FILTER_VALUE ? allSelected : selected;
                          return (
                            <li {...props}>
                              <Checkbox size="small" checked={checked} />
                              {option === ALL_FILTER_VALUE ? "All" : option}
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <MDInput
                            {...params}
                            label="Class"
                            placeholder="Select Class"
                            sx={groupByInputSx}
                          />
                        )}
                      />
                    </MDBox>
                    <MDBox width={{ xs: "80%", sm: "160px" }} sx={{ position: "relative" }}>
                      <input
                        type="date"
                        ref={asOfDateInputRef}
                        value={asOfDate || ""}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: "100%",
                          height: "100%",
                          top: 0,
                          left: 0,
                          cursor: "pointer",
                        }}
                        aria-hidden
                      />
                      <MDInput
                        label="As of Date"
                        value={toDisplayDate(asOfDate)}
                        onClick={() => openDatePicker(asOfDateInputRef)}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">
                              <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                            </InputAdornment>
                          ),
                        }}
                        fullWidth
                        sx={groupByInputSx}
                      />
                    </MDBox>
                    <MDBox
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mt: { xs: 1, sm: 0 },
                      }}
                    >
                      <IconButton
                        size="small"
                        color="info"
                        title="Refresh as-of values"
                        onClick={() => setAsOfRefreshToken((t) => t + 1)}
                      >
                        <Icon fontSize="small">send</Icon>
                      </IconButton>
                    </MDBox>
                  </MDBox>

                  <MDBox width={{ xs: "80%", md: "200px" }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={groupingColumnOptions}
                      disableCloseOnSelect
                      value={groupingColumnOptions.filter((opt) =>
                        groupByColumns.includes(opt.value)
                      )}
                      isOptionEqualToValue={(option, value) => option.value === value.value}
                      getOptionLabel={(option) => option.label}
                      onChange={(event, newValue) => {
                        setGroupByColumns((newValue || []).map((item) => item.value));
                      }}
                      renderInput={(params) => (
                        <MDInput
                          {...params}
                          label="Group By Columns"
                          placeholder="Select columns"
                          sx={groupByInputSx}
                        />
                      )}
                    />
                  </MDBox>
                </MDBox>

                <DataTable
                  table={{
                    columns: allColumns,
                    rows: computedRows,
                  }}
                  isSorted={false}
                  stickyToolbarAndHeader
                  stickyBodyMinHeight="unset"
                  contentFitTable
                  entriesPerPage={false}
                  pageSize={pageSize}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Contracts"
                  exportCellFormatter={contractsExportCellFormatter}
                  exportExcludeGroupParentsWhenExpanded
                  exportAllColumns
                  initialHiddenColumns={initialHiddenColumnIds}
                  onVisibleRowCountChange={setVisibleRowCount}
                />

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
                    <MDBox mb={{ xs: 1.5, sm: 0 }} display="flex" alignItems="center" gap={1}>
                      <FormControl size="xs" sx={{ minWidth: 12 }}>
                        <Select
                          value={String(pageSize)}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setPageSize(value);
                            setPageNumber(1);
                            fetchContracts(1, value);
                          }}
                          sx={{
                            "& .MuiSelect-select": { py: 0.5, fontSize: "0.8rem" },
                          }}
                        >
                          {[10, 20, 50, 100].map((size) => (
                            <MenuItem key={size} value={String(size)}>
                              {size}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <MDTypography variant="button" color="secondary" fontWeight="regular">
                        {visibleRowCount} of {totalCount} entries
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
        natures={natures}
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
                            disabled={isOperatorUser()}
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
          <MDButton onClick={handleConfirmDelete} color="error" disabled={isOperatorUser()}>
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* Contract Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDBox display="flex" justifyContent="space-between" alignItems="center">
            <MDBox>
              <MDTypography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                Contract Details
              </MDTypography>
              {selectedContractDetails && (
                <MDTypography variant="body2" color="text" fontWeight="medium">
                  Contract No:{" "}
                  {selectedContractDetails.ContractNo || selectedContractDetails.contractNo || "-"}
                </MDTypography>
              )}
            </MDBox>
            <IconButton onClick={() => setDetailsDialogOpen(false)} size="small">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: "70vh", overflowY: "auto" }}>
          {selectedContractDetails && (
            <MDBox>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {allColumns
                  .filter((col) => col.accessor !== "actions" && col.accessor !== "attachments")
                  .map((col) => {
                    const accessor = col.accessor;
                    const accessorKey = typeof accessor === "string" ? accessor : null;
                    // Access value from both camelCase and PascalCase
                    const rowData = selectedContractDetails;
                    let value = accessorKey ? rowData[accessorKey] : undefined;

                    // If not found in camelCase, try PascalCase
                    if ((value === undefined || value === null) && accessorKey) {
                      const pascalAccessor =
                        accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1);
                      value = rowData[pascalAccessor];
                    }

                    // Also try accessing from original if available
                    if (
                      (value === undefined || value === null) &&
                      rowData.original &&
                      accessorKey
                    ) {
                      value = rowData.original[accessorKey];
                      if (value === undefined || value === null) {
                        value =
                          rowData.original[
                            accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)
                          ];
                      }
                    }

                    // Special handling for Rate field - use GroupRate
                    if (accessor === "groupRate" || accessor === "totalRate") {
                      value =
                        rowData.GroupRate ||
                        rowData.groupRate ||
                        rowData.TotalRate ||
                        rowData.totalRate ||
                        value;
                    }

                    // Get the cell value using the column's Cell function if available
                    let displayValue = value;
                    if (col.Cell) {
                      try {
                        const cellProps = { value, row: { original: rowData.original || rowData } };
                        displayValue = col.Cell(cellProps);
                      } catch (e) {
                        displayValue = value || "-";
                      }
                    } else {
                      // Format based on type
                      if (typeof value === "number") {
                        displayValue = value.toLocaleString();
                      } else if (value === null || value === undefined || value === "") {
                        displayValue = "-";
                      } else {
                        displayValue = String(value);
                      }
                    }

                    return (
                      <Grid item xs={12} sm={6} md={4} key={accessor}>
                        <MDBox
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: "rgba(0, 0, 0, 0.02)",
                            border: "1px solid rgba(0, 0, 0, 0.05)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              backgroundColor: "rgba(0, 0, 0, 0.04)",
                              borderColor: "rgba(0, 0, 0, 0.1)",
                            },
                          }}
                        >
                          <MDTypography
                            variant="caption"
                            color="text"
                            fontWeight="bold"
                            sx={{ display: "block", mb: 0.5 }}
                          >
                            {col.Header}:
                          </MDTypography>
                          <MDTypography variant="body2" fontWeight="regular" color="text">
                            {displayValue}
                          </MDTypography>
                        </MDBox>
                      </Grid>
                    );
                  })}
              </Grid>

              {/* Rise Terms Section */}
              {loadingContractDetailsRiseTerms ? (
                <MDBox display="flex" justifyContent="center" py={3} mt={3}>
                  <CurrencyLoading size={40} />
                </MDBox>
              ) : contractDetailsRiseTerms.length > 0 ? (
                <MDBox mt={4}>
                  <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    Existing Rise Terms
                  </MDTypography>
                  <Card
                    sx={{
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      borderRadius: 2,
                    }}
                  >
                    <MDBox p={2}>
                      <TableContainer
                        sx={{
                          maxHeight: "400px",
                          overflowY: "auto",
                          // Firefox
                          scrollbarWidth: "thin",
                          scrollbarColor: "#888 transparent",
                          // Chrome/Safari/Edge
                          "&::-webkit-scrollbar": {
                            width: "8px",
                            height: "8px",
                          },
                          "&::-webkit-scrollbar-track": {
                            background: "transparent",
                            borderRadius: "4px",
                          },
                          "&::-webkit-scrollbar-thumb": {
                            backgroundColor: "#888",
                            borderRadius: "4px",
                            border: "2px solid transparent",
                            backgroundClip: "padding-box",
                            "&:hover": {
                              backgroundColor: "#555",
                            },
                          },
                        }}
                      >
                        <Table size="small" sx={{ borderCollapse: "collapse" }}>
                          <thead
                            style={{
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                              backgroundColor: "#f5f5f5",
                            }}
                          >
                            <TableRow>
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px 12px 16px",
                                  paddingRight: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Sequence No
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px 12px 4px",
                                  paddingLeft: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Months Interval
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Rise Percent (%)
                              </TableCell>
                            </TableRow>
                          </thead>
                          <TableBody>
                            {contractDetailsRiseTerms.map((term, index) => (
                              <TableRow
                                key={term.id || index}
                                sx={{
                                  "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.02)" },
                                  "&:last-child td": {
                                    borderBottom: "none",
                                  },
                                }}
                              >
                                <TableCell
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px 8px 16px",
                                    paddingRight: "4px",
                                  }}
                                >
                                  <MDTypography variant="body2" fontWeight="medium">
                                    {term.sequenceNo}
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px 8px 4px",
                                    paddingLeft: "4px",
                                  }}
                                >
                                  <MDTypography variant="body2">{term.monthsInterval}</MDTypography>
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px",
                                  }}
                                >
                                  <MDTypography variant="body2" fontWeight="bold" color="primary">
                                    {term.risePercent}%
                                  </MDTypography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </MDBox>
                  </Card>
                </MDBox>
              ) : null}
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            onClick={() => generateContractDetailsPDF(true)}
            color="info"
            variant="gradient"
            disabled={!selectedContractDetails}
          >
            <Icon>picture_as_pdf</Icon>&nbsp;View as PDF
          </MDButton>
          <MDButton onClick={() => setDetailsDialogOpen(false)} color="secondary">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
