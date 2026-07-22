import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
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
          minHeight: { xs: 220, sm: 280 },
          maxHeight: "calc(100vh - 96px)",
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
          maxHeight: "inherit",
          position: "relative",
        }}
      >
        <IconButton
          aria-label="Close notification"
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: 22,
            right: 8,
            zIndex: 2,
            color: "#666",
            bgcolor: "rgba(255,255,255,0.9)",
            "&:hover": {
              bgcolor: "rgba(0,0,0,0.06)",
              color: "#333",
            },
          }}
        >
          <Icon sx={{ fontSize: 22 }}>close</Icon>
        </IconButton>

        <MDBox sx={{ height: 14, background: NOTICE_STRIPE, flexShrink: 0 }} />

        <MDBox
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 3, sm: 5 },
            py: { xs: 2.5, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
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
              mb: 2,
              flexWrap: "wrap",
            }}
          >
            <MDBox
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "#f5a623",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(245, 166, 35, 0.45)",
              }}
            >
              <Icon sx={{ fontSize: 28, color: "#fff" }}>notifications</Icon>
            </MDBox>

            <MDTypography
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.5rem", sm: "1.75rem" },
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
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                lineHeight: 1.6,
                color: "#555",
                wordBreak: "break-word",
                textAlign: "initial",
                "& p": { m: 0, mb: 1.25 },
                "& p:last-child": { mb: 0 },
                "& div": { textAlign: "inherit" },
              }}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <MDTypography variant="body1" color="text">
              No notice.
            </MDTypography>
          )}
        </MDBox>

        <MDBox sx={{ height: 14, background: NOTICE_STRIPE, flexShrink: 0 }} />
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
