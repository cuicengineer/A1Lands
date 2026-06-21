import React from "react";
import ListSubheader from "@mui/material/ListSubheader";
import Divider from "@mui/material/Divider";

const ALWAYS_VISIBLE_VALUES = new Set(["", "__add__"]);

export function getMenuItemText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getMenuItemText).join(" ");
  if (!React.isValidElement(node)) return "";
  return getMenuItemText(node.props?.children);
}

export function isStructuralMenuChild(child) {
  if (!React.isValidElement(child)) return false;
  return child.type === ListSubheader || child.type === Divider;
}

export function shouldAlwaysShowMenuItem(child) {
  if (!React.isValidElement(child)) return false;

  const value = child.props?.value;
  if (ALWAYS_VISIBLE_VALUES.has(value)) return true;

  const text = getMenuItemText(child.props?.children ?? child).toLowerCase();
  if (value === "" || value === null || value === undefined) {
    if (text.includes("select") || text.includes("none") || text.includes("all") || text === "") {
      return true;
    }
  }

  return false;
}

export function filterMenuChildren(children, searchTerm) {
  const term = (searchTerm || "").toLowerCase().trim();
  const items = React.Children.toArray(children);

  if (!term) return items;

  return items.filter((child) => {
    if (!React.isValidElement(child)) return true;
    if (isStructuralMenuChild(child)) return false;
    if (shouldAlwaysShowMenuItem(child)) return true;
    return getMenuItemText(child.props?.children ?? child)
      .toLowerCase()
      .includes(term);
  });
}

export function countSelectableMenuItems(children) {
  return React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && !isStructuralMenuChild(child)
  ).length;
}

export function mergeSearchableMenuProps(menuProps, searchable) {
  if (!searchable) return menuProps;

  const baseMenuProps = menuProps ?? {};
  const paperProps = baseMenuProps.PaperProps ?? {};
  const menuListProps = baseMenuProps.MenuListProps ?? {};

  return {
    ...baseMenuProps,
    autoFocus: false,
    PaperProps: {
      ...paperProps,
      style: {
        maxHeight: 300,
        ...(paperProps.style ?? {}),
      },
    },
    MenuListProps: {
      ...menuListProps,
      autoFocusItem: false,
    },
  };
}
