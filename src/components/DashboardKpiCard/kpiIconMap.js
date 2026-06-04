import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TaskOutlinedIcon from "@mui/icons-material/TaskOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SignalCellularAltOutlinedIcon from "@mui/icons-material/SignalCellularAltOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LandscapeOutlinedIcon from "@mui/icons-material/LandscapeOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";

const KPI_ICON_MAP = {
  properties: HomeOutlinedIcon,
  home: HomeOutlinedIcon,
  landscape: LandscapeOutlinedIcon,
  contracts: DescriptionOutlinedIcon,
  description: DescriptionOutlinedIcon,
  revenue: PaidOutlinedIcon,
  payments: PaidOutlinedIcon,
  paid: PaidOutlinedIcon,
  tenants: GroupsOutlinedIcon,
  groups: GroupsOutlinedIcon,
  approvals: TaskOutlinedIcon,
  task: TaskOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  finance: AccountBalanceWalletOutlinedIcon,
  users: PeopleOutlineOutlinedIcon,
  people: PeopleOutlineOutlinedIcon,
  category: CategoryOutlinedIcon,
  signal_cellular_alt: SignalCellularAltOutlinedIcon,
  check_circle: CheckCircleOutlineIcon,
  schedule: ScheduleOutlinedIcon,
  warning: WarningAmberOutlinedIcon,
  archive: ArchiveOutlinedIcon,
  info: InfoOutlinedIcon,
  folder_open: FolderOpenOutlinedIcon,
};

export function resolveKpiIcon(iconKey) {
  if (!iconKey) return null;
  const key = String(iconKey).trim().toLowerCase();
  return KPI_ICON_MAP[key] || null;
}

export default KPI_ICON_MAP;
