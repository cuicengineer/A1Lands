import React, { useState, useEffect, useMemo, useRef } from "react";
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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import api from "services/api.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import contractApi from "services/api.contract.service";
import revenueRatesApi from "services/api.revenuerates.service";
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
  allPropertyGroupings = [],
  onGroupIdBlur,
}) {
  const isEditMode = Boolean(initialData);
  const normalizePropertyIds = (data) => {
    if (!data) return [];

    // API returns PropertyGroupLinkings (PascalCase)
    const fromLinkings = data.PropertyGroupLinkings;
    if (Array.isArray(fromLinkings) && fromLinkings.length) {
      const ids = fromLinkings
        .map((x) => {
          if (x === null || x === undefined) return null;
          if (typeof x === "number" || typeof x === "string") return Number(x);
          // API returns PropertyId or Id (PascalCase)
          const candidate = x.PropertyId || x.Id;
          return candidate ? Number(candidate) : null;
        })
        .filter((n) => n !== null && Number.isFinite(n));
      return Array.from(new Set(ids));
    }

    // Check for property array/string (API may return Property)
    const raw = data.Property;
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
    rate: 0,
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
  const [notGroupedProperties, setNotGroupedProperties] = useState([]);
  const [propertyRevenueRates, setPropertyRevenueRates] = useState(new Map()); // Cache revenue rates by property ID
  const [linkedPropertiesForEdit, setLinkedPropertiesForEdit] = useState([]); // Linked properties for edit mode

  const formatApplicableDate = (rawDate) => {
    if (!rawDate) return "-";
    const raw = String(rawDate).trim();
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split("-");
      return `${d}-${months[Number(m) - 1] || m}-${y}`;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
      const [d, m, y] = datePart.split("-");
      return `${d}-${months[Number(m) - 1] || m}-${y}`;
    }
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) {
      const m = months[parsed.getMonth()];
      return `${String(parsed.getDate()).padStart(2, "0")}-${m}-${parsed.getFullYear()}`;
    }
    return raw;
  };

  const getPropertyLabel = (propertyId) => {
    const idKey = String(propertyId);
    const fromLinked = linkedPropertyNameById[idKey];
    if (fromLinked) return String(fromLinked);

    // Check in selectableRentalProperties first (for NotGroupedProperties)
    const fromSelectable = selectableRentalProperties.find((p) => {
      const pid = getPropertyId(p);
      return pid !== null && Number(pid) === Number(propertyId);
    });
    if (fromSelectable) {
      return String(fromSelectable.PropertyName || fromSelectable.PId || propertyId);
    }

    // Fallback to rentalProperties
    const prop = rentalProperties.find((p) => {
      const pid = getPropertyId(p);
      return pid !== null && Number(pid) === Number(propertyId);
    });
    return String(prop?.PropertyName || prop?.PId || propertyId);
  };
  const getPropertyId = (property) => {
    if (!property) return null;
    // API returns Id or PropertyId (PascalCase)
    const id = property.Id || property.PropertyId || property.PropId;
    return id ? Number(id) : null;
  };
  const getPropertyById = (propertyId) => {
    const targetId = Number(propertyId);
    if (!Number.isFinite(targetId)) return null;
    const fromSelectable = (selectableRentalProperties || []).find(
      (p) => getPropertyId(p) === targetId
    );
    if (fromSelectable) return fromSelectable;
    return (rentalProperties || []).find((p) => getPropertyId(p) === targetId) || null;
  };
  // Fetch revenue rate for a property (latest applicable date, not after today)
  const fetchRevenueRateForProperty = async (propertyId) => {
    if (!propertyId) return null;

    // Check cache first
    if (propertyRevenueRates.has(Number(propertyId))) {
      return propertyRevenueRates.get(Number(propertyId));
    }

    try {
      // Fetch all revenue rates and filter by property ID
      const response = await revenueRatesApi.getAll(1, 1000); // Get large page to find all rates
      const rates = response?.pagination
        ? response.data || []
        : Array.isArray(response)
        ? response
        : [];

      // Filter by property ID (API returns PascalCase)
      const propertyRates = rates
        .filter((rate) => {
          const ratePropertyId = rate.PropertyId || rate.propertyId;
          return ratePropertyId && Number(ratePropertyId) === Number(propertyId);
        })
        .filter((rate) => {
          // Only active and not deleted rates
          const isActive = rate.Status === true || rate.Status === 1;
          const isNotDeleted = rate.IsDeleted === false || rate.IsDeleted === 0;
          return isActive && isNotDeleted;
        });

      if (propertyRates.length === 0) return null;

      // Get today's date for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter rates where applicable date is not after today, then sort by applicable date (latest first)
      const validRates = propertyRates
        .filter((rate) => {
          const applicableDate = rate.ApplicableDate || rate.applicableDate;
          if (!applicableDate) return false;
          const date = new Date(applicableDate);
          date.setHours(0, 0, 0, 0);
          return date <= today; // Only dates not after today
        })
        .sort((a, b) => {
          const dateA = new Date(a.ApplicableDate || a.applicableDate || 0);
          const dateB = new Date(b.ApplicableDate || b.applicableDate || 0);
          return dateB - dateA; // Latest first
        });

      if (validRates.length === 0) return null;

      // Get the latest applicable rate (closest date not after today)
      const latestRate = validRates[0];
      const rateValue = latestRate.Rate || latestRate.rate || 0;

      // Cache the result
      const cachedValue = {
        rate: Number(rateValue) || 0,
        applicableDate: latestRate.ApplicableDate || latestRate.applicableDate,
      };
      setPropertyRevenueRates((prev) => new Map(prev).set(Number(propertyId), cachedValue));

      return cachedValue;
    } catch (error) {
      console.error(`Error fetching revenue rate for property ${propertyId}:`, error);
      return null;
    }
  };

  // Get property rate (synchronous - uses cache if available)
  const getPropertyRateNumber = (property, propertyId = null) => {
    if (!property) return 0;

    // API returns PascalCase - check Rate first
    const rateValue = property.Rate || property.rate || 0;
    const parsed = Number(rateValue);
    const propertyRate = Number.isFinite(parsed) ? parsed : 0;

    // If property rate is 0, check revenue rates cache
    if (propertyRate === 0) {
      const propId = propertyId || getPropertyId(property);
      if (propId) {
        const cachedRate = propertyRevenueRates.get(Number(propId));
        if (cachedRate && cachedRate.rate > 0) {
          return cachedRate.rate;
        }
      }
    }

    return propertyRate;
  };

  // Get property rate with revenue rate fetch (async)
  const getPropertyRateWithRevenueRate = async (property, propertyId = null) => {
    if (!property) return { rate: 0, hasRevenueRate: false };

    const propId = propertyId || getPropertyId(property);
    // API returns PascalCase - check Rate first
    const rateValue = property.Rate || property.rate || 0;
    const parsed = Number(rateValue);
    const propertyRate = Number.isFinite(parsed) ? parsed : 0;

    // If property rate is 0, fetch from revenue rates
    if (propertyRate === 0 && propId) {
      const revenueRate = await fetchRevenueRateForProperty(propId);
      if (revenueRate && revenueRate.rate > 0) {
        return {
          rate: revenueRate.rate,
          hasRevenueRate: true,
          applicableDate: revenueRate.applicableDate,
        };
      }
      return { rate: 0, hasRevenueRate: false };
    }

    return { rate: propertyRate, hasRevenueRate: false };
  };

  useEffect(() => {
    let cancelled = false;

    const fetchNotGroupedProperties = async () => {
      if (!open || isEditMode) {
        setNotGroupedProperties([]);
        return;
      }
      if (!form.cmdid || !form.baseid) {
        setNotGroupedProperties([]);
        return;
      }

      try {
        const response = await propertyGroupingApi.notGroupedProperties(
          Number(form.cmdid),
          Number(form.baseid)
        );
        // Handle both paginated and direct array responses
        let options = [];
        if (response && response.pagination) {
          options = Array.isArray(response.data)
            ? response.data
            : response.data
            ? [response.data]
            : [];
        } else if (Array.isArray(response)) {
          options = response;
        } else if (response) {
          options = [response];
        }

        // API returns PascalCase: Id, PropertyId, PropertyName, PId
        const normalizedOptions = options
          .map((opt) => ({
            ...opt,
            id: opt.Id || opt.PropertyId || null,
            PId: opt.PId || opt.PropertyName || "",
            PropertyName: opt.PropertyName || opt.PId || "",
          }))
          .filter((opt) => opt.id !== null);

        if (!cancelled) setNotGroupedProperties(normalizedOptions);
      } catch (error) {
        console.error("Error fetching not-grouped properties:", error);
        if (!cancelled) setNotGroupedProperties([]);
      }
    };

    fetchNotGroupedProperties();
    return () => {
      cancelled = true;
    };
  }, [open, isEditMode, form.cmdid, form.baseid]);

  const selectableRentalProperties = useMemo(() => {
    if (isEditMode) {
      // In edit mode, combine rentalProperties with linked properties
      // Start with rentalProperties - API returns PascalCase
      const allProperties = (rentalProperties || [])
        .map((p) => ({
          ...p,
          Id: p.Id || p.PropertyId || null,
          PId: p.PId || p.PropertyName || "",
          PropertyName: p.PropertyName || p.PId || "",
        }))
        .filter((p) => p.Id !== null);

      // Add linked properties if they're not already in rentalProperties
      if (linkedPropertiesForEdit && linkedPropertiesForEdit.length > 0) {
        linkedPropertiesForEdit.forEach((linkedProp) => {
          // Get property ID from linked property (API returns PascalCase)
          const linkedPropId =
            linkedProp.PropertyId ||
            linkedProp.PropId ||
            (typeof linkedProp.PropertyId === "object"
              ? linkedProp.PropertyId.Id || linkedProp.PropertyId.PropertyId
              : null);

          if (linkedPropId) {
            // Check if this property is already in allProperties
            const exists = allProperties.some((p) => {
              const pid = p.Id || p.PropertyId;
              return pid && Number(pid) === Number(linkedPropId);
            });

            if (!exists) {
              // Add linked property to the list
              const propertyName = linkedProp.PropertyName || linkedProp.PropId || "";
              allProperties.push({
                Id: Number(linkedPropId),
                PropertyId: Number(linkedPropId),
                PId: propertyName,
                PropertyName: propertyName,
                // Include other properties from linkedProp if available
                Area: linkedProp.Area || linkedProp.area || 0,
                Rate: linkedProp.Rate || linkedProp.rate || 0,
                Location: linkedProp.Location || linkedProp.location || "",
                UoM: linkedProp.UoM || linkedProp.uoM || "",
              });
            }
          }
        });
      }

      return allProperties;
    }
    // In create mode, use notGroupedProperties (already normalized)
    return notGroupedProperties || [];
  }, [isEditMode, rentalProperties, notGroupedProperties, linkedPropertiesForEdit]);

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
      // API returns PascalCase
      const cmdId = initialData.CmdId || "";
      const baseId = initialData.BaseId || "";
      const classId = initialData.ClassId || "";
      const gId = initialData.GId || "";
      const rate = initialData.Rate || 0;
      const uoM = initialData.UoM || "";
      const location = initialData.Location || "";
      const area = initialData.Area || "";
      const remarks = initialData.Remarks || "";
      const status = initialData.Status !== undefined ? initialData.Status : true;
      const isDeleted = initialData.IsDeleted !== undefined ? initialData.IsDeleted : false;

      const newForm = {
        cmdid: cmdId ? Number(cmdId) : "",
        baseid: baseId ? Number(baseId) : "",
        classid: classId ? Number(classId) : "",
        property: normalizedPropertyIds,
        gId: gId,
        rate: Number(rate) || 0,
        uoM: uoM,
        location: location,
        area: area ? (typeof area === "number" ? area : Number(area) || "") : "",
        remarks: remarks,
        status: status === true || status === false ? Boolean(status) : true,
        isDeleted: isDeleted === true || isDeleted === false ? Boolean(isDeleted) : false,
      };
      let currentFilteredBases = [];
      if (newForm.cmdid && allBases.length > 0) {
        currentFilteredBases = allBases.filter(
          (base) => Number(base.cmd) === Number(newForm.cmdid)
        );
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
        rate: 0,
        uoM: "",
        location: "",
        area: "",
        remarks: "",

        status: true,
        isDeleted: false,
      });
      setLinkedPropertyNameById({});
      setLinkedPropertiesForEdit([]);
    }
  }, [initialData, allBases]);

  // Fetch linked properties when in edit mode
  useEffect(() => {
    let cancelled = false;

    const fetchLinkedProperties = async () => {
      if (!open || !isEditMode || !initialData || !initialData.Id) {
        setLinkedPropertiesForEdit([]);
        return;
      }

      try {
        const response = await propertyGroupingApi.getByGroup(initialData.Id, 1, 1000);
        const linkedProps = response?.pagination
          ? response.data || []
          : Array.isArray(response)
          ? response
          : [];

        if (!cancelled) {
          setLinkedPropertiesForEdit(linkedProps);
        }
      } catch (error) {
        console.error("Error fetching linked properties for edit:", error);
        if (!cancelled) {
          setLinkedPropertiesForEdit([]);
        }
      }
    };

    fetchLinkedProperties();
    return () => {
      cancelled = true;
    };
  }, [open, isEditMode, initialData]);

  // Auto-calculate derived read-only values when properties change
  useEffect(() => {
    // Skip auto-calculation if we're in edit mode and have initialData with existing values
    // This prevents overwriting correct values when properties can't be found
    if (isEditMode && initialData && (initialData.area || initialData.uoM || initialData.rate)) {
      // Only auto-calculate if we can find all properties and the calculation would be meaningful
      const allPropertiesFound = form.property.every((propertyId) => {
        const property = getPropertyById(propertyId);
        return property !== null;
      });

      // If we can't find all properties, preserve the initialData values
      if (!allPropertiesFound && form.property.length > 0) {
        // Don't overwrite - keep the values from initialData
        return;
      }
    }

    if (form.property && form.property.length > 0) {
      // Calculate total area from selected properties (API returns PascalCase)
      const totalArea = form.property.reduce((sum, propertyId) => {
        const property = getPropertyById(propertyId);
        const area = property?.Area || property?.area || 0;
        return sum + Number(area || 0);
      }, 0);

      // Calculate total rate from selected properties - use cached revenue rates if property rate is 0
      const totalRate = form.property.reduce((sum, propertyId) => {
        const property = getPropertyById(propertyId);
        return sum + getPropertyRateNumber(property, propertyId);
      }, 0);

      // Get unique UoMs from selected properties (API returns PascalCase)
      const uniqueUoMs = Array.from(
        new Set(
          form.property
            .map((propertyId) => {
              const property = getPropertyById(propertyId);
              return property?.UoM || property?.uoM || "";
            })
            .filter((value) => String(value || "").trim().length > 0)
        )
      );
      const uoMText = uniqueUoMs.join(", ");

      // Calculate location from selected properties (concatenate unique locations)
      const locations = form.property
        .map((propertyId) => {
          const property = getPropertyById(propertyId);
          return property?.Location || property?.location || "";
        })
        .filter((loc) => String(loc || "").trim().length > 0);
      const locationText = Array.from(new Set(locations)).join(", ");

      // Only update if the calculated values are different from current values
      // In edit mode, only update if we have meaningful calculated values
      const shouldUpdate =
        form.area !== totalArea ||
        (form.uoM || "") !== uoMText ||
        Number(form.rate || 0) !== totalRate ||
        (form.location || "") !== locationText;

      // In edit mode, only update if we have calculated values (not all zeros/empty)
      const hasCalculatedValues =
        totalArea > 0 || totalRate > 0 || uoMText.length > 0 || locationText.length > 0;

      if (shouldUpdate && (!isEditMode || hasCalculatedValues)) {
        setForm((prevForm) => ({
          ...prevForm,
          rate: totalRate,
          area: totalArea,
          uoM: uoMText,
          location: locationText,
        }));
      }
    } else if (
      form.property &&
      form.property.length === 0 &&
      !isEditMode && // Only clear in create mode
      (form.area !== "" || form.uoM !== "" || form.location !== "" || Number(form.rate || 0) !== 0)
    ) {
      setForm((prevForm) => ({
        ...prevForm,
        rate: 0,
        area: "",
        uoM: "",
        location: "",
      }));
    }
  }, [form.property, rentalProperties, selectableRentalProperties, isEditMode, initialData]);

  // Fetch revenue rates for properties with rate 0 when properties are selected
  useEffect(() => {
    if (!form.property || form.property.length === 0) return;

    let cancelled = false;

    const fetchRatesForProperties = async () => {
      const fetchPromises = form.property.map(async (propertyId) => {
        if (cancelled) return;
        const property = getPropertyById(propertyId);
        if (!property) return;

        const propertyRate = property.Rate || property.rate || 0;
        // Only fetch if property rate is 0 and not already cached
        if (Number(propertyRate) === 0) {
          // Check cache first
          if (!propertyRevenueRates.has(Number(propertyId))) {
            await fetchRevenueRateForProperty(propertyId);
          }
        }
      });

      await Promise.all(fetchPromises);

      if (cancelled) return;

      // Recalculate rate after fetching revenue rates
      const totalRate = form.property.reduce((sum, propertyId) => {
        const property = getPropertyById(propertyId);
        return sum + getPropertyRateNumber(property, propertyId);
      }, 0);

      // Update form if rate changed
      if (Number(form.rate || 0) !== totalRate) {
        setForm((prevForm) => ({
          ...prevForm,
          rate: totalRate,
        }));
      }
    };

    fetchRatesForProperties();

    return () => {
      cancelled = true;
    };
  }, [form.property]);

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
      { key: "remarks", label: "Remarks" },
    ];
    required.forEach(({ key, label }) => {
      if (isEmpty(form?.[key])) next[key] = `${label} is required`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Validate for duplicate active Group ID
  const validateDuplicateGroupId = () => {
    // Only check if status is active (1/true) and not deleted (0/false)
    const isActive = form.status === true || form.status === 1;
    const isNotDeleted = form.isDeleted === false || form.isDeleted === 0;

    if (!isActive || !isNotDeleted) {
      return true; // No validation needed for inactive or deleted records
    }

    if (!form.gId || !form.classid || !form.baseid) {
      return true; // Skip validation if required fields are missing
    }

    // Check for duplicate active Group ID with same class and base
    const duplicate = allPropertyGroupings.find((pg) => {
      const sameGroupId = (pg.gId || "").toString().trim() === form.gId.toString().trim();
      const sameClass = Number(pg.classId || pg.classid) === Number(form.classid);
      const sameBase = Number(pg.baseId || pg.baseid) === Number(form.baseid);
      const isActiveRecord = pg.status === true || pg.status === 1;
      const isNotDeletedRecord = pg.isDeleted === false || pg.isDeleted === 0;
      const isDifferentRecord = initialData ? Number(pg.id) !== Number(initialData.id) : true;

      return (
        sameGroupId &&
        sameClass &&
        sameBase &&
        isActiveRecord &&
        isNotDeletedRecord &&
        isDifferentRecord
      );
    });

    if (duplicate) {
      setErrors((prev) => ({
        ...prev,
        gId: "Same group ID already active for this class and base",
      }));
      return false;
    }

    return true;
  };

  // Validate: All selected properties must have the same UoM
  const validateSameUoM = () => {
    const selected = Array.isArray(form.property) ? form.property : [];
    if (selected.length === 0) return true;

    // Get UoM from all selected properties (API returns PascalCase)
    const uoMs = selected
      .map((id) => {
        const property = getPropertyById(id);
        return property?.UoM || property?.uoM || "";
      })
      .filter((uom) => String(uom || "").trim().length > 0);

    if (uoMs.length === 0) return true; // No UoM data, skip validation

    const uniqueUoMs = Array.from(new Set(uoMs));
    if (uniqueUoMs.length > 1) {
      setErrors((prev) => ({
        ...prev,
        property: "Properties with different UoM cannot be grouped together",
      }));
      alert(
        `Cannot group properties with different UoM values.\n\n` +
          `Selected properties have UoM: ${uniqueUoMs.join(", ")}\n\n` +
          `All properties in a group must have the same UoM.`
      );
      return false;
    }

    return true;
  };

  // Validate: each property can belong to only 1 active group at a time
  // On creation, block saving if any selected property is already in another active group.
  const validatePropertiesNotInOtherActiveGroup = () => {
    const toBool = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
    // Only enforce when creating an ACTIVE, not-deleted group
    const isNewActive = toBool(form.status);
    const isNewNotDeleted = !toBool(form.isDeleted);
    if (!isNewActive || !isNewNotDeleted) return true;

    const selected = Array.isArray(form.property) ? form.property : [];
    if (selected.length === 0) return true;

    // Build a lookup of propertyId -> active group gId (first match wins)
    const propertyToActiveGroupId = new Map();
    allPropertyGroupings.forEach((pg) => {
      if (!pg) return;
      const isActiveRecord = toBool(pg?.status ?? pg?.Status);
      const isNotDeletedRecord = !toBool(pg?.isDeleted ?? pg?.IsDeleted);
      if (!isActiveRecord || !isNotDeletedRecord) return;

      // If editing in the future, skip self (currently creation-only validation)
      if (initialData && Number(pg.id) === Number(initialData.id)) return;

      const ids = normalizePropertyIds(pg);
      ids.forEach((id) => {
        if (!propertyToActiveGroupId.has(Number(id))) {
          propertyToActiveGroupId.set(Number(id), (pg.gId || pg.GId || "").toString().trim());
        }
      });
    });

    const conflicts = selected
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .map((id) => ({
        id,
        label: getPropertyLabel(id),
        groupId: propertyToActiveGroupId.get(id),
      }))
      .filter((x) => x.groupId);

    if (conflicts.length === 0) return true;

    // User alert + block save
    const lines = conflicts.map((c) => `- ${c.label} (Active Group ID: ${c.groupId})`);
    alert(
      `Some selected properties are already part of an active group.\n` +
        `Each property can be part of 1 active group at any time.\n\n` +
        `${lines.join("\n")}\n\n` +
        `Please remove them from this grouping or deactivate the existing group.`
    );
    setErrors((prev) => ({
      ...prev,
      property: "Some selected properties are already part of an active group",
    }));
    return false;
  };

  const handleSave = () => {
    // Apply mandatory check only for "Add New"
    if (!isEditMode) {
      const ok = validateAddNew();
      if (!ok) return;
    }

    // Validate: All selected properties must have the same UoM
    const isUoMValid = validateSameUoM();
    if (!isUoMValid) return;

    // Validate for duplicate active Group ID
    const isDuplicateValid = validateDuplicateGroupId();
    if (!isDuplicateValid) return;

    // Validate: property can belong to only 1 active group at a time (creation-time)
    if (!isEditMode) {
      const ok = validatePropertiesNotInOtherActiveGroup();
      if (!ok) return;
    }

    onSubmit(form);
  };

  // Handle Group ID blur (when user finishes entering) - delegates to parent
  const handleGroupIdBlur = () => {
    if (form.gId && form.gId.trim() && onGroupIdBlur) {
      onGroupIdBlur(form.gId.trim());
    }
  };

  const handlePropertyChange = async (event) => {
    const {
      target: { value },
    } = event;
    const selectedPropertiesRaw = typeof value === "string" ? value.split(",") : value;
    const selectedProperties = (selectedPropertiesRaw || [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    // Validate rates for newly added properties
    const prevIds = Array.isArray(form.property) ? form.property : [];
    const addedIds = selectedProperties.filter((id) => !prevIds.includes(id));

    if (addedIds.length > 0) {
      // Check rates for newly added properties
      for (const id of addedIds) {
        const property = getPropertyById(id);
        if (!property) continue;

        // Check property rate first
        const propertyRate = property.Rate || property.rate || 0;

        if (Number(propertyRate) === 0) {
          // Property rate is 0, fetch from revenue rates
          const rateInfo = await getPropertyRateWithRevenueRate(property, id);

          if (rateInfo.rate === 0) {
            // No rate found in property or revenue rates
            const propertyLabel = getPropertyLabel(id);
            alert(
              `Property "${propertyLabel}" has no revenue rate configured.\n\n` +
                `Please add a revenue rate for this property first before grouping it.`
            );
            setErrors((prev) => ({
              ...prev,
              property: `Property "${propertyLabel}" has no revenue rate. Please add revenue rate first.`,
            }));
            // Revert to previous selection
            return;
          }
        }
      }
    }

    setForm((prevForm) => {
      // Allow removals freely; enforce unique labels only when adding new selection(s)
      const isRemoval = selectedProperties.length < prevIds.length;
      if (!isRemoval) {
        const prevLabelSet = new Set(prevIds.map(getPropertyLabel));

        // Detect newly-added ids and block duplicates by label
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

        // Validate UoM: All selected properties must have the same UoM
        if (prevIds.length > 0 || addedIds.length > 0) {
          // Get UoM from existing properties
          const existingUoMs = prevIds
            .map((id) => {
              const property = getPropertyById(id);
              return property?.UoM || property?.uoM || "";
            })
            .filter((uom) => String(uom || "").trim().length > 0);

          // Get UoM from newly added properties
          const newUoMs = addedIds
            .map((id) => {
              const property = getPropertyById(id);
              return property?.UoM || property?.uoM || "";
            })
            .filter((uom) => String(uom || "").trim().length > 0);

          // Combine all UoMs from selected properties
          const allUoMs = [...existingUoMs, ...newUoMs];
          const uniqueUoMs = Array.from(new Set(allUoMs));

          // If there are multiple different UoMs, block selection
          if (uniqueUoMs.length > 1) {
            const conflictingProperty = addedIds.find((id) => {
              const property = getPropertyById(id);
              const uom = property?.UoM || property?.uoM || "";
              return uom && existingUoMs.length > 0 && !existingUoMs.includes(uom);
            });

            if (conflictingProperty) {
              const propertyLabel = getPropertyLabel(conflictingProperty);
              const property = getPropertyById(conflictingProperty);
              const propertyUoM = property?.UoM || property?.uoM || "Unknown";
              const existingUoM = existingUoMs[0] || "Unknown";

              alert(
                `Cannot group properties with different UoM values.\n\n` +
                  `"${propertyLabel}" has UoM: ${propertyUoM}\n` +
                  `Existing properties have UoM: ${existingUoM}\n\n` +
                  `All properties in a group must have the same UoM.`
              );
              setErrors((prev) => ({
                ...prev,
                property: "Properties with different UoM cannot be grouped together",
              }));
              return prevForm;
            }
          }
        }
      }

      // Calculate total area from selected properties (API returns PascalCase)
      const totalArea = selectedProperties.reduce((sum, propertyId) => {
        const property = getPropertyById(propertyId);
        const area = property?.Area || property?.area || 0;
        return sum + Number(area || 0);
      }, 0);
      // Calculate total rate - use cached revenue rates if property rate is 0
      const totalRate = selectedProperties.reduce((sum, propertyId) => {
        const property = getPropertyById(propertyId);
        return sum + getPropertyRateNumber(property, propertyId);
      }, 0);
      // Get UoM from selected properties (API returns PascalCase)
      const uniqueUoMs = Array.from(
        new Set(
          selectedProperties
            .map((propertyId) => {
              const property = getPropertyById(propertyId);
              return property?.UoM || property?.uoM || "";
            })
            .filter((value) => String(value || "").trim().length > 0)
        )
      );
      const uoMText = uniqueUoMs.length > 0 ? uniqueUoMs[0] : ""; // Should only be one UoM after validation

      // Auto-populate location from selected properties (comma-separated) (API returns PascalCase)
      const locations = selectedProperties
        .map((propertyId) => {
          const property = getPropertyById(propertyId);
          return property?.Location || property?.location || "";
        })
        .filter((loc) => loc && loc.trim().length > 0); // Remove empty locations
      const autoLocation = locations.join(", ");

      return {
        ...prevForm,
        property: selectedProperties,
        rate: totalRate,
        area: totalArea,
        uoM: uoMText,
        location: autoLocation, // Auto-update location based on selected properties
      };
    });
    if (errors?.property) setErrors((prev) => ({ ...prev, property: undefined }));
  };

  const handleDeleteProperty = (propertyToDelete) => () => {
    const updatedProperties = form.property.filter((property) => property !== propertyToDelete);

    // Recalculate total area after removing a property (API returns PascalCase)
    const totalArea = updatedProperties.reduce((sum, propertyId) => {
      const property = getPropertyById(propertyId);
      const area = property?.Area || property?.area || 0;
      return sum + Number(area || 0);
    }, 0);
    const totalRate = updatedProperties.reduce((sum, propertyId) => {
      const property = getPropertyById(propertyId);
      return sum + getPropertyRateNumber(property);
    }, 0);
    // Get UoM from remaining properties (API returns PascalCase)
    const uniqueUoMs = Array.from(
      new Set(
        updatedProperties
          .map((propertyId) => {
            const property = getPropertyById(propertyId);
            return property?.UoM || property?.uoM || "";
          })
          .filter((value) => String(value || "").trim().length > 0)
      )
    );
    const uoMText = uniqueUoMs.length > 0 ? uniqueUoMs[0] : ""; // Should only be one UoM

    setForm((prevForm) => ({
      ...prevForm,
      property: updatedProperties,
      rate: totalRate,
      area: totalArea,
      uoM: uoMText,
    }));
  };

  return (
    <>
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
                  RAC
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
            <Grid item xs={12} sm={6}>
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
                        // Use getPropertyLabel which handles normalization and all data sources
                        const label = getPropertyLabel(value);
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
                  {selectableRentalProperties.map((option) => {
                    const optionId = getPropertyId(option);
                    if (optionId === null) return null; // Skip invalid options

                    const optionLabel = getPropertyLabel(optionId);
                    const selectedIds = form.property || [];
                    const selectedLabelSet = new Set(selectedIds.map(getPropertyLabel));
                    const isSelected = selectedIds.some((id) => Number(id) === Number(optionId));
                    const isDuplicateName = selectedLabelSet.has(optionLabel) && !isSelected;

                    // Check if this property has a different UoM than already selected properties
                    let isDifferentUoM = false;
                    if (selectedIds.length > 0 && !isSelected) {
                      const optionProperty = getPropertyById(optionId);
                      const optionUoM = optionProperty?.UoM || optionProperty?.uoM || "";

                      // Get UoM from first selected property
                      const firstSelectedId = selectedIds[0];
                      const firstProperty = getPropertyById(firstSelectedId);
                      const firstUoM = firstProperty?.UoM || firstProperty?.uoM || "";

                      // If both have UoM and they're different, disable this option
                      if (optionUoM && firstUoM && optionUoM !== firstUoM) {
                        isDifferentUoM = true;
                      }
                    }

                    return (
                      <MenuItem
                        key={optionId}
                        value={optionId}
                        disabled={isDuplicateName || isDifferentUoM}
                        sx={{ fontSize: "1rem", padding: "8px 14px" }}
                        title={
                          isDifferentUoM
                            ? "Properties with different UoM cannot be grouped together"
                            : ""
                        }
                      >
                        {optionLabel}
                      </MenuItem>
                    );
                  })}
                </Select>
                {!isEditMode && errors.property && (
                  <FormHelperText>{errors.property}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Group ID */}
            <Grid item xs={12} sm={6}>
              <MDInput
                label="Group ID"
                type="text"
                value={form.gId}
                onChange={(e) => handleChange("gId", e.target.value)}
                onBlur={handleGroupIdBlur}
                size="small"
                fullWidth
                required={!isEditMode}
                error={!isEditMode && Boolean(errors.gId)}
                helperText={!isEditMode ? errors.gId : ""}
                sx={{
                  "& .MuiInputBase-input": { fontSize: "1rem" },
                  "& .MuiInputLabel-root": { fontSize: "1rem" },
                }}
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <MDInput
                label="Address"
                type="text"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
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

            {/* Total Area, UoM, Rate - same row */}
            <Grid item xs={12} sm={4}>
              <MDInput
                label="Total Area"
                type="number"
                value={form.area}
                onChange={(e) => handleChange("area", e.target.value)}
                size="small"
                InputProps={{ readOnly: true }}
                fullWidth
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

            <Grid item xs={12} sm={4}>
              <MDInput
                label="UoM"
                type="text"
                value={form.uoM || ""}
                size="small"
                InputProps={{ readOnly: true }}
                fullWidth
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

            <Grid item xs={12} sm={4}>
              <MDInput
                label="Rate"
                type="number"
                value={form.rate || 0}
                size="small"
                InputProps={{ readOnly: true }}
                fullWidth
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
            <Grid item xs={12} sm={8}>
              <MDInput
                label="Remarks"
                type="text"
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                fullWidth
                multiline
                rows={3}
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
            <Grid item xs={12} sm={4}>
              <FormControl
                size="small"
                fullWidth
                sx={{
                  minWidth: "90px",
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

            {/* Current Revenue Rate - display only, when properties selected */}
            {!isEditMode && form.property && form.property.length > 0 && (
              <Grid item xs={12}>
                <MDBox
                  sx={{
                    p: 2,
                    backgroundColor: "#fafafa",
                    borderRadius: 1,
                    border: "1px solid #e8e8e8",
                  }}
                >
                  <MDTypography
                    variant="caption"
                    fontWeight="medium"
                    color="text"
                    sx={{ display: "block", mb: 1 }}
                  >
                    Current Revenue Rate (per property)
                  </MDTypography>
                  <MDBox component="ul" sx={{ m: 0, pl: 2.5, fontSize: "0.9rem" }}>
                    {form.property.map((propertyId) => {
                      const property = getPropertyById(propertyId);
                      if (!property) return null;
                      const propertyName = getPropertyLabel(propertyId);
                      const displayRate = getPropertyRateNumber(property, propertyId);
                      const rawDate =
                        property?.ApplicableDate ??
                        property?.applicableDate ??
                        propertyRevenueRates.get(Number(propertyId))?.applicableDate ??
                        propertyRevenueRates.get(Number(propertyId))?.ApplicableDate ??
                        "";
                      const appliedDateStr = formatApplicableDate(rawDate);
                      return (
                        <MDBox component="li" key={propertyId} sx={{ mb: 0.5 }}>
                          {propertyName}:{" "}
                          {displayRate.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {" · Applied: "}
                          {appliedDateStr}
                        </MDBox>
                      );
                    })}
                  </MDBox>
                </MDBox>
              </Grid>
            )}
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

      {/* Active Contracts Dialog - Moved to parent component */}
    </>
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
  allPropertyGroupings: PropTypes.array,
  onGroupIdBlur: PropTypes.func,
};

export { PropertyGroupingForm };

export default function PropertyGrouping() {
  const [openForm, setOpenForm] = useState(false);
  const [currentPropertyGrouping, setCurrentPropertyGrouping] = useState(null);
  const [rows, setRows] = useState([]);
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [linkedPropertiesDialogOpen, setLinkedPropertiesDialogOpen] = useState(false);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [currentViewingGroupId, setCurrentViewingGroupId] = useState("");
  const [loadingLinkedProperties, setLoadingLinkedProperties] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState("");
  const [currentGroupRecordId, setCurrentGroupRecordId] = useState(null);
  const [removingPropertyId, setRemovingPropertyId] = useState(null);
  const [linkingSelection, setLinkingSelection] = useState([]);
  const [savingLinkings, setSavingLinkings] = useState(false);
  const [availablePropertiesForLinking, setAvailablePropertiesForLinking] = useState([]);
  const [currentGroupCmdId, setCurrentGroupCmdId] = useState(null);
  const [currentGroupBaseId, setCurrentGroupBaseId] = useState(null);

  // Pagination state for main table
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Pagination state for linked properties dialog
  const [linkedPropertiesPageNumber, setLinkedPropertiesPageNumber] = useState(1);
  const [linkedPropertiesPageSize, setLinkedPropertiesPageSize] = useState(100);
  const [linkedPropertiesTotalCount, setLinkedPropertiesTotalCount] = useState(0);

  const allPropertyGroupingsFetchedForOpenRef = useRef(false);

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

  // Fetch all property groupings for duplicate validation (single API call)
  const fetchAllPropertyGroupings = async () => {
    try {
      const response = await propertyGroupingApi.list(1, 10000);
      if (response && response.pagination) {
        const data = response.data || [];
        const totalCount = Number(response.pagination.totalCount || 0);
        // If backend capped our request and there are more records, fall back to multi-page fetch
        if (totalCount > 0 && data.length < totalCount) {
          const serverPageSize = Number(response.pagination.pageSize || data.length || 1);
          const totalPages = serverPageSize > 0 ? Math.ceil(totalCount / serverPageSize) : 1;
          if (totalPages > 1) {
            const pagePromises = [];
            for (let page = 2; page <= totalPages; page += 1) {
              pagePromises.push(propertyGroupingApi.list(page, serverPageSize));
            }
            const rest = await Promise.allSettled(pagePromises);
            const allData = [...data];
            rest.forEach((r) => {
              if (r.status === "fulfilled" && r.value?.data) allData.push(...r.value.data);
            });
            setAllPropertyGroupings(allData);
            return;
          }
        }
        setAllPropertyGroupings(data);
      } else {
        setAllPropertyGroupings(Array.isArray(response) ? response : []);
      }
    } catch (error) {
      console.error("Error fetching all property groupings:", error);
      setAllPropertyGroupings([]);
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
    // Only fetch rentalProperties for Edit mode; Add New uses notGroupedProperties (fetched by form when RAC/Base selected)
    if (currentPropertyGrouping && rentalProperties.length === 0) fetchRentalProperties();
  }, [openForm, currentPropertyGrouping, commands.length, classes.length, rentalProperties.length]);

  // Fetch all property groupings for duplicate validation - separate effect, run only once per form open (guards against Strict Mode double-invoke)
  useEffect(() => {
    if (!openForm) {
      allPropertyGroupingsFetchedForOpenRef.current = false;
      return;
    }
    if (allPropertyGroupingsFetchedForOpenRef.current) return;
    allPropertyGroupingsFetchedForOpenRef.current = true;
    fetchAllPropertyGroupings();
  }, [openForm]);

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

    // Get the property grouping to extract cmdId and baseId
    const propertyGrouping = rows.find((row) => {
      const rowId = row.Id || row.id;
      return rowId && Number(rowId) === Number(recordId);
    });

    if (propertyGrouping) {
      const cmdId = propertyGrouping.CmdId || propertyGrouping.cmdId;
      const baseId = propertyGrouping.BaseId || propertyGrouping.baseId;
      setCurrentGroupCmdId(cmdId ? Number(cmdId) : null);
      setCurrentGroupBaseId(baseId ? Number(baseId) : null);

      // Fetch not-grouped properties for this cmd and base
      if (cmdId && baseId) {
        try {
          const notGroupedResponse = await propertyGroupingApi.notGroupedProperties(
            Number(cmdId),
            Number(baseId)
          );
          let options = [];
          if (notGroupedResponse && notGroupedResponse.pagination) {
            options = Array.isArray(notGroupedResponse.data)
              ? notGroupedResponse.data
              : notGroupedResponse.data
              ? [notGroupedResponse.data]
              : [];
          } else if (Array.isArray(notGroupedResponse)) {
            options = notGroupedResponse;
          } else if (notGroupedResponse) {
            options = [notGroupedResponse];
          }

          // Normalize options (API returns PascalCase)
          const normalizedOptions = options
            .map((opt) => ({
              ...opt,
              Id: opt.Id || opt.PropertyId || null,
              PropertyId: opt.Id || opt.PropertyId || null,
              PId: opt.PId || opt.PropertyName || "",
              PropertyName: opt.PropertyName || opt.PId || "",
            }))
            .filter((opt) => opt.Id !== null);

          setAvailablePropertiesForLinking(normalizedOptions);
        } catch (error) {
          console.error("Error fetching not-grouped properties for linking:", error);
          setAvailablePropertiesForLinking([]);
        }
      } else {
        setAvailablePropertiesForLinking([]);
      }
    } else {
      setCurrentGroupCmdId(null);
      setCurrentGroupBaseId(null);
      setAvailablePropertiesForLinking([]);
    }

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
    setAvailablePropertiesForLinking([]);
    setCurrentGroupCmdId(null);
    setCurrentGroupBaseId(null);
  };

  const getRentalPropertyLabel = (rp) => String(rp?.PropertyName || rp?.PId || "");

  const getLinkedPropertyLabel = (item) => {
    if (!item) return "";
    // API returns PropertyName (PascalCase)
    if (item.PropertyName) return String(item.PropertyName);
    if (item.PropId) return String(item.PropId);
    if (typeof item.Property === "object") {
      return String(item.Property.PropertyName || item.Property.PId || "");
    }
    return "";
  };

  const getPropertyLabelById = (propertyId) => {
    const rp = rentalProperties.find((p) => {
      const pid = p.Id || p.PropertyId;
      return pid && Number(pid) === Number(propertyId);
    });
    return rp ? getRentalPropertyLabel(rp) : `Property ID: ${propertyId}`;
  };

  const getLinkedPropertyId = (item) => {
    if (!item) return null;
    // API returns PropertyId or PropId (PascalCase)
    const id = item.PropertyId || item.PropId;
    if (typeof id === "object") {
      return Number(id.Id || id.PropertyId || null);
    }
    return id ? Number(id) : null;
  };

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

    // Check for active contracts before allowing addition
    if (currentGroupId) {
      try {
        const contractsResponse = await contractApi.searchByGrpName(currentGroupId.trim());
        const contracts =
          contractsResponse?.data || (Array.isArray(contractsResponse) ? contractsResponse : []);

        // Filter for active contracts (status = true)
        const activeContracts = contracts.filter((contract) => {
          const isActive = contract.Status === true || contract.Status === 1;
          const isNotDeleted = contract.IsDeleted === false || contract.IsDeleted === 0;
          return isActive && isNotDeleted;
        });

        if (activeContracts.length > 0) {
          alert(
            `Cannot add properties to group "${currentGroupId}".\n\n` +
              `There are ${activeContracts.length} active contract(s) associated with this group.\n` +
              `Please deactivate or delete the active contracts first before modifying linked properties.`
          );
          return;
        }
      } catch (error) {
        console.error("Error checking for active contracts:", error);
        // Continue with addition if contract check fails (don't block user)
      }
    }

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

    // Check for active contracts before allowing removal
    if (currentGroupId) {
      try {
        const contractsResponse = await contractApi.searchByGrpName(currentGroupId.trim());
        const contracts =
          contractsResponse?.data || (Array.isArray(contractsResponse) ? contractsResponse : []);

        // Filter for active contracts (status = true)
        const activeContracts = contracts.filter((contract) => {
          const isActive = contract.Status === true || contract.Status === 1;
          const isNotDeleted = contract.IsDeleted === false || contract.IsDeleted === 0;
          return isActive && isNotDeleted;
        });

        if (activeContracts.length > 0) {
          alert(
            `Cannot remove property from group "${currentGroupId}".\n\n` +
              `There are ${activeContracts.length} active contract(s) associated with this group.\n` +
              `Please deactivate or delete the active contracts first before removing properties.`
          );
          return;
        }
      } catch (error) {
        console.error("Error checking for active contracts:", error);
        // Continue with removal if contract check fails (don't block user)
      }
    }

    setRemovingPropertyId(linkingId);
    try {
      // Find the property being removed to get its details
      const linkingToRemove = linkedProperties.find((lp) => {
        const lpId = lp.Id || lp.id;
        return lpId && Number(lpId) === Number(linkingId);
      });

      if (!linkingToRemove) {
        alert("Property linking not found.");
        return;
      }

      // Get property ID from the linking (API returns PascalCase)
      const propertyId =
        linkingToRemove.PropertyId ||
        linkingToRemove.PropId ||
        (typeof linkingToRemove.PropertyId === "object"
          ? linkingToRemove.PropertyId.Id || linkingToRemove.PropertyId.PropertyId
          : null);

      if (!propertyId) {
        alert("Property ID not found in linking.");
        return;
      }

      // Get property details from rentalProperties
      const propertyToRemove = rentalProperties.find((rp) => {
        const pid = rp.Id || rp.PropertyId;
        return pid && Number(pid) === Number(propertyId);
      });

      if (!propertyToRemove) {
        // If property not found in rentalProperties, still proceed with removal
        // but skip area/rate/location updates
        await propertyGroupingApi.removePropertyFromGroup(linkingId);
      } else {
        // Get property details (API returns PascalCase)
        const propertyArea = Number(propertyToRemove.Area || propertyToRemove.area || 0);
        const propertyLocation = String(
          propertyToRemove.Location || propertyToRemove.location || ""
        ).trim();

        // Get property rate - check if it's 0, then try revenue rates
        let propertyRate = Number(propertyToRemove.Rate || propertyToRemove.rate || 0);
        if (propertyRate === 0) {
          // Fetch revenue rate for this property
          try {
            const response = await revenueRatesApi.getAll(1, 1000);
            const rates = response?.pagination
              ? response.data || []
              : Array.isArray(response)
              ? response
              : [];

            // Filter by property ID and get latest applicable date (not after today)
            const propertyRates = rates
              .filter((rate) => {
                const ratePropertyId = rate.PropertyId || rate.propertyId;
                return ratePropertyId && Number(ratePropertyId) === Number(propertyId);
              })
              .filter((rate) => {
                const isActive = rate.Status === true || rate.Status === 1;
                const isNotDeleted = rate.IsDeleted === false || rate.IsDeleted === 0;
                return isActive && isNotDeleted;
              });

            if (propertyRates.length > 0) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const validRates = propertyRates
                .filter((rate) => {
                  const applicableDate = rate.ApplicableDate || rate.applicableDate;
                  if (!applicableDate) return false;
                  const date = new Date(applicableDate);
                  date.setHours(0, 0, 0, 0);
                  return date <= today;
                })
                .sort((a, b) => {
                  const dateA = new Date(a.ApplicableDate || a.applicableDate || 0);
                  const dateB = new Date(b.ApplicableDate || b.applicableDate || 0);
                  return dateB - dateA;
                });

              if (validRates.length > 0) {
                propertyRate = Number(validRates[0].Rate || validRates[0].rate || 0);
              }
            }
          } catch (error) {
            console.error("Error fetching revenue rate for property:", error);
            // Continue with propertyRate = 0
          }
        }

        // Get current property grouping to update
        const currentGrouping = rows.find((pg) => {
          const pgId = pg.Id || pg.id;
          return pgId && Number(pgId) === Number(currentGroupRecordId);
        });

        if (currentGrouping) {
          // Calculate new values
          const currentArea = Number(currentGrouping.Area || currentGrouping.area || 0);
          const currentRate = Number(currentGrouping.Rate || currentGrouping.rate || 0);
          const currentLocation = String(
            currentGrouping.Location || currentGrouping.location || ""
          ).trim();

          const newArea = Math.max(0, currentArea - propertyArea);
          const newRate = Math.max(0, currentRate - propertyRate);

          // Remove property location from group location
          let newLocation = currentLocation;
          if (propertyLocation && currentLocation) {
            // Split location by comma, remove the property's location, rejoin
            const locations = currentLocation
              .split(",")
              .map((loc) => loc.trim())
              .filter((loc) => loc && loc.toLowerCase() !== propertyLocation.toLowerCase());
            newLocation = locations.join(", ");
          }

          // Update property grouping
          const updateData = {
            cmdId: Number(currentGrouping.CmdId || currentGrouping.cmdId),
            baseId: Number(currentGrouping.BaseId || currentGrouping.baseId),
            classId: Number(currentGrouping.ClassId || currentGrouping.classId),
            gId: currentGrouping.GId || currentGrouping.gId || "",
            rate: newRate,
            area: newArea,
            location: newLocation,
            uoM: currentGrouping.UoM || currentGrouping.uoM || "",
            remarks: currentGrouping.Remarks || currentGrouping.remarks || "",
            status: currentGrouping.Status !== undefined ? currentGrouping.Status : true,
            property: currentGrouping.Property || "", // Keep existing property field
            PropertyGroupLinkings: [], // Will be updated by backend after removal
          };

          // Remove the property from group and update grouping in parallel
          await Promise.all([
            propertyGroupingApi.removePropertyFromGroup(linkingId),
            propertyGroupingApi.update(currentGroupRecordId, updateData),
          ]);
        } else {
          // If grouping not found, just remove the property
          await propertyGroupingApi.removePropertyFromGroup(linkingId);
        }
      }

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
      alert("Property removed successfully and grouping updated!");
    } catch (error) {
      console.error("Error removing property:", error);
      alert("Failed to remove property. Please try again.");
    } finally {
      setRemovingPropertyId(null);
    }
  };

  const getPropertyName = (propertyId) => {
    if (!propertyId) return "Unknown Property";
    // Handle if propertyId is already an object - API returns PascalCase
    if (typeof propertyId === "object") {
      return String(propertyId.PropertyName || propertyId.PId || "Unknown Property");
    }
    // Look up property by ID - API returns Id or PropertyId (PascalCase)
    const property = rentalProperties.find((p) => {
      const pid = p.Id || p.PropertyId;
      return pid && Number(pid) === Number(propertyId);
    });
    return property
      ? String(property.PropertyName || property.PId || `Property ID: ${propertyId}`)
      : `Property ID: ${propertyId}`;
  };

  const columns = [
    {
      Header: "Actions",
      accessor: "actions",
      align: "center",
      width: "10%",
    },
    { Header: "ID", accessor: "id", align: "left", width: "5%" },
    { Header: "RAC", accessor: "cmdName", align: "left", width: "12%" },
    { Header: "Base", accessor: "baseName", align: "left", width: "12%" },
    { Header: "Class", accessor: "className", align: "left", width: "12%" },
    { Header: "Group ID", accessor: "gId", align: "left", width: "8%" },
    { Header: "Rate", accessor: "rate", align: "right", width: "7%" },
    { Header: "Area", accessor: "area", align: "right", width: "7%" },
    { Header: "UoM", accessor: "uoM", align: "left", width: "7%" },
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
      Header: "Link Prop",
      accessor: "linkedProperties", // Accessor matches field in computedRows
      align: "center",
      width: "10%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        // Use id from computedRows (lowercase) or fallback to original Id (PascalCase)
        const recordId = rowData.id || rowData.Id;
        const grpId = rowData.gId || rowData.GId || "";
        // Always show the icon - it was displaying before
        return (
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleViewLinkedProperties(recordId, grpId)}
            title="View linked properties"
            disabled={!recordId}
          >
            <Icon>visibility</Icon>
          </IconButton>
        );
      },
    },
    {
      Header: "Active Contracts",
      accessor: "activeContracts",
      align: "center",
      width: "10%",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const groupId = rowData.gId || rowData.GId || "";
        return groupId ? (
          <IconButton
            size="small"
            color="info"
            onClick={() => handleViewActiveContractsForGroup(groupId)}
            disabled={loadingContracts}
            title="View active contracts for this group"
          >
            <Icon>description</Icon>
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

  // View Active Contracts for a Group
  const handleViewActiveContractsForGroup = async (groupId) => {
    if (!groupId || !groupId.trim()) {
      setActiveContracts([]);
      setCurrentViewingGroupId("");
      return;
    }

    setCurrentViewingGroupId(groupId.trim());
    setLoadingContracts(true);
    try {
      // Call API endpoint to search contracts by group name
      const response = await contractApi.searchByGrpName(groupId.trim());

      // Handle different response structures
      let contracts = [];
      if (Array.isArray(response)) {
        contracts = response;
      } else if (response && Array.isArray(response.data)) {
        contracts = response.data;
      } else if (response && response.data) {
        // If data is a single object, wrap it in an array
        contracts = Array.isArray(response.data) ? response.data : [response.data];
      } else if (response && typeof response === "object") {
        // If response is a single object, wrap it in an array
        contracts = [response];
      }

      // Ensure contracts is an array
      if (!Array.isArray(contracts)) {
        contracts = [];
      }

      // Filter for active contracts (status = true, not deleted)
      // Use both PascalCase and camelCase for field access
      const activeContractsList = contracts.filter((contract) => {
        if (!contract || typeof contract !== "object") return false;
        // Check status - use both PascalCase and camelCase
        const status = contract.Status !== undefined ? contract.Status : contract.status;
        const isDeleted =
          contract.IsDeleted !== undefined ? contract.IsDeleted : contract.isDeleted;

        // If status is explicitly false or 0, exclude it
        // If status is true or 1, include it
        // If status is undefined/null, include it (assume active)
        const isActive = status === undefined || status === null || status === true || status === 1;

        // If IsDeleted is explicitly true or 1, exclude it
        // If IsDeleted is false, 0, undefined, or null, include it
        const isNotDeleted =
          isDeleted === undefined || isDeleted === null || isDeleted === false || isDeleted === 0;

        return isActive && isNotDeleted;
      });

      setActiveContracts(activeContractsList);
      setContractsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching contracts by Group ID:", error);
      setActiveContracts([]);
      alert("Error fetching contracts. Please try again.");
    } finally {
      setLoadingContracts(false);
    }
  };

  // Check if group has active contracts
  const checkActiveContractsForGroup = async (groupId) => {
    if (!groupId || !groupId.trim()) {
      return { hasActiveContracts: false, count: 0 };
    }

    try {
      const response = await contractApi.searchByGrpName(groupId.trim());
      const contracts = response?.data || (Array.isArray(response) ? response : []);

      // Filter for active contracts (status = true, not deleted)
      const activeContractsList = contracts.filter((contract) => {
        const isActive = contract.Status === true || contract.Status === 1;
        const isNotDeleted = contract.IsDeleted === false || contract.IsDeleted === 0;
        return isActive && isNotDeleted;
      });

      return {
        hasActiveContracts: activeContractsList.length > 0,
        count: activeContractsList.length,
      };
    } catch (error) {
      console.error("Error checking active contracts for group:", error);
      return { hasActiveContracts: false, count: 0 };
    }
  };

  const handleEditPropertyGrouping = async (id) => {
    const propertyGrouping = rows.find((row) => Number(row?.id ?? row?.Id) === Number(id));
    if (!propertyGrouping) {
      console.error("Property grouping not found for id:", id);
      return;
    }

    // Check for active contracts before allowing edit
    const grpId = propertyGrouping.GId || propertyGrouping.gId || "";
    if (grpId) {
      const contractCheck = await checkActiveContractsForGroup(grpId);
      if (contractCheck.hasActiveContracts) {
        alert(
          `Cannot edit property group "${grpId}".\n\n` +
            `There are ${contractCheck.count} active contract(s) associated with this group.\n` +
            `Please deactivate or delete the active contracts first before editing this group.`
        );
        return;
      }
    }
    const normalizePropertyIds = (data) => {
      if (!data) return [];

      // API returns PropertyGroupLinkings (PascalCase)
      const fromLinkings = data.PropertyGroupLinkings;
      if (Array.isArray(fromLinkings) && fromLinkings.length) {
        const ids = fromLinkings
          .map((x) => {
            if (x === null || x === undefined) return null;
            if (typeof x === "number" || typeof x === "string") return Number(x);
            // API returns PropertyId or Id (PascalCase)
            const candidate = x.PropertyId || x.Id;
            return candidate ? Number(candidate) : null;
          })
          .filter((n) => n !== null && Number.isFinite(n));
        return Array.from(new Set(ids));
      }

      // Check for property array/string (API may return Property)
      const raw = data.Property;
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

    const mapToFormInitialData = (pg) => {
      if (!pg) return null;
      // API returns PascalCase
      const cmdId = pg.CmdId || "";
      const baseId = pg.BaseId || "";
      const classId = pg.ClassId || "";
      const gId = pg.GId || "";
      const uoM = pg.UoM || "";
      const location = pg.Location || "";
      const remarks = pg.Remarks || "";
      const area = pg.Area || "";
      const rate = pg.Rate || 0;
      const status = pg.Status !== undefined ? pg.Status : true;
      const isDeleted = pg.IsDeleted !== undefined ? pg.IsDeleted : false;

      return {
        ...pg,
        id: pg.Id,
        cmdId: cmdId,
        baseId: baseId,
        classId: classId,
        cmdid: cmdId ? Number(cmdId) : "",
        baseid: baseId ? Number(baseId) : "",
        classid: classId ? Number(classId) : "",
        gId: gId,
        uoM: uoM,
        location: location,
        remarks: remarks,
        property: normalizePropertyIds(pg),
        area: area ? (typeof area === "number" ? area : Number(area) || "") : "",
        rate: Number(rate) || 0,
        status: Boolean(status),
        isDeleted: Boolean(isDeleted),
      };
    };

    // Use only the row data - no additional API calls needed
    // The row data already contains all necessary information
    const mappedData = mapToFormInitialData(propertyGrouping);

    // Extract linked property names from the row data if available
    // Try to build nameById from available property data
    const propertyIds = normalizePropertyIds(propertyGrouping);
    const nameById = {};
    if (propertyIds.length > 0) {
      // Try to get property names from rentalProperties if available
      propertyIds.forEach((propId) => {
        const prop = rentalProperties.find((p) => {
          const pid = p.id ?? p.Id ?? p.propertyId ?? p.PropertyId;
          return Number(pid) === Number(propId);
        });
        if (prop) {
          const name = prop.pId ?? prop.PId ?? prop.pid ?? prop.name ?? prop.Name ?? String(propId);
          nameById[String(propId)] = String(name);
        }
      });
    }

    setCurrentPropertyGrouping({
      ...mappedData,
      linkedPropertyNameById: nameById,
    });
    setOpenForm(true);
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

    // Find the property grouping to get its Group ID
    const propertyGrouping = rows.find(
      (row) => Number(row?.id ?? row?.Id) === Number(recordToDelete)
    );
    if (propertyGrouping) {
      const grpId = propertyGrouping.GId || propertyGrouping.gId || "";
      if (grpId) {
        // Check for active contracts before allowing delete
        const contractCheck = await checkActiveContractsForGroup(grpId);
        if (contractCheck.hasActiveContracts) {
          alert(
            `Cannot delete property group "${grpId}".\n\n` +
              `There are ${contractCheck.count} active contract(s) associated with this group.\n` +
              `Please deactivate or delete the active contracts first before deleting this group.`
          );
          setDeleteDialogOpen(false);
          setRecordToDelete(null);
          return;
        }
      }
    }

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
      // Check for duplicate group ID before saving (only for create, not update)
      if (!currentPropertyGrouping) {
        // Check if group ID already exists for the same class and base
        const duplicateGroup = allPropertyGroupings.find((pg) => {
          const sameGroupId =
            (pg.GId || pg.gId || "").toString().trim() === (data.gId || "").toString().trim();
          const sameClass = Number(pg.ClassId || pg.classId) === Number(data.classid);
          const sameBase = Number(pg.BaseId || pg.baseId) === Number(data.baseid);
          const isActive = pg.Status === true || pg.Status === 1;
          const isNotDeleted = pg.IsDeleted === false || pg.IsDeleted === 0;

          return sameGroupId && sameClass && sameBase && isActive && isNotDeleted;
        });

        if (duplicateGroup) {
          alert(
            `Group ID "${data.gId}" already exists for this class and base.\n\n` +
              `Please use a different Group ID or deactivate the existing group first.`
          );
          return;
        }
      }

      // Convert property array to list of IDs for PropertyGroupLinkings
      const propertyGroupLinkings = Array.isArray(data.property)
        ? data.property.map((propId) => Number(propId))
        : [];

      const formattedData = {
        cmdId: Number(data.cmdid),
        baseId: Number(data.baseid),
        classId: Number(data.classid),
        gId: data.gId || "",
        rate: Number(data.rate) || 0,
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
        await propertyGroupingApi.update(currentPropertyGrouping.Id, formattedData);
      } else {
        await propertyGroupingApi.create(formattedData);
      }
      fetchPropertyGroupings(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving property grouping:", error);
      alert("Failed to save property grouping. Please try again.");
    }
  };

  const computedRows = rows.map((row) => {
    // API returns PascalCase
    const normalizedId = row.Id;
    return {
      id: normalizedId,
      cmdId: row.CmdId,
      baseId: row.BaseId,
      classId: row.ClassId,
      cmdName: row.CmdName || "",
      baseName: row.BaseName || "",
      className: row.ClassName || "",
      gId: row.GId || "",
      rate: Number(row.Rate || 0),
      area: Number(row.Area || 0),
      uoM: row.UoM || "",
      location: row.Location || "",
      remarks: row.Remarks || "",
      status: row.Status,
      linkedProperties: normalizedId, // Dummy field for Linked Property column accessor
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
            onClick={() => handleEditPropertyGrouping(normalizedId)}
            title="Edit"
            sx={{ padding: "1px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeletePropertyGrouping(normalizedId)}
            title="Delete"
            sx={{ padding: "1px" }}
          >
            <Icon>delete</Icon>
          </IconButton>
        </MDBox>
      ),
    };
  });

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
                <DataTable
                  table={{ columns, rows: computedRows }}
                  isSorted={false}
                  entriesPerPage={{
                    defaultValue: 20,
                    entries: [10, 25, 50, 100],
                  }}
                  pageSize={pageSize}
                  onEntriesPerPageChange={(value) => {
                    setPageSize(value);
                    setPageNumber(1);
                    fetchPropertyGroupings(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  pagination={{ variant: "gradient", color: "info" }}
                  exportFileName="Property-Grouping"
                />

                {/* Custom Pagination Footer */}
                {totalCount > 0 && (
                  <MDBox
                    display="flex"
                    flexDirection={{ xs: "column", sm: "row" }}
                    justifyContent="flex-start"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    p={3}
                    gap={2}
                  >
                    <MDBox mb={{ xs: 3, sm: 0 }} display="flex" alignItems="center" gap={2}>
                      <MDTypography variant="button" color="secondary" fontWeight="regular">
                        {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} entries
                      </MDTypography>
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
        allPropertyGroupings={allPropertyGroupings}
        onGroupIdBlur={handleViewActiveContractsForGroup}
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
              options={availablePropertiesForLinking || []}
              value={(availablePropertiesForLinking || []).filter((rp) => {
                const pid = rp.Id || rp.PropertyId;
                return pid && (linkingSelection || []).some((id) => Number(id) === Number(pid));
              })}
              getOptionLabel={(option) => {
                const pid = option.Id || option.PropertyId;
                return getRentalPropertyLabel(option) || String(pid || "");
              }}
              isOptionEqualToValue={(option, value) => {
                const optId = option.Id || option.PropertyId;
                const valId = value.Id || value.PropertyId;
                return optId && valId && Number(optId) === Number(valId);
              }}
              onChange={(event, newValue) => {
                const nextIds = (newValue || [])
                  .map((v) => {
                    const pid = v.Id || v.PropertyId;
                    return pid ? Number(pid) : null;
                  })
                  .filter((n) => n !== null && Number.isFinite(n));

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
                value.map((option, index) => {
                  const pid = option.Id || option.PropertyId;
                  return (
                    <Chip
                      key={pid || index}
                      label={getRentalPropertyLabel(option) || String(pid || "")}
                      size="small"
                      {...getTagProps({ index })}
                    />
                  );
                })
              }
              renderOption={(props, option) => {
                const pid = option.Id || option.PropertyId;
                const optionLabel = getRentalPropertyLabel(option) || String(pid || "");
                const linkedNameSet = getLinkedPropertyNameSet();
                const selectedNameSet = new Set(
                  (linkingSelection || []).map((id) => getPropertyLabelById(id))
                );
                const isAlreadyLinked = linkedNameSet.has(optionLabel);
                const isDuplicateByName =
                  selectedNameSet.has(optionLabel) &&
                  pid &&
                  !(linkingSelection || []).includes(Number(pid));

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
                  // API returns Id (PascalCase) for linking ID
                  const linkingId = property.Id;

                  // API returns PropertyName (PascalCase)
                  let propertyName = "Unknown Property";

                  if (property.PropertyName) {
                    propertyName = String(property.PropertyName);
                  } else if (property.PropId) {
                    propertyName = String(property.PropId);
                  } else if (property.Property) {
                    if (typeof property.Property === "object") {
                      propertyName =
                        property.Property.PropertyName ||
                        property.Property.PId ||
                        "Unknown Property";
                    } else {
                      propertyName = getPropertyName(property.Property);
                    }
                  } else if (property.PropertyId) {
                    const propertyId =
                      typeof property.PropertyId === "object"
                        ? property.PropertyId.Id || property.PropertyId.PropertyId
                        : property.PropertyId;
                    if (propertyId) {
                      propertyName = getPropertyName(propertyId);
                    }
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

      {/* Active Contracts Dialog */}
      <Dialog
        open={contractsDialogOpen}
        onClose={() => {
          setContractsDialogOpen(false);
          setActiveContracts([]);
          setCurrentViewingGroupId("");
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            Active Contracts for Group ID: {currentViewingGroupId || "N/A"}
          </MDTypography>
          {activeContracts.length > 0 && (
            <MDTypography variant="body2" color="secondary" sx={{ mt: 1 }}>
              Total Active Contracts: {activeContracts.length}
            </MDTypography>
          )}
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
                scrollbarWidth: "thin",
                scrollbarColor: "#333333 transparent",
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
                  <TableContainer component={Paper} sx={{ maxHeight: "600px", overflowX: "auto" }}>
                    <Table
                      size="small"
                      stickyHeader
                      sx={{
                        "& .MuiTableCell-root": {
                          padding: "6px 8px",
                        },
                        "& .MuiTableCell-head": {
                          padding: "8px 8px",
                        },
                      }}
                    >
                      <thead>
                        <TableRow>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            ID
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Contract No
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Command
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Base
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Class
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Tenant No
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Business Name
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Nature of Business
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Start Date
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            End Date
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            COD
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Group Area
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Group Rate
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            CA Area
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Rental Value
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            % Rate
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Govt Share
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            PAF Share
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Initial Rent PM
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Initial Rent PA
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Payment Term (Months)
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            SD Rate (Months)
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Security Deposit
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Increase Rate %
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Increase Interval (Months)
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Term
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Status
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              backgroundColor: "#f5f5f5",
                              whiteSpace: "nowrap",
                              padding: "8px 8px",
                            }}
                          >
                            Remarks
                          </TableCell>
                        </TableRow>
                      </thead>
                      <TableBody>
                        {activeContracts.map((contract, index) => {
                          // Format date for display as dd-mmm-yyyy (e.g., 10-feb-2026)
                          const formatDate = (dateValue) => {
                            if (!dateValue) return "-";
                            const raw = String(dateValue).trim();
                            if (!raw) return "-";

                            const monthShort = [
                              "jan",
                              "feb",
                              "mar",
                              "apr",
                              "may",
                              "jun",
                              "jul",
                              "aug",
                              "sep",
                              "oct",
                              "nov",
                              "dec",
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
                              return "-";
                            }
                          };

                          const formatNumber = (value) => {
                            if (value === null || value === undefined || value === "") return "-";
                            return typeof value === "number"
                              ? value.toLocaleString()
                              : String(value);
                          };

                          return (
                            <TableRow
                              key={contract.Id || contract.id || index}
                              sx={{
                                "&:hover": { backgroundColor: "#f9f9f9" },
                              }}
                            >
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.Id || contract.id || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  fontWeight: "medium",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.ContractNo || contract.contractNo || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.CmdName || contract.cmdName || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.BaseName || contract.baseName || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.ClassName || contract.className || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.TenantNo || contract.tenantNo || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.BusinessName || contract.businessName || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.NatureOfBusiness || contract.natureOfBusiness || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  whiteSpace: "nowrap",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatDate(
                                  contract.ContractStartDate || contract.contractStartDate
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  whiteSpace: "nowrap",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatDate(contract.ContractEndDate || contract.contractEndDate)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  whiteSpace: "nowrap",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatDate(
                                  contract.CommercialOperationDate ||
                                    contract.commercialOperationDate
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.GroupArea || contract.groupArea)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.GroupRate || contract.groupRate)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.VaArea || contract.vaArea)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  fontWeight: "medium",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.RentalValue || contract.rentalValue)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.RentalValueRate || contract.rentalValueRate)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.GovtShare || contract.govtShare)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.PAFShare || contract.pafShare)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.InitialRentPM || contract.initialRentPM)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.InitialRentPA || contract.initialRentPA)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(
                                  contract.PaymentTermMonths || contract.paymentTermMonths
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(contract.SDRateMonths || contract.sdRateMonths)}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(
                                  contract.SecurityDepositAmount || contract.securityDepositAmount
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(
                                  contract.IncreaseRatePercent || contract.increaseRatePercent
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  textAlign: "right",
                                  padding: "6px 8px",
                                }}
                              >
                                {formatNumber(
                                  contract.IncreaseIntervalMonths || contract.increaseIntervalMonths
                                )}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.Term || contract.term || "-"}
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                <StatusBadge value={contract.Status || contract.status} />
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontSize: "0.875rem",
                                  padding: "6px 8px",
                                }}
                              >
                                {contract.Remarks || contract.remarks || "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => {
              setContractsDialogOpen(false);
              setActiveContracts([]);
              setCurrentViewingGroupId("");
            }}
          >
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
