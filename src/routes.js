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
import DashboardModuleLayout from "layouts/dashboard/DashboardModuleLayout";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import A1Login from "layouts/authentication/a1-login";
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
import PropertyType from "layouts/configuration/property-type/property-type";
import BanksList from "layouts/configuration/banks-list/banks-list";
import LockDateConfig from "layouts/configuration/lock-date/lock-date";
import AccountingSysConfig from "layouts/configuration/accounting-sys/accounting-sys";
import ChartOfAccounts from "layouts/configuration/chart-of-accounts/chart-of-accounts";
import IncomeStatement from "layouts/configuration/income-statement/income-statement";
import PropertyGrouping from "layouts/contracts/property-grouping/property-grouping";
import Contracts from "layouts/contracts";
import ContractsReport from "layouts/contracts/report";
import RevenueRates from "layouts/contracts/revenue-rates/revenue-rates";
import Tenants from "layouts/contracts/tenants/tenants";
import ContractsNew from "layouts/contracts/contracts/contracts";
import ShareDistribution from "layouts/contracts/share-distribution/share-distribution";
import AgreementProvInvoice from "layouts/contracts/agreement-prov-invoice/agreement-prov-invoice";
import SalesReturns from "layouts/income-agreements/sales-returns/sales-returns";
import Collections from "layouts/income-agreements/collections/collections";
import RentalValueRate from "layouts/contracts/rental-value-rate/rental-value-rate";
import GovtShareRate from "layouts/contracts/govt-share-rate/govt-share-rate";
import SharingFormula from "layouts/contracts/sharing-formula/sharing-formula";
import BankAccounts from "layouts/accounts/bank-account/bank-account";
import Payments from "layouts/accounts/receipts/payments";
import Receipts from "layouts/receipts/receipts";
import Supplier from "layouts/supplier/supplier";
import Customer from "layouts/customer/customer";
// @mui icons
import Icon from "@mui/material/Icon";

const routes = [
  // Default landing page (not shown in Sidenav because it has no `type`)
  {
    key: "a1-login",
    route: "/",
    component: <A1Login />,
  },
  {
    key: "a1-login-route",
    route: "/login",
    component: <A1Login />,
  },
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "KPI",
        key: "dashboard-main",
        icon: <Icon fontSize="small">dashboard</Icon>,
        route: "/dashboard/*",
        component: <DashboardModuleLayout />,
      },
      {
        type: "collapse",
        name: "KPI Overview",
        key: "dashboard-kpi-overview",
        icon: <Icon fontSize="small">insights</Icon>,
        route: "/dashboard/kpi-overview",
      },
    ],
  },
  {
    type: "collapse",
    name: "Configuration",
    key: "configuration",
    icon: <Icon fontSize="small">tune</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "User Roles",
        key: "configuration-user-role",
        icon: <Icon fontSize="small">admin_panel_settings</Icon>,
        route: "/configuration/user-role",
        component: <UserRole />,
      },
      {
        type: "collapse",
        name: "User Mgmt",
        key: "configuration-user-mgmt",
        icon: <Icon fontSize="small">people</Icon>,
        route: "/configuration/user-mgmt",
        component: <UserMgmt />,
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
      {
        type: "collapse",
        name: "Property Type",
        key: "configuration-property-type",
        icon: <Icon fontSize="small">home_work</Icon>,
        route: "/configuration/property-type",
        component: <PropertyType />,
      },
      {
        type: "collapse",
        name: "Banks List",
        key: "configuration-banks-list",
        icon: <Icon fontSize="small">account_balance</Icon>,
        route: "/configuration/banks-list",
        component: <BanksList />,
      },
      {
        type: "collapse",
        name: "Rental Value Rate",
        key: "rental-value-rate",
        icon: <Icon fontSize="small">monetization_on</Icon>,
        route: "/configuration/rental-value-rate",
        component: <RentalValueRate />,
      },
      {
        type: "collapse",
        name: "Govt Share Rate",
        key: "govt-share-rate",
        icon: <Icon fontSize="small">account_balance</Icon>,
        route: "/configuration/govt-share-rate",
        component: <GovtShareRate />,
      },
      {
        type: "collapse",
        name: "Sharing Formula",
        key: "sharing-formula",
        icon: <Icon fontSize="small">schema</Icon>,
        route: "/configuration/sharing-formula",
        component: <SharingFormula />,
      },
      {
        type: "collapse",
        name: "Tenants",
        key: "tenants",
        icon: <Icon fontSize="small">people</Icon>,
        route: "/configuration/tenants",
        component: <Tenants />,
      },
      {
        type: "collapse",
        name: "Lock Date",
        key: "configuration-lock-date",
        icon: <Icon fontSize="small">event_busy</Icon>,
        route: "/configuration/lock-date",
        component: <LockDateConfig />,
      },
      {
        type: "collapse",
        name: "Accounting Sys.",
        key: "configuration-accounting-sys",
        icon: <Icon fontSize="small">account_balance_wallet</Icon>,
        route: "/configuration/accounting-sys",
        component: <AccountingSysConfig />,
      },
      {
        type: "collapse",
        name: "Chart of Accounts",
        key: "configuration-chart-of-accounts",
        icon: <Icon fontSize="small">account_tree</Icon>,
        route: "/configuration/chart-of-accounts",
        component: <ChartOfAccounts />,
      },
      {
        key: "configuration-income-statement-redirect",
        route: "/configuration/income-statement",
        component: <IncomeStatement />,
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
    name: "Sales Agreements",
    key: "contracts-mgmt",
    icon: <Icon fontSize="small">description</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Rental Properties",
        key: "configuration-rental-properties",
        icon: <Icon fontSize="small">home</Icon>,
        route: "/contracts/rental-properties",
        component: <RentalProperties />,
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
        name: "Property Grouping",
        key: "configuration-property-grouping",
        icon: <Icon fontSize="small">group_work</Icon>,
        route: "/contracts/property-grouping",
        component: <PropertyGrouping />,
      },
      {
        type: "collapse",
        name: "Agreements",
        key: "contracts",
        icon: <Icon fontSize="small">article</Icon>,
        route: "/contracts",
        component: <ContractsNew />,
      },
      // {
      //   type: "collapse",
      //   name: "Report",
      //   key: "contracts-report",
      //   icon: <Icon fontSize="small">assessment</Icon>,
      //   route: "/contracts/report",
      //   component: <ContractsReport />,
      // },
    ],
  },
  {
    type: "collapse",
    name: "Income Agreements",
    key: "income-agreements",
    icon: <Icon fontSize="small">savings</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Agreement Invoice",
        key: "agreement-prov-invoice",
        icon: <Icon fontSize="small">receipt</Icon>,
        route: "/contracts/agreement-prov-invoice",
        component: <AgreementProvInvoice />,
      },
      {
        type: "collapse",
        name: "Sales Returns",
        key: "income-agreements-sales-returns",
        icon: <Icon fontSize="small">undo</Icon>,
        route: "/income-agreements/sales-returns",
        component: <SalesReturns />,
      },
      {
        type: "collapse",
        name: "Collections",
        key: "income-agreements-collections",
        icon: <Icon fontSize="small">account_balance_wallet</Icon>,
        route: "/income-agreements/collections",
        component: <Collections />,
      },
      {
        type: "collapse",
        name: "Share Distribution",
        key: "income-agreements-share-distribution",
        icon: <Icon fontSize="small">pie_chart</Icon>,
        route: "/contracts/share-distribution",
        component: <ShareDistribution />,
      },
    ],
  },
  {
    type: "collapse",
    name: "Accounts",
    key: "accounts",
    icon: <Icon fontSize="small">account_balance_wallet</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Inst Bank Accts",
        key: "accounts-bank-accounts",
        icon: <Icon fontSize="small">account_balance</Icon>,
        route: "/accounts/bank-accounts",
        component: <BankAccounts />,
      },
    ],
  },
  {
    type: "collapse",
    name: "Cash & Fund Flow",
    key: "cash-fund-flow",
    icon: <Icon fontSize="small">account_balance_wallet</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Payments",
        key: "payments",
        excludeFromAssignRights: true,
        icon: <Icon fontSize="small">payments</Icon>,
        route: "/payments",
        component: <Payments />,
      },
      {
        type: "collapse",
        name: "Receipts",
        key: "receipts",
        excludeFromAssignRights: true,
        icon: <Icon fontSize="small">receipt_long</Icon>,
        route: "/receipts",
        component: <Receipts />,
      },
    ],
  },
  {
    type: "collapse",
    name: "Purchases",
    key: "purchases",
    icon: <Icon fontSize="small">shopping_cart</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Supplier",
        key: "supplier",
        excludeFromAssignRights: true,
        icon: <Icon fontSize="small">local_shipping</Icon>,
        route: "/supplier",
        component: <Supplier />,
      },
    ],
  },
  {
    type: "collapse",
    name: "Sales",
    key: "sales",
    icon: <Icon fontSize="small">point_of_sale</Icon>,
    collapse: [
      {
        type: "collapse",
        name: "Customer",
        key: "customer",
        excludeFromAssignRights: true,
        icon: <Icon fontSize="small">people</Icon>,
        route: "/customer",
        component: <Customer />,
      },
    ],
  },
];

export default routes;
