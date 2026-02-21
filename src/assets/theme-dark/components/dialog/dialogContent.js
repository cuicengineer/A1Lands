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

// Material Dashboard 2 React base styles
import typography from "assets/theme-dark/base/typography";
import borders from "assets/theme-dark/base/borders";
import colors from "assets/theme-dark/base/colors";

// Material Dashboard 2 React helper functions
import pxToRem from "assets/theme-dark/functions/pxToRem";
import rgba from "assets/theme-dark/functions/rgba";

const { size } = typography;
const { white } = colors;
const { borderWidth, borderColor } = borders;

const dialogContent = {
  styleOverrides: {
    root: {
      padding: pxToRem(16),
      fontSize: size.md,
      color: "#000000", // Black text for better readability in dialogs
      backgroundColor: "#ffffff", // White background for dialogs
      "& .MuiInputLabel-root": {
        color: "#000000 !important", // Black labels
      },
      "& .MuiInputBase-input": {
        color: "#000000 !important", // Black input text
      },
      "& .MuiSelect-select": {
        color: "#000000 !important", // Black select text
      },
      "& .MuiTypography-root": {
        color: "#000000 !important", // Black typography
      },
      "& .MuiFormLabel-root": {
        color: "#000000 !important", // Black form labels
      },
      "& .MuiFormHelperText-root": {
        color: "#000000 !important", // Black helper text
      },
    },

    dividers: {
      borderTop: `${borderWidth[1]} solid ${rgba(borderColor, 0.6)}`,
      borderBottom: `${borderWidth[1]} solid ${rgba(borderColor, 0.6)}`,
    },
  },
};

export default dialogContent;
