const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let accessToken = null;
let refreshToken = null;

// Function to get a new access token using the refresh token
const refreshAccessToken = async () => {
  try {
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.heelachterhoekwerkt.nl/api/ExternalApplication/ExternalAppLogin",
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        ApplicationId: process.env.APPLICATION_ID,
        Password: process.env.PASSWORD,
      }),
    };
    const refreshResponse = await axios.request(config);

    if (refreshResponse.data.result == true) {
      accessToken = refreshResponse.data.token;
      refreshToken = refreshResponse.data.refreshToken;
      return true;
    }
    return false;
  } catch (error) {
    logError("Error refreshing token:" + error);
    return false;
  }
};

// Middleware to check if the access token is available and refresh if necessary
const checkAccessToken = async (req, res, next) => {
  if (!accessToken) {
    // If no access token, try to refresh
    const success = await refreshAccessToken();
    if (!success) {
      return res
        .status(401)
        .json({ success: false, message: "Unable to refresh access token" });
    }
  }
  next();
};

// Homepage route
app.get("/", async (req, res) => {
  logError(req.body);
  // res.send('<h1>Heel Oost Nederland Werkt</h1>')
});

// Route to handle leadInfo and make API requests
app.post("/submitLead", checkAccessToken, async (req, res) => {
  try {
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.heelachterhoekwerkt.nl/api/ExternalApplication/PostNewLead",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: JSON.stringify({
        firstName: "Tyco",
        lastName: "van der Steen",
        phoneNumber: "0123456789",
        emailAddress: "tyco@futureready.design",
        question: "Ik ben de api aan het testen",
        campaignCode: "2023-0003",
        medium: "YOUTUBE",
      }),
    };

    // Make a POST request to submit the lead
    const leadResponse = await axios.request(config);

    // Handle the lead submission response
    if (leadResponse.data.result == true) {
      res
        .status(200)
        .json({ success: true, message: "Lead submitted successfully" });
    } else if (leadResponse.status === 401) {
      // If the access token is not valid, try to refresh and retry
      const refreshSuccess = await refreshAccessToken();
      if (refreshSuccess) {
        // Retry the lead submission
        let config = {
          method: "post",
          maxBodyLength: Infinity,
          url: "https://api.heelachterhoekwerkt.nl/api/ExternalApplication/PostNewLead",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          data: JSON.stringify({
            firstName: "Tyco",
            lastName: "van der Steen",
            phoneNumber: "0123456789",
            emailAddress: "tyco@futureready.design",
            question: "Ik ben de api aan het testen",
            campaignCode: "2023-0003",
            medium: "YOUTUBE",
          }),
        };

        // Make a POST request to submit the lead
        const retryResponse = await axios.request(config);

        if (retryResponse.data.result == true) {
          res
            .status(200)
            .json({
              success: true,
              message: "Lead submitted successfully after token refresh",
            });
        } else {
          res
            .status(500)
            .json({
              success: false,
              message: "Failed to submit lead after token refresh",
            });
        }
      } else {
        res
          .status(500)
          .json({
            success: false,
            message: "Failed to refresh token and submit lead",
          });
      }
    } else {
      res
        .status(500)
        .json({ success: false, message: "Failed to submit lead" });
    }
  } catch (error) {
    logError("Error: " + error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const logError = (errorMessage) => {
  const errorFilePath = "error.txt";
  const timestamp = new Date().toISOString();

  fs.appendFile(errorFilePath, `${timestamp}: ${errorMessage}\n`, (err) => {
    if (err) {
      console.error("Error writing to error file:", err.message);
    }
  });
};
// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
