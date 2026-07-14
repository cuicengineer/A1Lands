import { useCallback, useEffect, useState } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import NoticeLoginPopup from "components/LoginNoticeAlert/NoticeLoginPopup";
import { configurationWorkspaceBodySx } from "utils/configurationWorkspaceBodySx";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import noticeApi from "services/api.notice.service";
import NoticeFormDialog, { parseExcludedUserIds } from "./NoticeFormDialog";
import { stripHtmlToPlainText } from "./NoticeRichTextEditor";

export default function NoticeConfig() {
  const canManage = isSuperuserOrAhqSupervisorUser();
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchNotice = useCallback(async () => {
    setLoading(true);
    try {
      const response = await noticeApi.listNotices();
      const rows = noticeApi.unwrapList(response);
      setNotice(Array.isArray(rows) && rows.length ? rows[0] : null);
    } catch (error) {
      console.error("Error fetching notice:", error);
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotice();
  }, [fetchNotice]);

  const handleOpenCreate = () => {
    if (!canManage || notice) return;
    setFormOpen(true);
  };

  const handleOpenEdit = () => {
    if (!canManage || !notice) return;
    setFormOpen(true);
  };

  const handlePreview = () => {
    if (!notice) return;
    const html = notice.contentHtml ?? notice.ContentHtml ?? "";
    if (!stripHtmlToPlainText(html)) {
      alert("Notice has no text to preview.");
      return;
    }
    setPreviewOpen(true);
  };

  const contentHtml = notice?.contentHtml ?? notice?.ContentHtml ?? "";
  const previewText = stripHtmlToPlainText(contentHtml);
  const isActive = Boolean(notice?.status ?? notice?.Status);
  const excludedCount = parseExcludedUserIds(notice).length;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Notice"
        subtitle="System login alert message"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canManage ? (
            notice ? (
              <MDButton variant="gradient" color="info" onClick={handleOpenEdit}>
                <Icon>edit</Icon>&nbsp;Edit Notice
              </MDButton>
            ) : (
              <MDButton variant="gradient" color="info" onClick={handleOpenCreate}>
                <Icon>add</Icon>&nbsp;Add Notice
              </MDButton>
            )
          ) : null
        }
      >
        <WorkspaceLoadingOverlay loading={loading} />
        <MDBox sx={{ ...configurationWorkspaceBodySx, opacity: loading ? 0.55 : 1 }}>
          {!canManage ? (
            <MDTypography variant="body2" color="text">
              Only a superuser or AHQ Category Supervisor can create or edit the notice.
            </MDTypography>
          ) : null}

          {notice ? (
            <MDBox
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2.5,
                bgcolor: "background.paper",
              }}
            >
              <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <MDBox display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                  <MDTypography variant="h6">Current notice</MDTypography>
                  <MDTypography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.35,
                      borderRadius: 1,
                      fontWeight: 600,
                      bgcolor: isActive ? "success.main" : "grey.400",
                      color: "#fff",
                    }}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </MDTypography>
                  {excludedCount > 0 ? (
                    <MDTypography variant="caption" color="text">
                      Exclude Show: {excludedCount} user{excludedCount === 1 ? "" : "s"}
                    </MDTypography>
                  ) : null}
                </MDBox>
                <MDBox display="flex" alignItems="center" gap={0.5}>
                  <Tooltip title="Preview login popup">
                    <IconButton color="secondary" size="small" onClick={handlePreview}>
                      <Icon>visibility</Icon>
                    </IconButton>
                  </Tooltip>
                  {canManage ? (
                    <Tooltip title="Edit">
                      <IconButton color="info" size="small" onClick={handleOpenEdit}>
                        <Icon>edit</Icon>
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </MDBox>
              </MDBox>
              {!isActive ? (
                <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                  Inactive — this notice will not appear on login.
                </MDTypography>
              ) : null}
              <MDBox
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 1.5,
                  p: 2,
                  minHeight: 80,
                  fontSize: "0.95rem",
                  lineHeight: 1.5,
                  opacity: isActive ? 1 : 0.65,
                  "& p": { m: 0 },
                }}
                dangerouslySetInnerHTML={{ __html: contentHtml || "<em>Empty</em>" }}
              />
              <MDTypography variant="caption" color="text" sx={{ mt: 1, display: "block" }}>
                Plain text: {previewText.length} characters
              </MDTypography>
            </MDBox>
          ) : (
            !loading && (
              <MDTypography variant="body2" color="text">
                No notice has been created yet.
                {canManage ? " Use Add Notice to create one." : ""}
              </MDTypography>
            )
          )}
        </MDBox>
      </EnterpriseWorkspace>

      <NoticeFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={notice}
        onSaved={fetchNotice}
      />

      <NoticeLoginPopup
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        contentHtml={contentHtml}
      />
    </DashboardLayout>
  );
}
