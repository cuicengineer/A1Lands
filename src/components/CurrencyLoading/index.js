/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import React from "react";
import PropTypes from "prop-types";
import { Box, keyframes } from "@mui/material";
import MDBox from "components/MDBox";

const createFallingAnimation = (distance) => keyframes`
  0% {
    transform: translate(-50%, -100%) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, ${distance}px) rotate(360deg);
    opacity: 0;
  }
`;

function CurrencyLoading({ size = 40 }) {
  const currencySymbols = ["$", "₹", "€", "£", "¥"];
  const numCoins = 5;
  const containerHeight = size * 1.5;
  const fallingAnimation = createFallingAnimation(containerHeight);

  return (
    <MDBox
      position="relative"
      width={size}
      height={containerHeight}
      display="flex"
      justifyContent="center"
      alignItems="flex-start"
      overflow="hidden"
    >
      {Array.from({ length: numCoins }).map((_, index) => {
        const delay = index * 0.2;
        const symbol = currencySymbols[index % currencySymbols.length];
        const animationDuration = 1.5 + index * 0.1;

        return (
          <Box
            key={index}
            sx={{
              position: "absolute",
              left: "50%",
              fontSize: `${size * 0.4}px`,
              fontWeight: "bold",
              color: "#1976d2",
              animation: `${fallingAnimation} ${animationDuration}s ease-in-out infinite`,
              animationDelay: `${delay}s`,
              opacity: 0.8,
            }}
          >
            {symbol}
          </Box>
        );
      })}
    </MDBox>
  );
}

// Setting default values for the props of CurrencyLoading
CurrencyLoading.defaultProps = {
  size: 40,
};

// Typechecking props for the CurrencyLoading
CurrencyLoading.propTypes = {
  size: PropTypes.number,
};

export default CurrencyLoading;
