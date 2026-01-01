/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

/** 
  All of the routes for the Material Dashboard 2 React are added here,
  You can add a new route, customize the routes and delete the routes here.

  Once you add a new route on this file it will be visible automatically on
  the Sidenav.

  For adding a new route you can follow the existing routes in the routes array.
  1. The `type` key with the `collapse` value is used for a route.
  2. The `type` key with the `title` value is used for a title inside the Sidenav. 
  3. The `type` key with the `divider` value is used for a divider between Sidenav items.
  4. The `name` key is used for the name of the route on the Sidenav.
  5. The `key` key is used for the key of the route (It will help you with the key prop inside a loop).
  6. The `icon` key is used for the icon of the route on the Sidenav, you have to add a node.
  7. The `collapse` key is used for making a collapsible item on the Sidenav that has other routes
  inside (nested routes), you need to pass the nested routes inside an array as a value for the `collapse` key.
  8. The `route` key is used to store the route location which is used for the react router.
  9. The `href` key is used to store the external links location.
  10. The `title` key is only for the item with the type of `title` and its used for the title text on the Sidenav.
  10. The `component` key is used to store the component of its route.
*/

// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import Configuration from "layouts/configuration";
import UserMgmt from "layouts/configuration/user-mgmt/user-mgmt";
import UserRole from "layouts/configuration/user-role/user-role";
import Command from "layouts/configuration/command/cmd";
import Base from "layouts/configuration/base/base";
import LandCategories from "layouts/configuration/land-categories/landcategories";
import ClassConfig from "layouts/configuration/class/class";
import UnitsConfig from "layouts/configuration/units/units";
import NatureConfig from "layouts/configuration/nature/nature";
import ProfitSharing from "layouts/configuration/profit-sharing";
import DataConfig from "layouts/configuration/data-config";
import RentalProperties from "layouts/configuration/rental-properties/rental-properties";
import PropertyGrouping from "layouts/contracts/property-grouping/property-grouping";
import Contracts from "layouts/contracts";
import ContractsReport from "layouts/contracts/report";
import RevenueRates from "layouts/contracts/revenue-rates/revenue-rates";
import Tenants from "layouts/contracts/tenants/tenants";
import ContractsNew from "layouts/contracts/contracts/contracts";
// @mui icons
import Icon from "@mui/material/Icon";

const routes = [
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
  },
  {
    type: "collapse",
    name: "Configuration",
    key: "configuration",
    icon: <Icon fontSize="small">settings</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "User Mgmt",
        key: "configuration-user-mgmt",
        icon: <Icon fontSize="small">people</Icon>,
        route: "/configuration/user-mgmt",
        component: <UserMgmt />,
      },
      {
        type: "collapse",
        name: "User Roles",
        key: "configuration-user-role",
        icon: <Icon fontSize="small">admin_panel_settings</Icon>,
        route: "/configuration/user-role",
        component: <UserRole />,
      },
      // {
      //   type: "collapse",
      //   name: "Command",
      //   key: "configuration-command",
      //   route: "/configuration/command",
      //   component: <Command />,
      // },
      // {
      //   type: "collapse",
      //   name: "Base",
      //   key: "configuration-base",
      //   route: "/configuration/base",
      //   component: <Base />,
      // },
      // {
      //   type: "collapse",
      //   name: "Units",
      //   key: "configuration-units",
      //   route: "/configuration/units",
      //   component: <UnitsConfig />,
      // },
      {
        type: "collapse",
        name: "Class",
        key: "configuration-class",
        icon: <Icon fontSize="small">category</Icon>,
        route: "/configuration/class",
        component: <ClassConfig />,
      },
      // {
      //   type: "collapse",
      //   name: "Land Categories",
      //   key: "configuration-land-categories",
      //   route: "/configuration/land-categories",
      //   component: <LandCategories />,
      // },
      {
        type: "collapse",
        name: "Nature",
        key: "configuration-nature",
        icon: <Icon fontSize="small">eco</Icon>,
        route: "/configuration/nature",
        component: <NatureConfig />,
      },
      // {
      //   type: "collapse",
      //   name: "Profit Sharing",
      //   key: "configuration-profit-sharing",
      //   route: "/configuration/profit-sharing",
      //   component: <ProfitSharing />,
      // },
      // {
      //   type: "collapse",
      //   name: "Data Config",
      //   key: "configuration-data-config",
      //   route: "/configuration/data-config",
      //   component: <DataConfig />,
      // },
    ],
  },
  {
    type: "collapse",
    name: "Contracts Mgmt",
    key: "contracts-mgmt",
    icon: <Icon fontSize="small">description</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Rental Properties",
        key: "configuration-rental-properties",
        icon: <Icon fontSize="small">home</Icon>,
        route: "/configuration/rental-properties",
        component: <RentalProperties />,
      },
      {
        type: "collapse",
        name: "Property Grouping",
        key: "configuration-property-grouping",
        icon: <Icon fontSize="small">group_work</Icon>,
        route: "/configuration/property-grouping",
        component: <PropertyGrouping />,
      },
      {
        type: "collapse",
        name: "Contracts",
        key: "contracts",
        icon: <Icon fontSize="small">article</Icon>,
        route: "/contracts",
        component: <ContractsNew />,
      },
      {
        type: "collapse",
        name: "Report",
        key: "contracts-report",
        icon: <Icon fontSize="small">assessment</Icon>,
        route: "/contracts/report",
        component: <ContractsReport />,
      },
      {
        type: "collapse",
        name: "Revenue Rates",
        key: "revenue-rates",
        icon: <Icon fontSize="small">attach_money</Icon>,
        route: "/contracts/revenue-rates",
        component: <RevenueRates />,
      },
      {
        type: "collapse",
        name: "Tenants",
        key: "tenants",
        icon: <Icon fontSize="small">people</Icon>,
        route: "/contracts/tenants",
        component: <Tenants />,
      },
    ],
  },
  {
    type: "collapse",
    name: "Publication",
    key: "publication",
    icon: <Icon fontSize="small">publish</Icon>,
    route: "/publication",
    component: <Profile />,
  },
];

export default routes;
