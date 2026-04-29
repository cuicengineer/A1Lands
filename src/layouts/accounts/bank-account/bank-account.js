import React, { useState, useEffect, useMemo } from "react";
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
import IconButton from "@mui/material/IconButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CurrencyLoading from "components/CurrencyLoading";
import MDPagination from "components/MDPagination";
import BankAccountForm from "layouts/accounts/bank-account/BankAccountForm";
import bankAccountApi, {
  UPLOAD_TABLE_NAME,
  fetchBankListsForDropdown,
} from "services/api.bankAccount.service";
import uploadApi from "services/api.upload.service";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";

export default function BankAccounts() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentsForId, setAttachmentsForId] = useState(null);

  const getAttachmentPath = (file) =>
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.file_path ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    "";

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, UPLOAD_TABLE_NAME);
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    const normalized = filesArray
      .map((f) => {
        if (typeof f === "string") {
          return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl =
          f?.Path || f?.path || f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || "";
        return { ...f, fileName, downloadUrl };
      })
      .filter((f) => getAttachmentPath(f));
    setAttachmentsFiles(normalized);
  };

  const fetchBankAccounts = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await bankAccountApi.getAll(page, size);
      if (Array.isArray(response)) {
        setTableRows(response);
        setTotalCount(response.length);
        return;
      }
      const data = response?.data ?? [];
      const pagination = response?.pagination;
      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount ?? 0));
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cmdRes, baseRes, banks] = await Promise.all([
          api.list("command").catch(() => []),
          api.list("base").catch(() => []),
          fetchBankListsForDropdown().catch(() => []),
        ]);
        if (!alive) return;
        setCommands(
          (Array.isArray(cmdRes) ? cmdRes : []).map((c) => ({
            id: Number(c?.id),
            name: String(c?.name ?? c?.Name ?? c?.Value ?? c?.value ?? ""),
          }))
        );
        setBases(
          (Array.isArray(baseRes) ? baseRes : []).map((b) => ({
            id: Number(b?.id),
            name: String(b?.name ?? b?.Name ?? ""),
          }))
        );
        setBankList(Array.isArray(banks) ? banks : []);
      } catch (error) {
        console.error("Error loading bank account display lists:", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    fetchBankAccounts(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!record) {
      console.error("Record not found for id:", id);
      return;
    }
    setCurrentRecord({ ...record });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await bankAccountApi.remove(recordToDelete);
      fetchBankAccounts(pageNumber, pageSize);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting bank account:", error);
      window.alert("Failed to delete bank account. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (recordId) => {
    if (!recordId) return;
    setAttachmentsForId(recordId);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      await refreshAttachments(recordId);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsFiles([]);
    setAttachmentsForId(null);
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await bankAccountApi.update(existingId, payload);
      await fetchBankAccounts(pageNumber, pageSize);
      handleCloseForm();
      return { id: existingId, ids: [existingId] };
    }
    const res = await bankAccountApi.create(payload);
    const newId =
      res?.id ||
      res?.Id ||
      res?.data?.id ||
      res?.data?.Id ||
      (Array.isArray(res?.data) && res.data[0] ? res.data[0].id || res.data[0].Id : null);
    await fetchBankAccounts(pageNumber, pageSize);
    handleCloseForm();
    return { id: newId, ids: newId ? [newId] : [] };
  };

  const formatDateDDMMMYYYY = (dateString) => {
    if (!dateString) return "";
    const raw = String(dateString).trim();
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
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
    } catch (e) {
      return dateString;
    }
  };

  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || column?.accessor || "").toLowerCase();
    if (["openingdate", "signatorydate", "statusdate"].includes(colId)) {
      return formatDateDDMMMYYYY(value);
    }
    return value;
  };

  const txt = (v) => (v != null && String(v).trim() !== "" ? String(v) : "-");

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "72px",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        width: "60px",
        Cell: ({ row }) => row?.original?.attachments,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        width: "60px",
        Cell: ({ row }) => {
          const s = row?.original?.sno;
          return s != null && s !== "" ? s : "-";
        },
      },
      {
        id: "recordId",
        Header: "Record ID",
        accessor: "recordId",
        align: "left",
        minWidth: "72px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "openingDate",
        Header: "Opening Date",
        accessor: "openingDate",
        align: "left",
        minWidth: "96px",
        Cell: ({ value, row }) => {
          const v = value || row?.original?.OpeningDate || row?.original?.openingDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "racDisplay",
        Header: "RAC",
        accessor: "racDisplay",
        align: "left",
        minWidth: "88px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "baseDisplay",
        Header: "Base",
        accessor: "baseDisplay",
        align: "left",
        minWidth: "88px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "fundingSource",
        Header: "Funding Source",
        accessor: "fundingSource",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "fundName",
        Header: "Fund Name",
        accessor: "fundName",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "titleOfAccount",
        Header: "Title of Account",
        accessor: "titleOfAccount",
        align: "left",
        minWidth: "120px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "bankDisplay",
        Header: "Bank Name",
        accessor: "bankDisplay",
        align: "left",
        minWidth: "120px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "branchCode",
        Header: "Branch Code",
        accessor: "branchCode",
        align: "left",
        minWidth: "88px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "branchAddress",
        Header: "Branch Address",
        accessor: "branchAddress",
        align: "left",
        minWidth: "160px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "accountNoIban",
        Header: "Account No (IBAN)",
        accessor: "accountNoIban",
        align: "left",
        minWidth: "140px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "currency",
        Header: "Currency",
        accessor: "currency",
        align: "left",
        minWidth: "72px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "accountType",
        Header: "Type",
        accessor: "accountType",
        align: "left",
        minWidth: "88px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatoryDate",
        Header: "Signatory Date",
        accessor: "signatoryDate",
        align: "left",
        minWidth: "100px",
        Cell: ({ value, row }) => {
          const v = value || row?.original?.SignatoryDate || row?.original?.signatoryDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "signatory1",
        Header: "Signatory-1",
        accessor: "signatory1",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatory2",
        Header: "Signatory-2",
        accessor: "signatory2",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "signatory3",
        Header: "Signatory-3",
        accessor: "signatory3",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "left",
        minWidth: "80px",
        Cell: ({ value, row }) => {
          const s = value ?? row?.original?.Status ?? row?.original?.status;
          return s != null && s !== "" ? String(s) : "-";
        },
      },
      {
        id: "statusDate",
        Header: "Status Date",
        accessor: "statusDate",
        align: "left",
        minWidth: "100px",
        Cell: ({ value, row }) => {
          const v = value || row?.original?.StatusDate || row?.original?.statusDate || "";
          return formatDateDDMMMYYYY(v) || "-";
        },
      },
      {
        id: "remarks",
        Header: "Remarks",
        accessor: "remarks",
        align: "left",
        minWidth: "180px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "authority",
        Header: "Authority",
        accessor: "authority",
        align: "left",
        minWidth: "88px",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "reference",
        Header: "Reference",
        accessor: "reference",
        align: "left",
        minWidth: "100px",
        Cell: ({ value }) => txt(value),
      },
    ],
    []
  );

  const computedRows = tableRows.map((row, index) => {
    const normalizedId = row?.id ?? row?.Id;
    const sno = (pageNumber - 1) * pageSize + index + 1;
    const racId = row.racId ?? row.RacId ?? row.cmdId ?? row.CmdId;
    const baseId = row.baseId ?? row.BaseId;
    const bankId = row.bankId ?? row.BankId;

    const cmdItem = commands.find((c) => Number(c.id) === Number(racId));
    const racDisplay =
      (cmdItem?.name && String(cmdItem.name).trim()) ||
      String(row.cmdName ?? row.CmdName ?? "").trim() ||
      (racId != null && racId !== "" ? String(racId) : "-");

    const baseItem = bases.find((b) => Number(b.id) === Number(baseId));
    const baseDisplay =
      (baseItem?.name && String(baseItem.name).trim()) ||
      String(row.baseName ?? row.BaseName ?? "").trim() ||
      (baseId != null && baseId !== "" ? String(baseId) : "-");

    const bankItem = bankList.find((bk) => Number(bk.id) === Number(bankId));
    const bankDisplay = bankItem?.label ?? (bankId != null && bankId !== "" ? String(bankId) : "-");

    const typeVal = row.type ?? row.Type ?? row.accountType ?? row.AccountType ?? "";

    const rawIsAttachment = row?.IsAttachment ?? row?.isAttachment;
    const countValue =
      row?.attachmentCount ??
      row?.attachmentsCount ??
      row?.filesCount ??
      row?.AttachmentCount ??
      row?.AttachmentsCount ??
      row?.FilesCount;
    const hasAttachmentByCount = Number(countValue || 0) > 0;
    const hasAttachmentData =
      rawIsAttachment === true ||
      rawIsAttachment === 1 ||
      rawIsAttachment === "1" ||
      String(rawIsAttachment || "")
        .trim()
        .toLowerCase() === "true" ||
      hasAttachmentByCount;

    return {
      ...row,
      id: normalizedId,
      sno,
      recordId: normalizedId != null && normalizedId !== "" ? String(normalizedId) : "-",
      cmdId: racId,
      racDisplay,
      baseDisplay,
      bankDisplay,
      openingDate: row.openingDate ?? row.OpeningDate ?? "",
      fundingSource: row.fundingSource ?? row.FundingSource ?? "",
      fundName: row.fundName ?? row.FundName ?? "",
      titleOfAccount: row.titleOfAccount ?? row.TitleOfAccount ?? "",
      branchCode: row.branchCode ?? row.BranchCode ?? "",
      branchAddress: row.branchAddress ?? row.BranchAddress ?? "",
      accountNoIban: row.accountNoIban ?? row.AccountNoIban ?? "",
      currency: row.currency ?? row.Currency ?? "",
      accountType: typeVal,
      signatoryDate: row.signatoryDate ?? row.SignatoryDate ?? "",
      signatory1: row.signatory1 ?? row.Signatory1 ?? "",
      signatory2: row.signatory2 ?? row.Signatory2 ?? "",
      signatory3: row.signatory3 ?? row.Signatory3 ?? "",
      status: row.status ?? row.Status ?? "",
      statusDate: row.statusDate ?? row.StatusDate ?? "",
      remarks: row.remarks ?? row.Remarks ?? "",
      authority: row.authority ?? row.Authority ?? "",
      reference: row.reference ?? row.Reference ?? "",
      attachments: (
        <IconButton
          size="small"
          color={hasAttachmentData ? "success" : "error"}
          onClick={() => handleOpenAttachments(normalizedId)}
          title="View Attachments"
          sx={{ padding: "1px" }}
        >
          <Icon>visibility</Icon>
        </IconButton>
      ),
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
          {canEditCurrentMenu() && (
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditRecord(normalizedId)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
          )}
          {canDeleteCurrentMenu() && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteRecord(normalizedId)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          )}
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
                  Institutional Accounts
                </MDTypography>
                {canCreateCurrentMenu() && (
                  <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                    <Icon>add</Icon>&nbsp;Add New
                  </MDButton>
                )}
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  height: "78vh",
                  minHeight: "560px",
                  overflow: "hidden",
                  "& .MuiTableContainer-root": {
                    flex: "1 1 0",
                    minHeight: 0,
                    overflow: "auto",
                  },
                  "& .MuiTable-root": {
                    tableLayout: "auto",
                    width: "max-content",
                    minWidth: "100%",
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
                }}
              >
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
                  stickyToolbarAndHeader
                  entriesPerPage={{
                    defaultValue: 20,
                    entries: [10, 25, 50, 100, 500, 1000],
                  }}
                  pageSize={pageSize}
                  onEntriesPerPageChange={(value) => {
                    setPageSize(value);
                    setPageNumber(1);
                    fetchBankAccounts(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Bank-Accounts"
                  exportCellFormatter={exportCellFormatter}
                />

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
                      {(() => {
                        const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
                        return displayTotal === 0
                          ? "0 of 0 entries"
                          : `${Math.min(
                              pageNumber * pageSize,
                              displayTotal
                            )} of ${displayTotal} entries`;
                      })()}
                    </MDTypography>
                    {(() => {
                      const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
                      return displayTotal > 0 && Math.ceil(displayTotal / pageSize) > 1;
                    })() && (
                      <MDPagination variant="gradient" color="info">
                        {pageNumber > 1 && (
                          <MDPagination item onClick={() => setPageNumber(pageNumber - 1)}>
                            <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
                          </MDPagination>
                        )}

                        {Array.from(
                          { length: Math.ceil(totalCount / pageSize) || 1 },
                          (_, i) => i + 1
                        )
                          .filter((page) => {
                            const totalPages = Math.ceil(totalCount / pageSize) || 1;
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
                                    ...
                                  </MDPagination>
                                )}
                                <MDPagination
                                  item
                                  active={page === pageNumber}
                                  onClick={() => setPageNumber(page)}
                                >
                                  {page}
                                </MDPagination>
                              </React.Fragment>
                            );
                          })}

                        {pageNumber < Math.ceil(totalCount / pageSize) && totalCount > 0 && (
                          <MDPagination item onClick={() => setPageNumber(pageNumber + 1)}>
                            <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
                          </MDPagination>
                        )}
                      </MDPagination>
                    )}
                  </MDBox>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <BankAccountForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        onUploadSuccess={() => {
          fetchBankAccounts(pageNumber, pageSize);
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>Attachments {attachmentsForId ? `(#${attachmentsForId})` : ""}</DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((f, idx) => (
                <MDBox
                  key={`${f.fileName || "file"}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      uploadApi
                        .downloadFile(f, f.fileName || `File-${idx + 1}`)
                        .catch((e) => window.alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {f.fileName || `File ${idx + 1}`}
                  </MDButton>
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              No attachments found for this record.
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments} variant="gradient" color="info">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
