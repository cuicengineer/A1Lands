import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

const NOTICE_STRIPE = "repeating-linear-gradient(-45deg, #f5a623 0 10px, #ffffff 10px 20px)";

/**
 * Shared login-notice popup UI (used after login and for Configuration preview).
 */
export default function NoticeLoginPopup({ open, onClose, contentHtml }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        elevation: 8,
        sx: {
          width: { xs: "94vw", sm: 720, md: 900 },
          maxWidth: "94vw",
          minHeight: { xs: 360, sm: 480 },
          borderRadius: 0,
          overflow: "hidden",
          boxShadow: "6px 6px 0 rgba(0,0,0,0.18)",
        },
      }}
    >
      <MDBox
        sx={{
          bgcolor: "#fff",
          display: "flex",
          flexDirection: "column",
          minHeight: "inherit",
        }}
      >
        <MDBox sx={{ height: 18, background: NOTICE_STRIPE, flexShrink: 0 }} />

        <MDBox
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 3, sm: 5 },
            py: { xs: 4, sm: 5 },
            textAlign: "center",
          }}
        >
          <MDBox
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              mb: 2.5,
              flexWrap: "wrap",
            }}
          >
            <MDBox
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "#f5a623",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(245, 166, 35, 0.45)",
              }}
            >
              <Icon sx={{ fontSize: 32, color: "#fff" }}>notifications</Icon>
            </MDBox>

            <MDTypography
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.75rem", sm: "2rem" },
                color: "#3a3a3a",
                letterSpacing: "0.02em",
                lineHeight: 1.2,
              }}
            >
              Notification
            </MDTypography>
          </MDBox>

          {contentHtml ? (
            <MDBox
              sx={{
                maxWidth: 720,
                width: "100%",
                fontSize: { xs: "1rem", sm: "1.1rem" },
                lineHeight: 1.65,
                color: "#555",
                wordBreak: "break-word",
                "& p": { m: 0, mb: 1.25 },
                "& p:last-child": { mb: 0 },
              }}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <MDTypography variant="body1" color="text">
              No notice.
            </MDTypography>
          )}

          <MDBox mt={4}>
            <MDButton
              variant="gradient"
              color="warning"
              onClick={onClose}
              sx={{
                minWidth: 140,
                px: 4,
                py: 1.25,
                fontSize: "0.95rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Close
            </MDButton>
          </MDBox>
        </MDBox>

        <MDBox sx={{ height: 18, background: NOTICE_STRIPE, flexShrink: 0 }} />
      </MDBox>
    </Dialog>
  );
}

NoticeLoginPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  contentHtml: PropTypes.string,
};

NoticeLoginPopup.defaultProps = {
  contentHtml: "",
};
