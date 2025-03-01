import React from "react";

export const Select = ({ children }) => <div>{children}</div>;

export const SelectTrigger = ({ children, className }) => (
  <button className={`p-2 border rounded-md ${className}`}>{children}</button>
);

export const SelectValue = ({ children }) => <span>{children}</span>;

export const SelectContent = ({ children }) => (
  <div className="absolute mt-2 border rounded-md bg-white shadow-lg">
    {children}
  </div>
);

export const SelectItem = ({ children, onClick }) => (
  <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={onClick}>
    {children}
  </div>
);
