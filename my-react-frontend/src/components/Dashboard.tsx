// Dashboard.jsx
import React from "react";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import useAuth from "./useAuth";

const Dashboard = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" style={{ marginTop: "2rem" }}>
        <Paper elevation={3} style={{ padding: "2rem" }}>
          <Typography variant="h4" gutterBottom>
            Update Management Dashboard
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate("/assign-update")}
            >
              Assign Updates
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => navigate("/add-update")}
            >
              Add New Update
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate("/view-status")}
            >
              View Update Status
            </Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default Dashboard;
