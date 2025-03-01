import { useEffect, useState } from "react";
import "./App.css";
import Application from "./components/Application.tsx";

function App() {
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    let savedMode = localStorage.getItem("displayMode");
    if (!savedMode) {
      savedMode = "light";
      setDarkMode(false);
      localStorage.setItem("displayMode", savedMode);
    }
    setDarkMode(savedMode === "dark" ? true : false);
  }, []);

  const toggleDisplayMode = () => {
    setDarkMode(!darkMode);
  };
  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="App dark:bg-gray-700">
        <div>
          {/* <button
            onClick={() => {
              toggleDisplayMode();
            }}
            className="bg-gray-700 text-gray-100 border font-bold p-3 rounded-lg dark:bg-gray-100 dark:text-gray-700 transition duration-300"
          >
            {darkMode ? "Set To Light" : "Set To Dark"}
          </button> */}
        </div>
        <Application />
      </div>
    </div>
  );
}

export default App;
