const express = require('express');
const axios = require('axios');
require('dotenv').config()


const app = express();
const port = 3000;

app.use(express.json());

let accessToken = null;
let refreshToken = null;


// Function to get a new access token using the refresh token
const refreshAccessToken = async () => {
  try {
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.heelachterhoekwerkt.nl/api/ExternalApplication/ExternalAppLogin',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : JSON.stringify({
            "ApplicationId": process.env.APPLICATION_ID,
            "Password": process.env.PASSWORD
          })
      };
    const refreshResponse = await axios.request(config);


    if (refreshResponse.data.result == true) {
      accessToken = refreshResponse.data.token;
      refreshToken = refreshResponse.data.refreshToken;
      return true;
    }
    return false;
  } catch (error) {
    logError('Error refreshing token:' + error);
    return false;
  }
};

// Middleware to check if the access token is available and refresh if necessary
const checkAccessToken = async (req, res, next) => {
  if (!accessToken) {
    // If no access token, try to refresh
    const success = await refreshAccessToken();
    if (!success) {
      return res.status(401).json({ success: false, message: 'Unable to refresh access token' });
    }
  }
  next();
};

// Homepage route
app.get('/', async (req, res) => {
  logError(req.body)
    // res.send('<h1>Heel Oost Nederland Werkt</h1>')
});


// Route to handle leadInfo and make API requests
app.post('/submitLead', checkAccessToken, async (req, res) => {
    try {
      // Ensure that leadInfo is present in the request body
      if (!req.body.leadInfo) {
        return res.status(400).json({ success: false, message: 'Missing leadInfo in the request body' });
      }
  
      // Extract leadInfo from the request body
      const { leadInfo } = req.body;
  
      // Make a POST request to submit the lead
      const leadResponse = await axios.post('https://api.heelachterhoekwerkt.nl/api/ExternalApplication/PostNewLead', leadInfo, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      // Handle the lead submission response
      if (leadResponse.data.result == true) {
        res.status(200).json({ success: true, message: 'Lead submitted successfully' });
      } else if (leadResponse.status === 401) {
        // If the access token is not valid, try to refresh and retry
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          // Retry the lead submission
          const retryResponse = await axios.post('https://api.heelachterhoekwerkt.nl/api/ExternalApplication/PostNewLead', leadInfo, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
  
          if (retryResponse.data.result == true) {
            res.status(200).json({ success: true, message: 'Lead submitted successfully after token refresh' });
          } else {
            res.status(500).json({ success: false, message: 'Failed to submit lead after token refresh' });
          }
        } else {
          res.status(500).json({ success: false, message: 'Failed to refresh token and submit lead' });
        }
      } else {
        res.status(500).json({ success: false, message: 'Failed to submit lead' });
      }
    } catch (error) {
      logError('Error: ' + error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  
  const logError = (errorMessage) => {
    const errorFilePath = 'error.txt';
    const timestamp = new Date().toISOString();
  
    fs.appendFile(errorFilePath, `${timestamp}: ${errorMessage}\n`, (err) => {
      if (err) {
        console.error('Error writing to error file:', err.message);
      }
    });
  };
// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
