import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import CurrencyLoading from "components/CurrencyLoading";
import {
  AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX,
  AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN,
  AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP,
  AGREEMENT_PROV_PDF_DEFAULT_MARGINS,
  formatAgreementProvPdfContentScalePercent,
  loadAgreementProvPdfMargins,
  normalizeAgreementProvPdfContentScale,
  saveAgreementProvPdfMargins,
} from "utils/agreementProvPdfMargins";

function AgreementProvPdfPreviewDialog({
  open,
  onClose,
  data,
  generatePdfBlob,
  title = "PDF Preview",
  previewTitle = "PDF Preview",
  defaultMargins = AGREEMENT_PROV_PDF_DEFAULT_MARGINS,
  loadMargins = loadAgreementProvPdfMargins,
  saveMargins = saveAgreementProvPdfMargins,
}) {
  const [marginsIn, setMarginsIn] = useState(() => loadMargins());
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const previewUrlRef = useRef(null);

  const revokePreviewObjectUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const regeneratePreview = useCallback(
    async (rowData, margins) => {
      if (!rowData || typeof generatePdfBlob !== "function") return;
      setLoading(true);
      try {
        saveMargins(margins);
        const pdfBlob = await generatePdfBlob(rowData, margins);
        revokePreviewObjectUrl();
        const nextUrl = URL.createObjectURL(pdfBlob);
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
      } catch (error) {
        console.error("Error generating PDF preview:", error);
        window.alert(error?.message || "Failed to generate PDF preview.");
      } finally {
        setLoading(false);
      }
    },
    [generatePdfBlob, revokePreviewObjectUrl, saveMargins]
  );

  useEffect(() => {
    if (!open) return undefined;
    const margins = loadMargins();
    setMarginsIn(margins);
    regeneratePreview(data, margins);
    return () => revokePreviewObjectUrl();
  }, [open, data, regeneratePreview, revokePreviewObjectUrl, loadMargins]);

  const handleClose = () => {
    revokePreviewObjectUrl();
    setLoading(false);
    onClose?.();
  };

  const handleApplyMargins = async () => {
    await regeneratePreview(data, marginsIn);
  };

  const adjustContentScale = (delta) => {
    setMarginsIn((prev) => ({
      ...prev,
      contentScale: normalizeAgreementProvPdfContentScale(
        normalizeAgreementProvPdfContentScale(prev?.contentScale) + delta
      ),
    }));
  };

  const contentScale = normalizeAgreementProvPdfContentScale(marginsIn?.contentScale);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={false} fullWidth>
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 700, pb: 1 }}>{title}</DialogTitle>
      <DialogContent sx={{ p: 0, height: "75vh", display: "flex" }}>
        <MDBox
          sx={{
            width: 320,
            borderRight: "1px solid #e0e0e0",
            p: 2,
            overflow: "auto",
          }}
        >
          <MDTypography variant="h6" sx={{ mb: 1 }}>
            Margins (in)
          </MDTypography>

          <MDBox display="flex" flexDirection="column" gap={1}>
            <MDInput
              size="small"
              label="Top"
              type="number"
              value={marginsIn?.topIn ?? 0}
              onChange={(e) =>
                setMarginsIn((prev) => ({
                  ...prev,
                  topIn: Number(e.target.value),
                }))
              }
              inputProps={{ step: 0.1, min: 0 }}
            />
            <MDInput
              size="small"
              label="Bottom"
              type="number"
              value={marginsIn?.bottomIn ?? 0}
              onChange={(e) =>
                setMarginsIn((prev) => ({
                  ...prev,
                  bottomIn: Number(e.target.value),
                }))
              }
              inputProps={{ step: 0.1, min: 0 }}
            />
            <MDInput
              size="small"
              label="Left"
              type="number"
              value={marginsIn?.leftIn ?? 0}
              onChange={(e) =>
                setMarginsIn((prev) => ({
                  ...prev,
                  leftIn: Number(e.target.value),
                }))
              }
              inputProps={{ step: 0.1, min: 0 }}
            />
            <MDInput
              size="small"
              label="Right"
              type="number"
              value={marginsIn?.rightIn ?? 0}
              onChange={(e) =>
                setMarginsIn((prev) => ({
                  ...prev,
                  rightIn: Number(e.target.value),
                }))
              }
              inputProps={{ step: 0.1, min: 0 }}
            />
          </MDBox>

          <MDTypography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Content scale
          </MDTypography>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            <Tooltip title="Zoom out content">
              <span>
                <IconButton
                  size="small"
                  color="dark"
                  onClick={() => adjustContentScale(-AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP)}
                  disabled={loading || contentScale <= AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN}
                >
                  <Icon fontSize="small">zoom_out</Icon>
                </IconButton>
              </span>
            </Tooltip>
            <MDInput
              size="small"
              label="Scale %"
              type="number"
              value={Math.round(contentScale * 100)}
              readOnly
              InputProps={{ readOnly: true }}
              inputProps={{
                min: AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN * 100,
                max: AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX * 100,
                step: AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP * 100,
              }}
              sx={{
                width: 100,
                "& .MuiInputBase-input": { cursor: "default" },
              }}
            />
            <Tooltip title="Zoom in content">
              <span>
                <IconButton
                  size="small"
                  color="dark"
                  onClick={() => adjustContentScale(AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP)}
                  disabled={loading || contentScale >= AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX}
                >
                  <Icon fontSize="small">zoom_in</Icon>
                </IconButton>
              </span>
            </Tooltip>
          </MDBox>
          <MDTypography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
            Current: {formatAgreementProvPdfContentScalePercent(contentScale)} (print content size)
          </MDTypography>
          <MDTypography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            A4 size is 100% scale.
          </MDTypography>

          <MDBox mt={2} display="flex" gap={1} alignItems="center">
            <MDButton
              variant="outlined"
              color="dark"
              size="small"
              onClick={() => setMarginsIn({ ...defaultMargins })}
              disabled={loading}
            >
              Reset
            </MDButton>
            <MDButton
              variant="contained"
              color="dark"
              size="small"
              onClick={handleApplyMargins}
              disabled={!data || loading}
            >
              Update
            </MDButton>
          </MDBox>

          <MDTypography variant="caption" sx={{ mt: 1, color: "text.secondary", display: "block" }}>
            Margins and content scale are applied when you click Update. Scale adjusts fonts,
            spacing, and layout in the generated PDF (not just the preview display).
          </MDTypography>
        </MDBox>

        <MDBox sx={{ flex: 1, position: "relative", backgroundColor: "#ffffff" }}>
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
              zIndex={2}
              sx={{
                backgroundColor: "rgba(255, 255, 255, 0.75)",
                backdropFilter: "blur(2px)",
              }}
            >
              <CurrencyLoading size={40} />
            </MDBox>
          )}

          {previewUrl ? (
            <iframe
              title={previewTitle}
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <MDBox height="100%" display="flex" justifyContent="center" alignItems="center">
              <MDTypography variant="body2" sx={{ color: "text.secondary" }}>
                No preview generated yet.
              </MDTypography>
            </MDBox>
          )}
        </MDBox>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <MDButton variant="outlined" color="dark" onClick={handleClose}>
          Close
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

AgreementProvPdfPreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  data: PropTypes.any,
  generatePdfBlob: PropTypes.func.isRequired,
  title: PropTypes.string,
  previewTitle: PropTypes.string,
  defaultMargins: PropTypes.shape({
    topIn: PropTypes.number,
    bottomIn: PropTypes.number,
    leftIn: PropTypes.number,
    rightIn: PropTypes.number,
    contentScale: PropTypes.number,
  }),
  loadMargins: PropTypes.func,
  saveMargins: PropTypes.func,
};

export default AgreementProvPdfPreviewDialog;
