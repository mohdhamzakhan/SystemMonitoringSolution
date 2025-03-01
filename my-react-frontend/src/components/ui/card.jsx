import React from "react";

export const Card = ({ children, className }) => (
  <div className={`rounded-lg shadow-md p-4 bg-white ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children }) => (
  <div className="border-b pb-2 mb-2">{children}</div>
);

export const CardContent = ({ children }) => <div>{children}</div>;

export const CardTitle = ({ children }) => (
  <h2 className="text-lg font-bold">{children}</h2>
);
