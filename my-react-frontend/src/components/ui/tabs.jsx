import React, { useState } from "react";

export const Tabs = ({ value, onValueChange, children }) => {
  const [activeTab, setActiveTab] = useState(value);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    onValueChange(tab);
  };

  return (
    <div>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { activeTab, handleTabChange })
      )}
    </div>
  );
};

export const TabsList = ({ children, activeTab, handleTabChange }) => (
  <div className="flex space-x-4 border-b">
    {React.Children.map(children, (child) =>
      React.cloneElement(child, { activeTab, handleTabChange })
    )}
  </div>
);

export const TabsTrigger = ({
  value,
  activeTab,
  handleTabChange,
  children,
}) => (
  <button
    onClick={() => handleTabChange(value)}
    className={`py-2 px-4 ${
      activeTab === value ? "border-b-2 border-blue-600" : "text-gray-600"
    }`}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, activeTab, children }) =>
  activeTab === value && <div className="py-4">{children}</div>;
